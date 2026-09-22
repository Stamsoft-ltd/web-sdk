<script lang="ts">
	import { onMount } from 'svelte';
	import { dev } from '$app/environment';
	import {
		stateBet,
		stateBetDerived,
		stateConfig,
		stateModal,
		stateUrlDerived,
	} from 'state-shared';
	import { formatWalletAmount, formatWinAmount } from 'utils-shared/currency';
	import { COSTS, PAYS, SYMBOLS, type Mode, type Bet } from '../game/contract';
	import { gameActor } from '../game/actor';
	import { initMetadata } from '../game/metadata';
	import {
		runtime,
		playEvents,
		resetRound,
		cancelPlayback,
		continuePresentation,
		requestSkip,
		speedChanged,
	} from '../game/playback.svelte';
	import { gatesStakeState, gatesStakeDerived } from '../state/gatesStake.svelte';
	import { t } from '../i18n';
	import Board from './Board.svelte';
	import CountUp from './CountUp.svelte';
	import { selectedSpeed, nextSpeed } from '../game/uiPolicy';
	import TempleGate from './TempleGate.svelte';
	import Symbol from './Symbol.svelte';
	import Icon from './Icon.svelte';
	import Modal from './Modal.svelte';
	let { demo = false }: { demo?: boolean } = $props();
	initMetadata();
	let idle = $state(false),
		ready = $state(false),
		entered = $state(false),
		pending = $state(false);
	let modal = $state<null | 'features' | 'rules' | 'settings' | 'auto'>(null);
	let selected = $state<Mode | null>(null);
	let autoCount = $state(10),
		lossLimit = $state(10),
		winLimit = $state(100);
	let sessionSeconds = $state(0),
		openingBalance = $state(0);
	let inFlight = $state(false);
	let stageViewport: HTMLElement, stageContent: HTMLElement;
	let leftHud: HTMLElement, boardArea: HTMLElement;
	let stageScale = $state(1);
	let leftHudShift = $state(0);
	const speed = $derived(selectedSpeed(stateBet, stateConfig.jurisdiction));
	function changeSpeed() {
		if (!canChangeSpeed) return;
		const previous = speed;
		const next = nextSpeed(speed, stateConfig.jurisdiction);
		stateBet.isTurbo = next === 'fast';
		stateBet.isSuperTurbo = next === 'turbo';
		speedChanged(previous);
	}

	const replay = $derived(gatesStakeDerived.isReplayMode());
	const mode = $derived(
		(stateBet.activeBetModeKey.toUpperCase() in COSTS
			? stateBet.activeBetModeKey.toUpperCase()
			: 'BASE') as Mode,
	);
	const busy = $derived(!idle || runtime.busy || inFlight);
	const canPlay = $derived(
		ready &&
			entered &&
			!busy &&
			!pending &&
			!replay &&
			!modal &&
			!selected &&
			!runtime.overlay &&
			!runtime.error &&
			!stateModal.modal,
	);
	// A busy round locks wagers, not presentation controls. Bonus play uses the same HUD.
	const canChangeSpeed = $derived(
		ready &&
			entered &&
			!pending &&
			!modal &&
			!selected &&
			!runtime.overlay &&
			!runtime.error &&
			!stateModal.modal &&
			!stateConfig.jurisdiction.disabledTurbo,
	);
	const money = (n: number) => formatWalletAmount(stateBet.currency, n);
	const winnings = (n: number) =>
		formatWinAmount(stateBet.currency, (stateBet.wageredBetAmount * n) / 100);
	const errorMessage = $derived(
		runtime.error ||
			(stateModal.modal?.name === 'error'
				? String(
						(stateModal.modal.error as { message?: string; error?: string })?.message ||
							(stateModal.modal.error as { error?: string })?.error ||
							t('ERROR'),
					)
				: ''),
	);
	const tiers = ['normal', 'super', 'hidden'];
	const title = $derived(runtime.game.tier ? t(runtime.game.tier.toUpperCase()) : t('BASE'));
	const selectedCost = $derived(selected ? stateBet.betAmount * COSTS[selected] : 0);
	const rewardText = $derived.by(() => {
		const r = runtime.game.reward;
		if (!r) return '';
		if ('value' in r) return `${r.kind === 'addMultiplier' ? '+' : '×'}${r.value}×`;
		if (r.kind === 'stickyWild') return t('STICKY WILD');
		return `+${'spinsAdded' in r ? r.spinsAdded : 0} ${t('FREE SPINS')}`;
	});
	function reload() {
		location.reload();
	}
	function stepBet(direction: number) {
		if (!canPlay) return;
		const levels = stateConfig.betAmountOptions;
		const index = levels.indexOf(stateBet.betAmount);
		const next = levels[Math.max(0, Math.min(levels.length - 1, index + direction))];
		if (next !== undefined) stateBetDerived.setBetAmount(next);
	}
	async function spin(force = false) {
		if (
			(!canPlay && !force) ||
			busy ||
			inFlight ||
			pending ||
			replay ||
			runtime.error ||
			stateModal.modal
		)
			return;
		if (!demo && !stateBetDerived.isBetCostAvailable()) return;
		inFlight = true;
		if (dev && demo) {
			try {
				stateBet.wageredBetAmount = stateBet.betAmount;
				resetRound();
				const { previewEvents } = await import('../game/preview');
				await playEvents(previewEvents(mode), true);
				if (['BONUS', 'SUPER', 'MYSTERY'].includes(mode)) stateBet.activeBetModeKey = 'BASE';
			} catch (error) {
				runtime.error = String(error);
			} finally {
				inFlight = false;
			}
		} else {
			gameActor.send({ type: 'BET' });
			inFlight = false;
		}
	}
	function choose(key: Mode) {
		if (busy || pending || replay || stateConfig.jurisdiction.disabledBuyFeature) return;
		modal = null;
		if ((key === 'CHANCE' || key === 'FEATURE') && mode === key) {
			stateBet.activeBetModeKey = 'BASE';
		} else if (COSTS[key] <= 5) {
			stateBet.activeBetModeKey = key;
		} else {
			selected = key;
		}
	}
	function confirm() {
		if (
			!selected ||
			busy ||
			replay ||
			pending ||
			stateConfig.jurisdiction.disabledBuyFeature ||
			(!demo && selectedCost > stateBet.balanceAmount)
		)
			return;
		const next = selected;
		stateBet.activeBetModeKey = next;
		selected = null;
		if (['BONUS', 'SUPER', 'MYSTERY'].includes(next)) void spin(true);
	}
	function resume() {
		if (busy || !stateBet.betToResume) return;
		pending = false;
		entered = true;
		stateBet.activeBetModeKey = String(stateBet.betToResume.mode || 'BASE');
		gameActor.send({ type: 'RESUME_BET' });
	}
	function startReplay() {
		if (busy || !gatesStakeState.replaySnapshot) return;
		const bet = gatesStakeDerived.cloneReplayBet(gatesStakeState.replaySnapshot);
		if (!bet) return;
		stateBet.betToResume = { ...bet, event: '0', active: true };
		gatesStakeDerived.requestReplayStart();
		entered = true;
		gameActor.send({ type: 'RESUME_BET' });
	}
	function autoStart() {
		if (busy || replay || demo || pending || stateConfig.jurisdiction.disabledAutoplay) return;
		stateBet.autoSpinsCounter = autoCount;
		stateBet.autoSpinsLossLimitAmount = lossLimit;
		stateBet.autoSpinsSingleWinLimitAmount = winLimit;
		modal = null;
		gameActor.send({ type: 'AUTO_BET' });
	}
	function keydown(e: KeyboardEvent) {
		if (e.code !== 'Space') return;
		// Like the studio hotkey: HUD button focus must not turn Space into another click.
		if ((e.target as HTMLElement).closest('input,select,textarea,[contenteditable="true"]')) return;
		if ((e.target as HTMLElement).closest('dialog') && !runtime.overlay) return;
		e.preventDefault();
		if (e.repeat || stateConfig.jurisdiction.disabledSpacebar) return;
		if (runtime.waiting) continuePresentation();
		else if (runtime.busy && !modal && !selected && !stateModal.modal) requestSkip();
		else if (canPlay) void spin();
	}
	async function fullscreen() {
		try {
			if (document.fullscreenElement) await document.exitFullscreen();
			else await document.documentElement.requestFullscreen();
		} catch {
			/* Browser may not support fullscreen. */
		}
	}
	onMount(() => {
		const fitStage = () => {
			if (!stageViewport || !stageContent) return;
			const scale = Math.min(
				1,
				stageViewport.clientHeight / Math.max(1, stageContent.offsetHeight),
				stageViewport.clientWidth / Math.max(1, stageContent.offsetWidth),
			);
			stageScale = scale;
			if (leftHud && boardArea && scale > 0) {
				// The grid is centered and scaled; center the HUD in the actual screen-to-board gap.
				// Use untransformed offsets so the HUD's own translation cannot feed back into fitting.
				const stageLeft =
					stageViewport.getBoundingClientRect().left +
					(stageViewport.clientWidth - stageContent.offsetWidth * scale) / 2;
				const boardLeft = stageLeft + boardArea.offsetLeft * scale;
				const hudCenter = stageLeft + (leftHud.offsetLeft + leftHud.offsetWidth / 2) * scale;
				leftHudShift = (boardLeft / 2 - hudCenter) / scale;
			}
		};
		const stageObserver = new ResizeObserver(fitStage);
		stageObserver.observe(stageViewport);
		stageObserver.observe(stageContent);
		fitStage();
		const subscription = gameActor.subscribe({
			next: (snapshot) => {
				idle = snapshot.value === 'idle';
				gatesStakeDerived.syncReplayStatus(idle);
			},
			error: (error) => {
				runtime.error = String(error);
				stateBet.autoSpinsCounter = 0;
			},
		});
		gameActor.start();
		gameActor.send({ type: 'RENDERED' });
		if (dev && demo) {
			stateBet.balanceAmount = 10000;
			stateConfig.betAmountOptions = [0.1, 0.2, 0.5, 1, 2, 5, 10];
			stateBet.betAmount = 1;
			stateBet.wageredBetAmount = 1;
		}
		openingBalance = stateBet.balanceAmount;
		pending = !replay && Boolean(stateBet.betToResume?.active);
		if (replay) {
			entered = true;
			gatesStakeDerived.captureReplaySnapshot(stateBet.betToResume);
		}
		const motion = matchMedia('(prefers-reduced-motion: reduce)');
		runtime.reduced = motion.matches;
		const onMotion = () => {
			runtime.reduced = motion.matches;
		};
		motion.addEventListener('change', onMotion);
		const timer = setInterval(() => sessionSeconds++, 1000);
		let disposed = false;
		Promise.all(
			['scene-base', 'scene-normal', 'scene-super', 'scene-hidden', 'gate-doors', 'symbols'].map(
				(name) =>
					new Promise<void>((resolve, reject) => {
						const img = new Image();
						img.onload = () => resolve();
						img.onerror = () => reject(new Error(`Artwork unavailable: ${name}`));
						img.src = `./assets/the-gates/${name}.png`;
					}),
			),
		)
			.then(() => {
				if (!disposed) ready = true;
			})
			.catch((error) => {
				if (!disposed) runtime.error = String(error);
			});
		// Decorative idle arrangement; never evaluated or used to determine any outcome.
		runtime.game.board = Array.from({ length: 6 }, (_, c) =>
			Array.from({ length: 5 }, (_, r) => ({ name: SYMBOLS[(c * 3 + r * 2) % 10] })),
		);
		return () => {
			disposed = true;
			clearInterval(timer);
			motion.removeEventListener('change', onMotion);
			cancelPlayback();
			stateBet.autoSpinsCounter = 0;
			stageObserver.disconnect();
			subscription.unsubscribe();
			gameActor.stop();
		};
	});
