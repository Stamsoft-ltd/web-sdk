<script lang="ts">
	import { onMount, onDestroy, tick } from 'svelte';
	import Blob from './components/Blob.svelte';
	import Scenery from './components/Scenery.svelte';
	import paytable from './lib/paytable.json';
	import {
		MODES,
		initialState,
		applyEvent,
		parseRound,
		winMoney,
		type Mode,
		type Round,
	} from './lib/model';
	import { launch, createTransport } from './lib/transport';
	import { activate, t, languages } from './lib/i18n';
	import { formatWalletAmount, formatWinAmount } from './lib/reference/currency';
	const q = launch(location.search);
	const api = createTransport(q);
	activate(q.lang, q.social);
	let lang = $state(q.lang);
	let social = $state(q.social);
	let localeVersion = $state(0);
	const tr = (k: string) => {
		localeVersion;
		return t(k);
	};
	let board = $state(initialState());
	let balance = $state(0);
	let currency = $state(q.currency);
	let bet = $state(1);
	let roundBet = $state(1);
	let bets = $state([0.1, 0.2, 0.5, 1, 2, 5, 10]);
	let busy = $state(false);
	let ready = $state(false);
	let started = $state(false);
	let error = $state('');
	let pending = $state<Round | null>(null);
	let replay = $state<Round | null>(null);
	let replayPlayed = $state(false);
	let settling = $state(false);
	let turbo = $state(false);
	let sound = $state(false);
	let modal = $state('');
	let chosen = $state<Mode>('normal');
	let activeMode = $state<Mode>('base');
	let autoCount = $state(0);
	let autoChoice = $state(10);
	let jurisdiction = $state<Record<string, any>>({});
	let disposed = false;
	let audio: AudioContext | undefined;
	let timer: ReturnType<typeof setTimeout> | undefined;
	let wake: (() => void) | undefined;
	const sleep = (ms: number) =>
		new Promise<void>((resolve) => {
			wake = resolve;
			timer = setTimeout(() => {
				wake = undefined;
				resolve();
			}, ms);
		});
	const money = (v: number) => formatWalletAmount(currency, v);
	const win = (v: number) => formatWinAmount(currency, v);
	let displayedWin = $derived(winMoney(roundBet, board.total));
	let locked = $derived(busy || !!pending || !ready || !!error || q.replay || autoCount > 0);
	let status = $derived(
		board.tier
			? `${tr(board.tier.toUpperCase())} · ${tr('FREE SPINS')} ${board.freeSpin}/10`
			: busy
				? tr('SPLIT')
				: tr('READY'),
	);
	function locale() {
		activate(lang, social);
		localeVersion++;
	}
	function syncBalance(data: any) {
		if (!data?.balance) throw Error('Missing RGS balance');
		if (data?.balance) {
			if (!Number.isSafeInteger(data.balance.amount) || data.balance.amount < 0)
				throw Error('Invalid RGS balance');
			balance = data.balance.amount / 1e6;
			currency = data.balance.currency ?? currency;
		}
	}
	function chime() {
		if (!sound) return;
		audio ??= new AudioContext();
		void audio.resume();
		const osc = audio.createOscillator();
		const g = audio.createGain();
		osc.connect(g);
		g.connect(audio.destination);
		osc.type = 'sine';
		osc.frequency.setValueAtTime(620, audio.currentTime);
		osc.frequency.exponentialRampToValueAtTime(940, audio.currentTime + 0.1);
		g.gain.setValueAtTime(0.035, audio.currentTime);
		g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.16);
		osc.start();
		osc.stop(audio.currentTime + 0.17);
	}
	async function boot() {
		if (busy) return;
		busy = true;
		error = '';
		autoCount = 0;
		try {
			if (q.replay) {
				replay = await api.replay();
				bet = replay.amount / 1e6;
				roundBet = bet;
				activeMode = replay.mode;
				ready = true;
				started = true;
				return;
			}
			if (!q.demo && (!q.rgsUrl || !q.sessionID)) {
				ready = false;
				return;
			}
			const data = await api.authenticate();
			if (disposed) return;
			syncBalance(data);
			jurisdiction = data.config?.jurisdiction ?? {};
			social = q.social || !!jurisdiction.socialCasino;
			locale();
			const levels = (data.config?.betLevels ?? [])
				.filter((n: number) => Number.isSafeInteger(n) && n > 0)
				.map((n: number) => n / 1e6);
			if (!levels.length) throw Error('Missing RGS bet levels');
			bets = levels;
			const proposed = data.config?.defaultBetLevel / 1e6;
			bet = levels.includes(proposed) ? proposed : levels[0];
			roundBet = bet;
			if (data.round?.active) {
				pending = parseRound(data.round, Math.round(bet * 1e6), 'base');
				bet = pending.amount / 1e6;
				roundBet = bet;
				activeMode = pending.mode;
				started = true;
			} else {
				pending = null;
				settling = false;
			}
			ready = true;
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
			ready = false;
		} finally {
			busy = false;
		}
	}
	async function playback(round: Round) {
		board = initialState();
		roundBet = round.amount / 1e6;
		activeMode = round.mode;
		for (const event of round.state) {
			if (disposed) return;
			board = applyEvent(board, event);
			if (event.type === 'bonusStart') {
				autoCount = 0;
				chime();
			}
			if (event.type === 'clusterWin') chime();
			const duration =
				event.type === 'reveal'
					? 220
					: event.type === 'tumble'
						? 190
						: event.type === 'clusterWin'
							? 390
							: event.type === 'bladeUpdate'
								? 190
								: event.type === 'bonusStart' || event.type === 'mysteryChoice'
									? 900
									: event.type === 'finalWin'
										? 250
										: 0;
			if (duration) await sleep(turbo ? duration * 0.22 : duration);
		}
	}
	async function finish() {
		if (pending?.active === false) {
			pending = null;
			return;
		}
		settling = true;
		const data = await api.end();
		if (disposed) return;
		syncBalance(data);
		pending = null;
		settling = false;
	}
	async function spin(mode: Mode = 'base', fromAuto = false) {
		if (
			busy ||
			pending ||
			!ready ||
			error ||
			q.replay ||
			modal ||
			!started ||
			(autoCount > 0 && !fromAuto)
		)
			return;
		if (balance < bet * MODES[mode]) {
			error = tr('INSUFFICIENT');
			autoCount = 0;
			return;
		}
		busy = true;
		activeMode = mode;
		roundBet = bet;
		const time = Date.now();
		try {
			const data = await api.play(mode, bet, currency);
			if (disposed) return;
			// Keep wallet uncertain until authenticated if response parsing fails.
			pending = parseRound(data, Math.round(bet * 1e6), mode);
			syncBalance(data);
			await playback(pending);
			if (disposed) return;
			await sleep(Math.max(0, (jurisdiction.minimumRoundDuration ?? 0) - (Date.now() - time)));
			if (disposed) return;
			await finish();
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
			autoCount = 0;
		} finally {
			busy = false;
		}
		if (autoCount > 0 && !error && !disposed) {
			autoCount--;
			if (autoCount > 0) {
				await sleep(350);
				if (autoCount > 0 && !disposed) void spin('base', true);
			}
		}
	}
	async function resume() {
		if (!pending || busy) return;
		busy = true;
		error = '';
		try {
			if (!settling) await playback(pending);
			if (!disposed) await finish();
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			busy = false;
		}
	}
	async function playReplay() {
		if (!replay || busy) return;
		busy = true;
		error = '';
		try {
			await playback(replay);
			replayPlayed = true;
		} catch (e) {
			error = String(e);
		} finally {
			busy = false;
		}
	}
	function changeBet(direction: number) {
		if (locked) return;
		const index = bets.indexOf(bet);
		bet = bets[Math.max(0, Math.min(bets.length - 1, index + direction))];
	}
	async function openModal(name: string) {
		if (busy || pending) return;
		autoCount = 0;
		modal = name;
		await tick();
		document.querySelector<HTMLElement>('.dialog button, .dialog select')?.focus();
	}
	function closeModal() {
		modal = '';
	}
	function key(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			closeModal();
			autoCount = 0;
			return;
		}
		if (event.key === 'Tab' && modal) {
			const nodes = Array.from(
				document.querySelectorAll<HTMLElement>(
					'.dialog button:not(:disabled),.dialog select,.dialog input',
				),
			);
			const first = nodes[0],
				last = nodes.at(-1);
			if (event.shiftKey && document.activeElement === first) {
				event.preventDefault();
				last?.focus();
			} else if (!event.shiftKey && document.activeElement === last) {
				event.preventDefault();
				first?.focus();
			}
			return;
		}
		if (
			event.code === 'Space' &&
			!event.repeat &&
			!modal &&
			!jurisdiction.disabledSpacebar &&
			!(
				event.target instanceof HTMLInputElement ||
				event.target instanceof HTMLSelectElement ||
				event.target instanceof HTMLButtonElement
			)
		) {
			event.preventDefault();
			void spin();
		}
	}
	async function confirmBuy() {
		const mode = chosen;
		closeModal();
		await spin(mode);
	}
	function startAuto() {
		closeModal();
		autoCount = autoChoice;
		void spin('base', true);
	}
	onMount(() => {
		locale();
		void boot();
	});
	onDestroy(() => {
		disposed = true;
		autoCount = 0;
		clearTimeout(timer);
		wake?.();
		void audio?.close();
	});
