<script lang="ts">
	import { OnHotkey } from 'components-shared';
	import {
		stateBet,
		stateBetDerived,
		stateConfig,
		stateI18nDerived,
		stateMeta,
		stateModal,
		stateSound,
		stateUi,
	} from 'state-shared';
	import { bookEventAmountToCurrencyString, numberToCurrencyString } from 'utils-shared/amount';

	import { eventEmitter } from '../../game/eventEmitter';
	import { CLUSTER_LOG_SIZE, stateGame, stateGameDerived } from '../../game/stateGame.svelte';
	import { stateXstateDerived } from '../../game/stateXstate';
	import { VEGGIE_SYMBOL_ASSETS } from '../../game/veggieAssets';
	import type { Position, RawSymbol } from '../../game/types';

	const t = (key: string) => stateI18nDerived.translate(key);

	// Every paid mode lives in BONUS FEATURES. CHANCE and FEATURE are per-spin modes; FEATURE adds
	// an activation confirmation. The three actual bonuses remain one-shot buys.
	const modeCards = [
		{
			key: 'CHANCE',
			title: 'MODE CHANCE TITLE',
			cost: 2,
			tag: 'MODE CHANCE TAG',
			icon: 'onion',
			kind: 'toggle',
		},
		{
			key: 'FEATURE',
			title: 'MODE FEATURE TITLE',
			cost: 20,
			tag: 'MODE FEATURE TAG',
			icon: 'broccoli',
			kind: 'toggle',
		},
		{
			key: 'BONUS',
			title: 'MODE BONUS TITLE',
			cost: 100,
			tag: 'MODE BONUS TAG',
			icon: 'tomato',
			kind: 'buy',
		},
		{
			key: 'MYSTERY',
			title: 'MODE MYSTERY TITLE',
			cost: 300,
			tag: 'MODE MYSTERY TAG',
			icon: 'onion',
			kind: 'buy',
		},
		{
			key: 'SUPER',
			title: 'MODE SUPER TITLE',
			cost: 400,
			tag: 'MODE SUPER TAG',
			icon: 'corn',
			kind: 'buy',
		},
	] as const;

	const modeIconAsset = (icon: string) =>
		icon === 'onion'
			? `.${VEGGIE_SYMBOL_ASSETS.SCATTER}`
			: `./assets/veggie-salad/pixel/${icon}.png`;

	let showBuyMenu = $state(false);
	let pendingMode = $state<(typeof modeCards)[number] | null>(null);
	let showAutoMenu = $state(false);
	let pendingAutoSpins = $state<number>(100);
	let showMenu = $state(false);

	const isReplay = $derived(stateUi.config.mode === 'replay');
	const isIdle = $derived(stateXstateDerived.isIdle());
	const canInteract = $derived(isIdle && !isReplay);
	const activeMode = $derived(stateBet.activeBetModeKey.toUpperCase());
	const chanceActive = $derived(activeMode === 'CHANCE');
	const featureActive = $derived(activeMode === 'FEATURE');
	const betOptions = $derived(stateConfig.betAmountOptions);
	const betIndex = $derived(Math.max(0, betOptions.indexOf(stateBet.betAmount)));
	const smallestBet = $derived(betOptions[0] ?? stateBet.betAmount);
	const biggestBet = $derived(betOptions[betOptions.length - 1] ?? stateBet.betAmount);
	const featureRibbon = $derived(stateGame.featureLabel);
	const bonusTierLabel = $derived(
		stateGame.bonusTier ? t(`BONUS TIER ${stateGame.bonusTier.toUpperCase()}`) : '',
	);
	const hasAuto = $derived(stateBetDerived.hasAutoBetCounter());
	const autoCounterText = $derived(
		stateBet.autoSpinsCounter === Infinity ? '∞' : stateBet.autoSpinsCounter || 'A',
	);
	const controlsBlocked = $derived(
		showBuyMenu ||
			showAutoMenu ||
			showMenu ||
			stateGame.continueGate !== null ||
			stateModal.modal !== null,
	);
	const canChangeSpeed = $derived(
		!isReplay && !controlsBlocked && !stateConfig.jurisdiction?.disabledTurbo,
	);
	const soundMuted = $derived(stateSound.volumeValueMaster === 0);
	const musicMuted = $derived(stateSound.volumeValueMusic === 0);
	const winningKeys = $derived(
		new Set(stateGame.winningPositions.map((position) => stateGameDerived.positionKey(position))),
	);
	const scatterKeys = $derived(
		new Set(stateGame.scatterPositions.map((position) => stateGameDerived.positionKey(position))),
	);
	// On a bonus-entry spin the scatter COUNT is the announcement of which bonus was won, so it
	// gets its own read-out under the board.
	const scatterCount = $derived(stateGame.scatterPositions.length);
	// Visual theme follows the active bonus, not the last reveal's gameType. The latter remains the
	// bonus type until the next base reveal, which previously left the base garden colour-graded
	// after the bonus outro had closed.
	const theme = $derived(
		stateGame.bonusTier === 'hidden'
			? 'rainbow'
			: stateGame.bonusTier === 'super'
				? 'night'
				: stateGame.bonusTier === 'normal'
					? 'sunset'
					: 'day',
	);

	// The active motion profile — normal, or the fast one under turbo/skip. Because this is
	// $derived, a skip press rewrites these custom properties on cells that are mid-fall, and the
	// browser re-scales the running animation instead of dropping it: a fast-forward, not a cut.
	const motion = $derived(stateGameDerived.motion());
	const ms = (value: number) => `${Math.round(value)}ms`;

	// Per-cell drop timing. The spin reveal and the tumble refill share one gravity model — only
	// the column stagger differs. Bottom rows start first, so a column piles up from the floor and
	// a falling symbol can never pass through one that has already landed.
	const cellMotion = (reel: number, row: number) => {
		const distance = stateGame.fallDistances[reel]?.[row] ?? 0;
		const jitter = stateGame.fallJitter[reel]?.[row] ?? 0;
		const fall = stateGameDerived.fallDurationMs(distance);
		const stagger =
			stateGame.phase === 'spinning' ? motion.spinRowStaggerMs : motion.tumbleRowStaggerMs;
		const delay =
			(stateGame.gridSize - 1 - row) * stagger +
			reel * motion.reelDelayMs +
			jitter * motion.jitterMs;

		// A skip press rewrites these so every cell still in the air lands together.
		const drop = stateGameDerived.skipAdjust({ delayMs: delay, durationMs: fall });
		const exit = stateGameDerived.skipAdjust({
			delayMs:
				(stateGame.gridSize - 1 - row) * motion.exitRowStaggerMs +
				reel * motion.exitReelDelayMs +
				jitter * motion.exitJitterMs,
			durationMs: stateGameDerived.fallDurationMs(stateGameDerived.exitDistance(row)),
		});

		return [
			`--fall-offset:${-105 * distance}%`,
			`--fall-duration:${ms(drop.durationMs)}`,
			`--fall-delay:${ms(drop.delayMs)}`,
			// The landing squash starts exactly where the fall ends.
			`--impact-delay:${ms(drop.delayMs + drop.durationMs)}`,
			// Trap-door exit: the same fall, downwards and out. Distance-derived duration + a
			// bottom-row-first stagger, so the old board tumbles out instead of sliding off as one
			// sheet (which is what the single shared duration used to look like).
			`--exit-offset:${105 * stateGameDerived.exitDistance(row)}%`,
			`--exit-duration:${ms(exit.durationMs)}`,
			`--exit-delay:${ms(exit.delayMs)}`,
			`--harvest-delay:${ms(jitter * motion.removeJitterMs)}`,
		].join(';');
	};

	const formatCurrency = (amount: number) => numberToCurrencyString(amount);
	const bookWinToCurrency = (amount: number) => bookEventAmountToCurrencyString(amount);
	const balanceText = $derived(formatCurrency(stateBet.balanceAmount));
	const winText = $derived(bookWinToCurrency(stateGame.roundWin));
	const bonusTotalText = $derived(bookWinToCurrency(stateGame.bonusTotalWin));
	// Persistent CHANCE/FEATURE modes charge per spin, so their highlighted BET value shows the
	// actual debited cost. One-shot bonus buys keep showing the selected base stake: their card and
	// confirmation own the purchase price, and must not overwrite the player's bet level.
	const displayedBetAmount = $derived(
		chanceActive || featureActive ? stateBetDerived.betCost() : stateBet.betAmount,
	);
	const betText = $derived(formatCurrency(displayedBetAmount));
	const textFitStyle = (value: string) => `--chars:${Math.max(1, Array.from(value).length)}`;

	const getCell = (reel: number, row: number): RawSymbol | null =>
		stateGame.board[reel]?.[row] ?? null;
	const keyOf = (reel: number, row: number) => `${reel}:${row}`;
	// Newest first, already capped by the handler. Rendered into a fixed number of slots, so the
	// panel is the same size empty or full and a new win always lands in the top slot.
	const clusterRows = $derived(stateGame.spinClusterWins.slice(0, CLUSTER_LOG_SIZE));

	// One label per live cluster, parked on the cluster's centre of mass rather than on its first
	// cell, so the amount reads as belonging to the whole shape.
	const clusterLabels = $derived(
		stateGame.winningClusters.map((cluster) => {
			const reels = cluster.positions.map((position) => position.reel);
			const rows = cluster.positions.map((position) => position.row);
			const centre = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;
			// Keep the label inside the frame: the board clips its own overflow (it has to, for the
			// falls), so a cluster hugging an edge would otherwise have half its amount cut off.
			const pitch = 100 / stateGame.gridSize;
			const inset = (value: number) => Math.min(100 - pitch * 1.8, Math.max(pitch * 1.8, value));
			return {
				id: cluster.clusterId,
				left: inset(((centre(reels) + 0.5) / stateGame.gridSize) * 100),
				top: inset(((centre(rows) + 0.5) / stateGame.gridSize) * 100),
				text: `${bookWinToCurrency(cluster.amount)}${
					cluster.appliedMultiplier > 1 ? ` X${cluster.appliedMultiplier}` : ''
				}`,
			};
		}),
	);

	const spinOrSkip = () => {
		if (controlsBlocked) return;
		if (!isIdle) {
			if (stateConfig.jurisdiction?.disabledSlamstop) return;
			stateGameDerived.requestSkip();
			eventEmitter.broadcast({ type: 'stopButtonClick' });
			return;
		}
		if (hasAuto) {
			stateBet.autoSpinsCounter = 0;
			return;
		}
		if (isReplay) return;
		// Buy modes are one-shot requests. A later manual/hotkey spin must return to BASE; only the
		// two activate modes intentionally stay armed across spins.
		if (!['CHANCE', 'FEATURE'].includes(activeMode)) stateBet.activeBetModeKey = 'BASE';
		eventEmitter.broadcast({ type: 'bet' });
	};

	// Space is presentation control while autoplay owns round progression. In the tiny idle gap
	// between auto rounds it does nothing; AUTO remains the explicit stop action.
	const spaceSpinOrSkip = () => {
		if (controlsBlocked) return;
		if (!isIdle) {
			if (stateConfig.jurisdiction?.disabledSlamstop) return;
			stateGameDerived.requestSkip();
			eventEmitter.broadcast({ type: 'stopButtonClick' });
			return;
		}
		if (hasAuto) return;
		spinOrSkip();
	};

	const stepBet = (direction: -1 | 1) => {
		if (!canInteract || betOptions.length === 0) return;
		const nextIndex = Math.max(0, Math.min(betOptions.length - 1, betIndex + direction));
		const next = betOptions[nextIndex];
		if (typeof next === 'number') stateBetDerived.setBetAmount(next);
	};

	const highestAffordableBet = $derived.by(() => {
		const multiplier = stateBetDerived.betCostMultiplier();
		if (multiplier <= 0) return biggestBet;
		const affordable = betOptions.filter((option) => option * multiplier <= stateBet.balanceAmount);
		return affordable[affordable.length - 1] ?? smallestBet;
	});
	const disableDecrease = $derived(!canInteract || stateBet.betAmount <= smallestBet);
	const disableIncrease = $derived(
		!canInteract || stateBet.betAmount >= Math.min(biggestBet, highestAffordableBet),
	);

	const canAffordMode = (mode: (typeof modeCards)[number]) =>
		stateBet.betAmount * mode.cost <= stateBet.balanceAmount;

	const requestBuyMode = (mode: (typeof modeCards)[number]) => {
		if (!canInteract) return;
		// EXTRA CHANCE is a direct toggle. Product reference has no purchase confirmation here.
		if (mode.key === 'CHANCE') {
			stateBet.activeBetModeKey = activeMode === 'CHANCE' ? 'BASE' : 'CHANCE';
			showBuyMenu = false;
			return;
		}
		// Turning a toggle OFF spends nothing, so it skips the confirmation.
		if (mode.kind === 'toggle' && activeMode === mode.key) {
			stateBet.activeBetModeKey = 'BASE';
			showBuyMenu = false;
			return;
		}
		if (!canAffordMode(mode)) {
			stateModal.modal = {
				name: 'error',
				error: new Error(
					'INSUFFICIENT FUNDS TO PLACE THIS BET. PLEASE ADD FUNDS TO YOUR ACCOUNT OR LOWER THE BET LEVEL.',
				),
			};
			return;
		}
		pendingMode = mode;
	};

	const confirmBuyMode = () => {
		if (!pendingMode || !canInteract || !canAffordMode(pendingMode)) return;
		const mode = pendingMode;
		pendingMode = null;
		showBuyMenu = false;
		stateBet.activeBetModeKey = mode.key;
		// Actual bonus buys spin now. FEATURE is armed like CHANCE after its confirmation.
		if (mode.kind === 'buy') eventEmitter.broadcast({ type: 'bet' });
	};

	const toggleTurbo = () => {
		if (!canChangeSpeed) return;
		// NORMAL -> FAST -> MAX -> NORMAL. Flags stay exclusive, so MAX cannot trap the toggle.
		if (stateBet.isSuperTurbo) {
			stateBet.isTurbo = false;
			stateBet.isSuperTurbo = false;
			return;
		}
		if (stateBet.isTurbo) {
			if (!stateConfig.jurisdiction?.disabledSuperTurbo) {
				stateBet.isTurbo = false;
				stateBet.isSuperTurbo = true;
			} else {
				stateBet.isTurbo = false;
			}
			return;
		}
		stateBet.isTurbo = true;
		stateBet.isSuperTurbo = false;
	};

	const toggleSound = () => {
		eventEmitter.broadcast({ type: 'soundPressGeneral' });
		stateSound.volumeValueMaster = soundMuted ? 75 : 0;
	};

	const toggleMusic = () => {
		eventEmitter.broadcast({ type: 'soundPressGeneral' });
		stateSound.volumeValueMusic = musicMuted ? 75 : 0;
	};

	const flashControl = (event: MouseEvent) => {
		const button = event.currentTarget;
		if (!(button instanceof HTMLButtonElement) || button.disabled) return;
		button.classList.remove('pressed-flash');
		void button.offsetWidth;
		button.classList.add('pressed-flash');
		window.setTimeout(() => button.classList.remove('pressed-flash'), 170);
	};

	const toggleAuto = () => {
		if (stateConfig.jurisdiction?.disabledAutoplay || isReplay) return;
		if (hasAuto) {
			stateBet.autoSpinsCounter = 0;
			return;
		}
		if (!canInteract) return;
		showAutoMenu = true;
	};

	const startAuto = () => {
		if (!canInteract || !stateBetDerived.isBetCostAvailable()) return;
		// Per-spin modes persist through autoplay; actual bonus buys are one-shot.
		if (['BONUS', 'MYSTERY', 'SUPER'].includes(activeMode)) {
			stateBet.activeBetModeKey = 'BASE';
		}
		stateBet.autoSpinsCounter = pendingAutoSpins;
		showAutoMenu = false;
		eventEmitter.broadcast({ type: 'autoBet' });
	};

	const openRules = () => {
		showMenu = false;
		stateModal.modal = { name: 'gameRules' };
	};

	const closeTopPanel = (event: KeyboardEvent) => {
		if (event.key !== 'Escape') return;
		if (pendingMode) pendingMode = null;
		else if (showAutoMenu) showAutoMenu = false;
		else if (showBuyMenu) showBuyMenu = false;
		else if (showMenu) showMenu = false;
	};

	// One delegated click listener avoids putting click handlers on non-interactive layout nodes.
	// Backdrop clicks close their panel; game-area clicks request slam-stop; controls are excluded.
	const handleWindowClick = (event: MouseEvent) => {
		const target = event.target;
		if (!(target instanceof Element)) return;
		const modalLayer = target.closest('.modal-layer');
		if (modalLayer) {
			if (target.closest('.buy-panel, .confirm-panel, .auto-panel')) return;
			if (pendingMode) pendingMode = null;
			else if (showAutoMenu) showAutoMenu = false;
			else if (showBuyMenu) showBuyMenu = false;
			return;
		}
		if (target.closest('button, .hud, .quick-menu, .event-overlay')) return;
		if (!isIdle && !stateConfig.jurisdiction?.disabledSlamstop) stateGameDerived.requestSkip();
	};
