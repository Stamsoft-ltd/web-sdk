<script lang="ts">
	import { onMount, onDestroy, tick } from 'svelte';
	import { fade } from 'svelte/transition';
	import { elasticOut, cubicIn } from 'svelte/easing';
	import Blob from './components/Blob.svelte';
	import Splash from './components/Splash.svelte';
	import Logo from './components/Logo.svelte';
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
	// Base game is the Figma 11003:24523 frame (1200×670) scaled to fit; portrait restacks it.
	let vw = $state(1200);
	let vh = $state(670);
	let portrait = $derived(vw < vh);
	// Tall phones stretch the portrait stage; CSS spreads rows into the spare height (--ex).
	let stage = $derived(
		portrait ? { w: 680, h: Math.max(940, (680 * vh) / vw) } : { w: 1200, h: 670 },
	);
	let fit = $derived(Math.min(vw / stage.w, vh / stage.h));
	let error = $state('');
	let pending = $state<Round | null>(null);
	let replay = $state<Round | null>(null);
	let replayPlayed = $state(false);
	let settling = $state(false);
	let turbo = $state(false);
	let superTurbo = $state(false);
	let sound = $state(false);
	let modal = $state('');
	let chosen = $state<Mode>('normal');
	let activeMode = $state<Mode>('base');
	let autoCount = $state(0);
	let autoChoice = $state(10);
	let autoFeature = $state(false);
	let autoMode = $state<Mode>('base');
	const AUTO_STEPS = [5, 10, 25, 50, 100];
	const stepAuto = (d: number) =>
		(autoChoice = AUTO_STEPS[Math.max(0, Math.min(AUTO_STEPS.length - 1, AUTO_STEPS.indexOf(autoChoice) + d))]);
	const BUYS: Mode[] = ['feature', 'normal', 'super', 'mystery'];
	// Figma 9164:11722's five-blob cluster on the Feature card (34.76px blobs).
	const FEATURE_BLOBS = [
		[0, 0],
		[0, 33.85],
		[24.62, 17.12],
		[49.24, 0.39],
		[49.24, 34.24],
	];
	// Every popup lands like a blob: squashed wide, then jiggles to rest; it leaves by
	// shrinking up and away.
	function pop(_node: Element, { duration = 520 } = {}) {
		return {
			duration,
			css: (t: number) => {
				const e = elasticOut(t);
				return `opacity:${Math.min(1, t * 3)};transform:translateY(${(1 - t) * 24}px) scale(${1 + (1 - e) * 0.28}, ${1 - (1 - e) * 0.42})`;
			},
		};
	}
	function popOut(_node: Element, { duration = 180 } = {}) {
		return {
			duration,
			easing: cubicIn,
			css: (t: number) => `opacity:${t};transform:translateY(${(1 - t) * -14}px) scale(${0.9 + t * 0.1}, ${0.86 + t * 0.14})`,
		};
	}
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
	// Reel motion ported from Veggie Salad (feature/veggie-salad-v1, stateGame.svelte.ts
	// FALL_MOTION / FALL_MOTION_FAST with its 1.25 GAME_PACE already applied): the old board
	// drops out through the floor, new blobs rain in column by column under constant gravity
	// and land with a squash; winners pop before survivors fall into the holes.
	const MOTION = {
		unitMs: 163,
		minMs: 150,
		spinRowStaggerMs: 50,
		tumbleRowStaggerMs: 28,
		reelDelayMs: 11,
		spinReelDelayMs: 90,
		jitterMs: 48,
		impactMs: 425,
		exitRowStaggerMs: 33,
		exitReelDelayMs: 13,
		exitJitterMs: 33,
		removeMs: 525,
		removeJitterMs: 69,
		holdMs: 150,
		// Not from Veggie: the roller-coaster fright the blobs pull before the board drops.
		scareMs: 420,
	};
	const MOTION_FAST = {
		unitMs: 69,
		minMs: 63,
		spinRowStaggerMs: 14,
		tumbleRowStaggerMs: 8,
		reelDelayMs: 4,
		spinReelDelayMs: 20,
		jitterMs: 15,
		impactMs: 138,
		exitRowStaggerMs: 9,
		exitReelDelayMs: 4,
		exitJitterMs: 13,
		removeMs: 225,
		removeJitterMs: 25,
		holdMs: 88,
		scareMs: 150,
	};
	const N = 7;
	const motion = () => (turbo || superTurbo ? MOTION_FAST : MOTION);
	const fallMs = (m: typeof MOTION, rows: number) => Math.max(m.minMs, m.unitMs * Math.sqrt(rows));
	type Drop = { rows: number; delay: number; dur: number };
	let wave = $state<{ id: number; drops: Drop[][]; impact: number }>({ id: 0, drops: [], impact: 0 });
	type Ghost = { col: number; row: number; symbol: string; units: number; rows: number; delay: number; dur: number };
	let ghost = $state<{ id: number; cells: Ghost[] } | null>(null);
	let awaitingReveal = $state(false);
	let scared = $state(false);
	let moving = $state(false);
	let popping = $state<Record<string, number>>({});
	let motionId = 0;
	let movingTimer: ReturnType<typeof setTimeout> | undefined;
	// The board clips falling blobs only while something is in the air, so win glows aren't cut.
	function holdMoving(ms: number) {
		moving = true;
		clearTimeout(movingTimer);
		movingTimer = setTimeout(() => (moving = false), ms);
	}
	// Fright, then the drop: resolves when the reveal may start (35% into the exit).
	async function dropBoard() {
		scared = true;
		await sleep(motion().scareMs);
		await sleep(startExit() * 0.35);
	}
	// Trap door: copy the board into a ghost layer that free-falls out of the bottom (bottom
	// row first, columns left to right); the live board stays hidden until the reveal.
	function startExit() {
		const m = motion();
		const cells: Ghost[] = [];
		let end = 0;
		for (let col = 0; col < N; col++)
			for (let row = 0; row < N; row++) {
				const rows = N - row + 1;
				const delay = (N - 1 - row) * m.exitRowStaggerMs + col * m.exitReelDelayMs + Math.random() * m.exitJitterMs;
				const dur = fallMs(m, rows);
				end = Math.max(end, delay + dur);
				cells.push({ col, row, symbol: board.board[col][row], units: board.blades[col][row] + 1, rows, delay, dur });
			}
		const id = ++motionId;
		ghost = { id, cells };
		awaitingReveal = true;
		holdMoving(end + 120);
		setTimeout(() => ghost?.id === id && (ghost = null), end + 120);
		return end;
	}
	// Reveal: every blob starts the same 8 rows up, so constant gravity lands them in a sweep.
	function spinWave() {
		const m = motion();
		let end = 0;
		const drops = Array.from({ length: N }, (_, col) =>
			Array.from({ length: N }, (_, row) => {
				const delay = (N - 1 - row) * m.spinRowStaggerMs + col * m.spinReelDelayMs + Math.random() * m.jitterMs;
				const dur = fallMs(m, N + 1);
				end = Math.max(end, delay + dur);
				return { rows: N + 1, delay, dur };
			}),
		);
		wave = { id: ++motionId, drops, impact: m.impactMs };
		awaitingReveal = false;
		scared = false;
		holdMoving(end + m.impactMs + 60);
		return end + m.impactMs + 60;
	}
	// Tumble: survivors fall by the holes below them; new blobs enter from above the board.
	function tumbleWave(removed: Set<string>) {
		const m = motion();
		let end = 0;
		const drops = Array.from({ length: N }, (_, col) => {
			const out: Drop[] = Array(N);
			let holes = 0;
			for (let row = N - 1; row >= 0; row--) {
				if (removed.has(`${col},${row}`)) holes++;
				else out[row + holes] = { rows: holes, delay: 0, dur: 0 };
			}
			for (let row = 0; row < holes; row++) out[row] = { rows: holes, delay: 0, dur: 0 };
			out.forEach((d, row) => {
				if (!d.rows) return;
				d.delay = (N - 1 - row) * m.tumbleRowStaggerMs + col * m.reelDelayMs + Math.random() * m.jitterMs;
				d.dur = fallMs(m, d.rows);
				end = Math.max(end, d.delay + d.dur);
			});
			return out;
		});
		wave = { id: ++motionId, drops, impact: m.impactMs };
		if (!end) return 0;
		holdMoving(end + m.impactMs + 60);
		return end + m.impactMs + 60;
	}
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
		// Keep the symbols on screen: they are what drops out when the first reveal lands.
		board = { ...initialState(), board: board.board, blades: board.blades };
		roundBet = round.amount / 1e6;
		activeMode = round.mode;
		for (const event of round.state) {
			if (disposed) return;
			if (event.type === 'reveal') {
				if (!awaitingReveal) await dropBoard();
				if (disposed) return;
				board = applyEvent(board, event);
				await sleep(spinWave());
				continue;
			}
			if (event.type === 'tumble') {
				const m = motion();
				const removed = new Set(board.highlight);
				if (removed.size) {
					popping = Object.fromEntries([...removed].map((k) => [k, Math.random() * m.removeJitterMs]));
					await sleep(m.removeMs + m.removeJitterMs + m.holdMs);
					if (disposed) return;
				}
				board = applyEvent(board, event);
				popping = {};
				const t = tumbleWave(removed);
				if (t) await sleep(t);
				continue;
			}
			board = applyEvent(board, event);
			if (event.type === 'bonusStart') {
				autoCount = 0;
				chime();
			}
			if (event.type === 'clusterWin') chime();
			const duration =
				event.type === 'clusterWin'
							? 390
							: event.type === 'bladeUpdate'
								? 190
								: event.type === 'bonusStart' || event.type === 'mysteryChoice'
									? 900
									: event.type === 'finalWin'
										? 250
										: 0;
			if (duration) await sleep(duration * (superTurbo ? 0.08 : turbo ? 0.22 : 1));
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
			// The old board starts falling on the press; the reveal waits for 35% of the exit.
			const exit = dropBoard();
			const data = await api.play(mode, bet, currency);
			await exit;
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
			awaitingReveal = false;
			scared = false;
		} finally {
			busy = false;
		}
		if (autoCount > 0 && !error && !disposed) {
			autoCount--;
			if (autoCount > 0) {
				await sleep(350);
				if (autoCount > 0 && !disposed) void spin(autoMode, true);
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
		document.querySelector<HTMLElement>('[aria-modal="true"] :is(.buy-button, section button, select)')?.focus();
	}
	function closeModal() {
		modal = '';
	}
	// Splash → base game: the splash logo flies (with a little hop) onto the base-game logo
	// while the splash fades away, then lands with a squash. Instant with reduced motion.
	let entering = false;
	async function enterGame() {
		if (started || entering) return;
		const from = document.querySelector<HTMLElement>('.splash-logo');
		const to = document.querySelector<HTMLElement>('.base-logo');
		const splash = document.querySelector<HTMLElement>('.splash');
		if (!from || !to || !splash || matchMedia('(prefers-reduced-motion: reduce)').matches) {
			started = true;
			return;
		}
		entering = true;
		const a = from.getBoundingClientRect();
		const b = to.getBoundingClientRect();
		const fly = from.cloneNode(true) as HTMLElement;
		fly.className = 'logo-fly';
		fly.setAttribute('aria-hidden', 'true');
		Object.assign(fly.style, {
			left: `${a.left}px`,
			top: `${a.top}px`,
			width: `${a.width}px`,
			height: `${a.height}px`,
		});
		document.body.append(fly);
		from.style.visibility = 'hidden';
		to.style.visibility = 'hidden';
		splash.style.pointerEvents = 'none';
		splash.animate([{ opacity: 1 }, { opacity: 0 }], {
			duration: 450,
			easing: 'ease-in',
			fill: 'forwards',
		});
		const dx = b.left - a.left,
			dy = b.top - a.top,
			k = b.width / a.width;
		await fly.animate(
			[
				{ transform: 'none' },
				{
					offset: 0.3,
					transform: `translate(${dx * 0.2}px, ${dy * 0.2 - a.height * 0.18}px) scale(${1 + (k - 1) * 0.2}) rotate(-5deg)`,
				},
				{ transform: `translate(${dx}px, ${dy}px) scale(${k})` },
			],
			{ duration: 780, easing: 'cubic-bezier(0.45, 0, 0.25, 1)', fill: 'forwards' },
		).finished;
		started = true;
		entering = false;
		to.style.visibility = '';
		fly.remove();
		to.animate(
			[
				{ transform: 'scale(1.1, 0.88)' },
				{ transform: 'scale(0.96, 1.05)', offset: 0.5 },
				{ transform: 'none' },
			],
			{ duration: 360, easing: 'ease-out' },
		);
	}
	function key(event: KeyboardEvent) {
		if (!started && ready && !error && (event.code === 'Space' || event.key === 'Enter')) {
			event.preventDefault();
			void enterGame();
			return;
		}
		if (event.key === 'Escape') {
			closeModal();
			autoCount = 0;
			return;
		}
		if (event.key === 'Tab' && modal) {
			const nodes = Array.from(
				document.querySelectorAll<HTMLElement>(
					'[aria-modal="true"] :is(button:not(:disabled), select, input:not(:disabled))',
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
		autoMode = autoFeature ? 'feature' : 'base';
		void spin(autoMode, true);
	}
	onMount(() => {
		locale();
		void boot();
	});
	onDestroy(() => {
		disposed = true;
		autoCount = 0;
		clearTimeout(timer);
		clearTimeout(movingTimer);
		wake?.();
		void audio?.close();
	});
</script>

<svelte:window onkeydown={key} bind:innerWidth={vw} bind:innerHeight={vh} />
<svelte:head><title>Blob Split · Split Party v1</title></svelte:head>
<img class="base-bg" src="/base/bg.webp" alt="" />
<main
	class:playing={busy}
	class:bonus-round={!!board.tier}
	class:portrait
	dir="ltr"
	inert={!!modal ||
		!started ||
		!!error ||
		(!!pending && !busy) ||
		(q.replay && !busy && !replayPlayed)}
>
	<div
		class="base-stage"
		style={`width:${stage.w}px;height:${stage.h}px;--ex:${stage.h - 940}px;transform:translate(-50%,-50%) scale(${fit})`}
	>
		<div class="base-logo"><Logo uid="base-logo" /></div>
		<div class="studio-badge" aria-hidden="true">
			<img class="studio-mark" src="/splash/studio-mark.svg" alt="" /><img
				class="studio-word"
				src="/splash/studio-word.svg"
				alt=""
			/>
		</div>
		{#if q.demo || q.replay}<div class="connection">{q.demo ? tr('PREVIEW') : tr('REPLAY')}</div>{/if}
		<p class="sr-only" aria-live="polite">{status}</p>
		{#if board.tier}
			<aside class="round-detail">
				<span class="tier-badge">{tr(board.tier.toUpperCase())}</span>
				<span class="round-spins">{tr('FREE SPINS')} {board.freeSpin} / 10</span>
				<span class="round-label">{tr('TOTAL WIN')}</span><strong>{win(displayedWin)}</strong>
			</aside>
		{/if}

		<section
			class="board"
			class:celebrate={board.phase === 'split'}
			class:moving
			aria-label="Split Party game"
		>
			<div class="grid-stack">
			<div
				class="grid"
				class:awaiting={awaitingReveal}
				class:scared
				role="img"
				aria-label={`7 by 7 game board. ${status}`}
			>
				{#each Array(7) as _, row}{#each Array(7) as _, col}
						{@const symbol = board.board[col][row]}{@const units =
							board.blades[col][row] + 1}{@const lit = board.highlight.includes(`${col},${row}`)}{@const drop =
							wave.drops[col]?.[row]}{@const falls = !!drop?.rows}{@const pop =
							popping[`${col},${row}`]}
						<div
							class="cell"
							class:lit
							class:split={units > 1}
							class:scatter={symbol === 'BASKET'}
							style={`grid-column:${col + 1};grid-row:${row + 1}`}
							data-units={units}
							title={`${symbol} · ${units} units`}
						>
							{#key falls ? wave.id : 0}
								<div
									class="sym"
									class:falling={falls}
									class:popping={pop !== undefined}
									style={falls
										? `--fall-offset:${-105 * drop.rows}%;--fall-duration:${drop.dur.toFixed(0)}ms;--fall-delay:${drop.delay.toFixed(0)}ms;--impact-duration:${wave.impact}ms;--impact-delay:${(drop.delay + drop.dur).toFixed(0)}ms;--remove-duration:${motion().removeMs}ms;--harvest-delay:${(pop ?? 0).toFixed(0)}ms`
										: `--remove-duration:${motion().removeMs}ms;--harvest-delay:${(pop ?? 0).toFixed(0)}ms`}
								>
									<Blob {symbol} {units} uid={`b-${col}-${row}`} />
								</div>
							{/key}
							{#if units > 1}<span class="cell-seam"></span>{/if}
							{#if lit && board.phase === 'split'}<span class="slash"></span>{/if}
						</div>
					{/each}{/each}
			</div>
			{#if ghost}
				{#key ghost.id}
					<div class="grid ghost-grid scared" aria-hidden="true">
						{#each ghost.cells as g (`${g.col},${g.row}`)}
							<div class="ghost-cell" style={`grid-column:${g.col + 1};grid-row:${g.row + 1}`}>
								<div
									class="sym exiting"
									style={`--exit-offset:${105 * g.rows}%;--exit-duration:${g.dur.toFixed(0)}ms;--exit-delay:${g.delay.toFixed(0)}ms`}
								>
									<Blob symbol={g.symbol} units={g.units} uid={`g-${ghost.id}-${g.col}-${g.row}`} />
								</div>
							</div>
						{/each}
					</div>
				{/key}
			{/if}
			</div>
		</section>

		<footer class="hud">
			<div class="hud-bar"></div>
			<button
				class="hud-icon menu-button"
				aria-label={tr('INFO CTRL MENU')}
				onclick={() => openModal('settings')}
				disabled={busy || !!pending}><img src="/base/menu.svg" alt="" /></button
			>
			<button
				class="bonus-button"
				disabled={locked || jurisdiction.disabledBuyFeature}
				onclick={() => openModal('bonus')}>{tr('BONUS')}</button
			>
			<div class="hud-metrics">
				<div class="metric">
					<span class="metric-label">{tr('BALANCE')}</span><strong>{money(balance)}</strong>
				</div>
				<span class="hud-divider"></span>
				<div class="metric">
					<span class="metric-label">{tr('WIN')}</span><strong>{win(displayedWin)}</strong>
				</div>
			</div>
			<span class="hud-divider bet-divider"></span>
			<div class="bet-controls">
				<img class="bet-coins" src="/base/coins.svg" alt="" />
				<div class="metric">
					<span class="metric-label bet-label">{tr('BET')}</span><strong>{money(bet)}</strong>
				</div>
				<button
					class="hud-icon"
					aria-label={tr('INFO CTRL MINUS')}
					onclick={() => changeBet(-1)}
					disabled={locked || bet === bets[0]}><img class="minus" src="/base/minus.svg" alt="" /></button
				><button
					class="hud-icon"
					aria-label={tr('INFO CTRL PLUS')}
					onclick={() => changeBet(1)}
					disabled={locked || bet === bets.at(-1)}><img class="plus" src="/base/plus.svg" alt="" /></button
				>
			</div>
			<button
				class="spin-button"
				aria-label={q.replay ? tr('START REPLAY') : tr('INFO CTRL SPIN')}
				disabled={q.replay ? busy || !replay : locked || !started}
				onclick={() => (q.replay ? playReplay() : spin())}
				><img class="spin-ring" src="/base/spin-ring.svg" alt="" /><img
					class="spin-arrow"
					src="/base/spin-arrow.svg"
					alt=""
				/></button
			>
			<button
				class="hud-icon turbo-button"
				class:active={turbo}
				aria-label={tr('TURBO')}
				aria-pressed={turbo}
				disabled={!!jurisdiction.disabledTurbo}
				onclick={() => (turbo = !turbo)}><span class="turbo-icon"><img src="/base/turbo.webp" alt="" /></span></button
			>
			<button
				class="hud-icon auto-button"
				class:active={autoCount > 0}
				aria-label={autoCount ? tr('STOP') : tr('AUTOPLAY')}
				disabled={q.replay || !!jurisdiction.disabledAutoplay || (!autoCount && locked)}
				onclick={() => (autoCount ? (autoCount = 0) : openModal('auto'))}
				>{#if autoCount}<span class="auto-stop">■</span>{:else}<img src="/base/auto.svg" alt="" />{/if}<small
					>{autoCount || 'AUTO'}</small
				></button
			>
		</footer>
	</div>
</main>
{#if !started && !error}
	<Splash {ready} {busy} demo={q.demo} {tr} onstart={enterGame} />
{/if}
{#if error || (pending && !busy)}
	<div class="overlay" transition:fade={{ duration: 180 }}>
		<section
			class="dialog recovery"
			role="alertdialog"
			aria-modal="true"
			aria-labelledby="recovery-title"
			in:pop
			out:popOut
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
	<div class="overlay" transition:fade={{ duration: 180 }}>
		<section class="dialog" role="dialog" aria-modal="true" aria-label={tr('REPLAY')} in:pop out:popOut>
			<span class="eyebrow">BLOB SPLIT</span>
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
{#if modal === 'bonus'}
	<!-- Figma 9164:11722 at the base game's stage size. The design's fifth card (Extra Chance)
	     has no bet mode in the math, so the four real modes are shown with their real prices. -->
	<div
		class="overlay bonus-overlay"
		role="dialog"
		aria-modal="true"
		aria-labelledby="modal-title"
		dir={lang === 'ar' && !social ? 'rtl' : 'ltr'}
		transition:fade={{ duration: 200 }}
	>
		<div
			class="bonus-stage"
			class:portrait
			style={`width:${stage.w}px;height:${stage.h}px;transform:translate(-50%,-50%) scale(${fit})`}
		>
			<h2 class="bonus-title" id="modal-title">{tr('BUY BONUS')}</h2>
			<div class="buy-cards">
				{#each BUYS as mode, i}
					<article class="buy-card" style={`--i:${i}`}>
						<h3>{tr(mode.toUpperCase())}</h3>
						<p>{tr(`${mode.toUpperCase()} DESC`)}</p>
						<div class={`buy-art ${mode}`}>
							{#if mode === 'feature'}
								{#each FEATURE_BLOBS as [x, y], j}<span class="feature-blob" style={`left:${x}px;top:${y}px`}
										><Blob symbol="STRAWBERRY" uid={`buy-feature-${j}`} /></span
									>{/each}
							{:else if mode === 'mystery'}
								<img class="mystery-ball" src="/ui/mystery.webp" alt="" />
							{:else}
								<span class="tier-badge">{mode === 'normal' ? 3 : 4}x</span><img
									class="buy-egg"
									src="/splash/egg.webp"
									alt=""
								/>
							{/if}
						</div>
						<b class="buy-price">{money(bet * MODES[mode])}</b>
						<button
							class="buy-button"
							disabled={balance < bet * MODES[mode]}
							onclick={() => {
								chosen = mode;
								modal = 'confirm';
							}}>{tr('BUY')}</button
						>
					</article>
				{/each}
			</div>
			<div class="bonus-bet">
				<button
					class="hud-icon"
					aria-label={tr('INFO CTRL MINUS')}
					onclick={() => changeBet(-1)}
					disabled={bet === bets[0]}><img class="minus" src="/base/minus.svg" alt="" /></button
				>
				<div class="metric">
					<span class="metric-label">{tr('BET')}</span><strong>{money(bet)}</strong>
				</div>
				<button
					class="hud-icon"
					aria-label={tr('INFO CTRL PLUS')}
					onclick={() => changeBet(1)}
					disabled={bet === bets.at(-1)}><img class="plus" src="/base/plus.svg" alt="" /></button
				>
			</div>
			<button class="screen-close" aria-label={tr('INFO CTRL CLOSE')} onclick={closeModal}
				><img src="/ui/close.svg" alt="" /></button
			>
		</div>
	</div>
{:else if modal && modal !== 'replay'}
	<div
		class="overlay"
		role="dialog"
		aria-modal="true"
		aria-labelledby="modal-title"
		dir={lang === 'ar' && !social ? 'rtl' : 'ltr'}
		transition:fade={{ duration: 200 }}
	>
		<button class="screen-close" aria-label={tr('INFO CTRL CLOSE')} onclick={closeModal}
			><img src="/ui/close.svg" alt="" /></button
		>
		{#key modal}
			<section
				class={`dialog ${modal}`}
				class:wide={modal === 'rules' || modal === 'paytable'}
				in:pop
				out:popOut
			>
				{#if modal === 'confirm'}
					<!-- Figma 9185:17341 -->
					<h2 id="modal-title">{tr('CONFIRM')} {tr(chosen.toUpperCase())}</h2>
					<p class="confirm-line">
						{tr('BUY FOR')
							.replace('%name%', tr(chosen.toUpperCase()))
							.replace('%price%', money(bet * MODES[chosen]))}
					</p>
					<div class="dialog-actions">
						<button class="secondary" onclick={() => (modal = 'bonus')}>{tr('CANCEL')}</button
						><button class="primary" onclick={confirmBuy} disabled={balance < bet * MODES[chosen]}
							>{tr('CONFIRM')}</button
						>
					</div>
				{:else if modal === 'auto'}
					<!-- Figma 9185:17902. "50 X" is the feature spin's price, so that toggle autoplays
					     feature spins. -->
					<h2 class="sr-only" id="modal-title">{tr('AUTOPLAY')}</h2>
					<div class="toggles">
						<label class="toggle-row"
							>{tr('TURBO SPIN')}<input
								type="checkbox"
								role="switch"
								bind:checked={turbo}
								onchange={() => turbo && (superTurbo = false)}
								disabled={!!jurisdiction.disabledTurbo}
							/></label
						>
						<label class="toggle-row"
							>{tr('SUPER TURBO SPIN')}<input
								type="checkbox"
								role="switch"
								bind:checked={superTurbo}
								onchange={() => superTurbo && (turbo = false)}
								disabled={!!jurisdiction.disabledTurbo}
							/></label
						>
						<label class="toggle-row"
							>{MODES.feature} X {tr('FEATURE')}<input
								type="checkbox"
								role="switch"
								bind:checked={autoFeature}
								disabled={!!jurisdiction.disabledBuyFeature}
							/></label
						>
					</div>
					<h3 class="spins-title">{tr('AUTO NUM SPINS')}</h3>
					<div class="spins-stepper">
						<button
							class="hud-icon"
							aria-label={tr('INFO CTRL MINUS')}
							onclick={() => stepAuto(-1)}
							disabled={autoChoice === AUTO_STEPS[0]}
							><img class="minus" src="/base/minus.svg" alt="" /></button
						><output>{autoChoice}</output><button
							class="hud-icon"
							aria-label={tr('INFO CTRL PLUS')}
							onclick={() => stepAuto(1)}
							disabled={autoChoice === AUTO_STEPS.at(-1)}
							><img class="plus" src="/base/plus.svg" alt="" /></button
						>
					</div>
					<button class="primary start-auto" onclick={startAuto}
						>{tr('AUTO START')} ({autoChoice})</button
					>
				{:else if modal === 'settings'}<h2 id="modal-title">{tr('SETTINGS')}</h2>
					<label class="setting"
						>{tr('LANGUAGE')}<select bind:value={lang} onchange={locale} disabled={social}
							>{#each languages as l}<option value={l}>{l.toUpperCase()}</option>{/each}</select
						></label
					><label class="setting toggle-row"
						>{tr('SOUND')}<input type="checkbox" role="switch" bind:checked={sound} /></label
					><button class="setting link" onclick={() => (modal = 'rules')}
						>{tr('GAME RULES')} <span>→</span></button
					><button class="setting link" onclick={() => (modal = 'paytable')}
						>{tr('PAYTABLE')} <span>→</span></button
					><small>{q.demo ? tr('PREVIEW_NOTE') : tr('LEGAL')}</small>
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
		{/key}
	</div>
{/if}