</script>

<svelte:window onkeydown={key} />
<svelte:head><title>Blob Split · Split Party v1</title></svelte:head>
<Scenery />
<main
	class:playing={busy}
	class:bonus-round={!!board.tier}
	dir="ltr"
	inert={!!modal ||
		!started ||
		!!error ||
		(!!pending && !busy) ||
		(q.replay && !busy && !replayPlayed)}
>
	<header class="branding">
		<div class="logo" aria-label="Blob Split">
			<span class="logo-top">BL<span class="logo-o">O<span class="logo-eyes">••</span></span>B</span
			><span class="logo-bottom">SPLIT</span><i>✦</i>
		</div>
		<div class="edition">SPLIT PARTY <span>v1</span></div>
	</header>
	<div class="studio"><span class="studio-mark">♪</span> Press Play</div>
	<div class="connection" class:preview={q.demo}>
		{q.demo ? tr('PREVIEW') : q.replay ? tr('REPLAY') : ready ? tr('LIVE') : tr('CONNECTING')}
	</div>
	<aside class="side-note">
		<span class="mini-label">SPLIT. MATCH. REPEAT.</span>
		<h1>Little blobs.<br />Big party.</h1>
		<div class="mini-divider"></div>
		<p>7 × 7 <span>·</span> 96% RTP</p>
		<p class="max-win">20,000× <small>MAX</small></p>
	</aside>
	<section class="game-area" aria-label="Split Party game">
		<div class="board-top">
			<span class="mode-pill">{tr(activeMode.toUpperCase())}</span><span
				class="status"
				aria-live="polite">{status}</span
			><span class="board-spark">✦</span>
		</div>
		<div class="board-frame" class:celebrate={board.phase === 'split'}>
			<div class="grid" role="img" aria-label={`7 by 7 game board. ${status}`}>
				{#each Array(7) as _, row}{#each Array(7) as _, col}
						{@const symbol = board.board[col][row]}{@const units =
							board.blades[col][row] + 1}{@const lit = board.highlight.includes(`${col},${row}`)}
						<div
							class="cell"
							class:lit
							class:split={units > 1}
							class:scatter={symbol === 'BASKET'}
							data-units={units}
							title={`${symbol} · ${units} units`}
						>
							<Blob {symbol} {units} uid={`b-${col}-${row}`} />
							{#if units > 1}<span class="cell-seam"></span>{/if}
							{#if lit && board.phase === 'split'}<span class="slash"></span>{/if}
						</div>
					{/each}{/each}
			</div>
		</div>
		<div class="underboard">
			<span class="tiny-dot"></span>{busy ? tr('SPLIT') : tr('READY')}<span class="tiny-dot"></span>
		</div>
	</section>
	<aside class="round-detail">
		<span class="mini-label">{tr('TOTAL WIN')}</span><strong>{win(displayedWin)}</strong
		>{#if board.tier}<span class="tier-badge">{tr(board.tier.toUpperCase())}</span>
			<p>{board.freeSpin} / 10</p>{:else}<Blob symbol="KIWI" uid="mascot" />
			<p>More splits.<br />More smiles.</p>{/if}
	</aside>
	<footer class="control-bar">
		<button
			class="circle menu-button"
			aria-label={tr('INFO CTRL MENU')}
			onclick={() => openModal('settings')}
			disabled={busy || !!pending}>☰</button
		>
		<button
			class="bonus-button"
			disabled={locked || jurisdiction.disabledBuyFeature}
			onclick={() => openModal('bonus')}>{tr('BONUS')}<span>✦</span></button
		>
		<div class="metric balance">
			<span class="metric-label">{tr('BALANCE')}</span><strong>{money(balance)}</strong>
		</div>
		<div class="metric win">
			<span class="metric-label">{tr('WIN')}</span><strong>{win(displayedWin)}</strong>
		</div>
		<div class="bet-controls">
			<div class="metric">
				<span class="metric-label">{tr('BET')}</span><strong>{money(bet)}</strong>
			</div>
			<button
				class="circle"
				aria-label={tr('INFO CTRL MINUS')}
				onclick={() => changeBet(-1)}
				disabled={locked || bet === bets[0]}>−</button
			><button
				class="circle"
				aria-label={tr('INFO CTRL PLUS')}
				onclick={() => changeBet(1)}
				disabled={locked || bet === bets.at(-1)}>+</button
			>
		</div>
		<button
			class="spin-button"
			aria-label={q.replay ? tr('START REPLAY') : tr('INFO CTRL SPIN')}
			disabled={q.replay ? busy || !replay : locked || !started}
			onclick={() => (q.replay ? playReplay() : spin())}
			><svg viewBox="0 0 64 64" aria-hidden="true"
				><path d="M49 19A23 23 0 1 0 54 41" /><path d="M49 7v14H35" /></svg
			></button
		>
		<button
			class="circle turbo-button"
			class:active={turbo}
			aria-label={tr('TURBO')}
			aria-pressed={turbo}
			disabled={!!jurisdiction.disabledTurbo}
			onclick={() => (turbo = !turbo)}>ϟ</button
		>
		<button
			class="circle auto-button"
			class:active={autoCount > 0}
			aria-label={autoCount ? tr('STOP') : tr('AUTOPLAY')}
			disabled={q.replay || !!jurisdiction.disabledAutoplay || (!autoCount && locked)}
			onclick={() => (autoCount ? (autoCount = 0) : openModal('auto'))}
			><span>{autoCount ? '■' : '⟳'}</span><small>{autoCount || 'AUTO'}</small></button
		>
	</footer>
	<div class="bottom-note">
		{q.demo ? 'TEST BUILD · PREVIEW ONLY' : 'SPLIT PARTY · 96% RTP'}<span
			>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span
		>
	</div>
</main>
{#if !started && !error}
	<div class="overlay splash">
		<section class="welcome dialog" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
			<div class="welcome-blobs">
				<Blob symbol="ORANGE" uid="welcome-1" /><Blob symbol="KIWI" uid="welcome-2" /><Blob
					symbol="GRAPES"
					uid="welcome-3"
				/>
			</div>
			<span class="eyebrow">WELCOME TO THE PARTY</span>
			<h2 id="welcome-title">Small blobs.<br /><em>Endless personality.</em></h2>
			<p>{tr('RULE')}</p>
			<div class="welcome-facts">
				<span><b>7×7</b> GRID</span><span><b>96%</b> RTP</span><span><b>20,000×</b> MAX WIN</span>
			</div>
			{#if ready}<button class="primary" onclick={() => (started = true)}
					>{tr('CONTINUE')} <span>→</span></button
				>{:else if !busy}<p>{tr('NO_SESSION')}</p>
				<a class="primary" href="?demo=1">{tr('OPEN_PREVIEW')} →</a>{:else}<p>
					{tr('CONNECTING')}
				</p>{/if}<small>{q.demo ? tr('PREVIEW_NOTE') : ''}</small>
		</section>
	</div>
{/if}
{#if error || (pending && !busy)}
	<div class="overlay">
		<section
			class="dialog recovery"
			role="alertdialog"
			aria-modal="true"
			aria-labelledby="recovery-title"
		>
			<span class="eyebrow">{pending ? tr('UNFINISHED ROUND') : tr('ERROR')}</span>
			<h2 id="recovery-title">{tr('RECOVERY TITLE')}</h2>
			<p>{tr('RECOVERY BODY')}</p>
			{#if error}<pre>{error}</pre>{/if}<button
				class="primary"
				onclick={() => (pending ? resume() : boot())}
				disabled={busy}>{pending ? tr('RETRY RESUME') : tr('RELOAD')}</button
			>
		</section>
	</div>
{/if}
{#if q.replay && !busy && !error && (!replayPlayed || modal === 'replay')}
	<div class="overlay">
		<section class="dialog" role="dialog" aria-modal="true" aria-label={tr('REPLAY')}>
			<span class="eyebrow">SPLIT PARTY</span>
			<h2>{tr('REPLAY')}</h2>
			<p>{tr('REPLAY DISCLAIMER')}</p>
			<div class="summary">
				<span>{tr('MODE')}</span><b>{tr(activeMode.toUpperCase())}</b><span>{tr('BASE BET')}</span
				><b>{money(bet)}</b><span>{tr('TOTAL BET COST')}</span><b
					>{money(bet * MODES[activeMode])}</b
				>
			</div>
			<button
				class="primary"
				onclick={() => {
					modal = '';
					void playReplay();
				}}>{tr('START REPLAY')} →</button
			>
		</section>
	</div>
{/if}
{#if modal && modal !== 'replay'}
	<div class="overlay">
		<section
			class="dialog"
			class:wide={modal === 'bonus' || modal === 'rules'}
			role="dialog"
			aria-modal="true"
			aria-labelledby="modal-title"
			dir={lang === 'ar' && !social ? 'rtl' : 'ltr'}
		>
			<button class="close" aria-label={tr('INFO CTRL CLOSE')} onclick={closeModal}>×</button>
			<span class="eyebrow">BLOB SPLIT</span>
			{#if modal === 'bonus'}
				<h2 id="modal-title">{tr('CHOOSE')}</h2>
				<p>Same little blobs. A whole new kind of party.</p>
				<div class="mode-cards">
					{#each ['feature', 'normal', 'super', 'mystery'] as m}{@const mode = m as Mode}<button
							class={`mode-card ${mode}`}
							onclick={() => {
								chosen = mode;
								modal = 'confirm';
							}}
							><div class="mode-blob">
								<Blob
									symbol={mode === 'normal'
										? 'ORANGE'
										: mode === 'super'
											? 'GRAPES'
											: mode === 'mystery'
												? 'KIWI'
												: 'CHERRIES'}
									units={mode === 'feature' ? 4 : mode === 'super' ? 2 : 1}
									uid={`mode-${mode}`}
								/>
							</div>
							<h3>{tr(mode.toUpperCase())}</h3>
							<span
								>{mode === 'feature'
									? '2–6 units / tile'
									: mode === 'mystery'
										? '65% · 30% · 5%'
										: `10 ${tr('FREE SPINS')}`}</span
							><b>{money(bet * MODES[mode])}</b><small>{MODES[mode]}× {tr('BASE BET')}</small
							></button
						>{/each}
				</div>
			{:else if modal === 'confirm'}<h2 id="modal-title">{tr(chosen.toUpperCase())}</h2>
				<div class="confirm-blob"><Blob symbol="KIWI" units={3} uid="confirm" /></div>
				<div class="summary">
					<span>{tr('BASE BET')}</span><b>{money(bet)}</b><span>{tr('TOTAL BET COST')}</span><b
						>{money(bet * MODES[chosen])}</b
					>
				</div>
				<p>
					{chosen === 'mystery'
						? '65% Normal · 30% Super · 5% Hidden'
						: chosen === 'feature'
							? tr('FEATURE_RULE')
							: `10 ${tr('FREE SPINS')}`}
				</p>
				<button class="primary" onclick={confirmBuy} disabled={balance < bet * MODES[chosen]}
					>{tr('CONFIRM')} · {money(bet * MODES[chosen])}</button
				><button class="text-button" onclick={() => (modal = 'bonus')}>{tr('CANCEL')}</button>
			{:else if modal === 'settings'}<h2 id="modal-title">{tr('SETTINGS')}</h2>
				<label class="setting"
					>{tr('LANGUAGE')}<select bind:value={lang} onchange={locale} disabled={social}
						>{#each languages as l}<option value={l}>{l.toUpperCase()}</option>{/each}</select
					></label
				><label class="setting">{tr('SOUND')}<input type="checkbox" bind:checked={sound} /></label
				><button class="setting link" onclick={() => (modal = 'rules')}
					>{tr('GAME RULES')} <span>→</span></button
				><button class="setting link" onclick={() => (modal = 'paytable')}
					>{tr('PAYTABLE')} <span>→</span></button
				><small>{q.demo ? tr('PREVIEW_NOTE') : tr('LEGAL')}</small>
			{:else if modal === 'auto'}<h2 id="modal-title">{tr('AUTOPLAY')}</h2>
				<p>{tr('AUTO_NOTE')}</p>
				<label class="setting"
					>{tr('AUTO NUM SPINS')}<select bind:value={autoChoice}
						>{#each [10, 25, 50, 100] as n}<option value={n}>{n}</option>{/each}</select
					></label
				><button class="primary" onclick={startAuto}>{tr('AUTO START')}</button>
			{:else if modal === 'rules'}<h2 id="modal-title">{tr('GAME RULES')}</h2>
				<div class="rules-content">
					<h3>01 · Split & match</h3>
					<p>{tr('RULE')}</p>
					<h3>02 · Bonus party</h3>
					<p>{tr('BONUSRULE')}</p>
					<p>{tr('FEATURE_RULE')}</p>
					<h3>03 · 96% RTP / 20,000× max</h3>
					<p>{tr('LEGAL')}</p>
					<small>{tr('RULES_NOTE')}</small>
				</div>
			{:else if modal === 'paytable'}<h2 id="modal-title">{tr('PAYTABLE')}</h2>
				<p>Original math symbols → blob colors. Awards in base-play multiples.</p>
				<div class="paytable">
					<table>
						<thead
							><tr
								><th>Symbol</th>{#each paytable.bands as band}<th>{band}</th>{/each}</tr
							></thead
						><tbody
							>{#each Object.entries(paytable.symbols) as [symbol, awards]}<tr
									><th
										><span class="table-blob"><Blob {symbol} uid={`table-${symbol}`} /></span
										>{symbol}</th
									>{#each awards as value}<td>{value}×</td>{/each}</tr
								>{/each}</tbody
						>
					</table>
				</div>
				<small
					>Columns show total blob units in a connected cluster. At least 2 tiles required. Baskets:
					3 / 4 / 5+ award 2× / 10× / 50×. Round capped at 20,000×.</small
				>
			{/if}
		</section>
	</div>
{/if}