</script>

<svelte:head>
	<title>Veggie Salad</title>
	<meta name="description" content="Veggie Salad cluster slot" />
</svelte:head>

<OnHotkey
	hotkey="Space"
	disabled={Boolean(stateConfig.jurisdiction?.disabledSpacebar) || controlsBlocked}
	onpress={spaceSpinOrSkip}
/>
<svelte:window onkeydown={closeTopPanel} onclick={handleWindowClick} />

<main
	class="scene theme-{theme}"
	class:bonus-normal={stateGame.bonusTier === 'normal'}
	class:bonus-super={stateGame.bonusTier === 'super'}
	class:bonus-hidden={stateGame.bonusTier === 'hidden'}
	style="--pixel-background:url('./assets/veggie-salad/pixel/background.png');--bonus-normal-background:url('./assets/veggie-salad/pixel/background-bonus-normal.png');--bonus-super-background:url('./assets/veggie-salad/pixel/background-bonus-super.png');--bonus-hidden-background:url('./assets/veggie-salad/pixel/background-bonus-hidden.png');--hud-button:url('./assets/veggie-salad/pixel/hud-button.png');--hud-button-pressed:url('./assets/veggie-salad/pixel/hud-button-pressed.png')"
>
	<!-- Background images cannot interpolate. Persistent layers can: entering a bonus fades its
	     garden over BASE; leaving fades it away and reveals the exact same BASE layer underneath. -->
	<div class="pixel-background-stack" aria-hidden="true">
		<div class="pixel-background background-base"></div>
		<div class="pixel-background background-bonus background-normal"></div>
		<div class="pixel-background background-bonus background-super"></div>
		<div class="pixel-background background-bonus background-hidden"></div>
	</div>
	<div class="sun-moon" aria-hidden="true"></div>
	<div class="rainbow" aria-hidden="true"></div>
	<div class="cloud cloud-a" aria-hidden="true"></div>
	<div class="cloud cloud-b" aria-hidden="true"></div>
	<div class="tree-line tree-back" aria-hidden="true"></div>
	<div class="tree-line tree-front" aria-hidden="true"></div>
	<div class="meadow" aria-hidden="true"></div>
	<div class="corner-foliage" aria-hidden="true"></div>

	<header class="brand" aria-label={t('VEGGIE SALAD')}>
		<img src="./assets/veggie-salad/pixel/logo.png" alt={t('VEGGIE SALAD')} />
	</header>
	<img
		class="studio-mark"
		src="./assets/veggie-salad/pixel/loading/press_play_logo.webp"
		alt="Press Play"
	/>

	{#if stateGame.freeSpinTotal > 0 && stateGame.bonusTier}
		<div class="bonus-readouts" aria-live="polite">
			<div class="bonus-status bonus-readout">
				<span>{t('FREE SPINS')}</span>
				<strong>{stateGame.freeSpinCurrent}/{stateGame.freeSpinTotal}</strong>
				<small>{bonusTierLabel}</small>
			</div>
			<div class="bonus-total bonus-readout">
				<span>{t('EARNED')}</span>
				<strong style={textFitStyle(bonusTotalText)}>{bonusTotalText}</strong>
			</div>
		</div>
	{/if}

	<section class="game-stage" aria-label={t('VEGGIE SALAD GAME BOARD')}>
		<aside
			class="cluster-panel"
			style={`--slots:${CLUSTER_LOG_SIZE}`}
			aria-label={t('CLUSTER PAYOUTS')}
		>
			<div class="panel-rows">
				<!-- Slots, not rows: keyed by position so a repeat win in the same cascade cannot
				     collide with an identical clusterId from an earlier tumble (which is what stopped
				     the panel updating), and so the box keeps its height while it fills. -->
				{#each Array(CLUSTER_LOG_SIZE) as _, slot (slot)}
					{@const row = clusterRows[slot]}
					<div class="panel-row" class:vacant={!row}>
						{#if row}
							<span>{row.size}x</span>
							<img src={`.${VEGGIE_SYMBOL_ASSETS[row.symbol]}`} alt="" />
							<span>x{row.appliedMultiplier}</span>
							<strong>{bookWinToCurrency(row.amount)}</strong>
						{/if}
					</div>
				{/each}
			</div>
		</aside>
		<div class="board-wrap">
			<div class="board-shadow"></div>
			<div
				class="board-frame"
				class:is-spinning={stateGame.phase === 'spinning' || stateGame.phase === 'spinning-out'}
			>
				{#key stateGame.gridSize}
					<div
						class="board phase-{stateGame.phase}"
						style={`--grid-size:${stateGame.gridSize};--reveal:${stateGame.revealId};--impact-duration:${ms(motion.impactMs)};--remove-duration:${ms(motion.removeMs)}`}
						aria-label={`${stateGame.gridSize} by ${stateGame.gridSize} symbol grid`}
					>
						{#each Array(stateGame.gridSize) as _, row}
							{#each Array(stateGame.gridSize) as _, reel}
								{@const cell = getCell(reel, row)}
								{@const hit = winningKeys.has(keyOf(reel, row))}
								{@const scatterHit = scatterKeys.has(keyOf(reel, row))}
								<div
									class="cell"
									class:cluster-hit={hit}
									class:scatter-hit={scatterHit}
									class:empty={!cell}
									class:falling={(stateGame.fallDistances[reel]?.[row] ?? 0) > 0}
									style={cellMotion(reel, row)}
								>
									{#if cell}
										{#key `${stateGame.revealId}:${reel}:${row}`}
											<div class="symbol-layer">
												{#if cell.name === 'SCATTER' && scatterHit}
													<img
														class="backplate"
														src="./assets/veggie-salad/symbols/backplate.png"
														alt=""
													/>
												{/if}
												<img
													class="symbol"
													src={`.${VEGGIE_SYMBOL_ASSETS[cell.name]}`}
													alt={cell.name.toLowerCase()}
													draggable="false"
												/>
												{#if cell.multiplier}
													<span class="multiplier">{cell.multiplier}×</span>
												{/if}
											</div>
										{/key}
									{/if}
								</div>
							{/each}
						{/each}

						<!-- Keyed by position, not clusterId: the math is free to reuse an id between
						     cascades, and a duplicate key in a keyed each is a runtime error. -->
						{#each clusterLabels as label, index (index)}
							<span class="win-label" style={`left:${label.left}%;top:${label.top}%`}>
								{label.text}
							</span>
						{/each}
					</div>
				{/key}
				<div class="frame-highlight" aria-hidden="true"></div>
			</div>

			{#if scatterCount > 0}
				<div class="scatter-tally">
					{scatterCount}
					{scatterCount === 1 ? t('SCATTER') : t('SCATTERS')}
				</div>
			{/if}

			{#if featureRibbon}
				<div class="feature-ribbon">{t(featureRibbon)}</div>
			{/if}
		</div>
	</section>

	{#if showBuyMenu}
		<div class="modal-layer">
			<section class="buy-panel">
				<button class="close" aria-label={t('CLOSE')} onclick={() => (showBuyMenu = false)}
					>×</button
				>
				<header>
					<small>{t('CHOOSE YOUR HARVEST')}</small>
					<h2>{t('BONUS FEATURES')}</h2>
				</header>
				<div class="buy-grid">
					{#each modeCards as mode}
						{@const isArmed = mode.kind === 'toggle' && activeMode === mode.key}
						<button
							class="buy-card mode-{mode.key.toLowerCase()}"
							class:armed={isArmed}
							aria-pressed={mode.kind === 'toggle' ? isArmed : undefined}
							disabled={!canAffordMode(mode) && !isArmed}
							onclick={() => requestBuyMode(mode)}
						>
							<img src={modeIconAsset(mode.icon)} alt="" />
							<span>{t(mode.title)}</span>
							<small>{t(mode.tag)}</small>
							<strong
								>{mode.cost}× {t('BET')}{mode.kind === 'toggle' ? ` / ${t('SPIN')}` : ''}</strong
							>
							<em>{formatCurrency(stateBet.betAmount * mode.cost)}</em>
							{#if mode.kind === 'toggle'}
								<b class="card-state">{isArmed ? t('ARMED TAP TO STOP') : t('TOGGLE')}</b>
							{/if}
						</button>
					{/each}
				</div>
			</section>
		</div>
	{/if}

	{#if pendingMode}
		<div class="modal-layer confirm-layer">
			<section class="confirm-panel" role="dialog" aria-modal="true">
				<button class="close" aria-label={t('CLOSE')} onclick={() => (pendingMode = null)}>×</button
				>
				<small
					>{pendingMode.kind === 'toggle' ? t('CONFIRM ACTIVATION') : t('CONFIRM PURCHASE')}</small
				>
				<img src={modeIconAsset(pendingMode.icon)} alt="" />
				<h2>{t(pendingMode.title)}</h2>
				<p>{t(pendingMode.tag)}</p>
				<strong>{formatCurrency(stateBet.betAmount * pendingMode.cost)}</strong>
				{#if pendingMode.kind === 'toggle'}
					<p class="confirm-note">{t('TOGGLE COST NOTE')}</p>
				{/if}
				<div class="confirm-actions">
					<button class="cancel" onclick={() => (pendingMode = null)}>{t('CANCEL')}</button>
					<button class="accept" onclick={confirmBuyMode}>
						{pendingMode.kind === 'toggle' ? t('ACTIVATE') : t('CONFIRM')}
					</button>
				</div>
			</section>
		</div>
	{/if}

	{#if showAutoMenu}
		<div class="modal-layer">
			<section class="auto-panel" role="dialog" aria-modal="true">
				<button class="close" aria-label={t('CLOSE')} onclick={() => (showAutoMenu = false)}
					>×</button
				>
				<small>{t('AUTOPLAY')}</small>
				<h2>{t('NUMBER OF SPINS')}</h2>
				<div class="auto-options">
					{#each [10, 25, 50, 100, 250, 500, Infinity] as count}
						<button
							class:active={pendingAutoSpins === count}
							onclick={() => (pendingAutoSpins = count)}
						>
							{count === Infinity ? '∞' : count}
						</button>
					{/each}
				</div>
				<p>{t('AUTOPLAY STOP NOTE')}</p>
				<button
					class="auto-start"
					disabled={!stateBetDerived.isBetCostAvailable()}
					onclick={startAuto}
				>
					{t('START AUTOPLAY')}
				</button>
			</section>
		</div>
	{/if}

	{#if showMenu}
		<div class="quick-menu" role="menu">
			<button
				type="button"
				role="menuitem"
				aria-pressed={!soundMuted}
				class:off={soundMuted}
				onclick={toggleSound}
			>
				<span class="quick-menu-icon" aria-hidden="true">
					<svg viewBox="0 0 24 24"
						><path
							d="M3 9v6h4l5 4V5L7 9H3zm13-1-2 2a3 3 0 0 1 0 4l2 2a6 6 0 0 0 0-8zm3-3-2 2a8 8 0 0 1 0 10l2 2a11 11 0 0 0 0-14z"
						/></svg
					>
				</span>
				<span>{t('SOUND')}</span>
			</button>
			<button
				type="button"
				role="menuitem"
				aria-pressed={!musicMuted}
				class:off={musicMuted}
				onclick={toggleMusic}
			>
				<span class="quick-menu-icon" aria-hidden="true">
					<svg viewBox="0 0 24 24"
						><path d="M9 4v11.2a4 4 0 1 0 2 3.5V8l8-2v7.2a4 4 0 1 0 2 3.5V2L9 4z" /></svg
					>
				</span>
				<span>{t('MUSIC')}</span>
			</button>
			<button type="button" role="menuitem" onclick={openRules}>
				<span class="quick-menu-icon info-icon" aria-hidden="true">i</span>
				<span>{t('INFO')}</span>
			</button>
		</div>
	{/if}

	{#if !isReplay}
		<footer class="hud">
			<div class="hud-left">
				<button
					type="button"
					class="round utility"
					aria-label={t('MENU')}
					aria-expanded={showMenu}
					onclick={(event) => {
						flashControl(event);
						showMenu = !showMenu;
					}}
				>
					<svg viewBox="0 0 64 64" aria-hidden="true">
						<path d="M13 17h38v6H13zm0 12h38v6H13zm0 12h38v6H13z" />
					</svg>
				</button>
				{#if !stateConfig.jurisdiction?.disabledBuyFeature}
					<button
						type="button"
						class="bonus-button"
						disabled={!canInteract}
						onclick={() => (showBuyMenu = true)}
					>
						<span>{t('BONUS')}</span><small>{t('FEATURES')}</small>
					</button>
				{/if}
			</div>

			<div class="metrics">
				<div class="metric">
					<span>{t('BALANCE')}</span><strong style={textFitStyle(balanceText)}>{balanceText}</strong
					>
				</div>
				<div class="metric win">
					<span>{t('WIN')}</span><strong style={textFitStyle(winText)}>{winText}</strong>
				</div>
				<div class="metric bet" class:boosted={chanceActive || featureActive}>
					<span>{t('BET')}</span><strong style={textFitStyle(betText)}>{betText}</strong>
				</div>
			</div>

			<div class="hud-right">
				<div class="bet-stepper">
					<button
						type="button"
						aria-label={t('DECREASE BET')}
						disabled={disableDecrease}
						onclick={(event) => {
							flashControl(event);
							stepBet(-1);
						}}>−</button
					>
					<button
						type="button"
						aria-label={t('INCREASE BET')}
						disabled={disableIncrease}
						onclick={(event) => {
							flashControl(event);
							stepBet(1);
						}}>+</button
					>
				</div>
				<button
					type="button"
					class="spin"
					aria-label={isIdle ? t('SPIN') : t('SKIP')}
					title={isIdle ? t('SPIN') : t('SKIP ANIMATION')}
					disabled={controlsBlocked}
					onclick={spinOrSkip}
				>
					{#if isIdle}
						<svg class="spin-arrow" viewBox="0 0 100 100" aria-hidden="true">
							<path d="M74 27A33 33 0 1 0 79 66l-10-5a22 22 0 1 1-3-26L55 45h31V14z" />
						</svg>
					{:else}
						<span class="stop">■</span>
					{/if}
				</button>
				<button
					type="button"
					class="round utility turbo"
					aria-label={t('TURBO')}
					aria-pressed={stateBet.isTurbo || stateBet.isSuperTurbo}
					disabled={!canChangeSpeed}
					onclick={(event) => {
						flashControl(event);
						toggleTurbo();
					}}
				>
					<svg viewBox="0 0 64 64" aria-hidden="true">
						<path d="M36 5 15 36h14l-2 23 22-34H35z" />
					</svg><small>{stateBet.isSuperTurbo ? t('MAX') : stateBet.isTurbo ? t('FAST') : ''}</small
					>
				</button>
				{#if !stateConfig.jurisdiction?.disabledAutoplay}
					<button
						type="button"
						class="round utility auto"
						aria-label={t('AUTO SPIN')}
						aria-pressed={hasAuto}
						disabled={!hasAuto && !canInteract}
						onclick={(event) => {
							flashControl(event);
							toggleAuto();
						}}
					>
						{#if hasAuto}
							<span>{autoCounterText}</span>
						{:else}
							<svg viewBox="0 0 64 64" aria-hidden="true">
								<path
									d="M47 20a21 21 0 0 0-34 7l9 2a12 12 0 0 1 19-4l-7 6h18V13zM17 44a21 21 0 0 0 34-7l-9-2a12 12 0 0 1-19 4l7-6H12v18z"
								/>
							</svg>
						{/if}
						<small>{t('AUTO')}</small>
					</button>
				{/if}
			</div>
		</footer>
	{/if}
</main>

<style>
	:global(*) {
		box-sizing: border-box;
	}
	:global(html),
	:global(body) {
		width: 100%;
		height: 100%;
		margin: 0;
		overflow: hidden;
	}
	:global(button) {
		font: inherit;
	}
	.scene {
		position: fixed;
		inset: 0;
		isolation: isolate;
		overflow: hidden;
		font-family: 'Trebuchet MS', 'Arial Rounded MT Bold', system-ui, sans-serif;
		color: #fff;
		background: linear-gradient(#48bff0 0 48%, #86c944 70%, #327c2b 100%);
		transition: background 700ms ease;
	}
	.scene::after {
		content: '';
		position: absolute;
		inset: 0;
		z-index: -1;
		pointer-events: none;
		background: radial-gradient(
			ellipse at 50% 42%,
			transparent 25%,
			rgb(10 62 22 / 14%) 75%,
			rgb(6 31 13 / 40%)
		);
	}
	.theme-sunset {
		background: linear-gradient(#f36a51 0, #ffae55 44%, #719644 70%, #315e2c 100%);
	}
	.theme-night {
		background: linear-gradient(#071544 0, #174986 50%, #245a68 70%, #123b35 100%);
	}
	.theme-rainbow {
		background: linear-gradient(#d9edf6 0, #eaf4f4 48%, #8bce62 72%, #39863b 100%);
	}
	.sun-moon {
		position: absolute;
		top: 11%;
		right: 15%;
		width: min(8vw, 90px);
		aspect-ratio: 1;
		border-radius: 50%;
		background: #fff1a0;
		box-shadow: 0 0 40px 18px rgb(255 228 105 / 38%);
		opacity: 0.82;
	}
	.theme-night .sun-moon {
		right: auto;
		left: 17%;
		background: transparent;
		box-shadow: 18px 0 0 0 #fffbd0;
	}
	.theme-rainbow .sun-moon {
		opacity: 0;
	}
	.rainbow {
		position: absolute;
		left: 50%;
		top: 39%;
		width: 84vw;
		height: 53vw;
		transform: translate(-50%, -50%);
		border-radius: 50% 50% 0 0;
		border: clamp(16px, 2.8vw, 50px) solid transparent;
		background:
			linear-gradient(#dceef4, #dceef4) padding-box,
			linear-gradient(90deg, #f36b6b, #ffd55f, #72d57f, #69aeef, #a27ae7) border-box;
		opacity: 0;
		filter: saturate(0.75);
	}
	.theme-rainbow .rainbow {
		opacity: 0.88;
	}
	.cloud {
		position: absolute;
		width: 150px;
		height: 35px;
		border-radius: 60px;
		background: rgb(255 255 255 / 68%);
		filter: blur(0.3px);
	}
	.cloud::before,
	.cloud::after {
		content: '';
		position: absolute;
		border-radius: 50%;
		background: inherit;
	}
	.cloud::before {
		width: 65px;
		height: 65px;
		left: 25px;
		bottom: 0;
	}
	.cloud::after {
		width: 82px;
		height: 82px;
		right: 18px;
		bottom: 0;
	}
	.cloud-a {
		top: 14%;
		left: 8%;
		transform: scale(0.72);
	}
	.cloud-b {
		top: 24%;
		right: 7%;
		transform: scale(0.48);
	}
	.theme-night .cloud {
		opacity: 0.14;
	}
	.tree-line {
		position: absolute;
		left: -5%;
		right: -5%;
		bottom: 10%;
		height: 48%;
		background:
			radial-gradient(circle at 5% 62%, #286c2c 0 10%, transparent 10.5%),
			radial-gradient(circle at 18% 55%, #347c35 0 14%, transparent 14.5%),
			radial-gradient(circle at 33% 63%, #21642a 0 13%, transparent 13.5%),
			radial-gradient(circle at 50% 53%, #3b853b 0 16%, transparent 16.5%),
			radial-gradient(circle at 68% 62%, #276c2d 0 14%, transparent 14.5%),
			radial-gradient(circle at 84% 53%, #337936 0 16%, transparent 16.5%),
			radial-gradient(circle at 98% 61%, #205f29 0 13%, transparent 13.5%);
	}
	.tree-back {
		bottom: 24%;
		opacity: 0.75;
		transform: scale(1.18);
		filter: brightness(1.08);
	}
	.tree-front {
		background-color: #255e28;
		filter: drop-shadow(0 -10px 16px rgb(0 53 22 / 22%));
	}
	.theme-sunset .tree-line {
		filter: sepia(0.22) brightness(0.72);
	}
	.theme-night .tree-line {
		filter: brightness(0.38) saturate(0.7) hue-rotate(45deg);
	}
	.meadow {
		position: absolute;
		inset: auto 0 0;
		height: 32%;
		background: linear-gradient(transparent, #4ca33b 28%, #27722f);
	}
	.corner-foliage {
		position: absolute;
		inset: 0;
		z-index: 2;
		pointer-events: none;
		background:
			radial-gradient(ellipse at -3% -2%, #0d4522 0 13%, transparent 13.5%),
			radial-gradient(ellipse at 103% -2%, #134c25 0 14%, transparent 14.5%),
			radial-gradient(ellipse at -3% 103%, #0b4823 0 16%, transparent 16.5%),
			radial-gradient(ellipse at 103% 103%, #0b4020 0 17%, transparent 17.5%);
	}
	.brand {
		position: absolute;
		top: max(8px, 1.2vh);
		left: 50%;
		z-index: 12;
		display: flex;
		align-items: center;
		gap: 10px;
		transform: translateX(-50%) rotate(-1deg);
		padding: 5px 25px 7px;
		border: 4px solid #694012;
		border-radius: 50% 50% 34% 34%;
		background: linear-gradient(#f9e65f, #e49a17);
		box-shadow:
			inset 0 0 0 3px #fff184,
			0 5px 0 #3e671b,
			0 9px 18px rgb(0 0 0 / 32%);
		color: #315f16;
		text-align: center;
		white-space: nowrap;
	}
	.brand div {
		display: grid;
	}
	.brand small {
		font-size: clamp(6px, 0.55vw, 9px);
		letter-spacing: 0.18em;
		font-weight: 900;
	}
	.brand strong {
		font-size: clamp(18px, 2vw, 34px);
		line-height: 0.9;
		font-weight: 1000;
		letter-spacing: -0.06em;
		-webkit-text-stroke: 1px #173c0f;
		text-shadow: 0 2px #fff47d;
	}
	.brand-leaf {
		color: #4a8b1c;
		font-size: 25px;
	}
	.brand-leaf.mirror {
		transform: scaleX(-1);
	}
	/* The stage is the free space between the brand plate and the HUD; the board is the largest
	   square that fits INSIDE it. `container-type: size` is what makes that expressible in CSS:
	   min(100cqw, 100cqh) reads both axes of this box, so the board can never overflow one axis
	   the way `aspect-ratio` + `max-width` did (that combination broke the square and let the
	   bottom rows slide under the HUD on short screens and clip on narrow ones).
	   The bottom inset is a max() against the HUD's own height for the same reason. */
	.game-stage {
		position: absolute;
		z-index: 5;
		top: 8.5%;
		bottom: max(12%, 122px);
		left: 0;
		right: 0;
		padding: 0 clamp(4px, 1.5vw, 28px);
		container-type: size;
		display: grid;
		place-items: center;
	}
	.board-wrap {
		position: relative;
		/* Fallback first for engines without container query units: a square bounded by the
		   narrower axis of the stage. */
		width: 100%;
		height: 100%;
		aspect-ratio: 1;
		width: min(100cqw, 100cqh);
		height: min(100cqw, 100cqh);
	}
	.board-shadow {
		position: absolute;
		inset: 3%;
		border-radius: 18px;
		background: rgb(15 47 7 / 55%);
		filter: blur(20px);
		transform: translateY(16px);
	}
	.board-frame {
		position: relative;
		width: 100%;
		height: 100%;
		padding: clamp(8px, 1vw, 14px);
		border: clamp(8px, 1vw, 14px) solid #744313;
		border-radius: 16px;
		background: linear-gradient(90deg, #a46a25, #4b2808 10%, #754515 50%, #4b2808 90%, #a46a25);
		box-shadow:
			inset 0 0 0 3px #d59b3f,
			inset 0 0 20px #2b1605,
			0 15px 34px rgb(0 0 0 / 40%);
		overflow: hidden;
	}
	.board-frame::before,
	.board-frame::after {
		content: '';
		position: absolute;
		z-index: 5;
		pointer-events: none;
	}
	.board-frame::before {
		inset: 3px;
		border: 2px solid rgb(255 222 116 / 58%);
		border-radius: 8px;
	}
	.board-frame::after {
		inset: 0;
		background: linear-gradient(
			90deg,
			transparent 0 2%,
			rgb(255 207 86 / 15%) 4%,
			transparent 8% 92%,
			rgb(255 207 86 / 15%) 96%,
			transparent 98%
		);
	}
	.board {
		/* Runs once per mount, and {#key stateGame.gridSize} remounts the grid whenever the bonus
		   changes board size — so 7×7 → 9×9 reads as a re-deal instead of the cells jumping to a
		   new pitch under the old symbols. */
		animation: grid-swap 380ms cubic-bezier(0.2, 0.9, 0.3, 1.1) both;
		display: grid;
		grid-template-columns: repeat(var(--grid-size), minmax(0, 1fr));
		grid-template-rows: repeat(var(--grid-size), minmax(0, 1fr));
		gap: clamp(1px, 0.18vw, 3px);
		width: 100%;
		height: 100%;
		padding: 3px;
		overflow: hidden;
		background: #a96e27;
		border: 2px solid #2c1b08;
	}
	.cell {
		position: relative;
		display: grid;
		place-items: center;
		min-width: 0;
		min-height: 0;
		overflow: visible;
		transform-origin: center bottom;
	}
	.cell::before {
		content: '';
		position: absolute;
		inset: 0;
		z-index: 0;
		pointer-events: none;
		background:
			radial-gradient(circle at 45% 34%, rgb(118 150 50 / 74%), transparent 62%),
			linear-gradient(145deg, #496c20, #203d14);
		box-shadow:
			inset 0 0 0 1px rgb(255 234 144 / 18%),
			inset 0 -6px 12px rgb(9 31 8 / 20%);
	}
	/* Tumble symbols stay inside target slot until their fall starts. Prevents fresh art from
		appearing beside last winning cluster before gravity animation reaches it. */
	.phase-dropping .cell.falling {
		overflow: visible;
	}
	.symbol-layer {
		/* quadIn — slow off the ledge, fast into the floor. Paired with the sqrt(distance)
		   duration this gives every symbol an identical trajectory, so short and long falls look
		   like the same board of vegetables under the same gravity. */
		--gravity-ease: cubic-bezier(0.11, 0, 0.5, 0);
		position: absolute;
		inset: 0;
		z-index: 2;
		display: grid;
		place-items: center;
		transform-origin: center bottom;
		will-change: transform, opacity, filter;
	}
	.symbol,
	.backplate {
		position: absolute;
		width: 88%;
		height: 88%;
		object-fit: contain;
		user-select: none;
		filter: drop-shadow(0 3px 2px rgb(0 0 0 / 42%));
	}
	.backplate {
		width: 96%;
		height: 96%;
		filter: drop-shadow(0 0 7px #ffe36a);
	}
	.multiplier {
		position: absolute;
		right: 2%;
		bottom: 1%;
		z-index: 3;
		display: grid;
		place-items: center;
		min-width: 31%;
		aspect-ratio: 1;
		padding: 1px;
		border: clamp(1px, 0.15vw, 2px) solid #fff4a4;
		border-radius: 50%;
		background: linear-gradient(#ff813d, #c92322);
		box-shadow: 0 2px 5px #310900;
		font-size: clamp(7px, 1vw, 15px);
		font-weight: 1000;
		text-shadow: 0 2px 2px #510700;
	}
	/* Trap-door exit: the old board free-falls out the bottom under the same gravity as the drop,
	   loosened by a per-reel delay and the per-cell jitter instead of a rigid left-to-right sweep. */
	.phase-spinning-out .symbol-layer {
		animation: trapdoor-exit var(--exit-duration) var(--gravity-ease) var(--exit-delay) both;
	}
	/* Spin reveal and tumble refill are the SAME motion: an accelerating fall whose duration is
	   proportional to sqrt(distance) (constant gravity — see FALL_MOTION), then a separate
	   landing animation that squashes the symbol against the floor and bounces it out.
	   `land-impact` is `forwards`, not `both`: with `both` its 0% frame would fill backwards over
	   the whole fall and freeze the symbol in place. */
	.phase-spinning .symbol-layer,
	.phase-dropping .cell.falling .symbol-layer {
		animation:
			gravity-fall var(--fall-duration) var(--gravity-ease) var(--fall-delay) both,
			land-impact var(--impact-duration) linear var(--impact-delay) forwards;
	}
	.cell.cluster-hit {
		z-index: 4;
	}
	.cell.cluster-hit::before {
		background: radial-gradient(circle, #faff7c 0 10%, #8fca34 56%, #31511b);
		box-shadow:
			inset 0 0 0 2px #fff36a,
			0 0 12px rgb(229 255 69 / 70%);
	}
	.cell.cluster-hit .symbol-layer {
		animation: cluster-pulse 720ms ease-in-out infinite alternate;
	}
	.phase-removing .cell.cluster-hit .symbol-layer {
		visibility: visible;
		animation: harvest var(--remove-duration) steps(6, end) var(--harvest-delay) forwards;
	}
	.phase-removing .cell.cluster-hit .symbol-layer::before,
	.phase-removing .cell.cluster-hit .symbol-layer::after {
		content: '';
		position: absolute;
		z-index: 8;
		left: 46%;
		top: 46%;
		width: 9%;
		aspect-ratio: 1;
		background: #fff25a;
		box-shadow:
			-1.9em -1.2em #7bdf2d,
			1.8em -1.4em #ff9c19,
			2.2em 0.5em #e93624,
			-2.1em 0.8em #9c3cff,
			0.4em 2em #f4f06a;
		animation: pixel-burst-a var(--remove-duration) steps(5, end) var(--harvest-delay) forwards;
	}
	.phase-removing .cell.cluster-hit .symbol-layer::after {
		transform: rotate(45deg) scale(0.72);
		animation-name: pixel-burst-b;
	}
	/* Bonus-entry scatters: gold cell and a slow throb, so counting them takes no effort. Kept
	   distinct from the lime cluster highlight — a scatter is not a pay. */
	.cell.scatter-hit {
		z-index: 4;
	}
	.cell.scatter-hit::before {
		background: radial-gradient(circle, #fff5b0 0 12%, #ffbe33 58%, #7a4409);
		box-shadow:
			inset 0 0 0 2px #fff3b0,
			0 0 14px rgb(255 199 62 / 75%);
	}
	.cell.scatter-hit .symbol-layer {
		animation: scatter-throb 620ms ease-in-out infinite alternate;
	}
	.cell.empty::before {
		background: linear-gradient(145deg, #354e1b, #18320f);
	}
	/* Cluster win read-out: heavy white type stroked in dark green, parked on the cluster's centre
	   of mass. Sized off the cell pitch (board square / grid size) so it stays proportional from a
	   7×7 base grid to a 10×10 bonus grid. */
	.win-label {
		position: absolute;
		z-index: 8;
		width: max-content;
		transform: translate(-50%, -50%);
		color: #fff;
		font-size: calc(min(100cqw, 100cqh) / var(--grid-size) * 0.4);
		font-weight: 1000;
		letter-spacing: -0.02em;
		white-space: nowrap;
		-webkit-text-stroke: 0.09em #1d3c0c;
		paint-order: stroke fill;
		text-shadow:
			0 0.06em 0.02em #16300a,
			0 0.1em 0.22em rgb(9 26 5 / 65%);
		pointer-events: none;
		animation: win-label-in 260ms cubic-bezier(0.2, 1.5, 0.4, 1) both;
	}
	@keyframes win-label-in {
		from {
			transform: translate(-50%, -50%) scale(0.55);
			opacity: 0;
		}
		to {
			transform: translate(-50%, -50%) scale(1);
			opacity: 1;
		}
	}
	/* Side payout box. Same furniture as the board frame and the free-spins plaque: brown wood,
	   gold inner rule, green plates. Fixed height — CLUSTER_LOG_SIZE slots are always reserved, so
	   it does not grow or shrink as a cascade fills it. Only shown where there is real gutter next
	   to the board; a square board on a portrait screen leaves none. */
	.cluster-panel {
		position: absolute;
		left: clamp(4px, 1.5cqw, 26px);
		top: 50%;
		z-index: 7;
		display: none;
		width: clamp(128px, 25cqh, 196px);
		padding: clamp(5px, 0.9cqh, 9px);
		border: clamp(3px, 0.6cqh, 6px) solid #744313;
		border-radius: 14px;
		background: linear-gradient(#7c4a16, #452507);
		box-shadow:
			inset 0 0 0 2px #d59b3f,
			inset 0 0 16px #2b1605,
			0 10px 22px rgb(0 0 0 / 38%);
		transform: translateY(-50%);
	}
	@container (min-aspect-ratio: 1.55) {
		.cluster-panel {
			display: block;
		}
	}
	.panel-head {
		padding-bottom: clamp(3px, 0.6cqh, 6px);
		margin-bottom: clamp(4px, 0.7cqh, 7px);
		border-bottom: 2px solid rgb(213 155 63 / 55%);
		color: #ffe07a;
		font-size: clamp(8px, 1.4cqh, 11px);
		font-weight: 1000;
		letter-spacing: 0.14em;
		text-align: center;
		text-shadow: 0 2px 2px #2a1403;
	}
	.panel-rows {
		display: grid;
		grid-template-rows: repeat(var(--slots, 5), 1fr);
		gap: clamp(3px, 0.6cqh, 6px);
	}
	.panel-row {
		display: grid;
		grid-template-columns: auto 1.5em auto 1fr;
		align-items: center;
		gap: 4px;
		min-height: clamp(19px, 3.4cqh, 28px);
		padding: 2px 6px;
		border: 2px solid #9ec652;
		border-radius: 999px;
		background: linear-gradient(#568c22, #23480f);
		box-shadow: inset 0 2px 0 rgb(255 244 164 / 22%);
		color: #f4ffdf;
		font-size: clamp(8px, 1.5cqh, 12px);
		font-weight: 1000;
	}
	.panel-row.vacant {
		border-color: rgb(158 198 82 / 26%);
		background: rgb(24 48 16 / 45%);
		box-shadow: none;
	}
	.panel-row img {
		width: 1.5em;
		height: 1.5em;
		object-fit: contain;
		filter: drop-shadow(0 1px 1px rgb(0 0 0 / 45%));
	}
	.panel-row strong {
		color: #ffe964;
		text-align: right;
		text-shadow: 0 2px 2px #2a1403;
	}
	.frame-highlight {
		position: absolute;
		inset: 0;
		pointer-events: none;
		box-shadow: inset 0 0 24px rgb(255 207 74 / 22%);
	}
	.scatter-tally {
		position: absolute;
		z-index: 9;
		left: 50%;
		/* Inside the frame, over the bottom row: below the board it collided with the HUD bar. */
		bottom: clamp(6px, 2.5cqh, 22px);
		transform: translateX(-50%);
		padding: clamp(3px, 0.7cqh, 7px) clamp(9px, 1.8cqh, 18px);
		border: 2px solid #ffdd65;
		border-radius: 999px;
		background: linear-gradient(#c98a22, #5e360a);
		box-shadow:
			inset 0 0 0 2px rgb(255 244 164 / 35%),
			0 6px 14px rgb(0 0 0 / 40%);
		color: #fff6cf;
		font-size: clamp(9px, 1.8cqh, 15px);
		font-weight: 1000;
		letter-spacing: 0.12em;
		white-space: nowrap;
		animation: card-in 220ms cubic-bezier(0.2, 1.4, 0.4, 1) both;
	}
	.feature-ribbon {
		position: absolute;
		z-index: 9;
		top: 3%;
		left: 0;
		transform: translateX(-4%);
		padding: 6px 14px;
		border: 2px solid #ffdd65;
		border-radius: 0 10px 10px 0;
		background: #4f761a;
		box-shadow: 0 5px 12px #1d3c0c;
		font-size: 11px;
		font-weight: 1000;
		letter-spacing: 0.08em;
		white-space: nowrap;
	}
	.bonus-status {
		position: absolute;
		top: 16%;
		right: 2.2%;
		z-index: 8;
		display: grid;
		width: min(150px, 13vw);
		padding: 12px 10px;
		border: 3px solid #754314;
		border-radius: 16px;
		background: linear-gradient(#426f20, #1e4215);
		box-shadow:
			inset 0 0 0 2px #d9ad3f,
			0 8px 20px rgb(0 0 0 / 28%);
		text-align: center;
	}
	.bonus-status span,
	.bonus-status small {
		color: #ffe15b;
		font-size: 9px;
		font-weight: 1000;
		letter-spacing: 0.09em;
	}
	.bonus-status strong {
		font-size: 23px;
	}
	.hud {
		position: absolute;
		z-index: 15;
		left: 50%;
		bottom: max(7px, 1vh);
		transform: translateX(-50%);
		display: grid;
		grid-template-columns: auto minmax(300px, 1fr) auto;
		align-items: center;
		gap: clamp(8px, 1.1vw, 18px);
		width: min(96vw, 1450px);
		min-height: 76px;
		padding: 8px 12px;
		border: 4px solid #774410;
		border-radius: 22px;
		background: linear-gradient(#593407, #2a1904);
		box-shadow:
			inset 0 0 0 2px #bc8124,
			0 8px 22px rgb(0 0 0 / 42%);
	}
	.hud-left,
	.hud-right {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.hud button {
		border: 0;
		color: white;
		font-weight: 1000;
		cursor: pointer;
	}
	.hud button:disabled {
		opacity: 0.42;
		cursor: not-allowed;
	}
	.round {
		display: grid;
		place-items: center;
		width: 46px;
		aspect-ratio: 1;
		border: 2px solid #c08b31 !important;
		border-radius: 50%;
		background: radial-gradient(circle at 40% 30%, #674310, #281704 70%);
		box-shadow: inset 0 0 0 2px #3d2607;
	}
	.round span {
		font-size: 20px;
		line-height: 1;
	}
	.round small {
		font-size: 6px;
		color: #ffe064;
	}
	.bonus-button,
	.chance {
		display: grid;
		min-width: 91px;
		min-height: 44px;
		place-content: center;
		padding: 4px 13px;
		border: 2px solid #ffc957 !important;
		border-radius: 12px;
		background: linear-gradient(#ffbd2e, #e17608);
		box-shadow: inset 0 2px #ffe88a;
	}
	.chance {
		min-width: 65px;
		background: linear-gradient(#688f28, #315c18);
		border-color: #bfe453 !important;
	}
	.chance.active {
		background: linear-gradient(#b7ec42, #568919);
		color: #173009;
		box-shadow: 0 0 13px #baff41;
	}
	.bonus-button span,
	.chance span {
		font-size: 12px;
	}
	.bonus-button small,
	.chance small {
		font-size: 7px;
		letter-spacing: 0.08em;
	}
	.metrics {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: clamp(10px, 2vw, 34px);
		min-width: 0;
	}
	.metric {
		display: grid;
		gap: 2px;
		min-width: 0;
		text-align: center;
	}
	.metric span {
		color: #e8b73e;
		font-size: 9px;
		font-weight: 1000;
		letter-spacing: 0.14em;
	}
	.metric strong {
		overflow: hidden;
		color: #fff;
		font-size: clamp(15px, 1.55vw, 25px);
		text-overflow: ellipsis;
		white-space: nowrap;
		text-shadow: 0 2px #1a0c00;
	}
	.metric.win strong {
		color: #fff09b;
	}
	.bet-stepper {
		display: flex;
		gap: 4px;
	}
	.bet-stepper button {
		width: 34px;
		height: 34px;
		border: 2px solid #a97423 !important;
		border-radius: 50%;
		background: #342006;
		font-size: 20px;
	}
	.spin {
		position: relative;
		display: grid;
		place-items: center;
		width: 78px;
		aspect-ratio: 1;
		border: 5px solid #ffebad !important;
		border-radius: 50%;
		background: radial-gradient(circle, #ffc63d 0 35%, #ef8b0c 38% 65%, #7f4504 67%);
		box-shadow:
			inset 0 0 0 4px #ff9c12,
			0 4px 10px rgb(0 0 0 / 42%);
	}
	.phase-spinning .symbol-layer,
	.phase-dropping .cell.falling .symbol-layer {
		animation:
			gravity-fall var(--fall-duration) var(--gravity-ease) var(--fall-delay) both,
			land-impact var(--impact-duration) linear var(--impact-delay) forwards;
	}
	.spin span {
		font-size: 51px;
		line-height: 0.8;
		transform: translateY(-2px);
	}
	.spin span.stop {
		font-size: 22px;
		transform: none;
	}
	.event-overlay,
	.modal-layer {
		position: fixed;
		inset: 0;
		z-index: 30;
		display: grid;
		place-items: center;
		padding: 20px;
		background: rgb(14 32 5 / 57%);
		backdrop-filter: blur(5px);
	}
	.event-card {
		position: relative;
		width: min(520px, 88vw);
		padding: 32px;
		border: 6px solid #7a4510;
		border-radius: 30px;
		background: radial-gradient(circle at 50% 0, #759731, #294b16 65%, #19340f);
		box-shadow:
			inset 0 0 0 3px #f0c94b,
			0 20px 60px #122000;
		text-align: center;
		animation: card-in 0.46s cubic-bezier(0.17, 0.89, 0.32, 1.35);
	}
	.event-card::before {
		content: '';
		position: absolute;
		inset: 8px;
		border: 1px solid rgb(255 239 140 / 46%);
		border-radius: 20px;
		pointer-events: none;
	}
	.event-card h2 {
		margin: 4px 0;
		color: #fff073;
		font-size: clamp(27px, 4vw, 52px);
		line-height: 0.95;
		-webkit-text-stroke: 1px #482200;
		text-shadow: 0 4px #4c2606;
	}
	.event-card p {
		margin: 10px 0;
		font-weight: 1000;
		letter-spacing: 0.1em;
	}
	.event-card > strong {
		display: block;
		margin-top: 10px;
		font-size: clamp(30px, 5vw, 58px);
		color: #fff;
	}
	.event-card button {
		position: relative;
		z-index: 2;
		margin-top: 14px;
		padding: 12px 28px;
		border: 2px solid #ffe88a;
		border-radius: 999px;
		background: linear-gradient(#ffc53d, #eb800c);
		color: #2f1600;
		font-weight: 1000;
		cursor: pointer;
	}
	.sprout {
		color: #fff067;
		font-size: 27px;
	}
	.buy-panel {
		position: relative;
		width: min(920px, 94vw);
		padding: 25px;
		border: 6px solid #71410d;
		border-radius: 28px;
		background: linear-gradient(#416b20, #18360f);
		box-shadow:
			inset 0 0 0 3px #d5a63c,
			0 25px 70px #102008;
	}
	.buy-panel header {
		text-align: center;
	}
	.buy-panel header small {
		color: #d9ff78;
		font-weight: 900;
		letter-spacing: 0.2em;
	}
	.buy-panel h2 {
		margin: 2px 0 18px;
		color: #ffe45d;
		font-size: 34px;
		text-shadow: 0 3px #4c2500;
	}
	.close {
		position: absolute;
		z-index: 2;
		top: 10px;
		right: 12px;
		width: 38px;
		aspect-ratio: 1;
		border: 2px solid #d8ac3c;
		border-radius: 50%;
		background: #402409;
		color: #fff;
		font-size: 26px;
		cursor: pointer;
	}
	.buy-grid {
		display: grid;
		grid-template-columns: repeat(5, minmax(0, 1fr));
		gap: 12px;
	}
	.buy-card {
		display: grid;
		grid-template-rows: 80px auto auto auto auto;
		justify-items: center;
		gap: 5px;
		min-width: 0;
		padding: 14px 8px;
		border: 2px solid #9ec652;
		border-radius: 18px;
		background: linear-gradient(#527d2a, #244615);
		color: #fff;
		cursor: pointer;
		box-shadow: inset 0 0 18px rgb(255 245 132 / 9%);
	}
	.buy-card:hover:not(:disabled) {
		transform: translateY(-3px);
		border-color: #ffe065;
	}
	.buy-card:disabled {
		opacity: 0.42;
		cursor: not-allowed;
	}
	.buy-card img {
		width: 80px;
		height: 80px;
		object-fit: contain;
		filter: drop-shadow(0 4px 3px #142407);
	}
	.buy-card span {
		color: #ffe769;
		font-weight: 1000;
		text-align: center;
	}
	.buy-card small {
		min-height: 24px;
		color: #dcf5b6;
		font-size: 8px;
		text-align: center;
	}
	.buy-card strong {
		font-size: 20px;
	}
	.buy-card em {
		color: #ffd05a;
		font-size: 11px;
		font-style: normal;
	}
	.buy-card .card-state {
		font-size: 10px;
		letter-spacing: 0.08em;
		color: #cfeaa0;
	}
	.buy-card.armed {
		border-color: #ffd166;
		background: linear-gradient(#c98a22, #6d3f0b);
		box-shadow:
			inset 0 0 18px rgb(255 226 132 / 22%),
			0 0 14px rgb(255 202 74 / 55%);
	}
	.buy-card.armed .card-state {
		color: #fff0bd;
	}
	.confirm-note {
		margin: 0;
		max-width: 260px;
		color: #ffd9a0;
		font-size: 11px;
	}
	.confirm-layer {
		z-index: 45;
		background: rgb(7 17 2 / 76%);
	}
	.confirm-panel,
	.auto-panel {
		position: relative;
		display: grid;
		justify-items: center;
		width: min(470px, 92vw);
		padding: 30px;
		border: 6px solid #71410d;
		border-radius: 28px;
		background: radial-gradient(circle at 50% 0, #648d2a, #18360f 70%);
		box-shadow:
			inset 0 0 0 3px #d5a63c,
			0 25px 70px #102008;
		text-align: center;
	}
	.confirm-panel > small,
	.auto-panel > small {
		color: #d9ff78;
		font-weight: 1000;
		letter-spacing: 0.18em;
	}
	.confirm-panel > img {
		width: 105px;
		height: 105px;
		object-fit: contain;
		filter: drop-shadow(0 5px 4px #102008);
	}
	.confirm-panel h2,
	.auto-panel h2 {
		margin: 2px 0 8px;
		color: #ffe45d;
		font-size: clamp(24px, 4vw, 38px);
		text-shadow: 0 3px #4c2500;
	}
	.confirm-panel p,
	.auto-panel p {
		margin: 4px 0 14px;
		color: #e3f6be;
		font-size: 12px;
	}
	.confirm-panel > strong {
		margin-bottom: 18px;
		color: #fff;
		font-size: 29px;
	}
	.confirm-actions {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 12px;
		width: 100%;
	}
	.confirm-actions button,
	.auto-start {
		min-height: 45px;
		border: 2px solid #dcad43;
		border-radius: 12px;
		color: #fff;
		font-weight: 1000;
		cursor: pointer;
	}
	.confirm-actions .cancel {
		background: #51330d;
	}
	.confirm-actions .accept,
	.auto-start {
		background: linear-gradient(#83bc36, #3f761b);
		box-shadow: inset 0 2px #bdec66;
	}
	.auto-panel {
		width: min(560px, 92vw);
	}
	.auto-options {
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		gap: 7px;
		width: 100%;
		margin: 18px 0;
	}
	.auto-options button {
		min-width: 0;
		padding: 10px 3px;
		border: 2px solid #80601c;
		border-radius: 9px;
		background: #2d2008;
		color: #fff;
		font-weight: 1000;
		cursor: pointer;
	}
	.auto-options button.active {
		border-color: #efff83;
		background: #639429;
		box-shadow: 0 0 12px #b9f94b88;
	}
	.auto-start {
		width: 100%;
	}
	.auto-start:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
	.quick-menu {
		position: fixed;
		left: 2%;
		bottom: 100px;
		z-index: 40;
		display: grid;
		gap: 7px;
		width: 170px;
		padding: 10px;
		border: 2px solid #b8832b;
		border-radius: 14px;
		background: #2c1b07ee;
		box-shadow: 0 10px 30px #0008;
	}
	.quick-menu button {
		padding: 10px;
		border: 1px solid #7d5b1d;
		border-radius: 8px;
		background: #4a3010;
		color: #ffe270;
		font-weight: 900;
		cursor: pointer;
	}
	@keyframes trapdoor-exit {
		from {
			transform: none;
		}
		to {
			transform: translateY(var(--exit-offset)) scale(0.96, 1.08);
		}
	}
	/* Pure travel — no fade, no blur: the board clips its own overflow, so a symbol simply is not
	   there yet. A stretch along the fall axis carries the speed instead. */
	@keyframes gravity-fall {
		from {
			transform: translateY(var(--fall-offset)) scale(0.97, 1.06);
		}
		to {
			transform: translateY(0) scale(1, 1);
		}
	}
	/* Stone-hit: wide and short against the floor, springs back through a small bounce. Timings
	   mirror magnetic's squash (~190ms) / thump (45ms) / bounce (35ms) / settle (40ms) split. */
	@keyframes land-impact {
		0% {
			transform: none;
		}
		18% {
			transform: translateY(0) scale(1.13, 0.86);
		}
		38% {
			transform: translateY(-7%) scale(0.97, 1.05);
		}
		60% {
			transform: translateY(0) scale(1.03, 0.98);
		}
		80% {
			transform: translateY(-2%) scale(0.99, 1.01);
		}
		100% {
			transform: none;
		}
	}
	@keyframes scatter-throb {
		from {
			transform: scale(1);
			filter: brightness(1);
		}
		to {
			transform: scale(1.12);
			filter: brightness(1.28) drop-shadow(0 0 8px rgb(255 226 128 / 85%));
		}
	}
	@keyframes cluster-pulse {
		from {
			transform: scale(1);
			filter: brightness(1);
		}
		to {
			transform: scale(1.08);
			filter: brightness(1.24);
		}
	}
	@keyframes harvest {
		0% {
			transform: none;
			filter: brightness(1.2);
		}
		26% {
			transform: scale(1.18, 0.88);
			filter: brightness(1.9);
		}
		48% {
			transform: scale(0.94, 1.14) translateY(-8%);
			filter: brightness(2.2);
		}
		100% {
			transform: scale(0.06) rotate(14deg) translateY(6%);
			opacity: 0;
			filter: brightness(2.4);
		}
	}
	@keyframes grid-swap {
		from {
			transform: scale(0.9);
			opacity: 0;
			filter: brightness(1.5);
		}
		to {
			transform: scale(1);
			opacity: 1;
			filter: none;
		}
	}
	@keyframes card-in {
		from {
			transform: scale(0.72);
			opacity: 0;
		}
		to {
			transform: scale(1);
			opacity: 1;
		}
	}
	@media (max-width: 980px) {
		.game-stage {
			top: 8%;
			bottom: max(14%, 100px);
			padding: 0 6px;
		}
		.bonus-status {
			top: 10px;
			right: 10px;
			width: 115px;
		}
		.hud {
			grid-template-columns: auto 1fr auto;
			gap: 6px;
			min-height: 65px;
			padding: 5px 7px;
		}
		.chance {
			display: none;
		}
		.bonus-button {
			min-width: 72px;
			padding: 4px 8px;
		}
		.round {
			width: 38px;
		}
		.spin {
			width: 62px;
		}
		.spin span {
			font-size: 40px;
		}
		.bet-stepper {
			display: none;
		}
		.metrics {
			gap: 7px;
		}
		.metric strong {
			font-size: 15px;
		}
		.buy-grid {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}
	@media (max-width: 680px) {
		.brand {
			top: 5px;
			padding: 4px 15px 6px;
		}
		.brand small,
		.brand-leaf {
			display: none;
		}
		.game-stage {
			top: 7%;
			bottom: max(16%, 96px);
			padding: 0 4px;
		}
		.board-frame {
			padding: 7px;
			border-width: 7px;
			border-radius: 10px;
		}
		.hud {
			width: 99vw;
			bottom: 3px;
			grid-template-columns: auto 1fr auto;
			border-width: 3px;
			border-radius: 14px;
		}
		.hud-left .utility,
		.auto {
			display: none;
		}
		.bonus-button {
			min-width: 64px;
		}
		.metric.balance {
			display: none;
		}
		.metrics {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
		.buy-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
		.buy-panel {
			padding: 18px 12px;
		}
		.buy-panel h2 {
			font-size: 25px;
		}
	}
	@media (max-height: 650px) and (orientation: landscape) {
		.brand {
			top: 2px;
			transform: translateX(-50%) scale(0.76);
			transform-origin: top center;
		}
		.game-stage {
			/* Only the top moves here — the bottom inset stays with the width breakpoints, which are
			   the ones that actually change the HUD's height. */
			top: 5%;
		}
		.hud {
			min-height: 58px;
		}
		.bonus-status {
			display: none;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		*,
		*::before,
		*::after {
			animation-duration: 1ms !important;
			transition-duration: 1ms !important;
		}
	}

	/* Pixel-art skin. Keeps game state, controls, math, and responsive layout unchanged. */
	.scene {
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		background: #148fd5 var(--pixel-background) center / 100% 100% no-repeat;
		image-rendering: pixelated;
		transition: none;
	}
	.scene::after {
		background:
			repeating-linear-gradient(0deg, rgb(0 0 0 / 3%) 0 2px, transparent 2px 4px),
			rgb(4 20 13 / 12%);
		mix-blend-mode: multiply;
	}
	.scene > .sun-moon,
	.scene > .rainbow,
	.scene > .cloud,
	.scene > .tree-line,
	.scene > .meadow,
	.scene > .corner-foliage {
		display: none;
	}
	.brand {
		top: max(3px, 0.5vh);
		width: min(410px, 42vw);
		height: clamp(48px, 8vh, 82px);
		padding: 0;
		border: 0;
		border-radius: 0;
		background: url('/assets/veggie-salad/pixel/logo.png') center / contain no-repeat;
		box-shadow: none;
		transform: translateX(-50%);
	}
	.brand div,
	.brand-leaf {
		display: none;
	}
	.game-stage {
		top: 10%;
		bottom: max(12%, 118px);
	}
	.board-shadow {
		border-radius: 0;
		background: rgb(0 20 7 / 64%);
		filter: blur(0);
		transform: translate(8px, 10px);
	}
	.board-frame {
		padding: clamp(5px, 0.8vw, 10px);
		border: clamp(7px, 0.9vw, 12px) solid #713a0d;
		border-radius: 0;
		background: #9b5b16;
		box-shadow:
			inset 0 0 0 3px #d49a36,
			inset 0 0 0 6px #4b260b,
			8px 10px 0 #321b0a;
	}
	.board-frame::before {
		inset: 4px;
		border: 2px solid #f0bd55;
		border-radius: 0;
	}
	.board-frame::after {
		background: none;
	}
	.board {
		gap: 2px;
		padding: 2px;
		background: #a86a20;
		border: 3px solid #281707;
		animation-timing-function: steps(4);
	}
	.cell::before {
		background: #304817;
		box-shadow:
			inset 0 0 0 1px #13240c,
			inset 0 -4px 0 rgb(0 0 0 / 18%);
	}
	.cell.cluster-hit::before {
		background: #7eaa25;
		box-shadow:
			inset 0 0 0 2px #e8f45c,
			0 0 0 2px #4d7315;
	}
	.cell.scatter-hit::before {
		background: #b47c1e;
		box-shadow:
			inset 0 0 0 2px #ffe36e,
			0 0 0 2px #70420c;
	}
	.symbol,
	.backplate {
		filter: drop-shadow(3px 3px 0 rgb(0 0 0 / 42%));
		image-rendering: pixelated;
	}
	.backplate {
		filter: drop-shadow(0 0 0 #ffe36a);
	}
	.multiplier {
		border-radius: 0;
		background: #c52b1d;
		box-shadow: 2px 2px 0 #390c08;
		font-family: inherit;
	}
	.win-label {
		font-family: inherit;
		font-size: calc(min(100cqw, 100cqh) / var(--grid-size) * 0.34);
		-webkit-text-stroke: 0.12em #18330b;
		text-shadow: 3px 3px 0 #18330b;
		animation: pixel-win-in 260ms steps(4) both;
	}
	.bonus-status,
	.scatter-tally,
	.feature-ribbon,
	.cluster-panel,
	.hud,
	.quick-menu,
	.buy-panel,
	.confirm-panel,
	.auto-panel,
	.event-card {
		border-radius: 0;
		font-family: inherit;
	}
	.bonus-status,
	.scatter-tally,
	.feature-ribbon {
		border: 3px solid #3c210b;
		box-shadow: 3px 3px 0 #211107;
		background: #5c2d0a;
	}
	.cluster-panel {
		border: 4px solid #6f390e;
		background: #24380f;
		box-shadow: 4px 5px 0 #251407;
	}
	.panel-head {
		border-radius: 0;
		background: #8b5217;
		color: #ffe475;
	}
	.panel-row {
		border-radius: 0;
		border-color: #47631d;
	}
	.hud {
		width: min(92vw, 1700px);
		min-height: 116px;
		padding: 12px 20px;
		gap: 0;
		border: 4px solid #6d390d;
		border-radius: 0;
		background: #3b1e09;
		box-shadow: 5px 6px 0 rgb(18 8 2 / 75%);
	}
	.hud-left,
	.hud-right,
	.metrics {
		gap: 0;
	}
	.hud-left .utility {
		width: 72px;
		height: 72px;
		border-right: 2px solid #80500d !important;
		box-shadow: none;
	}
	.bonus-button {
		min-width: 190px;
		height: 72px;
		border: 0 !important;
		box-shadow: none !important;
		background: #ec9200;
	}
	.chance {
		display: none;
	}
	.metric {
		min-width: 180px;
		min-height: 72px;
		padding: 0 28px;
		border-left: 2px solid #80500d;
	}
	.metric span {
		font-size: 14px;
	}
	.metric strong {
		font-size: clamp(18px, 1.7vw, 27px);
	}
	.hud-right {
		margin-left: auto;
		gap: 18px;
	}
	.bet-stepper button {
		width: 58px;
		height: 58px;
	}
	.spin {
		width: 150px;
		margin: -28px 0;
		border: 7px solid #f7c45c !important;
	}
	.spin span {
		font-size: 92px;
	}
	.hud button,
	.buy-card,
	.confirm-actions button,
	.auto-options button,
	.auto-start,
	.event-card button,
	.quick-menu button {
		border-radius: 0;
		font-family: inherit;
		box-shadow: 3px 3px 0 #1c0d04;
	}
	.spin {
		border-radius: 0 !important;
		background: #e29b19;
		box-shadow: 4px 4px 0 #412008 !important;
	}
	.event-overlay,
	.modal-layer {
		background: rgb(4 17 12 / 72%);
		backdrop-filter: none;
	}
	.event-card {
		width: min(620px, 88vw);
		padding: clamp(24px, 5vw, 48px);
		border: 6px solid #6d360b;
		background: #315018;
		box-shadow:
			inset 0 0 0 4px #d49b35,
			inset 0 0 0 8px #351b08,
			8px 10px 0 #1c0d05;
		animation: pixel-card-in 360ms steps(5);
	}
	.event-card::before {
		inset: 12px;
		border: 2px solid #9cc53c;
		border-radius: 0;
	}
	.event-card h2 {
		font-family: inherit;
		color: #ffe24e;
		text-shadow: 4px 4px 0 #552308;
	}
	.event-card p {
		color: #fff6bd;
	}
	.event-card > strong {
		color: #fff;
		text-shadow: 3px 3px 0 #4f2408;
	}
	.event-card.kind-win {
		background: #8c2418;
	}
	.event-card.kind-bonus {
		background: #8a5911;
	}
	.event-card.kind-mystery {
		background: #4e2077;
	}
	.event-card.kind-retrigger {
		background: #1e5c72;
	}
	.buy-panel,
	.confirm-panel,
	.auto-panel {
		border: 6px solid #6d360b;
		background: #294514;
		box-shadow:
			inset 0 0 0 4px #d49b35,
			inset 0 0 0 8px #351b08,
			8px 10px 0 #1c0d05;
	}
	.buy-card {
		border-color: #b57925;
		background: #3b5c1c;
	}
	.close {
		border-radius: 0 !important;
	}
	@keyframes harvest {
		0% {
			transform: scale(1);
			opacity: 1;
			filter: brightness(1);
		}
		24% {
			transform: scale(1.18, 0.84);
			filter: brightness(2.4);
		}
		48% {
			transform: scale(0.88, 1.13);
			opacity: 1;
			filter: brightness(3);
		}
		76% {
			transform: scale(0.42);
			opacity: 0.7;
			filter: brightness(2);
		}
		100% {
			transform: scale(0);
			opacity: 0;
			filter: brightness(2);
		}
	}
	@keyframes pixel-burst-a {
		0%,
		20% {
			transform: translate(0, 0) scale(0);
			opacity: 0;
		}
		35% {
			transform: translate(0, 0) scale(1);
			opacity: 1;
		}
		100% {
			transform: translate(-120%, -95%) scale(0.3);
			opacity: 0;
		}
	}
	@keyframes pixel-burst-b {
		0%,
		20% {
			transform: rotate(45deg) translate(0, 0) scale(0);
			opacity: 0;
		}
		35% {
			transform: rotate(45deg) translate(0, 0) scale(0.72);
			opacity: 1;
		}
		100% {
			transform: rotate(45deg) translate(110%, 105%) scale(0.2);
			opacity: 0;
		}
	}
	@keyframes pixel-win-in {
		0% {
			opacity: 0;
			transform: translate(-50%, -50%) scale(0);
		}
		75% {
			opacity: 1;
			transform: translate(-50%, -50%) scale(1.12);
		}
		100% {
			transform: translate(-50%, -50%) scale(1);
		}
	}
	@keyframes pixel-card-in {
		0% {
			opacity: 0;
			transform: scale(0.72);
		}
		60% {
			opacity: 1;
			transform: scale(1.04);
		}
		100% {
			transform: scale(1);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.scene::after {
			display: none;
		}
	}

	/* Currency values fit from their actual rendered character count. cqw measures each metric,
	   not viewport, so long currency prefixes and large balances cannot cross dividers. */
	.metric {
		container-type: inline-size;
	}
	.metric strong {
		display: block;
		width: 100%;
		max-width: 100%;
		overflow: visible;
		font-size: clamp(10px, calc(145cqw / var(--chars, 8)), 28px) !important;
		letter-spacing: 0;
		text-overflow: clip;
	}

	/* Bonus HUD has two independent values: current free-spin WIN stays in the main HUD; this
	   compact side stack shows spin progress and the authoritative cumulative bonus total. */
	.bonus-readouts {
		position: absolute;
		top: 15%;
		right: clamp(8px, 2vw, 28px);
		z-index: 14;
		display: grid;
		gap: clamp(8px, 1.1vh, 13px);
		width: clamp(132px, 13vw, 196px);
		pointer-events: none;
	}
	.bonus-readout,
	.bonus-status {
		position: static;
		top: auto;
		right: auto;
		display: grid;
		width: 100%;
		min-width: 0;
		padding: clamp(10px, 1.3vh, 15px) 9px;
		border: 5px solid #3a1b05;
		border-radius: 0;
		background:
			repeating-linear-gradient(0deg, rgb(255 255 255 / 4%) 0 3px, transparent 3px 7px), #5c2d0a;
		box-shadow:
			inset 0 0 0 3px #d99a32,
			inset 0 0 0 7px #75400e,
			5px 5px 0 #211107;
		font-family: inherit;
		text-align: center;
		container-type: inline-size;
	}
	.bonus-total {
		background:
			repeating-linear-gradient(0deg, rgb(255 255 255 / 4%) 0 3px, transparent 3px 7px), #24380f;
	}
	.bonus-readout span,
	.bonus-readout small,
	.bonus-status span,
	.bonus-status small {
		color: #ffe15b;
		font-size: clamp(8px, 0.72vw, 12px);
		font-weight: 1000;
		letter-spacing: 0.08em;
	}
	.bonus-readout strong,
	.bonus-status strong {
		display: block;
		width: 100%;
		overflow: hidden;
		font-size: clamp(14px, calc(150cqw / var(--chars, 8)), 28px);
		line-height: 1.15;
		white-space: nowrap;
	}

	/* Desktop HUD: measured against supplied 1820×244 reference crop. */
	@media (min-width: 1180px) {
		.hud {
			grid-template-columns: clamp(220px, 17vw, 310px) minmax(460px, 1fr) auto;
			width: min(92vw, 1700px);
			height: clamp(78px, 8.6vh, 96px);
			min-height: 0;
			padding: 6px 14px;
			gap: 0;
			border: 4px solid #78420d;
			background: #351a06;
			box-shadow:
				inset 0 0 0 2px #9a5b12,
				0 7px 0 rgb(20 9 2 / 74%);
			overflow: visible;
			bottom: clamp(20px, 3vh, 38px);
		}
		.hud-left {
			display: grid;
			grid-template-columns: clamp(58px, 4.4vw, 76px) 1fr;
			width: 100%;
			height: 100%;
			gap: 0;
		}
		.hud-left .utility {
			width: 100%;
			height: 100%;
			border: 2px solid #9c641b !important;
			background: #2e1806;
			box-shadow: inset 0 0 0 2px #1c0d03;
			font-size: clamp(24px, 2vw, 36px);
		}
		.bonus-button {
			width: 100%;
			min-width: 0;
			height: 100%;
			border: 2px solid #f3a70c !important;
			background: #eb9000;
			box-shadow: none !important;
		}
		.bonus-button span {
			font-size: clamp(15px, 1.25vw, 23px);
		}
		.bonus-button small {
			display: none;
		}
		.metrics {
			display: grid;
			grid-template-columns: 1fr 1.2fr 1fr;
			width: 100%;
			height: 100%;
			gap: 0;
		}
		.metric {
			align-content: center;
			min-width: 0;
			min-height: 0;
			height: 100%;
			padding: 0 clamp(14px, 1.4vw, 27px);
			border-left: 2px solid #70400d;
			text-align: left;
		}
		.metric span {
			font-size: clamp(10px, 0.9vw, 16px);
			letter-spacing: 0.16em;
		}
		.metric strong {
			font-size: clamp(17px, 1.55vw, 28px);
			line-height: 1.15;
		}
		.hud-right {
			display: grid;
			grid-template-columns: auto clamp(92px, 7.4vw, 132px) clamp(48px, 3.8vw, 66px) clamp(
					48px,
					3.8vw,
					66px
				);
			align-items: center;
			height: 100%;
			margin-left: 0;
			gap: clamp(7px, 0.8vw, 14px);
			padding-left: clamp(8px, 1vw, 18px);
			border-left: 2px solid #70400d;
		}
		.bet-stepper {
			gap: clamp(5px, 0.6vw, 10px);
		}
		.bet-stepper button {
			width: clamp(46px, 3.8vw, 62px);
			height: clamp(46px, 3.8vw, 62px);
			border: 2px solid #8e5817 !important;
			background: #2c1705;
			box-shadow: 3px 3px 0 #160901;
		}
		.spin {
			width: clamp(92px, 7.4vw, 132px);
			height: clamp(92px, 7.4vw, 132px);
			margin: clamp(-20px, -1.2vw, -12px) 0;
			border: 7px solid #c87900 !important;
			border-radius: 50% !important;
			background: #ed9700;
			box-shadow:
				inset 0 0 0 4px #f8bd32,
				4px 5px 0 #6d3905 !important;
		}
		.spin span {
			font-size: clamp(58px, 5vw, 88px);
		}
		.hud-right .utility {
			width: 100%;
			height: clamp(46px, 3.8vw, 62px);
			border: 2px solid #8e5817 !important;
			border-radius: 0;
			background: #2c1705;
			box-shadow: 3px 3px 0 #160901;
		}
	}

	@media (min-width: 681px) and (max-width: 1179px) {
		.hud {
			grid-template-columns: clamp(130px, 20vw, 180px) minmax(0, 1fr) auto;
			width: calc(100vw - 16px);
			height: 76px;
			min-height: 0;
			padding: 5px 8px;
			gap: 0;
			bottom: 14px;
			border-radius: 0;
			overflow: visible;
		}
		.hud-left {
			display: grid;
			grid-template-columns: 44px 1fr;
			height: 100%;
			gap: 0;
		}
		.hud-left .utility,
		.bonus-button {
			width: 100%;
			height: 100%;
			min-width: 0;
			border-radius: 0;
		}
		.bonus-button small,
		.chance {
			display: none;
		}
		.metrics {
			display: grid;
			grid-template-columns: repeat(3, minmax(0, 1fr));
			height: 100%;
			gap: 0;
		}
		.metric {
			align-content: center;
			min-width: 0;
			min-height: 0;
			height: 100%;
			padding: 0 8px;
			border-left: 1px solid #70400d;
			text-align: left;
		}
		.metric span {
			font-size: 9px;
		}
		.metric strong {
			font-size: clamp(9px, calc(140cqw / var(--chars, 8)), 20px) !important;
		}
		.hud-right {
			display: grid;
			grid-template-columns: auto 76px 40px 40px;
			align-items: center;
			height: 100%;
			margin: 0;
			padding-left: 7px;
			gap: 5px;
			border-left: 1px solid #70400d;
		}
		.bet-stepper {
			gap: 3px;
		}
		.bet-stepper button {
			width: 34px;
			height: 40px;
		}
		.spin {
			width: 76px;
			height: 76px;
			margin: -8px 0;
			border: 5px solid #c87900 !important;
			border-radius: 50% !important;
		}
		.spin span {
			font-size: 52px;
		}
		.hud-right .utility {
			display: grid;
			width: 40px;
			height: 44px;
			border-radius: 0;
		}
	}

	@media (max-width: 680px) {
		.game-stage {
			bottom: 124px;
		}
		.hud {
			grid-template-areas:
				'metrics metrics'
				'left right';
			grid-template-columns: 108px minmax(0, 1fr);
			grid-template-rows: 42px 56px;
			width: calc(100vw - 8px);
			height: 106px;
			min-height: 0;
			padding: 3px 4px;
			gap: 2px 0;
			bottom: 4px;
			border-width: 3px;
			border-radius: 0;
			overflow: visible;
		}
		.hud-left {
			grid-area: left;
			display: grid;
			grid-template-columns: 36px 72px;
			height: 52px;
			gap: 0;
		}
		.hud-left .utility {
			display: grid;
			width: 36px;
			height: 52px;
			border-radius: 0;
			font-size: 18px;
		}
		.bonus-button {
			width: 72px;
			min-width: 0;
			height: 52px;
			padding: 2px;
			border-radius: 0;
		}
		.bonus-button span {
			font-size: 10px;
		}
		.bonus-button small,
		.chance {
			display: none;
		}
		.metrics {
			grid-area: metrics;
			display: grid;
			grid-template-columns: repeat(3, minmax(0, 1fr));
			height: 42px;
			gap: 0;
		}
		.metric {
			align-content: center;
			display: grid;
			min-width: 0;
			min-height: 0;
			height: 42px;
			padding: 0 5px;
			border-left: 1px solid #70400d;
			text-align: left;
		}
		.metric:first-child {
			border-left: 0;
		}
		.metric span {
			font-size: 7px;
			line-height: 1;
		}
		.metric strong {
			font-size: clamp(8px, calc(138cqw / var(--chars, 8)), 15px) !important;
			line-height: 1.1;
		}
		.hud-right {
			grid-area: right;
			display: grid;
			grid-template-columns: 56px 54px 34px 34px;
			justify-content: end;
			align-items: center;
			height: 52px;
			margin: 0;
			padding: 0;
			gap: 3px;
		}
		.bet-stepper {
			gap: 2px;
		}
		.bet-stepper button {
			width: 27px;
			height: 36px;
			padding: 0;
			font-size: 15px;
		}
		.spin {
			width: 54px;
			height: 54px;
			margin: -1px 0;
			border: 4px solid #c87900 !important;
			border-radius: 50% !important;
		}
		.spin span {
			font-size: 38px;
		}
		.hud-right .utility,
		.auto {
			display: grid;
			width: 34px;
			height: 38px;
			border-radius: 0;
			padding: 0;
		}
		.hud-right .utility span {
			font-size: 15px;
		}
	}

	/* Portrait composition: board, payout strip, split control/metric HUD. */
	@media (max-width: 680px) and (orientation: portrait) {
		.brand {
			top: clamp(48px, 7vh, 72px);
			width: 90vw;
			height: clamp(68px, 11vh, 104px);
		}
		.game-stage {
			top: clamp(128px, 17vh, 158px);
			bottom: clamp(205px, 29vh, 260px);
			padding: 0 8px;
		}
		.cluster-panel {
			display: block;
			left: 50%;
			top: auto;
			bottom: -50px;
			width: min(94vw, 430px);
			padding: 4px;
			border-width: 3px;
			transform: translateX(-50%);
		}
		.panel-rows {
			display: grid;
			grid-template-columns: repeat(var(--slots, 5), minmax(0, 1fr));
			grid-template-rows: 34px;
			gap: 3px;
		}
		.panel-row {
			grid-template-columns: auto 1fr;
			min-height: 34px;
			padding: 1px 3px;
			font-size: 8px;
		}
		.panel-row span:nth-of-type(2),
		.panel-row strong {
			display: none;
		}
		.hud {
			grid-template-areas:
				'left right'
				'metrics metrics';
			grid-template-columns: minmax(112px, 42%) minmax(0, 1fr);
			grid-template-rows: clamp(64px, 9.5vh, 88px) clamp(54px, 7.5vh, 68px);
			width: calc(100vw - 16px);
			height: auto;
			padding: 0;
			row-gap: clamp(18px, 3.5vh, 34px);
			bottom: clamp(10px, 2vh, 18px);
			border: 0;
			background: none;
			box-shadow: none;
		}
		.hud::before {
			content: '';
			position: absolute;
			z-index: 0;
			z-index: -1;
			inset: 0 0 auto;
			height: clamp(64px, 9.5vh, 88px);
			border: 3px solid #78420d;
			background: #351a06;
			box-shadow: 0 5px 0 rgb(20 9 2 / 68%);
		}
		.hud-left {
			grid-area: left;
			grid-template-columns: clamp(38px, 12vw, 58px) minmax(68px, 1fr);
			height: 100%;
			padding: 7px 0 7px 7px;
		}
		.hud-left .utility,
		.bonus-button {
			height: 100%;
		}
		.hud-right {
			grid-area: right;
			grid-template-columns: clamp(62px, 19vw, 96px) clamp(34px, 10vw, 50px) clamp(34px, 10vw, 50px);
			justify-content: end;
			height: 100%;
			padding: 0 7px 0 4px;
			gap: clamp(3px, 1.2vw, 8px);
		}
		.spin {
			width: clamp(62px, 19vw, 96px);
			height: clamp(62px, 19vw, 96px);
			margin: clamp(-7px, -1.2vh, -3px) 0;
		}
		.spin span {
			font-size: clamp(42px, 13vw, 68px);
		}
		.hud-right .utility,
		.auto {
			width: clamp(34px, 10vw, 50px);
			height: clamp(42px, 12vw, 58px);
		}
		.bet-stepper {
			position: absolute;
			z-index: 3;
			left: 28%;
			right: 28%;
			bottom: 0;
			display: flex;
			justify-content: space-between;
			height: clamp(54px, 7.5vh, 68px);
			padding: 6px;
			border: 3px solid #8c520f;
			background: #351a06;
		}
		.bet-stepper button {
			width: clamp(34px, 10vw, 48px);
			height: 100%;
			border-radius: 50%;
		}
		.metrics {
			grid-area: metrics;
			grid-template-columns: 1fr 1.7fr 1fr;
			height: clamp(54px, 7.5vh, 68px);
			gap: 6px;
		}
		.metric {
			height: 100%;
			padding: 7px 9px;
			border: 2px solid #1b3441;
			background: rgb(2 17 25 / 94%);
		}
		.metric:first-child {
			grid-column: 1;
			grid-row: 1;
		}
		.metric.bet {
			z-index: 2;
			grid-column: 2;
			grid-row: 1;
			padding-inline: 32%;
			border-color: #8c520f;
			background: #351a06;
			text-align: center;
		}
		.metric.win {
			grid-column: 3;
			grid-row: 1;
		}
		.metric span {
			font-size: clamp(7px, 2.5vw, 11px);
		}
		.metric strong {
			font-size: clamp(8px, calc(136cqw / var(--chars, 8)), 18px) !important;
		}
		.bonus-readouts {
			top: clamp(74px, 10vh, 106px);
			right: 8px;
			gap: 6px;
			width: clamp(104px, 27vw, 132px);
		}
		.bonus-readout,
		.bonus-status {
			padding: 7px 5px;
			border-width: 3px;
		}
		.bonus-readout span,
		.bonus-readout small,
		.bonus-status span,
		.bonus-status small {
			font-size: 7px;
		}
	}

	@media (max-height: 650px) and (orientation: landscape) {
		.bonus-readouts {
			top: 8%;
			width: 106px;
			gap: 4px;
		}
		.bonus-readout,
		.bonus-status {
			padding: 4px;
		}
	}

	/* Final reference lock: shipped pixel art, not the old procedural CSS approximation. */
	.scene {
		background: #16a9ed;
		image-rendering: pixelated;
	}
	.pixel-background-stack {
		position: absolute;
		inset: 0;
		z-index: 0;
		pointer-events: none;
	}
	.pixel-background {
		position: absolute;
		inset: 0;
		z-index: 0;
		background: var(--pixel-background) center bottom / 100% auto no-repeat;
		image-rendering: pixelated;
		pointer-events: none;
	}
	.background-bonus {
		opacity: 0;
	}
	.sun-moon,
	.rainbow,
	.cloud,
	.tree-line,
	.meadow {
		display: none;
	}
	.corner-foliage {
		z-index: 1;
		background: none;
		overflow: hidden;
	}
	.corner-foliage::before,
	.corner-foliage::after {
		content: '';
		position: absolute;
		top: -6px;
		width: clamp(180px, 25vw, 390px);
		height: clamp(105px, 19vh, 230px);
		background-image: var(--pixel-background);
		background-repeat: no-repeat;
		background-size: max(720px, 82vw) auto;
		image-rendering: pixelated;
		filter: brightness(0.88) saturate(1.08);
	}
	.corner-foliage::before {
		left: -10px;
		background-position: left bottom;
		transform: scaleY(-1);
	}
	.corner-foliage::after {
		right: -10px;
		background-position: right bottom;
		transform: scale(-1);
	}
	.scene.theme-sunset {
		background: #f49b4b;
	}
	.scene.theme-night {
		background: #123d74;
	}
	.scene.theme-rainbow {
		background: #bde8f4;
	}
	.theme-sunset .background-base {
		filter: sepia(0.18) saturate(1.12) brightness(0.88);
	}
	.theme-night .background-base {
		filter: brightness(0.48) saturate(0.85) hue-rotate(34deg);
	}
	.theme-rainbow .background-base {
		filter: saturate(1.3) brightness(1.08);
	}
	.brand {
		top: clamp(-38px, -2.8vw, -27px);
		width: min(34vw, 420px);
		height: auto;
		padding: 0;
		border: 0;
		border-radius: 0;
		background: none;
		box-shadow: none;
		transform: translateX(-50%);
		image-rendering: pixelated;
	}
	.brand img {
		display: block;
		width: 100%;
		height: auto;
		image-rendering: pixelated;
		filter: drop-shadow(4px 5px 0 rgb(38 17 3 / 48%));
	}
	.studio-mark {
		position: absolute;
		top: clamp(10px, 1.8vh, 20px);
		right: clamp(12px, 2vw, 28px);
		z-index: 13;
		width: clamp(72px, 8vw, 108px);
		height: auto;
		object-fit: contain;
		filter: drop-shadow(2px 2px 0 rgb(7 57 68 / 42%));
	}
	.game-stage {
		top: clamp(46px, 7vh, 72px);
		bottom: clamp(92px, 13vh, 138px);
	}
	.board-wrap {
		width: min(100cqw, 125cqh);
		height: min(80cqw, 100cqh);
		aspect-ratio: 1.25;
	}
	.hud {
		bottom: clamp(7px, 1.4vh, 16px) !important;
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		image-rendering: pixelated;
	}
	.hud button {
		position: relative;
		isolation: isolate;
	}
	.hud button svg {
		display: block;
		width: 62%;
		height: 62%;
		margin: auto;
		fill: currentcolor;
		filter: drop-shadow(2px 2px 0 rgb(35 13 2 / 50%));
	}
	.hud .utility,
	.bet-stepper button {
		border-radius: 0 !important;
		clip-path: polygon(0 0, 72% 0, 72% 10%, 100% 10%, 100% 90%, 72% 90%, 72% 100%, 0 100%);
	}
	.hud-left .utility {
		clip-path: polygon(0 0, 76% 0, 76% 9%, 100% 9%, 100% 91%, 76% 91%, 76% 100%, 0 100%);
	}
	.bonus-button {
		clip-path: polygon(0 0, 96% 0, 96% 8%, 100% 8%, 100% 92%, 96% 92%, 96% 100%, 0 100%);
	}
	.bet-stepper button:first-child {
		transform: scaleX(-1);
	}
	.spin {
		clip-path: none !important;
		border-radius: 50% !important;
	}
	.spin-arrow {
		width: 76% !important;
		height: 76% !important;
		fill: #fff !important;
		filter: drop-shadow(4px 4px 0 rgb(113 45 2 / 34%)) !important;
	}
	.hud-right .utility {
		display: grid;
		grid-template-rows: 1fr auto;
		place-items: center;
		padding: 5px 2px 4px;
	}
	.hud-right .utility svg {
		width: 50%;
		height: 50%;
	}
	.hud-right .utility small {
		min-height: 0.72em;
		font-size: clamp(5px, 0.48vw, 8px);
		line-height: 1;
	}

	@media (min-width: 681px) {
		.hud {
			width: min(91vw, 1450px);
			min-height: 72px;
			padding: 6px 10px;
			gap: clamp(8px, 1vw, 16px);
			border: 3px solid #8b510f;
			border-radius: 0;
			background: #351903;
			box-shadow:
				inset 0 0 0 2px #5f3408,
				0 6px 0 rgb(21 8 1 / 55%);
		}
		.hud-left,
		.hud-right {
			gap: 7px;
		}
		.hud-left .utility {
			width: 54px;
			height: 54px;
		}
		.bonus-button {
			width: clamp(112px, 11vw, 148px);
			min-width: 112px;
			height: 54px;
			min-height: 54px;
			border-radius: 0;
			background: #ed9300;
			box-shadow: inset 0 3px #ffb321;
		}
		.metrics {
			align-self: stretch;
			gap: 0;
		}
		.metric {
			align-content: center;
			padding: 0 clamp(8px, 1.4vw, 24px);
			border-left: 2px solid #6b3b0c;
			text-align: left;
		}
		.metric:last-child {
			border-right: 2px solid #6b3b0c;
		}
		.metric strong {
			font-size: clamp(13px, calc(170cqw / var(--chars, 8)), 23px) !important;
		}
		.bet-stepper {
			gap: 6px;
		}
		.bet-stepper button {
			width: 46px;
			height: 50px;
			font-size: 22px;
		}
		.spin {
			width: 88px;
			height: 88px;
			margin: -20px 2px -12px;
			border-width: 5px !important;
		}
		.hud-right .utility {
			width: 50px;
			height: 54px;
		}
	}

	@media (min-width: 681px) and (max-width: 1179px) {
		.hud-left .utility {
			width: 44px;
			height: 100%;
		}
		.bonus-button {
			width: 100%;
			min-width: 0;
			height: 100%;
			min-height: 0;
		}
		.bet-stepper button {
			width: 34px;
			height: 40px;
		}
		.spin {
			width: 76px;
			height: 76px;
			margin: -8px 0;
		}
		.hud-right .utility {
			width: 40px;
			height: 44px;
		}
	}

	@media (max-width: 680px) {
		.pixel-background {
			background-size: auto 62%;
		}
		.corner-foliage::before,
		.corner-foliage::after {
			width: 42vw;
			height: 16vh;
			background-size: auto 210px;
		}
		.brand {
			top: clamp(8px, 1.5vh, 18px);
			width: min(94vw, 730px);
			height: auto;
		}
		.studio-mark {
			top: max(7px, env(safe-area-inset-top, 0px));
			right: 8px;
			width: clamp(54px, 16vw, 78px);
		}
		.game-stage {
			top: clamp(112px, 16vh, 170px);
			bottom: clamp(190px, 27vh, 252px);
		}
		.hud {
			bottom: max(6px, env(safe-area-inset-bottom, 0px)) !important;
		}
		.hud button svg {
			width: 58%;
			height: 58%;
		}
		.hud .utility,
		.bet-stepper button,
		.hud-left .utility,
		.bonus-button {
			clip-path: polygon(0 0, 78% 0, 78% 9%, 100% 9%, 100% 91%, 78% 91%, 78% 100%, 0 100%);
		}
		.spin {
			clip-path: none !important;
		}
	}

	@media (max-height: 520px) and (orientation: landscape) {
		.brand {
			top: -38px;
			width: min(42vw, 440px);
		}
		.game-stage {
			top: 34px;
			bottom: 76px;
		}
		.hud {
			bottom: 4px !important;
			height: 62px !important;
		}
	}

	@keyframes scatter-aura-in {
		0% {
			opacity: 0;
			transform: scale(0.35);
		}
		55% {
			opacity: 1;
			transform: scale(1.15);
		}
		100% {
			opacity: 1;
			transform: scale(1);
		}
	}
	.cell.scatter-hit .backplate {
		animation: scatter-aura-in 360ms steps(5, end) both;
	}

	/* Final HUD furniture lock. The supplied 50×50 frame is the canonical shell for every small
	   control. Icons remain live SVG/text so disabled/pressed state and accessibility stay wired. */
	.hud .utility,
	.hud-left .utility,
	.hud-right .utility,
	.bet-stepper button {
		clip-path: none !important;
		border: 0 !important;
		border-radius: 0 !important;
		background-color: transparent !important;
		background-image: var(--hud-button) !important;
		background-position: center !important;
		background-repeat: no-repeat !important;
		background-size: 100% 100% !important;
		box-shadow: none !important;
		image-rendering: pixelated;
	}
	.bet-stepper button:first-child {
		transform: none !important;
	}
	.bonus-button {
		clip-path: none !important;
		border: 2px solid #a86105 !important;
		border-radius: 0 !important;
		background: #ed9300 !important;
		box-shadow:
			inset 0 3px 0 #ffb62b,
			inset 0 -3px 0 #c96d00 !important;
	}
	.bonus-button small {
		display: none !important;
	}

	/* Reference HUD at tablet widths is a compact 58px rail, not the oversized earlier pass. */
	@media (min-width: 681px) and (max-width: 1179px) {
		.hud {
			grid-template-columns: 120px minmax(0, 1fr) auto;
			height: 60px;
			padding: 4px 6px;
		}
		.hud-left {
			grid-template-columns: 44px 76px;
		}
		.hud-left .utility {
			width: 44px;
			height: 44px;
			align-self: center;
		}
		.bonus-button {
			width: 76px;
			height: 44px;
			align-self: center;
		}
		.hud-right {
			grid-template-columns: auto 72px 40px 40px;
			gap: 3px;
			padding-left: 5px;
		}
		.bet-stepper {
			gap: 2px;
		}
		.bet-stepper button {
			width: 34px;
			height: 42px;
		}
		.spin {
			width: 72px;
			height: 72px;
			margin: -10px 0;
		}
		.hud-right .utility {
			width: 40px;
			height: 42px;
		}
	}

	@media (max-width: 680px) and (orientation: landscape) {
		.hud {
			grid-template-columns: 118px minmax(0, 1fr);
		}
		.hud-left {
			grid-template-columns: 46px 72px;
		}
		.hud-left .utility {
			width: 46px;
			height: 46px;
			align-self: center;
		}
		.bonus-button {
			height: 46px;
			align-self: center;
		}
	}

	@media (max-width: 680px) and (orientation: portrait) {
		.hud-left .utility {
			width: clamp(42px, 12vw, 58px);
			height: clamp(42px, 12vw, 58px);
			align-self: center;
		}
		.bonus-button {
			height: clamp(42px, 12vw, 58px);
			align-self: center;
		}
	}

	/* Activation/purchase confirmation uses plain full rectangles. */
	.confirm-actions button {
		clip-path: none !important;
		border-radius: 0 !important;
	}
	.metric.bet.boosted span,
	.metric.bet.boosted strong {
		color: #ffe15b !important;
	}

	/* Mobile composition lock. Keep the five visual bands (logo, board, pays, controls, values)
	   in normal grid flow. This removes the height-dependent absolute-position drift that made
	   Mobile M/S bunch at the bottom while leaving a large hole above the board. */
	@media (max-width: 680px) and (orientation: portrait) {
		.scene {
			display: grid;
			grid-template-rows: auto auto auto;
			align-content: space-evenly;
			justify-items: center;
			padding: max(5px, env(safe-area-inset-top, 0px)) clamp(6px, 2vw, 10px)
				max(5px, env(safe-area-inset-bottom, 0px));
		}

		.brand {
			position: relative;
			inset: auto;
			grid-row: 1;
			width: min(96vw, 410px);
			height: auto;
			transform: none;
		}

		.studio-mark {
			top: max(7px, env(safe-area-inset-top, 0px));
			right: 7px;
			width: clamp(48px, 15vw, 70px);
		}

		.game-stage {
			position: relative;
			inset: auto;
			grid-row: 2;
			display: grid;
			grid-template-rows: auto auto;
			place-items: center;
			align-content: center;
			row-gap: clamp(7px, 1.5vh, 12px);
			width: 100%;
			height: auto;
			padding: 0;
			container-type: inline-size;
		}

		.board-wrap {
			grid-row: 1;
			width: 100%;
			height: auto;
			aspect-ratio: 1.25;
			container-type: size;
		}

		.cluster-panel {
			position: relative;
			inset: auto;
			grid-row: 2;
			display: block;
			width: 100%;
			padding: 4px;
			border-width: 3px;
			border-radius: 0;
			transform: none;
		}

		.panel-rows {
			grid-template-columns: repeat(var(--slots, 5), minmax(0, 1fr));
			grid-template-rows: clamp(32px, 6vh, 40px);
			gap: clamp(2px, 0.8vw, 4px);
		}

		.panel-row {
			grid-template-columns: auto 1fr;
			min-height: 0;
			height: 100%;
			padding: 1px clamp(2px, 0.8vw, 4px);
			border-radius: 0;
			font-size: clamp(7px, 2.2vw, 9px);
		}

		.panel-row span:nth-of-type(2),
		.panel-row strong {
			display: none;
		}

		.hud {
			--mobile-control-height: clamp(54px, 9.2vh, 72px);
			--mobile-metric-height: clamp(54px, 8.8vh, 66px);
			--mobile-row-gap: clamp(7px, 1.5vh, 12px);
			position: relative;
			inset: auto;
			grid-row: 3;
			grid-template-areas:
				'left right'
				'metrics metrics';
			grid-template-columns: minmax(112px, 40%) minmax(0, 60%);
			grid-template-rows: var(--mobile-control-height) var(--mobile-metric-height);
			row-gap: var(--mobile-row-gap);
			width: 100%;
			height: calc(
				var(--mobile-control-height) + var(--mobile-metric-height) + var(--mobile-row-gap)
			);
			min-height: 0;
			padding: 0;
			border: 0;
			background: none;
			box-shadow: none;
			transform: none;
		}

		.hud::before {
			inset: 0 0 auto;
			height: var(--mobile-control-height);
			border-width: 3px;
		}

		.hud-left {
			grid-area: left;
			grid-template-columns: clamp(40px, 12vw, 52px) minmax(66px, 1fr);
			align-items: center;
			gap: clamp(3px, 1vw, 6px);
			width: 100%;
			height: var(--mobile-control-height);
			padding: clamp(4px, 1vw, 6px) 0 clamp(4px, 1vw, 6px) clamp(4px, 1vw, 6px);
		}

		.hud-left .utility,
		.bonus-button {
			width: 100%;
			height: 100%;
			min-height: 0;
		}

		.hud-right {
			grid-area: right;
			display: grid;
			grid-template-columns:
				clamp(58px, 19vw, 82px)
				clamp(34px, 10.5vw, 46px)
				clamp(34px, 10.5vw, 46px);
			justify-content: space-evenly;
			align-items: center;
			gap: clamp(2px, 0.8vw, 5px);
			width: 100%;
			height: var(--mobile-control-height);
			padding: 0 clamp(3px, 1vw, 6px);
		}

		.spin {
			width: clamp(58px, 19vw, 82px);
			height: clamp(58px, 19vw, 82px);
			margin: 0;
		}

		.hud-right .utility,
		.auto {
			width: clamp(34px, 10.5vw, 46px);
			height: clamp(42px, 12vw, 54px);
		}

		.metrics {
			grid-area: metrics;
			grid-template-columns: 1fr 1.6fr 1fr;
			height: var(--mobile-metric-height);
			gap: clamp(4px, 1.5vw, 7px);
		}

		.metric {
			height: 100%;
			padding: clamp(5px, 1.6vw, 8px);
		}

		.metric.bet {
			padding-inline: 30%;
		}

		.bet-stepper {
			left: 28%;
			right: 28%;
			bottom: 0;
			height: var(--mobile-metric-height);
			padding: clamp(4px, 1.4vw, 7px);
		}

		.bet-stepper button {
			width: clamp(34px, 10.5vw, 46px);
			height: 100%;
		}

		.bonus-readouts {
			top: clamp(64px, 11vh, 96px);
		}
	}

	/* 400×225 popout: landscape phone rules cannot fit. Use an explicit compact side composition:
	   logo + payout history left, full board right, one complete control rail below. */
	@media (max-width: 520px) and (max-height: 300px) and (orientation: landscape) {
		.scene {
			display: block;
			padding: 0;
		}

		.brand {
			position: absolute;
			top: 4px;
			left: 5px;
			width: 130px;
			height: auto;
			transform: none;
		}

		.studio-mark {
			top: 4px;
			right: 5px;
			width: 45px;
		}

		.game-stage {
			inset: 3px 5px 45px 140px;
			display: grid;
			place-items: center;
			padding: 0;
			container-type: size;
		}

		.board-wrap {
			width: min(100cqw, 125cqh);
			height: min(80cqw, 100cqh);
			aspect-ratio: 1.25;
		}

		.cluster-panel {
			left: -135px;
			top: 52%;
			bottom: auto;
			display: block;
			width: 126px;
			padding: 3px;
			border-width: 3px;
			border-radius: 0;
			transform: translateY(-42%);
		}

		.panel-rows {
			grid-template-columns: 1fr;
			grid-template-rows: repeat(var(--slots, 5), 1fr);
			gap: 2px;
		}

		.panel-row {
			grid-template-columns: auto 16px auto 1fr;
			gap: 2px;
			min-height: 18px;
			padding: 0 3px;
			border-width: 1px;
			border-radius: 0;
			font-size: 6px;
		}

		.panel-row img {
			width: 14px;
			height: 14px;
		}

		.hud {
			position: absolute;
			left: 50%;
			bottom: 3px !important;
			grid-template-areas: 'left metrics right';
			grid-template-columns: 70px minmax(0, 1fr) 132px;
			gap: 2px;
			width: calc(100% - 8px);
			height: 40px !important;
			min-height: 40px;
			padding: 2px;
			border: 2px solid #774410;
			border-radius: 0;
			transform: translateX(-50%);
		}

		.hud::before {
			display: none;
		}

		.hud-left {
			grid-area: left;
			display: grid;
			grid-template-columns: 27px 43px;
			gap: 0;
			width: 70px;
			height: 34px;
			padding: 0;
		}

		.hud-left .utility,
		.bonus-button {
			width: 100%;
			height: 34px;
			min-width: 0;
			min-height: 0;
		}

		.bonus-button span {
			font-size: 6px;
		}

		.metrics {
			grid-area: metrics;
			grid-template-columns: repeat(3, minmax(0, 1fr));
			gap: 0;
			height: 34px;
		}

		.metric,
		.metric.bet {
			grid-column: auto;
			grid-row: auto;
			height: 34px;
			padding: 1px 3px;
			border-width: 0 0 0 1px;
			background: transparent;
			text-align: left;
		}

		.metric span {
			font-size: 5px;
		}

		.metric strong {
			font-size: clamp(6px, calc(122cqw / var(--chars, 8)), 9px) !important;
		}

		.hud-right {
			grid-area: right;
			display: grid;
			grid-template-columns: 45px 39px 22px 22px;
			gap: 1px;
			width: 132px;
			height: 34px;
			padding: 0;
		}

		.bet-stepper {
			position: static;
			display: grid;
			grid-template-columns: 1fr 1fr;
			gap: 1px;
			width: 45px;
			height: 34px;
			padding: 0;
			border: 0;
			background: transparent;
		}

		.bet-stepper button {
			width: 22px;
			height: 34px;
			padding: 0;
			font-size: 11px;
		}

		.spin {
			width: 39px;
			height: 39px;
			margin: -3px 0;
			border-width: 3px !important;
		}

		.hud-right .utility,
		.auto {
			width: 22px;
			height: 34px;
			padding: 0;
		}

		.hud button svg {
			width: 55%;
			height: 55%;
		}

		.bonus-readouts {
			top: 4px;
			right: 54px;
			width: 70px;
		}
	}

	/* Bonus garden variants. Same source art and geometry; restrained grading + one soft light
	   layer makes each tier readable without looking like a different game. */
	.scene {
		transition: background-color 850ms ease-in-out;
	}
	.pixel-background {
		transition:
			opacity 850ms ease-in-out,
			filter 850ms ease-in-out,
			background-position 650ms ease;
	}
	.corner-foliage::before,
	.corner-foliage::after {
		transition: filter 850ms ease-in-out;
	}

	.scene.bonus-normal {
		background: #22afe9;
	}

	.scene.bonus-super {
		background: #188fc5;
	}

	.scene.bonus-hidden {
		background: #35b6dd;
	}

	.pixel-background::after {
		content: '';
		position: absolute;
		inset: 0;
		background: transparent;
		mix-blend-mode: soft-light;
		opacity: 0;
		pointer-events: none;
		transition:
			opacity 650ms ease,
			background 650ms ease;
	}

	.background-normal {
		background-image: var(--bonus-normal-background);
		background-position: center;
		background-size: cover;
		filter: none;
	}
	.scene.bonus-normal .background-normal {
		opacity: 1;
	}

	.background-normal::after {
		background:
			radial-gradient(circle at 24% 22%, rgb(255 220 105 / 34%), transparent 34%),
			linear-gradient(rgb(255 170 54 / 10%), transparent 58%);
		opacity: 0.72;
	}

	.background-super {
		background-image: var(--bonus-super-background);
		background-position: center;
		background-size: cover;
		filter: none;
	}
	.scene.bonus-super .background-super {
		opacity: 1;
	}

	.background-super::after {
		background:
			radial-gradient(circle at 74% 20%, rgb(112 204 255 / 30%), transparent 33%),
			linear-gradient(rgb(28 65 137 / 20%), rgb(15 92 95 / 8%));
		opacity: 0.78;
	}

	.background-hidden {
		background-image: var(--bonus-hidden-background);
		background-position: center;
		background-size: cover;
		filter: none;
	}
	.scene.bonus-hidden .background-hidden {
		opacity: 1;
	}

	.background-hidden::after {
		background:
			radial-gradient(circle at 18% 28%, rgb(202 124 255 / 26%), transparent 31%),
			radial-gradient(circle at 82% 24%, rgb(99 255 197 / 24%), transparent 32%),
			linear-gradient(rgb(121 73 168 / 10%), transparent 62%);
		opacity: 0.84;
	}

	/* Canonical pressed frame. JS keeps it visible long enough to read on touch screens. */
	.hud-left .utility.pressed-flash,
	.bet-stepper button.pressed-flash,
	.hud-right .turbo.pressed-flash,
	.hud-right .auto.pressed-flash,
	.hud-left .utility:active,
	.bet-stepper button:active,
	.hud-right .turbo:active,
	.hud-right .auto:active {
		background-image: var(--hud-button-pressed) !important;
	}

	/* Compact pixel menu from the supplied reference: one icon cell + one label per row. */
	.quick-menu {
		left: max(5px, 2vw);
		bottom: clamp(74px, 12vh, 126px);
		display: grid;
		gap: 0;
		width: clamp(104px, 9vw, 128px);
		padding: 3px;
		border: 2px solid #9b5905;
		border-radius: 0;
		background: #351a07;
		box-shadow: 4px 4px 0 #160a02aa;
		image-rendering: pixelated;
	}

	.quick-menu button {
		display: grid;
		grid-template-columns: 31px minmax(0, 1fr);
		align-items: center;
		gap: 7px;
		height: 38px;
		padding: 2px 5px 2px 2px;
		border: 0;
		border-bottom: 1px solid #754003;
		border-radius: 0;
		background: #3d2009;
		color: #f3a51d;
		font-family: 'PixelOperator', monospace;
		font-size: 10px;
		font-weight: 900;
		line-height: 1;
		text-align: left;
	}

	.quick-menu button:last-child {
		border-bottom: 0;
	}

	.quick-menu button:hover,
	.quick-menu button:focus-visible {
		background: #542b09;
		outline: 1px solid #ef9b12;
		outline-offset: -2px;
	}

	.quick-menu button.off {
		color: #956416;
	}

	.quick-menu-icon {
		display: grid;
		place-items: center;
		width: 27px;
		height: 27px;
		border: 1px solid #a45b05;
		background: #4a270a;
		color: currentColor;
	}

	.quick-menu-icon svg {
		width: 16px;
		height: 16px;
		fill: currentColor;
	}

	.quick-menu-icon.info-icon {
		font-family: Georgia, serif;
		font-size: 18px;
		font-weight: 900;
	}

	/* Portrait owns the viewport height. Extra room stays inside the game stage, never below HUD. */
	@media (max-width: 680px) and (orientation: portrait) {
		.scene {
			grid-template-rows: auto minmax(0, 1fr) auto;
			align-content: stretch;
			row-gap: clamp(5px, 1vh, 9px);
			padding-bottom: 0;
			background: linear-gradient(#16a9ed 0 58%, #559f2a 58% 100%);
		}

		.game-stage {
			height: 100%;
			min-height: 0;
			align-content: space-evenly;
		}

		.hud {
			align-self: end;
			margin-bottom: 0;
		}

		.quick-menu {
			left: max(7px, env(safe-area-inset-left, 0px));
			bottom: calc(
				var(--mobile-control-height, 62px) + var(--mobile-metric-height, 60px) +
					var(--mobile-row-gap, 8px) + 12px
			);
		}
	}

	/* Popout S / short landscape: board centre, metrics left, controls in a vertical right dock.
	   The payout strip remains visible below the board. Nothing depends on desktop HUD width. */
	@media (max-width: 520px) and (max-height: 300px) and (orientation: landscape) {
		.scene {
			position: fixed;
			inset: 0;
			display: block;
			width: 100%;
			height: 100%;
			padding: 0;
			background: linear-gradient(#16a9ed 0 54%, #559f2a 54% 100%);
		}

		.pixel-background {
			background-position: center bottom;
			background-size: cover;
		}

		.brand {
			position: absolute;
			top: 4px;
			left: 4px;
			width: 54px;
			height: auto;
			transform: none;
		}

		.studio-mark {
			display: none;
		}

		.game-stage {
			position: absolute;
			inset: 3px 53px 27px 62px;
			display: grid;
			place-items: center;
			width: auto;
			height: auto;
			padding: 0;
			container-type: size;
		}

		.board-wrap {
			width: min(100cqw, 125cqh);
			height: min(80cqw, 100cqh);
			aspect-ratio: 1.25;
		}

		.cluster-panel {
			position: absolute;
			inset: auto auto -25px 50%;
			display: block;
			width: min(100cqw, 244px);
			height: 24px;
			padding: 2px;
			border-width: 2px;
			border-radius: 0;
			transform: translateX(-50%);
		}

		.panel-rows {
			grid-template-columns: repeat(var(--slots, 5), minmax(0, 1fr));
			grid-template-rows: 16px;
			gap: 1px;
		}

		.panel-row {
			grid-template-columns: auto 1fr;
			gap: 1px;
			min-height: 0;
			height: 16px;
			padding: 0 1px;
			border-width: 1px;
			border-radius: 0;
			font-size: 5px;
		}

		.panel-row img {
			width: 11px;
			height: 11px;
		}

		.panel-row span:nth-of-type(2),
		.panel-row strong {
			display: none;
		}

		.hud {
			position: absolute;
			inset: 0;
			display: block;
			width: 100%;
			height: 100% !important;
			min-height: 0;
			padding: 0;
			border: 0;
			background: none;
			box-shadow: none;
			transform: none;
			pointer-events: none;
		}

		.hud::before {
			content: '';
			position: absolute;
			top: 1px;
			right: 1px;
			bottom: 1px;
			left: auto;
			display: block;
			width: 50px;
			height: auto;
			border: 2px solid #9d620d;
			border-radius: 0;
			background: #3a1d08;
			box-shadow:
				inset 0 0 0 1px #5d3509,
				-3px 3px 0 #1a0c03aa;
			pointer-events: none;
		}

		.hud-left,
		.hud-right,
		.metrics {
			z-index: 1;
			pointer-events: auto;
		}

		.hud-left {
			position: absolute;
			top: 3px;
			right: 3px;
			display: grid;
			grid-template-columns: 1fr;
			grid-template-rows: 27px 27px;
			gap: 2px;
			width: 46px;
			height: 56px;
			padding: 0;
		}

		.hud-left .utility,
		.bonus-button {
			width: 46px;
			height: 27px;
			min-width: 0;
			min-height: 0;
		}

		.bonus-button span {
			font-size: 6px;
		}

		.hud-right {
			position: absolute;
			top: 62px;
			right: 3px;
			display: grid;
			grid-template-columns: 46px;
			grid-template-rows: 21px 44px 28px 28px;
			justify-items: center;
			gap: 3px;
			width: 46px;
			height: 130px;
			padding: 0;
		}

		.bet-stepper {
			position: static;
			display: grid;
			grid-template-columns: 1fr 1fr;
			gap: 2px;
			width: 46px;
			height: 21px;
			padding: 0;
			border: 0;
			background: none;
		}

		.bet-stepper button {
			width: 22px;
			height: 21px;
			padding: 0;
			font-size: 10px;
		}

		.spin {
			width: 44px;
			height: 44px;
			margin: 0;
			border-width: 3px !important;
		}

		.hud-right .utility,
		.auto {
			width: 28px;
			height: 28px;
			padding: 0;
		}

		.hud button svg {
			width: 54%;
			height: 54%;
		}

		.metrics {
			position: absolute;
			top: 28px;
			left: 3px;
			display: grid;
			grid-template-columns: 56px;
			grid-template-rows: repeat(3, 29px);
			gap: 2px;
			width: 56px;
			height: 91px;
		}

		.metric,
		.metric.bet {
			grid-column: auto;
			grid-row: auto;
			height: 29px;
			padding: 2px 3px;
			border: 1px solid #83500e;
			background: #251506dd;
			text-align: left;
		}

		.metric span {
			font-size: 5px;
		}

		.metric strong {
			font-size: clamp(6px, calc(47px / var(--chars, 8)), 9px) !important;
		}

		.bonus-readouts {
			top: 123px;
			left: 3px;
			right: auto;
			width: 56px;
		}

		.quick-menu {
			top: 3px;
			right: 52px;
			bottom: auto;
			left: auto;
			width: 98px;
		}

		.quick-menu button {
			grid-template-columns: 25px minmax(0, 1fr);
			gap: 4px;
			height: 32px;
			font-size: 8px;
		}

		.quick-menu-icon {
			width: 23px;
			height: 23px;
		}

		/* Every HTML dialog must fit the 400×225 shell without browser zoom. */
		.modal-layer {
			place-items: center;
			padding: 4px;
			overflow: hidden;
		}

		.buy-panel,
		.confirm-panel,
		.auto-panel {
			width: min(388px, calc(100vw - 8px));
			max-height: calc(100dvh - 8px);
			padding: 6px 10px;
			border-width: 4px;
			box-shadow:
				inset 0 0 0 2px #d49b35,
				inset 0 0 0 4px #351b08,
				3px 3px 0 #1c0d05;
			overflow: auto;
		}

		.close {
			top: 3px;
			right: 3px;
			width: 22px;
			height: 22px;
			border-width: 2px;
			font-size: 14px;
			line-height: 1;
		}

		.buy-panel header small,
		.confirm-panel > small,
		.auto-panel > small {
			font-size: 6px;
			letter-spacing: 0.1em;
		}

		.buy-panel h2,
		.confirm-panel h2,
		.auto-panel h2 {
			margin: 0 24px 4px;
			font-size: 15px;
			line-height: 1;
			text-shadow: 1px 1px #4c2500;
		}

		.buy-grid {
			grid-template-columns: repeat(5, minmax(0, 1fr));
			gap: 4px;
		}

		.buy-card {
			grid-template-rows: 30px auto auto auto auto auto;
			gap: 1px;
			padding: 3px 2px;
			border-width: 2px;
		}

		.buy-card img {
			width: 28px;
			height: 28px;
		}

		.buy-card span {
			font-size: 6px;
			line-height: 1;
		}

		.buy-card small {
			min-height: 0;
			font-size: 5px;
			line-height: 1.05;
		}

		.buy-card strong {
			font-size: 8px;
		}

		.buy-card em,
		.buy-card .card-state {
			font-size: 5px;
			line-height: 1;
		}

		.confirm-panel > img {
			width: 42px;
			height: 42px;
		}

		.confirm-panel p,
		.auto-panel p,
		.confirm-note {
			max-width: 100%;
			margin: 1px 0 4px;
			font-size: 7px;
			line-height: 1.15;
		}

		.confirm-panel > strong {
			margin-bottom: 4px;
			font-size: 16px;
			line-height: 1;
		}

		.confirm-actions {
			gap: 4px;
		}

		.confirm-actions button,
		.auto-start {
			min-height: 28px;
			padding: 3px;
			border-width: 2px;
			font-size: 8px;
		}

		.auto-options {
			gap: 3px;
			margin: 5px 0;
		}

		.auto-options button {
			padding: 4px 1px;
			border-width: 1px;
			font-size: 7px;
		}

		:global(.pop-up-wrap .top-layer) {
			padding: 3px;
		}

		:global(.pop-up-wrap .ui-popup-standard-content-wrap) {
			width: calc(100vw - 8px);
			max-height: calc(100dvh - 8px);
			gap: 4px;
			font-size: 8px;
		}

		:global(.pop-up-wrap .ui-modal-title-wrap) {
			font-size: 12px;
			line-height: 1;
		}

		:global(.pop-up-wrap .close-button-wrap) {
			top: 1px;
			right: 1px;
		}

		:global(.pop-up-wrap .close-button) {
			width: 26px;
			height: 26px;
			font-size: 24px;
		}
	}
</style>