</script>

<svelte:window onkeydown={keydown} />
<svelte:head
	><meta
		name="description"
		content="The Gates — an ancient temple, cascading jewels and gates of power."
	/></svelte:head
>
<main
	class="temple"
	class:reduced={runtime.reduced}
	class:quick={speed !== 'normal'}
	class:turbo={speed === 'turbo'}
	class:normal-tier={runtime.game.tier === 'normal'}
	class:super-tier={runtime.game.tier === 'super'}
	class:hidden-tier={runtime.game.tier === 'hidden'}
>
	<TempleGate {rewardText} />
	<div class="ambient" aria-hidden="true">
		{#each Array(12) as _, i}<i style={`--i:${i}`}></i>{/each}
	</div>
	<header class="topbar">
		<img class="studio-mark" src="./assets/the-gates/press_play_logo.webp" alt="Press Play" />
	</header>
	<section class="game-stage" bind:this={stageViewport} aria-label="The Gates game">
		<div
			class="stage-content"
			bind:this={stageContent}
			style={`transform:scale(${stageScale});--left-hud-shift:${leftHudShift}px`}
		>
			<aside class="left-hud" bind:this={leftHud}>
				<div class="meter-panel">
					<div class="eyebrow">{t('CASCADE')}</div>
					<div class="meter-orbs" aria-label={`${runtime.game.progress} / 3`}>
						{#each [1, 2, 3] as n}<span class:lit={runtime.game.progress >= n}>{n}</span>{/each}
					</div>
					<p>{t('GATE HINT')}</p>
				</div>
				<div class="multiplier-panel">
					<div class="eyebrow">{t('MULTIPLIER')}</div>
					{#key runtime.game.multiplier}<strong class="multiplier-value"
							>{runtime.game.multiplier}<em>×</em></strong
						>{/key}
					<div class="gold-divider">◆</div>
					<span>{runtime.game.tier ? t('TOTAL WIN') : t('RAW WIN')}</span><b
						>{winnings(runtime.game.tier ? runtime.game.total : runtime.game.raw)}</b
					>
				</div>
				{#if runtime.game.tier}<div class="free-spins">
						<span>{t('FREE SPINS')}</span><strong
							>{runtime.game.freeSpin}<small> / {runtime.game.totalFs}</small></strong
						><small>{runtime.game.remaining} {t('REMAINING')}</small>
					</div>{:else}<div class="max-plaque">
						<span>{t('MAX WIN')}</span><strong>25,000×</strong>
					</div>{/if}
			</aside>
			<div class="board-area" bind:this={boardArea}>
				<div class="board-heading">
					<div class="wordmark">
						<span>THE</span>
						<h1>GATES</h1>
					</div>
					{#if runtime.game.tier}<p class="bonus-mode-label">{title}</p>{/if}
				</div>
				<Board />
				<div class="board-caption" aria-live="polite">
					{#if runtime.phase === 'winning'}{t('RAW WIN')}
						<b>{winnings(runtime.game.raw)}</b
						>{:else if runtime.phase === 'settling' && runtime.game.spinWin}{t('SPIN WIN')}
						<b>{winnings(runtime.game.spinWin)}</b>{:else}{t('HINT')}{/if}
				</div>
			</div>
			<div class="gate-space" aria-hidden="true"></div>
		</div>
	</section>
	<footer class="control-deck">
		<div class="hud-left">
			<div class="hud-utilities">
				<button
					class="icon-button"
					aria-label={t('PAYTABLE')}
					disabled={busy || !entered}
					onclick={() => (modal = 'rules')}><Icon name="info" /></button
				><button
					class="icon-button"
					aria-label={t('SETTINGS')}
					disabled={busy || !entered}
					onclick={() => (modal = 'settings')}><Icon name="settings" /></button
				>
			</div>
			<button
				class="feature-button"
				hidden={stateConfig.jurisdiction.disabledBuyFeature}
				disabled={!canPlay || stateConfig.jurisdiction.disabledBuyFeature}
				onclick={() => {
					if (mode === 'CHANCE' || mode === 'FEATURE') stateBet.activeBetModeKey = 'BASE';
					else modal = 'features';
				}}
				><Icon name="gate" /><span
					>{mode === 'CHANCE' || mode === 'FEATURE' ? t('DEACTIVATE') : t('FEATURES')}<small
						>{mode === 'BASE'
							? '15 ' + t('FREE SPINS')
							: t(mode) + ' · ' + COSTS[mode] + '×'}</small
					></span
				></button
			>
		</div>
		<div class="hud-metrics">
			<div class="wallet">
				<span>{t('BALANCE')}</span><strong>{money(stateBet.balanceAmount)}</strong>
			</div>
			<div class="win-display" aria-live="polite">
				<span>{t('WIN')}</span><strong>{winnings(runtime.game.total)}</strong>
			</div>
			<div class="bet-control">
				<div>
					<span>{t('BET')}</span><strong>{money(stateBet.betAmount)}</strong
					>{#if COSTS[mode] > 1}<small>{t('COST')} {money(stateBet.betAmount * COSTS[mode])}</small
						>{/if}
				</div>
			</div>
		</div>
		<div class="spin-actions">
			<div class="bet-stepper">
				<button
					class="icon-button"
					aria-label={`${t('BET')} −`}
					disabled={!canPlay || stateBet.betAmount <= stateConfig.betAmountOptions[0]}
					onclick={() => stepBet(-1)}><Icon name="minus" /></button
				>
				<button
					class="icon-button"
					aria-label={`${t('BET')} +`}
					disabled={!canPlay || stateBet.betAmount >= stateConfig.betAmountOptions.at(-1)!}
					onclick={() => stepBet(1)}><Icon name="plus" /></button
				>
			</div>
			<button
				class="spin-button"
				aria-label={stateBet.autoSpinsCounter ? t('STOP') : t('SPIN')}
				disabled={stateBet.autoSpinsCounter <= 0 &&
					(!canPlay || (!demo && !stateBetDerived.isBetCostAvailable()))}
				onclick={() => (stateBet.autoSpinsCounter > 0 ? (stateBet.autoSpinsCounter = 0) : spin())}
				><Icon name={stateBet.autoSpinsCounter ? 'stop' : 'spin'} /><span
					>{stateBet.autoSpinsCounter || t('SPIN')}</span
				></button
			>
			<button
				class="icon-button speed"
				hidden={stateConfig.jurisdiction.disabledTurbo}
				class:active={speed !== 'normal'}
				data-speed={speed}
				aria-label={`${t('SPEED')}: ${t('SPEED ' + speed.toUpperCase())}`}
				title={t('SPEED ' + speed.toUpperCase())}
				aria-pressed={speed !== 'normal'}
				disabled={!canChangeSpeed}
				onclick={changeSpeed}
				><Icon name="speed" /><small>{t('SPEED ' + speed.toUpperCase())}</small></button
			><button
				class="icon-button"
				aria-label={t('AUTO')}
				hidden={stateConfig.jurisdiction.disabledAutoplay}
				disabled={!canPlay || demo || stateConfig.jurisdiction.disabledAutoplay}
				onclick={() => {
					lossLimit = stateBet.betAmount * COSTS[mode] * 10;
					winLimit = stateBet.betAmount * 100;
					modal = 'auto';
				}}><Icon name="auto" /></button
			>
		</div>
	</footer>
	<div class="status-line">
		<span>THE GATES <small>v1</small></span><span
			>{demo ? t('DEMO') : replay ? t('REPLAY') : mode === 'BASE' ? t('READY') : t(mode)}</span
		><span
			>{#if stateConfig.jurisdiction.displayRTP}{t('TARGET RTP')} 96.1%{/if}{#if stateConfig.jurisdiction.displaySessionTimer}
				· {t('SESSION')}
				{Math.floor(sessionSeconds / 60)}:{String(sessionSeconds % 60).padStart(
					2,
					'0',
				)}{/if}{#if stateConfig.jurisdiction.displayNetPosition}
				· {t('NET')} {money(stateBet.balanceAmount - openingBalance)}{/if}</span
		>
	</div>
</main>

{#if errorMessage}<Modal title={t('ERROR')} close={() => {}} locked
		><p class="error-copy">{errorMessage}</p>
		<p>{t('RESUME')}</p>
		<button class="gold-button" onclick={reload}>{t('RETRY')}</button></Modal
	>
{:else if !ready}<div
		class="loading-screen"
		style="--temple-art:url('./assets/the-gates/temple-backplate.png')"
	>
		<div class="wordmark">
			<span>THE</span>
			<h1>GATES</h1>
		</div>
		<div class="loading-line"></div>
	</div>
{:else if pending}<Modal title={t('RESUME')} close={() => {}} locked
		><p>{t('CONTINUE')}</p>
		<button class="gold-button" disabled={busy} onclick={resume}>{t('RESUME')}</button></Modal
	>
{:else if !entered}<div
		class="welcome"
		style="--temple-art:url('./assets/the-gates/temple-backplate.png')"
	>
		<div class="welcome-content">
			<div class="welcome-glyph"><Icon name="gate" /></div>
			<div class="wordmark">
				<span>THE</span>
				<h1>GATES</h1>
			</div>
			<p class="welcome-tagline">{t('INTRO')}</p>
			<div class="welcome-features">
				<div><strong>8+</strong><span>{t('HINT')}</span></div>
				<div><strong>3</strong><span>{t('GATE HINT')}</span></div>
				<div><strong>25,000×</strong><span>{t('MAX WIN')}</span></div>
			</div>
			<button class="gold-button enter" aria-label={t('CONTINUE')} onclick={() => (entered = true)}
				>{t('CONTINUE')} <span>→</span></button
			>{#if demo}<small>{t('DEMO')}</small>{/if}
		</div>
	</div>
{:else if runtime.overlay}<Modal
		presentation
		title={runtime.overlay.kind === 'bonus'
			? t(runtime.overlay.tier!.toUpperCase())
			: runtime.overlay.kind === 'summary'
				? t('BONUS COMPLETE')
				: runtime.overlay.kind === 'cap'
					? t('MAX WIN')
					: t('WIN')}
		close={() => {}}
		locked
		><div class="celebration">
			<div class="celebration-glyph"><Icon name="gate" /></div>
			{#if runtime.overlay.spins}<strong>{runtime.overlay.spins}</strong>
				<p>{t('FREE SPINS')}</p>{:else}{#key runtime.overlay}<CountUp
						amount={runtime.overlay?.amount ?? 0}
						format={winnings}
					/>{/key}{/if}<button
				class="gold-button"
				disabled={!runtime.waiting}
				onclick={continuePresentation}>{t('CONTINUE')}</button
			>
		</div></Modal
	>
{:else if replay && !busy}<Modal title={t('REPLAY')} close={() => {}} locked
		><div class="replay-details">
			<p>{gatesStakeDerived.modeTitle()} · {gatesStakeState.replayEventId}</p>
			<dl>
				<dt>{t('BET')}</dt>
				<dd>{money(gatesStakeDerived.replayBetAmount())}</dd>
				<dt>{t('TOTAL COST')}</dt>
				<dd>
					{money(gatesStakeDerived.replayCostAmount())} ({gatesStakeDerived.modeCostMultiplier()}×)
				</dd>
				<dt>{t('WIN')}</dt>
				<dd>
					{formatWinAmount(stateBet.currency, gatesStakeDerived.replayWinAmount())} ({gatesStakeDerived.replayPayoutMultiplier()}×)
				</dd>
			</dl>
		</div>
		<button class="gold-button" disabled={!gatesStakeState.replaySnapshot} onclick={startReplay}
			>{t('REPLAY EVENT')}</button
		></Modal
	>
{:else if selected}<Modal title={t(selected)} close={() => (selected = null)}
		><p>{t(`${selected} DESC`)}</p>
		<div class="confirm-price">
			<span>{t('TOTAL COST')}</span><strong>{money(selectedCost)}</strong><small
				>{COSTS[selected]}× {t('BET')}</small
			>
		</div>
		<p>
			{['BONUS', 'SUPER', 'MYSTERY'].includes(selected) ? t('BUY NOTE') : t(`${selected} DESC`)}
		</p>
		<div class="modal-actions">
			<button class="quiet-button" onclick={() => (selected = null)}>{t('CANCEL')}</button><button
				class="gold-button"
				disabled={!demo && selectedCost > stateBet.balanceAmount}
				onclick={confirm}>{t('CONFIRM')}</button
			>
		</div></Modal
	>
{:else if modal === 'features'}<Modal title={t('FEATURES')} close={() => (modal = null)} wide
		><div class="mode-cards">
			{#each ['CHANCE', 'FEATURE', 'BONUS', 'SUPER', 'MYSTERY'] as key}<button
					class="mode-card"
					class:rare={key === 'MYSTERY'}
					onclick={() => choose(key as Mode)}
					data-mode={key}
					aria-pressed={key === 'CHANCE' || key === 'FEATURE' ? mode === key : undefined}
					disabled={!demo &&
						stateBet.betAmount * COSTS[key as Mode] > stateBet.balanceAmount &&
						mode !== key}
					><div class="mode-art">
						{#if key === 'BONUS' || key === 'SUPER' || key === 'MYSTERY'}
							<div
								class="card-door"
								style="background-image:url('./assets/the-gates/gate-doors.png')"
								data-skin={key}
								aria-hidden="true"
							></div>
						{:else}<Symbol
								name={key === 'CHANCE' ? 'SACRED_EYE' : 'SUN_MEDALLION'}
								decorative
							/>{/if}
					</div>
					<div>
						<h3>{t(key)}</h3>
						<p>{t(`${key} DESC`)}</p>
						<strong
							>{COSTS[key as Mode]}×
							<span>{money(stateBet.betAmount * COSTS[key as Mode])}</span></strong
						>
					</div></button
				>{/each}
		</div>
		{#if mode !== 'BASE'}<button
				class="quiet-button"
				onclick={() => {
					stateBet.activeBetModeKey = 'BASE';
					modal = null;
				}}>{t('DEACTIVATE')}</button
			>{/if}</Modal
	>
{:else if modal === 'rules'}<Modal title={t('PAYTABLE')} close={() => (modal = null)}
		><p>{t('RULES')}</p>
		<p>{t('KEY RULE')}</p>
		<table class="paytable">
			<thead><tr><th>{t('PAYTABLE')}</th><th>8–9</th><th>10–11</th><th>12+</th></tr></thead><tbody
				>{#each PAYS as pays, i}<tr
						><th
							><div class="pay-symbol">
								<Symbol name={SYMBOLS[i]} decorative /><span>{SYMBOLS[i].replaceAll('_', ' ')}</span
								>
							</div></th
						>{#each pays as pay}<td>{pay}×</td>{/each}</tr
					>{/each}</tbody
			>
		</table>
		<p>{t('PAYS NOTE')}</p>
		<p>{t('CAP RULE')}</p>
		<p>{t('MYSTERY DESC')}</p>
		<p class="notice">{t('UNVALIDATED')}</p></Modal
	>
{:else if modal === 'settings'}<Modal title={t('SETTINGS')} close={() => (modal = null)}
		><label class="setting-row"
			><span>{t('REDUCED MOTION')}</span><input
				type="checkbox"
				bind:checked={runtime.reduced}
			/></label
		>{#if !stateConfig.jurisdiction.disabledFullscreen}<button
				class="quiet-button"
				onclick={fullscreen}>{t('FULLSCREEN')}</button
			>{/if}
		<p class="notice">{t('UNVALIDATED')}</p></Modal
	>
{:else if modal === 'auto'}<Modal title={t('AUTO')} close={() => (modal = null)}
		><label class="setting-row"
			>{t('ROUND COUNT')}<select bind:value={autoCount}
				>{#each [10, 25, 50, 100] as n}<option value={n}>{n}</option>{/each}</select
			></label
		><label class="setting-row"
			>{t('LOSS LIMIT')}<input
				type="number"
				min={stateBet.betAmount}
				step="any"
				bind:value={lossLimit}
			/></label
		><label class="setting-row"
			>{t('SINGLE WIN LIMIT')}<input
				type="number"
				min={stateBet.betAmount}
				step="any"
				bind:value={winLimit}
			/></label
		>
		<p>{t('AUTO NOTE')}</p>
		<button
			class="gold-button"
			disabled={!Number.isFinite(lossLimit) ||
				!Number.isFinite(winLimit) ||
				lossLimit <= 0 ||
				winLimit <= 0}
			onclick={autoStart}>{t('PLAY')}</button
		></Modal
	>
{:else if stateModal.modal?.name === 'autoSpinMessage'}<Modal
		title={t('AUTO')}
		close={() => (stateModal.modal = null)}
		><p>{stateModal.modal.message}</p>
		<button class="gold-button" onclick={() => (stateModal.modal = null)}>{t('CONTINUE')}</button
		></Modal
	>{/if}
