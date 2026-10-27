<script lang="ts">
	import { onMount, onDestroy, tick, untrack } from 'svelte';
	import { fade, scale } from 'svelte/transition';
	import { elasticOut, cubicIn, backOut } from 'svelte/easing';
	import Blob from './components/Blob.svelte';
	import Crack from './components/Crack.svelte';
	import EggHatch from './components/EggHatch.svelte';
	import { SURPRISE_MS } from './board/anim';
	import PixiBoard from './components/PixiBoard.svelte';
	import PixiScene from './components/PixiScene.svelte';
	import PixiLogo from './components/PixiLogo.svelte';
	import BaseScene from './components/BaseScene.svelte';
	import BonusNormal from './components/BonusNormal.svelte';
	import BonusSuper from './components/BonusSuper.svelte';
	import MysteryEgg, { BURST_MS, KNOCKS_MS, MYSTERY_MS, START_BLOBS } from './components/MysteryEgg.svelte';
	import BonusCard, { CARD_BUILD_MS, type CardKind } from './components/BonusCard.svelte';
	import WinScreen, { type WinTier } from './components/WinScreen.svelte';
	import SpinLog, { type SpinLogRow } from './components/SpinLog.svelte';
	import Splash from './components/Splash.svelte';
	import Loading from './components/Loading.svelte';
	import { preloadAll } from './lib/preload';
	import { GRID_W, GRID_H } from './board/geometry';
	import { PREMIUM_RIM } from './lib/premium';
	import Logo from './components/Logo.svelte';
	import GameInfo from './components/GameInfo.svelte';
	import {
		MODES,
		SYMBOLS,
		initialState,
		applyEvent,
		parseRound,
		winMoney,
		type Mode,
		type Round,
	} from './lib/model';
	import { launch, createTransport } from './lib/transport';
	import * as sfx from './lib/sound';
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
	// The Mystery card's copy is a lead line, one line per bonus with its odds, and a closing
	// line: the odds lines render as rows, the percentage in a chip and the bonus name apart
	// from what it does.
	const oddsCopy = (text: string) => {
		const lines = text.split('\n');
		const odds = lines.slice(1, lines.length > 2 ? -1 : undefined).map((line) => {
			// "65 % Name — what", "%65 Name — what" (tr), "65 % Name: what" (es).
			const [, pct = '', rest = line] = /^(\d+\s?%|%\d+)\s*(.*)$/.exec(line) ?? [];
			const [, name = rest, what = ''] = /^(.*?)(?:\s[—–-]\s|:\s)(.*)$/.exec(rest) ?? [];
			return { pct, name, what };
		});
		return { lead: lines[0], odds, foot: lines.length > 2 ? lines.at(-1) : '' };
	};
	let board = $state(initialState());
	let balance = $state(0);
	let currency = $state(q.currency);
	let bet = $state(1);
	let roundBet = $state(1);
	let bets = $state([0.1, 0.2, 0.5, 1, 2, 5, 10]);
	let busy = $state(false);
	let mystery = $state<{ tier: string; pace: number } | null>(null);
	// The bonus cards (BonusCard): the bonus won or bought (its name, rule and spins; after the
	// egg for a Mystery draw), and the bonus total when the spins end. Each waits for the player
	// like other slots' congrats screens: it stays until a tap, Space or Enter, taken only once
	// the card has built up. `card` outlives `cardOpen` so the card keeps its content while it
	// fades out.
	type Card = { kind: CardKind; count: number; pace: number; tier?: string; amount?: string };
	let card = $state<Card | null>(null);
	let cardOpen = $state(false);
	let cardSkip: (() => void) | null = null;
	// The blob each Mystery tier's egg hatches, carried onto its result card's medallion.
	const TIER_BLOB: Record<string, string> = { normal: 'KIWI', super: 'GRAPES', hidden: 'LEMON' };
	async function presentCard(next: Omit<Card, 'pace'>) {
		const pace = Math.max(paceScale(), 0.5);
		card = { ...next, pace };
		cardOpen = true;
		const stopMusic = next.kind === 'end' ? sfx.sting('bonusEnd') : () => {};
		// The card pops in, its bubbles bursting in behind it (BonusCard's entrance).
		sfx.play('plop');
		sfx.play('pop', 260 * pace, 0.8, 1.15);
		// Reduced motion shows the card (and its prompt) built at once. The press is a continue,
		// not a slam stop, so it is taken even where slam stop is disabled.
		const armed = performance.now() + (reducedMotion ? 0 : CARD_BUILD_MS * pace);
		await new Promise<void>((done) => {
			cardSkip = () => {
				if (performance.now() >= armed) done();
			};
		});
		cardSkip = null;
		cardOpen = false;
		stopMusic();
	}
	let ready = $state(false);
	// Every image and font is fetched and decoded behind the loading screen before the splash.
	let loaded = $state(false);
	let loadProgress = $state(0);
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
	// The buy menu on a short landscape (phone on its side, popout) keeps a readable scale and
	// fills the screen instead: its cards reflow into a scrolling grid (style.css .compact).
	let buyCompact = $derived(!portrait && fit < 0.8);
	let buyK = $derived(buyCompact ? (vh <= 340 ? 0.65 : 0.8) : fit);
	let buyStage = $derived(buyCompact ? { w: vw / buyK, h: vh / buyK } : stage);
	// The portrait base game is Figma 11075:34378's 360×577 game area at 680 wide (×1.889 =
	// 680×1090); taller phones add the spare height as --ex, which the CSS spreads between rows.
	const PORTRAIT_H = 1090;
	// Phones on their side: Figma 11075:35080's 800×360 layout, board in the middle, logo/panels/
	// log/balance on the left, the bet stepper, a vertical control bar and the win on the right.
	// Wide screens only, Popout-S (400×225) included; the squarer Popout-L keeps the desktop bar.
	// The stage takes the screen's shape (800 wide, or 360 high on wider screens). As designed,
	// the board runs top to bottom and the control bar nearly so: on a taller screen both grow
	// with the height, the columns hold to the screen's edges (top parts at the top, bottom parts
	// at the bottom) and shrink by --c when the bigger board needs their width (to 85%, then the
	// board stops just short of the full height).
	const PHONE = { w: 800, h: 360 };
	let landFit = $derived(Math.min(vw / 1200, vh / 670));
	let phone = $derived(!portrait && vw / vh >= 1.7 && (vh <= 340 || landFit < 0.8));
	let phoneLay = $derived.by(() => {
		const W = Math.max(PHONE.w, (PHONE.h * vw) / vh);
		const H = Math.max(PHONE.h, (PHONE.w * vh) / vw);
		// The columns' own widths (18+137 left, 123+20 right) plus a 12px gap each side of the board.
		let bs = (H - 8) / 352;
		let c = Math.min(1, (W - 431 * bs - 24) / 298);
		if (c < 0.85) {
			c = 0.85;
			bs = (W - 24 - 298 * c) / 431;
		}
		const left = 155 * c;
		const right = W - 143 * c;
		const free = right - left - 431 * bs;
		return { W, H, c, s: 0.657 * bs, x: left + free * 0.69, y: 6 + (H - 8 - 352 * bs) / 2 };
	});
	let baseStage = $derived(
		portrait
			? { w: 680, h: Math.max(PORTRAIT_H, (680 * vh) / vw) }
			: phone
				? { w: phoneLay.W, h: phoneLay.H }
				: stage,
	);
	// Landscape phones fit inside env(safe-area-inset-*): style.css pads landscape <main> by them.
	let safe = $state({ x: 0, y: 0 });
	$effect(() => {
		void vw, vh, portrait;
		const main = document.querySelector('main');
		if (!main) return;
		const cs = getComputedStyle(main);
		safe = {
			x: parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight),
			y: parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom),
		};
	});
	let baseFit = $derived(Math.min((vw - safe.x) / baseStage.w, (vh - safe.y) / baseStage.h));
	let shortLand = $derived(!portrait && !phone && vh > 340 && baseFit < 0.8);
	// Portrait's balance/win boxes are 170 wide: long amounts step the type down to fit.
	// HUD amounts shrink to their slot's width (measured in their own face), so a long amount
	// ("100,000.00 ARS") can't push the bet steppers under the spin button. Slot widths are the
	// stage px each layout leaves the text (see .metric / .bet-controls in style.css).
	const HUD_FIT = {
		land: { metric: 117, bet: 80, max: 24, face: "400 {}px 'Coiny'", track: 0 },
		// Phones on their side (.short): tighter metric padding and stepper gaps give back ~10px.
		short: { metric: 134, bet: 88, max: 24, face: "400 {}px 'Coiny'", track: 0 },
		popout: { metric: 290, bet: 230, max: 40, face: "400 {}px 'Coiny'", track: 0 },
		portrait: { metric: 130, bet: 105, max: 26.4, face: "400 {}px 'Coiny'", track: 0.8 },
		// Phone landscape: balance/win at 12px (under the design's 14, asked for), the bet at 14.
		phone: { metric: 66, bet: 41, max: 12, betMax: 14, face: "500 {}px 'Poppins'", track: 0.42 },
	};
	let measure: CanvasRenderingContext2D | null | undefined;
	let fontsTick = $state(0);
	onMount(() => void document.fonts?.ready.then(() => fontsTick++));
	function hudSize(text: string, slot: 'metric' | 'bet', extra = 0) {
		void fontsTick;
		const f = HUD_FIT[portrait ? 'portrait' : phone ? 'phone' : vh <= 340 ? 'popout' : shortLand ? 'short' : 'land'];
		measure ??= document.createElement?.('canvas').getContext('2d');
		if (!measure) return f.max;
		measure.font = f.face.replace('{}', String(f.max));
		const max = (slot === 'bet' && 'betMax' in f && f.betMax) || f.max;
		const w = (measure.measureText(text).width * max) / f.max + f.track * text.length;
		return Math.min(max, (max * (f[slot] + extra)) / w);
	}
	const hudFont = (text: string, slot: 'metric' | 'bet', extra = 0) =>
		`font-size:${hudSize(text, slot, extra).toFixed(1)}px`;
	let error = $state('');
	// Recoverable problems (not enough balance, a play request that failed before any round came
	// back): a dismissible notice over a game that stays playable. `error` is for fatal states.
	let notice = $state('');
	let pending = $state<Round | null>(null);
	let replay = $state<Round | null>(null);
	// The replayed round's payout multiplier: its finalWin (always the last event) in book units.
	let replayX = $derived(replay ? Number((replay.state.at(-1) as any)?.amount ?? 0) / 100 : 0);
	let settling = $state(false);
	let turbo = $state(false);
	let superTurbo = $state(false);
	// Every bonus round, bought or won, starts at normal speed: turbo and super turbo are put
	// aside as the round starts (board.tier) and handed back once it is over. The player may
	// speed the round back up; that choice then outlives the round (a speed change drops the hold).
	let turboHeld: { turbo: boolean; superTurbo: boolean } | null = null;
	let inBonus = $derived(!!board.tier);
	// A tall phone's spare sky goes to a bigger logo in the base game (up to 1.6×). The bonus
	// panels and spin log share its row, so there it keeps nearly its own size.
	let logoScale = $derived(
		!portrait ? 1 : inBonus ? 1.08 : Math.min(1.6, 1 + Math.max(0, baseStage.h - PORTRAIT_H) / 600),
	);
	$effect(() => {
		const on = inBonus;
		untrack(() => {
			if (on && !turboHeld) {
				turboHeld = { turbo, superTurbo };
				turbo = superTurbo = false;
			} else if (!on && turboHeld) {
				turbo = turboHeld.turbo && !jurisdiction.disabledTurbo;
				superTurbo = turboHeld.superTurbo && !jurisdiction.disabledTurbo && !jurisdiction.disabledSuperTurbo;
				turboHeld = null;
			}
		});
	});
	// The menu's Sound (effects) and Music (bed and win music) toggles; lib/sound.ts.
	let sound = $state(true);
	let music = $state(true);
	$effect(() => sfx.setSfx(sound));
	$effect(() => sfx.setMusic(music));
	// A plop as a dialog (buy, info, autoplay, replay…) or the menu panel pops open.
	// The plop stands in for the click of the button that opened it.
	let lastClick: { stop: () => void; at: number } | null = null;
	const plop = () => {
		if (lastClick && performance.now() - lastClick.at < 400) lastClick.stop();
		lastClick = null;
		sfx.play('plop');
	};
	$effect(() => {
		if (modal) plop();
	});
	$effect(() => {
		if (menuOpen) plop();
	});
	// Base music in the base game, bonus music from the bonus start until its total is seen.
	$effect(() => sfx.setBed(started ? (board.tier ? 'bonus' : 'base') : null));
	// Figma 11174:7179: the menu button turns into a teal close and pops a Sound / Music / Info
	// panel above it. It is a popover, not a modal, so sound can be toggled mid-round.
	let menuOpen = $state(false);
	let modal = $state('');
	let infoPage = $state(0);
	let chosen = $state<Mode>('normal');
	let activeMode = $state<Mode>('base');
	let autoCount = $state(0);
	let autoChoice = $state(100);
	let autoFeature = $state(false);
	let autoMode = $state<Mode>('base');
	// Extra Feature and Feature Spin are switches, not buys: while one is on, every regular spin
	// (and regular autoplay) plays its mode at its cost, shown as the HUD bet. One at a time;
	// the HUD bonus button reads DEACTIVATE and turns it off.
	let toggled = $state<'extra_chance' | 'feature' | null>(null);
	let spinMode = $derived<Mode>(toggled ?? 'base');
	const toggleMode = (mode: 'extra_chance' | 'feature') => {
		toggled = toggled === mode ? null : mode;
		// Switching one on is the player's choice made: back to the board.
		if (toggled) closeModal();
	};
	// The HUD bonus button turns into the switch-off while Extra is on. DEACTIVATE runs about
	// twice BONUS's length, so its label is fitted to the button (measured in the button's own
	// font, per layout).
	let bonusBtn = $state<HTMLButtonElement>();
	let bonusW = $state(0);
	let bonusFit = $state({ k: 1, track: 0 });
	let bonusLabel = $derived(tr(toggled ? 'DEACTIVATE' : 'BONUS'));
	$effect(() => {
		const label = bonusLabel;
		const w = bonusW;
		void [portrait, phone, vh];
		const el = bonusBtn;
		if (!el || !w) return;
		void document.fonts.ready.then(() => {
			measure ??= document.createElement?.('canvas').getContext('2d');
			if (!measure) return;
			const cs = getComputedStyle(el);
			const track = parseFloat(cs.letterSpacing) || 0;
			measure.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
			const text = label.toUpperCase();
			const tw = measure.measureText(text).width + track * text.length;
			// The mark before the word (landscape) and its 8px gap take their share of the pill.
			const mark = el.querySelector<HTMLElement>('.bonus-mark')?.offsetWidth;
			const room =
				el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - 0.24 * el.clientHeight - (mark ? mark + 8 : 0);
			bonusFit = { k: Math.min(1, room / tw), track };
		});
	});
	const AUTO_STEPS = [10, 25, 50, 75, 100, 250, 500, 1000];
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
	// Jurisdictions that ask for them (displaySessionTimer / displayNetPosition) get a readout of
	// the time played and the balance change since the game was opened, ticking each second.
	let sessionStart = 0;
	let startBalance: number | null = null;
	let clock = $state(Date.now());
	let showSession = $derived(!q.replay && !!(jurisdiction.displaySessionTimer || jurisdiction.displayNetPosition));
	$effect(() => {
		if (!showSession) return;
		const h = setInterval(() => (clock = Date.now()), 1000);
		return () => clearInterval(h);
	});
	const elapsed = (ms: number) => {
		const s = Math.max(0, Math.floor(ms / 1000));
		return [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60].map((n) => String(n).padStart(2, '0')).join(':');
	};
	let disposed = false;
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
		spinRowStaggerMs: 42,
		tumbleRowStaggerMs: 28,
		reelDelayMs: 11,
		spinReelDelayMs: 72,
		jitterMs: 48,
		impactMs: 425,
		exitRowStaggerMs: 33,
		exitReelDelayMs: 13,
		exitJitterMs: 33,
		removeMs: 525,
		removeJitterMs: 69,
		holdMs: 150,
		// Not from Veggie: the roller-coaster fright the blobs pull before the board drops.
		scareMs: 240,
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
	// Cascade chains speed up, like other tumble slots: every cascade in a spin plays 18% faster
	// than the one before (highlight, split, pop and refill), down to 35% of the first, and the
	// next spin starts over. A 17-cascade free spin went from ~61s to ~22s; the first cascade of
	// every spin keeps its full showcase timing.
	const CHAIN_DECAY = 0.82;
	const CHAIN_FLOOR = 0.35;
	let chain = $state(0);
	const chainK = () => Math.max(CHAIN_FLOOR, CHAIN_DECAY ** chain);
	const cascadePace = () => paceScale() * chainK();
	const SPLIT_SFX_DELAY_MS = 350;
	// Each cascade in a chain sounds a semitone higher, up to a fifth.
	const chainPitch = () => 2 ** (Math.min(chain, 7) / 12);
	function cascadeMotion() {
		const m = motion();
		const k = chainK();
		return {
			...m,
			unitMs: m.unitMs * k,
			minMs: m.minMs * k,
			tumbleRowStaggerMs: m.tumbleRowStaggerMs * k,
			reelDelayMs: m.reelDelayMs * k,
			jitterMs: m.jitterMs * k,
			impactMs: m.impactMs * k,
			removeMs: m.removeMs * k,
			removeJitterMs: m.removeJitterMs * k,
			holdMs: m.holdMs * k,
		};
	}
	// Live: under reduced motion the boards land at once, so nothing may wait on falls or teases.
	let reducedMotion = $state(false);
	$effect(() => {
		const mq = matchMedia('(prefers-reduced-motion: reduce)');
		const change = () => (reducedMotion = mq.matches);
		change();
		mq.addEventListener('change', change);
		return () => mq.removeEventListener('change', change);
	});
	const fallMs = (m: typeof MOTION, rows: number) => Math.max(m.minMs, m.unitMs * Math.sqrt(rows));
	type Drop = { rows: number; delay: number; dur: number };
	type Tease = { col: number; from: number; to: number };
	let wave = $state<{ id: number; drops: Drop[][]; impact: number; tease: Tease[] }>({ id: 0, drops: [], impact: 0, tease: [] });
	// Scatter tease. 3 eggs trigger Normal, 4 Super, 5+ Hidden: once two are down, every column
	// still to land holds back and then drops under a glowing column, one at a time, the way
	// other slots tease the reels after the second scatter. It stops at five (nothing beats
	// Hidden). Turbo shortens the hold but keeps it readable.
	const TEASE_MS = 950;
	// The DOM board's tease column (style.css .tease-col): its seven chasing pads and bubbles.
	const TEASE_ROWS = [0, 1, 2, 3, 4, 5, 6];
	const TEASE_BUBBLES = [
		{ x: 22, s: 9, t: 1500, d: 0, w: 8 },
		{ x: 52, s: 12, t: 1830, d: 430, w: -10 },
		{ x: 36, s: 7, t: 1650, d: 860, w: 12 },
		{ x: 62, s: 10, t: 1990, d: 1290, w: -8 },
		{ x: 14, s: 8, t: 1500, d: 1720, w: 10 },
	];
	// The tease's moods (both boards): while a column is held back every blob wonders if an egg
	// is coming (`wonder`: that column); an egg landing there gets a happy surprise (`surprise`:
	// its performance.now(), 0 once over). Scheduled from the wave's own timings.
	let mood = $state<{ wonder: number | null; surprise: number }>({ wonder: null, surprise: 0 });
	// The DOM board's gaze at the teased column (BoardView wonderGaze): unit vectors from the
	// cell to the column's top and bottom blobs, which the pupils sweep between.
	function watchVars(wc: number, col: number, row: number) {
		const dx = (wc - col) * 90.2;
		const to = (r: number) => {
			const dy = (r - row) * 73 * 0.3;
			const l = Math.hypot(dx, dy) || 1;
			return [(dx / l).toFixed(2), (dy / l).toFixed(2)];
		};
		const [x0, y0] = to(0);
		const [x1, y1] = to(N - 1);
		return `;--wx0:${x0};--wy0:${y0};--wx1:${x1};--wy1:${y1}`;
	}
	// Trigger eggs hatching on the board (cheerEggs, EggHatch.svelte); cleared by the next drop.
	let hatched = $state<string[]>([]);
	let hatchPace = $state(1);
	let moodTimers: ReturnType<typeof setTimeout>[] = [];
	function scheduleMoods(tease: Tease[], drops: Drop[][]) {
		moodTimers.forEach(clearTimeout);
		moodTimers = [];
		mood = { wonder: null, surprise: 0 };
		const at = (ms: number, f: () => void) => moodTimers.push(setTimeout(f, ms));
		for (const t of tease) {
			const lands = board.board[t.col].flatMap((s, row) => (s === EGG ? [drops[t.col][row].delay + drops[t.col][row].dur] : []));
			at(t.from, () => (mood = { ...mood, wonder: t.col }));
			if (lands.length) {
				at(Math.min(...lands), () => {
					const stamp = performance.now();
					mood = { wonder: null, surprise: stamp };
					at(SURPRISE_MS, () => mood.surprise === stamp && (mood = { ...mood, surprise: 0 }));
				});
			}
			at(t.to, () => mood.wonder === t.col && (mood = { ...mood, wonder: null }));
		}
	}
	const TEASE_FROM = 2;
	const TEASE_TO = 5;
	const EGG = 'BASKET';
	const eggCells = (b: string[][]) => b.flatMap((c, col) => c.flatMap((s, row) => (s === EGG ? [`${col},${row}`] : [])));
	type Ghost = { col: number; row: number; symbol: string; units: number; rows: number; delay: number; dur: number };
	let ghost = $state<{ id: number; cells: Ghost[] } | null>(null);
	let awaitingReveal = $state(false);
	let scared = $state(false);
	// While tiles split the rest of the board watches nervously, then sighs once it's done.
	let nervous = $state(false);
	// The coaster pulls in: after a spin's blobs land they let out a sigh of relief (style.css
	// .grid.relieved). It plays over the next events, so it never holds the round up.
	const RELIEF_MS = 1250;
	let relieved = $state(false);
	let reliefTimer: ReturnType<typeof setTimeout> | undefined;
	function relief() {
		clearTimeout(reliefTimer);
		if (superTurbo) return;
		relieved = true;
		reliefTimer = setTimeout(() => (relieved = false), RELIEF_MS * (turbo ? 0.6 : 1) + 300);
	}
	let moving = $state(false);
	let popping = $state<Record<string, number>>({});
	// Each winning cluster's share of the award, popped up at the cluster's centre (cells as
	// fractions of the grid) with a burst of confetti; cleared when the board tumbles. `s` sizes
	// the pill by its share of the biggest cluster's award, so a late bonus board's crowd of
	// small pills doesn't drown the one that matters.
	type ClusterPop = { id: number; x: number; y: number; amount: string; s: number };
	let clusterPops = $state<ClusterPop[]>([]);
	let popId = 0;
	const SPARKS = Array.from({ length: 16 }, (_, i) => {
		const a = (i / 16) * Math.PI * 2 + (i % 2) * 0.2;
		const d = 58 + (i % 3) * 22;
		return { dx: Math.cos(a) * d, dy: Math.sin(a) * d, c: ['#c9a8ff', '#fa52e5', '#ffffff'][i % 3], s: 8 + (i % 3) * 3 };
	});
	// The current spin's clusters for the spin log (SpinLog.svelte), newest first; each free
	// spin starts it again.
	let spinLog = $state<SpinLogRow[]>([]);
	function popClusters(event: any) {
		logoBeat++;
		const wins: any[] = event.wins ?? [];
		const raw = wins.reduce((t, w) => t + (w.rawAward ?? 0), 0) || 1;
		const top = Math.max(...wins.map((w) => w.rawAward ?? 0)) || 1;
		clusterPops = wins.map((w) => {
			const ps: any[] = w.positions ?? [];
			const cx = ps.reduce((t, p) => t + p.reel, 0) / (ps.length || 1);
			const cy = ps.reduce((t, p) => t + p.row, 0) / (ps.length || 1);
			// Split the paid award by each cluster's raw share, so the pops add up to the win.
			const award = ((w.rawAward ?? 0) * event.paidAward) / raw;
			const s = wins.length > 1 ? 0.74 + 0.26 * Math.sqrt((w.rawAward ?? 0) / top) : 1;
			return { id: ++popId, x: (cx + 0.5) / 7, y: (cy + 0.5) / 7, amount: win(winMoney(roundBet, award)), s };
		});
		// The blobs the cluster paid on (fruitUnits, the paytable's "blob units"): counted as it
		// connects, before this win's split adds more.
		const tiles = (w: any) => w.tileCount ?? w.positions?.length ?? 1;
		spinLog = [
			...wins
				.map((w, i) => ({ id: clusterPops[i].id, symbol: w.symbol, units: w.fruitUnits ?? tiles(w), amount: clusterPops[i].amount }))
				.reverse(),
			...spinLog,
		];
		spreadPops(
			clusterPops,
			wins.map((w) => w.rawAward ?? 0),
		);
	}
	// A late bonus board can pay six or seven clusters at once, their centres close together:
	// pills that would overlap are pushed apart vertically (the bigger win keeps its spot), and
	// every pill is kept inside the board so a long amount can't hang off its edge.
	const PILL_H = 2 + 22 * 1.3 + 6; // the pill (overlays.ts / .cluster-pop strong) plus a gap
	function spreadPops(pops: { x: number; y: number; amount: string }[], size: number[]) {
		measure ??= document.createElement?.('canvas').getContext('2d');
		const box = pops.map((p) => {
			if (measure) measure.font = "400 22px 'Coiny', sans-serif";
			const w = (measure ? measure.measureText(p.amount).width : p.amount.length * 14) + 24;
			return { p, x: p.x * GRID_W, y: p.y * GRID_H, pw: w };
		});
		const clampX = (b: (typeof box)[number]) =>
			(b.x = Math.min(Math.max(b.x, b.pw / 2), GRID_W - b.pw / 2));
		const clampY = (b: (typeof box)[number]) => (b.y = Math.min(Math.max(b.y, PILL_H / 2), GRID_H - PILL_H / 2));
		box.forEach((b) => (clampX(b), clampY(b)));
		const order = box.map((b, i) => ({ b, s: size[i] })).sort((a, b) => b.s - a.s).map((o) => o.b);
		for (let pass = 0; pass < 12; pass++) {
			let moved = false;
			for (let i = 0; i < order.length; i++)
				for (let j = i + 1; j < order.length; j++) {
					const a = order[i],
						b = order[j];
					const ox = (a.pw + b.pw) / 2 - Math.abs(a.x - b.x);
					const oy = PILL_H - Math.abs(a.y - b.y);
					if (ox <= 0 || oy <= 0) continue;
					// Move the smaller win away from the bigger, toward the side with room.
					const down = b.y > a.y || (b.y === a.y && a.y < GRID_H / 2);
					b.y += down ? oy : -oy;
					clampY(b);
					if (Math.abs(a.y - b.y) < PILL_H - 0.5) b.y = a.y + (b.y >= a.y ? PILL_H : -PILL_H);
					clampY(b);
					moved = true;
				}
			if (!moved) break;
		}
		for (const b of box) {
			b.p.x = b.x / GRID_W;
			b.p.y = b.y / GRID_H;
		}
	}
	// Figma 11174:8407: every round win under a big win ends on the jelly plaque. The tiers are
	// McSchmutzo's (feature/mcschmutzo-v1, bookEventHandlerMap.ts): under 5 bets the amount lands
	// with the plaque and holds; 5–20 bets count up like its plaque tiers (winLevelMap levels
	// 4–5). 20x and up is a big win (presentBigWin, WinScreen.svelte). The splat-in (style.css
	// .win-plaque) runs PLAQUE_LAND_MS before the hold or count-up starts.
	// A split plays as cell division (Blob.svelte); the board waits for the whole beat.
	const DIVIDE_MS = 1400;
	// Space / a tap during a split lands it at once (`rush` tells the Pixi board; the DOM board's
	// division animations are finished in place).
	let rush = $state(0);
	let splitSkip: (() => void) | null = null;
	const DIVIDE_ANIMS = /(divide-swell|divide-apart|split-ring|tear|seam-flash|charge|burst|chip)$/;
	async function waitSplit(ms: number) {
		await new Promise<void>((done) => {
			const h = setTimeout(done, ms);
			splitSkip = () => {
				clearTimeout(h);
				rush++;
				for (const a of document.getAnimations())
					if (a instanceof CSSAnimation && DIVIDE_ANIMS.test(a.animationName))
						try {
							a.finish();
						} catch {}
				done();
			};
		});
		splitSkip = null;
	}
	const paceScale = () => (superTurbo ? 0.08 : turbo ? 0.22 : 1);
	// Slam stop, like other slots: Space / a tap while a spin plays skips the current step only:
	// whatever is falling or splitting lands at once (`rush`, and the waits in waveSleep are
	// cut); the next step plays at the normal pace again. Win screens, cards, the egg hatch and
	// the jurisdiction's minimum round time are not cut.
	let waveCut: (() => void) | null = null;
	const waveSleep = (ms: number) =>
		new Promise<void>((done) => {
			const h = setTimeout(() => ((waveCut = null), done()), ms);
			waveCut = () => (clearTimeout(h), (waveCut = null), done());
		});
	const FALL_ANIMS = /^(trapdoor-exit|gravity-fall|land-impact|blob-pop|tease-.*)$/;
	function slamStop() {
		if (splitSkip) return splitSkip();
		if (!waveCut) return;
		sfx.stopPending();
		sfx.play('land');
		rush++;
		ghost = null;
		wave = { ...wave, tease: [] };
		moodTimers.forEach(clearTimeout);
		mood = { wonder: null, surprise: 0 };
		for (const a of document.getAnimations())
			if (a instanceof CSSAnimation && FALL_ANIMS.test(a.animationName))
				try {
					a.finish();
				} catch {}
		waveCut();
	}
	// The board's blobs, pads and cracks render in Pixi (components/PixiBoard.svelte); `?board=dom`
	// (or a device without WebGL) keeps the SVG/CSS board. Same motion either way.
	let pixiBoard = $state(new URLSearchParams(location.search).get('board') !== 'dom');
	// The backdrops too (components/PixiScene.svelte); `?scene=dom` keeps the DOM scenes.
	let pixiScene = $state(new URLSearchParams(location.search).get('scene') !== 'dom');
	// Blobs on a tile: its blade count + 1. Eggs (scatters) never split in the math, so an egg
	// that lands on a split tile still shows whole.
	const unitsOf = (b: typeof board, col: number, row: number) => (b.board[col][row] === EGG ? 1 : b.blades[col][row] + 1);
	const cellUnits = (col: number, row: number) => unitsOf(board, col, row);
	let boardSnap = $derived({
		symbols: board.board.map((c) => [...c]),
		units: board.blades.map((c, col) => c.map((b, row) => cellUnits(col, row) - 1)),
		lit: [...board.highlight],
		wave,
		ghost,
		awaiting: awaitingReveal,
		scared,
		nervous,
		relieved,
		popping,
		divideMs: Math.round(DIVIDE_MS * cascadePace()),
		rush,
		reliefMs: Math.round(RELIEF_MS * (turbo ? 0.6 : 1)),
		removeMs: cascadeMotion().removeMs,
		pops: clusterPops,
		hatched,
		mood,
		sweat: relieved ? sweatCells(board) : [],
	});
	// The few single blobs that break a sweat as they sigh (same cells in both board modes).
	const sweats = (col: number, row: number, units: number) => units === 1 && (col * 5 + row * 3) % 4 === 0;
	const sweatCells = (b: typeof board) =>
		b.board.flatMap((c, col) => c.flatMap((_, row) => (sweats(col, row, unitsOf(b, col, row)) ? [`${col},${row}`] : [])));
	const QUICK_WIN_X = 5;
	const BIG_WIN_X = 20;
	const PLAQUE_LAND_MS = 650;
	const QUICK_WIN_HOLD_MS = 900;
	const COUNT_UP_HOLD_MS = 650;
	const COUNT_UP_LADDER = [
		[10, 1500],
		[BIG_WIN_X, 2000],
	];
	// The plaque keeps its last values while it plays out, so the exit never reads a cleared win.
	let smallWin = $state({ shown: 0, final: 0, counted: false, speed: 1 });
	let plaqueOn = $state(false);
	// Space on the plaque (see key()): skips straight to the next spin.
	let winSkip: (() => void) | null = null;
	const skippable = (ms: number) =>
		new Promise<boolean>((done) => {
			const h = setTimeout(() => ((winSkip = null), done(false)), ms);
			winSkip = () => (clearTimeout(h), (winSkip = null), done(true));
		});
	// A count-up ticks every ~110ms, climbing from its pitch to 1.3× of it as it counts.
	function ticker() {
		let next = 0;
		return (t: number) => {
			const now = performance.now();
			if (now < next || t >= 1) return;
			next = now + 110;
			sfx.play('tick', 0, 1, 1 + 0.3 * t);
		};
	}
	async function presentSmallWin(amount: number, multiplier: number) {
		const speed = superTurbo ? 0.4 : turbo ? 0.5 : 1;
		const countMs = multiplier < QUICK_WIN_X ? 0 : COUNT_UP_LADDER.find(([x]) => multiplier < x)![1];
		smallWin = { shown: countMs ? 0 : amount, final: amount, counted: false, speed };
		plaqueOn = true;
		sfx.play('winSmall');
		let skipped = await skippable(PLAQUE_LAND_MS * speed);
		if (countMs) {
			const start = performance.now();
			const tick = ticker();
			if (!skipped)
				await new Promise<void>((done) => {
					winSkip = () => ((skipped = true), (winSkip = null), done());
					const step = (now: number) => {
						const t = Math.min(1, (now - start) / (countMs * speed));
						if (disposed || !plaqueOn || skipped) return done();
						smallWin.shown = amount * (1 - (1 - t) ** 3);
						tick(t);
						if (t < 1) requestAnimationFrame(step);
						else done();
					};
					requestAnimationFrame(step);
				});
			Object.assign(smallWin, { shown: amount, counted: true });
			sfx.play('thud');
		}
		if (!skipped) await skippable((countMs ? COUNT_UP_HOLD_MS : QUICK_WIN_HOLD_MS) * speed);
		winSkip = null;
		plaqueOn = false;
		chainDrop();
	}
	// Continuous play (autoplay, a held Space, or Space pressed on the win): the board drops as
	// the win leaves instead of after the round settles, and spin() takes this drop over.
	let spaceHeld = false;
	let nextAsked = false;
	let predrop: Promise<void> | null = null;
	function chainDrop() {
		if (board.tier || q.replay || reducedMotion || awaitingReveal || disposed) return;
		const auto = autoCount > 1;
		if (!(auto || spaceHeld || nextAsked)) return;
		if (balance < bet * MODES[auto ? autoMode : spinMode]) return;
		clearTimeout(reliefTimer);
		relieved = false;
		const end = startExit();
		predrop = new Promise((done) => setTimeout(done, end * 0.35));
	}
	// Big wins (20x and up) get the full-screen slime win screen; the tier climbs with the
	// multiplier (thresholds are ours, the design has none), MAX only at the 20000x cap.
	const BIG_WIN_TIERS: [x: number, tier: WinTier, countMs: number][] = [
		[50, 'sweet', 3000],
		[100, 'wild', 3500],
		[250, 'epic', 4000],
		[500, 'mythic', 4500],
		[20000, 'legendary', 5000],
		[Infinity, 'max', 5500],
	];
	const BIG_WIN_LAND_MS = 1300;
	const FREE_SPIN_WIN_PACE = 0.6;
	// The counted amount stays up this long before the screen closes (a tap still closes it).
	const BIG_WIN_HOLD_MS = 4500;
	// `id`: each win screen is a fresh WinScreen ({#key}); two back to back would otherwise reuse
	// one instance, and it lays out its tier once (a WILD title over the SWEET plaque).
	let bigWin = $state<{ id: number; tier: WinTier; shown: number; final: number; speed: number } | null>(null);
	let bigWinId = 0;
	let bigWinSkip: (() => void) | null = null;
	// `pace` shortens only the count-up and hold (a free spin's own win screen keeps the bonus
	// moving); the screen's entrance plays at full length either way.
	async function presentBigWin(amount: number, multiplier: number, pace = 1) {
		const speed = superTurbo ? 0.4 : turbo ? 0.5 : 1;
		const [, tier, countMs] = BIG_WIN_TIERS.find(([x]) => multiplier < x)!;
		bigWin = { id: ++bigWinId, tier, shown: 0, final: amount, speed };
		// The two lowest tiers get the small-to-medium win music, the rest the big win music;
		// it fades out with the screen.
		const stopMusic = sfx.sting(tier === 'sweet' || tier === 'wild' ? 'win' : 'bigWin');
		// A tap skips the count-up, and once counted, closes the screen.
		let skipped = false;
		const wait = (ms: number) =>
			new Promise<void>((done) => {
				const h = setTimeout(done, ms);
				bigWinSkip = () => (clearTimeout(h), (skipped = true), done());
			});
		await wait(BIG_WIN_LAND_MS * speed);
		if (!skipped) {
			const start = performance.now();
			const tick = ticker();
			await new Promise<void>((done) => {
				bigWinSkip = () => ((skipped = true), done());
				const step = (now: number) => {
					const t = Math.min(1, (now - start) / (countMs * speed * pace));
					if (disposed || skipped || !bigWin) return done();
					bigWin.shown = amount * (1 - (1 - t) ** 3);
					tick(t);
					if (t < 1) requestAnimationFrame(step);
					else done();
				};
				requestAnimationFrame(step);
			});
		}
		if (bigWin) bigWin.shown = amount;
		sfx.play('thud', 0, tier === 'max' ? 1.4 : 1);
		if (tier === 'max') sfx.play('crack', 120, 1.2, 0.8);
		skipped = false;
		await wait(BIG_WIN_HOLD_MS * speed * pace);
		bigWinSkip = null;
		bigWin = null;
		stopMusic();
	}
	// The plaque leaves like a jelly sitting down: squashed onto its base as it fades.
	function plaqueOut(_node: Element, { speed = 1 } = {}) {
		return {
			duration: 220 * speed,
			easing: cubicIn,
			css: (t: number) => `opacity:${Math.min(1, t * 2)};transform:scale(${0.7 + 0.3 * t + (1 - t) * 0.25}, ${0.35 + 0.65 * t})`,
		};
	}
	// Jelly droplets thrown off by the splat: [angle°, distance px, size px].
	const PLAQUE_DROPS = [
		[-160, 230, 16], [-128, 190, 12], [-100, 175, 18], [-72, 200, 11], [-45, 220, 15],
		[-15, 240, 12], [12, 230, 14], [168, 235, 13], [-2, 200, 9], [-178, 205, 10],
	].map(([a, r, s]) => ({
		dx: (Math.cos((a * Math.PI) / 180) * r).toFixed(0),
		dy: (Math.sin((a * Math.PI) / 180) * r * 0.75).toFixed(0),
		s,
	}));
	// Coiny at the design's 90.87px fits "$2.12"; longer amounts shrink to stay in the well.
	const plaqueFont = (label: string) => (90.87 * Math.min(1, 5.5 / label.length)).toFixed(1);
	let motionId = 0;
	let movingTimer: ReturnType<typeof setTimeout> | undefined;
	// The board clips falling blobs only while something is in the air, so win glows aren't cut.
	function holdMoving(ms: number) {
		moving = true;
		clearTimeout(movingTimer);
		movingTimer = setTimeout(() => (moving = false), ms);
	}
	// Fright, then the drop: resolves when the reveal may start (20% into the exit; at 35% the
	// board sat nearly empty a second into the spin).
	const REVEAL_AT = 0.2;
	async function dropBoard() {
		clearTimeout(reliefTimer);
		relieved = false;
		scared = true;
		if (reducedMotion) {
			startExit();
			return;
		}
		await waveSleep(motion().scareMs);
		await waveSleep(startExit() * REVEAL_AT);
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
				cells.push({ col, row, symbol: board.board[col][row], units: cellUnits(col, row), rows, delay, dur });
			}
		const id = ++motionId;
		ghost = { id, cells };
		awaitingReveal = true;
		holdMoving(end + 120);
		setTimeout(() => ghost?.id === id && (ghost = null), end + 120);
		return end;
	}
	// Reveal: every blob starts the same 8 rows up, so constant gravity lands them in a sweep.
	// Teased columns (see TEASE_MS) wait for the column before them to land, plus the hold.
	// `teaseTo`: the egg count past which nothing is teased (a bought bonus stops at its own).
	function spinWave(teaseTo = TEASE_TO) {
		const m = motion();
		const hold = TEASE_MS * Math.max(paceScale(), 0.4);
		let end = 0;
		let shift = 0;
		let eggs = 0;
		let landed = 0;
		const tease: Tease[] = [];
		const drops = Array.from({ length: N }, (_, col) => {
			const teased = !reducedMotion && eggs >= TEASE_FROM && eggs < teaseTo;
			if (teased) shift += Math.max(0, landed + hold - (col * m.spinReelDelayMs + shift));
			let colEnd = 0;
			const out = Array.from({ length: N }, (_, row) => {
				const delay = (N - 1 - row) * m.spinRowStaggerMs + col * m.spinReelDelayMs + Math.random() * m.jitterMs + shift;
				const dur = fallMs(m, N + 1);
				colEnd = Math.max(colEnd, delay + dur);
				return { rows: N + 1, delay, dur };
			});
			if (teased) tease.push({ col, from: landed, to: colEnd });
			// The column thuds as its bottom blob lands; each egg clinks as it lands.
			if (!reducedMotion) {
				sfx.play('land', Math.min(...out.map((d) => d.delay + d.dur)), 1, 0.92 + col * 0.03);
				board.board[col].forEach((s, row) => s === EGG && sfx.play('scatter', out[row].delay + out[row].dur, 1, 1, true));
				if (teased) heartbeat(landed, colEnd);
			}
			landed = colEnd;
			end = Math.max(end, colEnd);
			eggs += board.board[col].filter((s) => s === EGG).length;
			return out;
		});
		hatched = [];
		wave = { id: ++motionId, drops, impact: m.impactMs, tease };
		scheduleMoods(tease, drops);
		awaitingReveal = false;
		scared = false;
		holdMoving(end + m.impactMs + 60);
		return settleMs(end + m.impactMs + 60);
	}
	// A held column beats like a heart (lub-dub) until it lands, quickening as it waits.
	function heartbeat(from: number, to: number) {
		for (let t = from + 120, gap = 560; t < to - 200; t += gap, gap = Math.max(380, gap * 0.9)) {
			sfx.play('heart', t, 1, 1, true);
			sfx.play('heart', t + 150, 0.6, 0.9, true);
		}
	}
	// How long play waits for a wave: under reduced motion the board lands at once, so only a beat.
	const REDUCED_BEAT_MS = 250;
	const settleMs = (ms: number) => (reducedMotion ? Math.min(ms, REDUCED_BEAT_MS) : ms);
	// Tumble: survivors fall by the holes below them; new blobs enter from above the board.
	function tumbleWave(removed: Set<string>) {
		const m = cascadeMotion();
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
		hatched = [];
		wave = { id: ++motionId, drops, impact: m.impactMs, tease: [] };
		scheduleMoods([], []);
		if (!end) return 0;
		if (!reducedMotion)
			sfx.play('land', Math.min(...drops.flat().filter((d) => d.rows).map((d) => d.delay + d.dur)), 1, chainPitch());
		holdMoving(end + m.impactMs + 60);
		return settleMs(end + m.impactMs + 60);
	}
	const money = (v: number) => formatWalletAmount(currency, v);
	// A long landscape bet amount ("1,000.00 ARS") would shrink to half size beside the coin
	// stack: it drops the coins and takes their room instead.
	const COIN_ROOM = 34;
	let betText = $derived(money(bet * MODES[spinMode]));
	let betCoinless = $derived(!portrait && vh > 340 && hudSize(betText, 'bet') < 18);
	const win = (v: number) => formatWinAmount(currency, v);
	// Count-up frames format against the final amount, so a tween value never shows extra decimals.
	const winCount = (v: number, final: number) => formatWinAmount(currency, v, final);
	// In a bonus the HUD's WIN is the current free spin's win (the TOTAL WIN panel carries the
	// bonus total); `spinBase` is the round total when that spin was revealed. Outside a bonus,
	// and once it ends, WIN is the whole round's.
	let spinBase = $state(0);
	let roundWin = $derived(winMoney(roundBet, board.total));
	let displayedWin = $derived(winMoney(roundBet, board.total - (board.tier ? spinBase : 0)));
	// The WIN figures roll up to each new total instead of swapping digits (a reset or reduced
	// motion snaps). Display only: nothing in the round waits on it. `winRolls` re-keys the HUD
	// amount so each rise replays its bump.
	const WIN_ROLL_MS = 650;
	let countedWin = $state(0);
	let winRolls = $state(0);
	$effect(() => {
		const to = displayedWin;
		const from = untrack(() => countedWin);
		if (to <= from || reducedMotion) {
			countedWin = to;
			return;
		}
		untrack(() => winRolls++);
		const ms = WIN_ROLL_MS * (superTurbo ? 0.4 : turbo ? 0.5 : 1);
		const t0 = performance.now();
		let raf = requestAnimationFrame(function step(now) {
			// A frame's timestamp can predate t0 (it's the frame's start): clamp, or the ease overshoots below `from`.
			const k = Math.min(1, Math.max(0, (now - t0) / ms));
			countedWin = k < 1 ? from + (to - from) * (1 - (1 - k) ** 3) : to;
			if (k < 1) raf = requestAnimationFrame(step);
		});
		return () => cancelAnimationFrame(raf);
	});
	// While a round plays the logo's eyes stare at the board: the direction from the eyes (in
	// the logo's "O", 57% / 39% of its box) to the board's centre, measured since the board sits
	// right of the logo in landscape and under it in portrait.
	let gaze = $derived.by(() => {
		if (!busy || !started) return null;
		void portrait;
		const logo = document.querySelector('.base-logo')?.getBoundingClientRect();
		const grid = document.querySelector('main .board')?.getBoundingClientRect();
		if (!logo?.width || !grid?.width) return null;
		const dx = grid.left + grid.width / 2 - (logo.left + logo.width * 0.57);
		const dy = grid.top + grid.height / 2 - (logo.top + logo.height * 0.39);
		const d = Math.hypot(dx, dy) || 1;
		return { x: dx / d, y: dy / d };
	});
	// The logo's O cheers while a win is on show (cluster pills, the small-win plaque or a big
	// win) and a beat after, so a quick cluster still gets the whole bounce and grin.
	const LOGO_CHEER_LINGER_MS = 1200;
	let winOnShow = $derived(clusterPops.length > 0 || plaqueOn || !!bigWin);
	let logoCheer = $state(false);
	// Every cluster win (each tumble's too) restarts the logo's full bounce.
	let logoBeat = $state(0);
	$effect(() => {
		if (winOnShow) {
			logoCheer = true;
			return;
		}
		const t = setTimeout(() => (logoCheer = false), LOGO_CHEER_LINGER_MS);
		return () => clearTimeout(t);
	});
	// Round panels pop in with a jelly overshoot and shrink away.
	const PANEL_IN = { start: 0.6, duration: 450, easing: backOut };
	const PANEL_OUT = { start: 0.85, duration: 220, easing: cubicIn };
	let locked = $derived(busy || !!pending || !ready || !!error || !!notice || q.replay || autoCount > 0);
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
			// A reconnect keeps the session the player started with.
			if (startBalance === null) {
				startBalance = balance;
				sessionStart = clock = Date.now();
			}
			jurisdiction = data.config?.jurisdiction ?? {};
			if (jurisdiction.disabledTurbo) turbo = superTurbo = false;
			if (jurisdiction.disabledSuperTurbo) superTurbo = false;
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
			console.error(e);
			error = tr('ERROR');
			ready = false;
		} finally {
			busy = false;
		}
	}
	// The eggs that triggered a bonus hatch on lit pads before the free-spins card (EggHatch:
	// the burst lands at 560ms of the pace, the shell is gone by ~1.4s). The opened bottoms stay
	// on the board until the next drop clears `hatched`, so the eggs never close up again.
	const EGG_CHEER_MS = 1600;
	async function cheerEggs() {
		const pace = Math.max(paceScale(), 0.5);
		const eggs = eggCells(board.board);
		board = { ...board, highlight: eggs };
		hatchPace = pace;
		hatched = eggs;
		// Each shell cracks on its burst (EggHatch: 560ms of the pace after its own stagger);
		// the clip's crack peaks 80ms in.
		for (const k of eggs) {
			const [col, row] = k.split(',').map(Number);
			sfx.play('crack', (((col * 3 + row * 5) % 4) * 60 + 560) * pace - 80, 1, 0.95 + ((col + row) % 3) * 0.05, true);
		}
		await sleep(EGG_CHEER_MS * pace);
		board = { ...board, highlight: [] };
	}
	// A bought Normal/Super bonus has no trigger spin in its book (it opens on bonusStart), so
	// the trigger is shown first like other slots do: a board with the tier's 3 or 4 eggs and
	// no win on it, teased and cheered like a real trigger. Display only; the book is unchanged.
	const BUY_EGGS: Partial<Record<Mode, number>> = { normal: 3, super: 4 };
	function triggerBoard(eggs: number) {
		const FRUIT = SYMBOLS.filter((s) => s !== EGG);
		const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
		// Two eggs early, then each one still to come a column or two after the last, so the
		// tease holds one or two columns per egg rather than the whole board.
		const cols: number[] = [];
		const second = 1 + Math.floor(Math.random() * (N - eggs + 1));
		cols.push(Math.floor(Math.random() * second), second);
		while (cols.length < eggs) {
			const left = eggs - cols.length - 1;
			cols.push(Math.min(N - 1 - left, cols.at(-1)! + 1 + (Math.random() < 0.5 ? 0 : 1)));
		}
		const grid = Array.from({ length: N }, () => Array.from({ length: N }, () => pick(FRUIT)));
		for (const col of cols) grid[col][Math.floor(Math.random() * N)] = EGG;
		// No win: break up any same-colour group of 5+ tiles (the base game's smallest win).
		for (let pass = 0; pass < 400; pass++) {
			const big = groups(grid).find((g) => g.length >= 5);
			if (!big) break;
			const [c, r] = pick(big);
			grid[c][r] = pick(FRUIT.filter((s) => s !== grid[c][r]));
		}
		return grid;
	}
	function groups(grid: string[][]) {
		const seen = new Set<string>();
		const out: [number, number][][] = [];
		for (let c = 0; c < N; c++)
			for (let r = 0; r < N; r++) {
				if (seen.has(`${c},${r}`) || grid[c][r] === EGG) continue;
				const g: [number, number][] = [];
				const stack: [number, number][] = [[c, r]];
				seen.add(`${c},${r}`);
				while (stack.length) {
					const [x, y] = stack.pop()!;
					g.push([x, y]);
					for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
						const nx = x + dx;
						const ny = y + dy;
						if (nx < 0 || ny < 0 || nx >= N || ny >= N || seen.has(`${nx},${ny}`) || grid[nx][ny] !== grid[c][r]) continue;
						seen.add(`${nx},${ny}`);
						stack.push([nx, ny]);
					}
				}
				out.push(g);
			}
		return out;
	}
	async function showBoughtTrigger(eggs: number) {
		if (!awaitingReveal) await dropBoard();
		if (disposed) return;
		board = { ...board, board: triggerBoard(eggs), blades: board.blades.map((c) => c.map(() => 0)), highlight: [] };
		await waveSleep(spinWave(eggs));
		if (disposed) return;
		await cheerEggs();
	}
	async function playback(round: Round) {
		// Keep the symbols on screen: they are what drops out when the first reveal lands.
		board = { ...initialState(), board: board.board, blades: board.blades };
		spinBase = 0;
		roundBet = round.amount / 1e6;
		activeMode = round.mode;
		const buyEggs = BUY_EGGS[round.mode];
		if (buyEggs && round.state[0]?.type === 'bonusStart') {
			await showBoughtTrigger(buyEggs);
			if (disposed) return;
		}
		for (const event of round.state) {
			if (disposed) return;
			if (event.type === 'reveal') {
				if (!awaitingReveal) await dropBoard();
				if (disposed) return;
				spinBase = board.total;
				// Each free spin starts like a base spin does.
				if (board.tier) sfx.play('spin');
				board = applyEvent(board, event);
				clusterPops = [];
				spinLog = [];
				chain = 0;
				await waveSleep(spinWave());
				relief();
				continue;
			}
			if (event.type === 'tumble') {
				const m = cascadeMotion();
				const removed = new Set(board.highlight);
				if (removed.size) {
					sfx.play('pop', 0, 1, chainPitch());
					popping = Object.fromEntries([...removed].map((k) => [k, Math.random() * m.removeJitterMs]));
					await waveSleep(m.removeMs + m.removeJitterMs + m.holdMs);
					if (disposed) return;
				}
				board = applyEvent(board, event);
				popping = {};
				clusterPops = [];
				const t = tumbleWave(removed);
				chain++;
				if (t) await waveSleep(t);
				continue;
			}
			board = applyEvent(board, event);
			if (event.type === 'scatterTrigger') {
				await cheerEggs();
				if (disposed) return;
				continue;
			}
			if (event.type === 'bladeUpdate') {
				// A beat after the win's connect sound, not on top of it (sped up with turbo).
				sfx.play('split', SPLIT_SFX_DELAY_MS * cascadePace());
				nervous = true;
				await waitSplit(DIVIDE_MS * cascadePace());
				nervous = false;
				if (disposed) return;
				relief();
				continue;
			}
			// Each free spin that wins big gets its own win screen as it ends, like base-game
			// spins do; the bonus total still gets the end card.
			if (event.type === 'spinEnd' && board.tier) {
				const spinWin = board.total - spinBase;
				if (spinWin >= BIG_WIN_X * 100) {
					await presentBigWin(winMoney(roundBet, spinWin), spinWin / 100, FREE_SPIN_WIN_PACE);
					if (disposed) return;
				}
				continue;
			}
			if (event.type === 'mysteryChoice') {
				// The mystery egg breaks open on the tier it drew; turbo hurries it, but never so
				// much that the prize can't be read.
				const pace = Math.max(paceScale(), 0.5);
				mystery = { tier: board.tier, pace };
				// Each knock is a tap and a small, high crack (louder and lower each time); the shudder
				// after the third quickens and climbs; the burst is the full crack (it peaks 80ms in).
				KNOCKS_MS.forEach((ms, i) => {
					sfx.play('land', ms * pace, 0.45 + i * 0.12, 1 + i * 0.08, true);
					sfx.play('crack', ms * pace - 80, 0.3 + i * 0.12, 1.7 - i * 0.15);
				});
				[3250, 3400, 3520, 3610].forEach((ms, i) => sfx.play('land', ms * pace, 0.4 + i * 0.1, 1.2 + i * 0.12, true));
				sfx.play('crack', BURST_MS * pace - 80, 1.3);
				await sleep(MYSTERY_MS * pace);
				mystery = null;
				if (disposed) return;
				continue;
			}
			if (event.type === 'bonusStart') {
				autoCount = 0;
				// Every bonus, won or bought, opens on the "you won" card: its name, rule and spins.
				await presentCard({ kind: 'mystery', count: event.freeSpins ?? 10, tier: board.tier });
				if (disposed) return;
				continue;
			}
			if (event.type === 'clusterWin') {
				sfx.play('connect', 0, 1, chainPitch());
				popClusters(event);
			}
			// The bonus ends on its congrats card with the total alone (no win screen before it),
			// which stays until the player presses to continue.
			if (event.type === 'finalWin' && board.tier) {
				await presentCard({ kind: 'end', count: 0, amount: win(winMoney(roundBet, board.total)) });
				if (disposed) return;
				// Back to the base world once the player has seen the total (the win stays up).
				board = { ...board, tier: '' };
				continue;
			}
			// Wins under 5 bets show on the WIN meter only, no plaque (user request 2026-10-20).
			if (event.type === 'finalWin' && board.total >= QUICK_WIN_X * 100 && board.total < BIG_WIN_X * 100) {
				await presentSmallWin(winMoney(roundBet, board.total), board.total / 100);
				continue;
			}
			if (event.type === 'finalWin' && board.total >= BIG_WIN_X * 100) {
				await presentBigWin(winMoney(roundBet, board.total), board.total / 100);
				chainDrop();
				continue;
			}
			const duration =
				event.type === 'clusterWin' ? 390 : event.type === 'bonusStart' ? 900 : event.type === 'finalWin' ? 250 : 0;
			if (duration) await waveSleep(duration * (event.type === 'clusterWin' ? cascadePace() : paceScale()));
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
	async function spin(mode: Mode = spinMode, fromAuto = false) {
		if (
			busy ||
			pending ||
			!ready ||
			error ||
			notice ||
			q.replay ||
			modal ||
			!started ||
			(autoCount > 0 && !fromAuto)
		)
			return;
		if (balance < bet * MODES[mode]) {
			notice = tr('INSUFFICIENT BODY');
			autoCount = 0;
			return;
		}
		busy = true;
		sfx.play('spin');
		activeMode = mode;
		// The last round's win goes on the press: kept, it would read at the new bet meanwhile.
		board = { ...board, total: 0 };
		roundBet = bet;
		const time = Date.now();
		try {
			// The old board starts falling on the press (or already did, chainDrop); the reveal
			// waits for REVEAL_AT of the exit.
			const exit = predrop ?? dropBoard();
			predrop = null;
			let data;
			try {
				data = await api.play(mode, bet, currency);
			} catch (e) {
				// No round came back, so nothing is in flight: say so and leave the game playable.
				console.error(e);
				await exit;
				notice = tr('PLAY FAILED');
				autoCount = 0;
				awaitingReveal = false;
				scared = false;
				return;
			}
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
			console.error(e);
			error = tr('ERROR');
			autoCount = 0;
			awaitingReveal = false;
			scared = false;
		} finally {
			busy = false;
		}
		const asked = nextAsked;
		nextAsked = false;
		if (autoCount > 0 && !error && !disposed) {
			autoCount--;
			if (autoCount > 0) {
				if (!predrop) await sleep(120);
				if (autoCount > 0 && !disposed) void spin(autoMode, true);
			}
		} else if ((asked || spaceHeld) && !error && !disposed) void spin();
		// The board dropped for a spin that didn't come (Space let go, a notice, autoplay
		// stopped): bring it back.
		if (predrop && !busy) {
			predrop = null;
			awaitingReveal = false;
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
			console.error(e);
			error = tr('ERROR');
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
		} catch (e) {
			console.error(e);
			error = tr('ERROR');
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
		// The info pages open at any time, mid-round too (the round plays on under them).
		if ((busy || pending) && name !== 'info') return;
		autoCount = 0;
		modal = name;
		await tick();
		document.querySelector<HTMLElement>('[aria-modal="true"] :is(.buy-button, section button, select)')?.focus();
	}
	function closeModal() {
		modal = '';
	}
	// Splash → base game: the camera pushes gently toward the splash's floating island while
	// the splash dissolves, and the base world, already full-screen behind it, settles from a
	// slight zoom-in on the same curve (a deep zoom blew the soft island art up into a blur, and
	// growing the world from a small box showed its edges). The HUD fades in and the board
	// drops in early, landing as the world settles.
	// The splash cards fade first; the logo flies (with a little hop) onto the base-game logo
	// meanwhile and lands with a squash. Instant with reduced motion.
	const FLY_MS = 1500;
	const FLY_ZOOM = 1.6; // how far the splash pushes toward the island
	const FLY_FROM = 1.18; // the base world's starting zoom
	let entering = false;
	async function enterGame() {
		if (started || entering) return;
		const from = document.querySelector<HTMLElement>('.splash-logo');
		const to = document.querySelector<HTMLElement>('.base-logo');
		const splash = document.querySelector<HTMLElement>('.splash');
		const island = document.querySelector<HTMLElement>('.splash .island-2');
		const world = [document.querySelector<HTMLElement>('.base-world'), document.querySelector<HTMLElement>('main')];
		if (!from || !to || !splash || !island || matchMedia('(prefers-reduced-motion: reduce)').matches) {
			started = true;
			return;
		}
		entering = true;
		const a = from.getBoundingClientRect();
		const b = to.getBoundingClientRect();
		const fly = from.cloneNode(true) as HTMLElement;
		fly.className = 'logo-fly';
		fly.setAttribute('aria-hidden', 'true');
		// The clone's eye clip paths share their ids with the splash logo's, and its pupils
		// rendered as nothing (blank white eyes all flight): give the clone ids of its own.
		for (const el of fly.querySelectorAll('[id]')) {
			const id = el.id;
			el.id = `fly-${id}`;
			for (const g of fly.querySelectorAll(`[clip-path="url(#${id})"]`)) g.setAttribute('clip-path', `url(#fly-${id})`);
		}
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
		// The island's centre, kept on screen (portrait can crop it off the side).
		const r = island.getBoundingClientRect();
		const ox = Math.min(Math.max(r.left + r.width / 2, innerWidth * 0.1), innerWidth * 0.9);
		const oy = Math.min(Math.max(r.top + r.height / 2, innerHeight * 0.1), innerHeight * 0.9);
		const zoom = { duration: FLY_MS, easing: 'cubic-bezier(0.55, 0, 0.3, 1)' };
		splash.querySelector('.splash-fit')?.animate([{ opacity: 1 }, { opacity: 0 }], {
			duration: 350,
			easing: 'ease-in',
			fill: 'forwards',
		});
		splash.style.transformOrigin = `${ox}px ${oy}px`;
		const cx = innerWidth / 2 - ox,
			cy = innerHeight / 2 - oy;
		splash.animate([{ transform: 'none' }, { transform: `translate(${cx}px, ${cy}px) scale(${FLY_ZOOM})` }], {
			...zoom,
			fill: 'forwards',
		});
		// The crossfade runs on plain time, not the zoom's curve: the splash dissolves over the
		// base world between 10% and 55% of the flight.
		splash.animate(
			[{ opacity: 1 }, { opacity: 1, offset: 0.1, easing: 'ease-in-out' }, { opacity: 0, offset: 0.55 }, { opacity: 0 }],
			{ duration: FLY_MS, fill: 'forwards' },
		);
		// The world is 20% bigger than the screen on every side, so zooming it from slightly
		// in, about the island's point, never shows an edge.
		const [backdrop, stageEl] = world;
		if (backdrop) {
			const box = backdrop.getBoundingClientRect();
			backdrop.style.transformOrigin = `${ox - box.left}px ${oy - box.top}px`;
			backdrop
				.animate([{ transform: `scale(${FLY_FROM})` }, { transform: 'none' }], zoom)
				.finished.then(() => (backdrop.style.transformOrigin = ''));
		}
		// The HUD and panels fade up into place rather than scaling with the world.
		stageEl?.animate(
			[
				{ opacity: 0, translate: '0 18px' },
				{ opacity: 0, translate: '0 18px', offset: 0.2, easing: 'ease-out' },
				{ opacity: 1, translate: '0 0', offset: 0.6 },
				{ opacity: 1, translate: '0 0' },
			],
			{ duration: FLY_MS },
		);
		// The board drops in from the top while the splash is still dissolving and bounces as it
		// lands. Translate only: a scale (squash) would re-raster the board and its 49 blobs.
		const board = document.querySelector<HTMLElement>('main .board');
		board?.classList.add('dropping');
		// The rim layer rides along with it.
		const deco = document.querySelector<HTMLElement>('main .board-deco');
		const drop = (el: HTMLElement | null) =>
			el?.animate(
				[
					{ translate: '0 -1400px' },
					{ translate: '0 -1400px', offset: 0.14, easing: 'cubic-bezier(0.55, 0, 0.9, 0.55)' },
					{ translate: '0 0', offset: 0.55, easing: 'ease-out' },
					{ translate: '0 -22px', offset: 0.7, easing: 'ease-in' },
					{ translate: '0 0', offset: 0.84, easing: 'ease-out' },
					{ translate: '0 -4px', offset: 0.93 },
					{ translate: '0 0' },
				],
				FLY_MS + 200,
			);
		drop(deco);
		drop(board)?.finished.then(() => board?.classList.remove('dropping'));
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
			{ duration: FLY_MS, easing: 'cubic-bezier(0.45, 0, 0.25, 1)', fill: 'forwards' },
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
	// Where the operator disables Space it does nothing at all: not even pressing a focused
	// button (buttons activate on Space, so both its keydown and keyup are swallowed).
	const spaceBlocked = (event: KeyboardEvent) =>
		event.code === 'Space' &&
		!!jurisdiction.disabledSpacebar &&
		!(event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement);
	function key(event: KeyboardEvent) {
		if (spaceBlocked(event)) {
			event.preventDefault();
			return;
		}
		// Enter still works where Space is disabled.
		const space = event.code === 'Space';
		if (!started && loaded && ready && !error && (space || event.key === 'Enter')) {
			event.preventDefault();
			void enterGame();
			return;
		}
		// A bonus card up: Space / Enter is its tap (a fresh press, so a held Space can't wave the
		// bonus total away unseen).
		if (cardOpen && cardSkip && (space || event.key === 'Enter')) {
			event.preventDefault();
			if (!event.repeat) cardSkip();
			return;
		}
		if (event.key === 'Escape') {
			notice = '';
			menuOpen = false;
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
		// Held Space keeps betting (the house rule for every game): its key repeats keep calling
		// spin(), which ignores them while a round plays and starts the next one when it's done.
		if (
			event.code === 'Space' &&
			!modal &&
			!jurisdiction.disabledSpacebar &&
			!(
				event.target instanceof HTMLInputElement ||
				event.target instanceof HTMLSelectElement ||
				(event.target instanceof HTMLButtonElement && event.target.closest('.menu-panel'))
			)
		) {
			// A HUD button keeps focus after a click; Space would press it (turbo, bet +/-)
			// instead of spinning, so it lets go of the focus and Space spins.
			if (event.target instanceof HTMLButtonElement) event.target.blur();
			event.preventDefault();
			spaceHeld = true;
			// A fresh press on a win skips it and goes on to the next spin (in a bonus it only
			// skips that free spin's win screen); anywhere else in a spin it slam stops.
			const skip = winSkip ?? bigWinSkip;
			if (busy && skip && !event.repeat && !jurisdiction.disabledSlamstop) {
				if (!board.tier) nextAsked = true;
				skip();
				return;
			}
			if (busy && !event.repeat && !jurisdiction.disabledSlamstop && !mystery) {
				slamStop();
				return;
			}
			void spin();
		}
	}
	function cycleSpeed() {
		turboHeld = null;
		if (superTurbo || (turbo && jurisdiction.disabledSuperTurbo)) turbo = superTurbo = false;
		else if (turbo) [turbo, superTurbo] = [false, true];
		else turbo = true;
	}
	// A scrolling list fades out at an edge with more cards beyond it (style.css .more-above /
	// .more-below), so a cut card reads as "scroll", not as clipped.
	function edgeFade(node: HTMLElement) {
		const update = () => {
			node.classList.toggle('more-above', node.scrollTop > 2);
			node.classList.toggle('more-below', node.scrollTop + node.clientHeight < node.scrollHeight - 2);
		};
		const ro = new ResizeObserver(update);
		ro.observe(node);
		node.addEventListener('scroll', update, { passive: true });
		update();
		return {
			destroy() {
				ro.disconnect();
				node.removeEventListener('scroll', update);
			},
		};
	}
	async function confirmBuy() {
		const mode = chosen;
		closeModal();
		await spin(mode);
	}
	function startAuto() {
		closeModal();
		autoCount = autoChoice;
		autoMode = autoFeature ? 'feature' : spinMode;
		void spin(autoMode, true);
	}
	onMount(() => {
		locale();
		void boot();
		void preloadAll((k) => (loadProgress = k)).then(() => (loaded = true));
		sfx.loadSound();
	});
	onDestroy(() => {
		disposed = true;
		autoCount = 0;
		clearTimeout(timer);
		clearTimeout(movingTimer);
		wake?.();
		sfx.closeSound();
	});
</script>

<svelte:window
	onkeydown={key}
	onkeyup={(e) => {
		if (e.code === 'Space') spaceHeld = false;
		if (spaceBlocked(e)) e.preventDefault();
	}}
	onblur={() => (spaceHeld = false)}
	onpointerdown={(e) => {
		// Every button clicks, except Spin (it has its own start sound).
		const btn = (e.target as Element).closest?.('button');
		if (btn && !btn.disabled && !btn.classList.contains('spin-button')) {
			const src = sfx.play('click');
			lastClick = src ? { stop: src, at: performance.now() } : null;
		}
		// A tap on the game (not a button or a panel) slam stops the spin; win screens and cards
		// take their own taps.
		if (busy && !modal && !cardOpen && !bigWin && !plaqueOn && !mystery && !jurisdiction.disabledSlamstop && !(e.target as Element).closest?.('button, [aria-modal="true"], .menu-panel, .spin-log'))
			slamStop();
		if (menuOpen && !(e.target as Element).closest?.('.menu-panel, .menu-button')) menuOpen = false;
	}}
	bind:innerWidth={vw}
	bind:innerHeight={vh}
/>
<svelte:head><title>Blob Split · Split Party v1</title></svelte:head>
{#if pixiScene}
	<PixiScene tier={(board.tier || null) as 'normal' | 'super' | 'hidden' | null} onfail={() => (pixiScene = false)} />
{:else}
<BaseScene />
<!-- Each bonus tier has its own backdrop, faded in over the base scene for the round. -->
{#if board.tier === 'normal'}
	<div class="bonus-world" aria-hidden="true" transition:fade={{ duration: 700 }}><BonusNormal /></div>
{:else if board.tier === 'super'}
	<div class="bonus-world" aria-hidden="true" transition:fade={{ duration: 700 }}><BonusSuper /></div>
{:else if board.tier === 'hidden'}
	<div class="bonus-world" aria-hidden="true" transition:fade={{ duration: 700 }}><BonusSuper night /></div>
{/if}
{/if}
<main
	class:playing={busy}
	class:bonus-round={!!board.tier}
	class:portrait
	class:popout={!portrait && !phone && vh <= 340}
	class:phone
	class:short={shortLand}
	dir="ltr"
	inert={!!modal ||
		!started ||
		!!error ||
		(!!pending && !busy) ||
		(q.replay && !busy)}
>
	<div
		class="base-stage"
		style={`width:${baseStage.w}px;height:${baseStage.h}px;--ex:${baseStage.h - (portrait ? PORTRAIT_H : phone ? PHONE.h : 670)}px;${phone ? `--W:${phoneLay.W}px;--H:${phoneLay.H}px;--c:${phoneLay.c};--pb-s:${phoneLay.s};--pb-x:${phoneLay.x}px;--pb-y:${phoneLay.y}px;` : ''}--k:${baseFit};--ls:${logoScale.toFixed(3)};transform:translate(-50%,-50%) scale(${baseFit})`}
	>
		<div class="base-logo">{#if pixiScene}<PixiLogo {gaze} cheer={logoCheer} beat={logoBeat} />{:else}<Logo
				uid="base-logo"
				{gaze}
				cheer={logoCheer}
				beat={logoBeat}
			/>{/if}</div>
		<div class="studio-badge" aria-hidden="true">
			<img class="studio-mark" src="./splash/studio-mark.svg" alt="" /><img
				class="studio-word"
				src="./splash/studio-word.svg"
				alt=""
			/>
		</div>
		{#if q.demo || q.replay}<div class="connection">{q.demo ? tr('PREVIEW') : tr('REPLAY')}</div>{/if}
		{#if showSession && startBalance !== null}
			{@const net = balance - startBalance}
			<!-- Scaled with the stage like the HUD, but never under 9px on screen. -->
			<div class="session-info" class:below={q.demo} style={`font-size:${Math.max(10, 9 / baseFit).toFixed(1)}px`}>
				{#if jurisdiction.displaySessionTimer}<span>{tr('SESSION TIME')} <b>{elapsed(clock - sessionStart)}</b></span>{/if}
				{#if jurisdiction.displayNetPosition}<span
						>{tr('NET POSITION')} <b>{net > 0 ? '+' : net < 0 ? '−' : ''}{money(Math.abs(net))}</b></span
					>{/if}
			</div>
		{/if}
		<p class="sr-only" aria-live="polite">{status}</p>
		<SpinLog rows={spinLog} label={tr('SPIN WINS')} />
		<!-- Figma 11174:5954, bonus rounds only: the free-spin count and the bonus total (base
			spins show their win in the HUD alone). The design's RESPIN tile (a cascade counter)
			is left out at the user's request. -->
		<aside class="round-detail">
			{#if board.tier}
				<div class="round-panel rp-free" in:scale={PANEL_IN} out:scale={PANEL_OUT}>
					<span class="round-label">{tr('FREE SPINS')}</span>
					<!-- Keyed: each new value is a fresh element, so it plays the pop-in. -->
					<!-- Coiny draws "/" as a backslash, so the separator is set in Poppins. -->
					{#key board.freeSpin}<strong>{board.freeSpin}<span class="of">/</span>10</strong>{/key}
				</div>
			{/if}
			{#if board.tier}
				<div class="round-panel rp-total" in:scale={PANEL_IN} out:scale={PANEL_OUT}>
					<span class="round-label">{tr('TOTAL WIN')}</span>
					{#key roundWin}<strong>{win(roundWin)}</strong>{/key}
				</div>
			{/if}
		</aside>

		<section
			class="board"
			class:celebrate={board.phase === 'split'}
			class:moving
			style={`--divide-ms:${Math.round(DIVIDE_MS * cascadePace())}ms`}
			aria-label="Split Party game"
		>
			<div class="grid-stack">
			{#if pixiBoard}<PixiBoard snap={boardSnap} onfail={() => (pixiBoard = false)} />{:else}
				<!-- The scatter tease's waiting column (Pixi draws its own in board/overlays.ts). -->
				{#each wave.tease as t (`${wave.id}-${t.col}`)}<div
						class="tease-col"
						aria-hidden="true"
						style={`left:${(t.col * (88.04 + 2.147)).toFixed(2)}px;--from:${t.from.toFixed(0)}ms;--len:${(t.to - t.from).toFixed(0)}ms`}
					>
						{#each TEASE_ROWS as row}<span
								class="tease-pad"
								style={`top:${(row * (70.86 + 2.147) - 1).toFixed(2)}px;animation-delay:${row * 86}ms`}
							></span>{/each}
						{#each TEASE_BUBBLES as b}<span
								class="tease-bubble"
								style={`left:${b.x}px;--s:${b.s}px;--t:${b.t}ms;--d:${b.d}ms;--w:${b.w}px`}
							></span>{/each}
					</div>{/each}
			{/if}
			<div
				class="grid"
				class:pixi={pixiBoard}
				class:awaiting={awaitingReveal}
				class:scared
				class:nervous
				class:relieved
				class:wondering={mood.wonder != null}
				class:surprised={mood.surprise > 0}
				class:winning={board.highlight.length > 0}
				style={`--relief-ms:${Math.round(RELIEF_MS * (turbo ? 0.6 : 1))}ms`}
				role="img"
				aria-label={`7 by 7 game board. ${status}`}
			>
				{#each Array(7) as _, row}{#each Array(7) as _, col}
						{@const symbol = board.board[col][row]}{@const units =
							cellUnits(col, row)}{@const lit = board.highlight.includes(`${col},${row}`)}{@const drop =
							wave.drops[col]?.[row]}{@const falls = !!drop?.rows}{@const pop =
							popping[`${col},${row}`]}
						<div
							class="cell"
							class:lit
							class:split={units > 1}
							class:scatter={symbol === 'BASKET'}
							class:premium={!!PREMIUM_RIM[symbol]}
							style={`grid-column:${col + 1};grid-row:${row + 1}${PREMIUM_RIM[symbol] ? `;--gem:${PREMIUM_RIM[symbol]}` : ''}${mood.wonder != null ? watchVars(mood.wonder, col, row) : ''}`}
							data-units={units}
						>
							{#if !pixiBoard}
							<!-- An egg still falling: a plain pad over the gold one until it lands, so the
							     board doesn't show where the eggs will be before the tease. -->
							{#if symbol === 'BASKET' && falls}{#key wave.id}<span
										class="egg-hide"
										style={`--lands:${(drop.delay + drop.dur).toFixed(0)}ms`}
									></span>{/key}{/if}
							{#key falls ? wave.id : 0}
								<div
									class="sym"
									class:hatched={hatched.includes(`${col},${row}`)}
									class:falling={falls}
									class:popping={pop !== undefined}
									style={falls
										? `--fall-offset:${-105 * drop.rows}%;--fall-duration:${drop.dur.toFixed(0)}ms;--fall-delay:${drop.delay.toFixed(0)}ms;--impact-duration:${wave.impact}ms;--impact-delay:${(drop.delay + drop.dur).toFixed(0)}ms;--remove-duration:${cascadeMotion().removeMs}ms;--harvest-delay:${(pop ?? 0).toFixed(0)}ms`
										: `--remove-duration:${cascadeMotion().removeMs}ms;--harvest-delay:${(pop ?? 0).toFixed(0)}ms`}
								>
									<Blob {symbol} {units} uid={`b-${col}-${row}`} />
								</div>
							{/key}
							<!-- The ground cracks between the new blobs as they divide; keyed on units so
							     every split tears it open again. -->
							{#if units > 1}{#key units}<Crack {units} seed={col * 7 + row + 1} />{/key}{/if}
							{#if relieved && sweats(col, row, units)}
								<!-- A clear bead of sweat: see-through body, light rim, one glint; the blob shows through. -->
								<svg class="phew-drop" viewBox="0 0 20 28" aria-hidden="true">
									<path
										d="M10 1.5C10 1.5 2.5 12 2.5 18.5a7.5 7.5 0 0 0 15 0C17.5 12 10 1.5 10 1.5Z"
										fill="#dff6ff"
										fill-opacity=".45"
										stroke="#fff"
										stroke-opacity=".85"
										stroke-width="1.1"
									/>
									<path d="M15.6 19.5a5.8 5.8 0 0 1-4.6 5.4" fill="none" stroke="#3d8fd0" stroke-opacity=".45" stroke-width="1.6" stroke-linecap="round" />
									<ellipse cx="7" cy="16.5" rx="1.5" ry="3.2" fill="#fff" fill-opacity=".95" transform="rotate(20 7 16.5)" />
								</svg>
							{/if}
							{/if}
						</div>
					{/each}{/each}
			</div>
			{#if ghost && !pixiBoard}
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
			<EggHatch cells={hatched} pace={hatchPace} />
			{#each pixiBoard ? [] : clusterPops as p (p.id)}
				<div class="cluster-pop" aria-hidden="true" style={`left:${(p.x * 100).toFixed(2)}%;top:${(p.y * 100).toFixed(2)}%`}>
					{#each SPARKS as k}<span
							class="spark"
							style={`--dx:${k.dx.toFixed(1)}px;--dy:${k.dy.toFixed(1)}px;width:${k.s}px;height:${k.s}px;background:${k.c}`}
						></span>{/each}
					<strong style={`font-size:${(22 * p.s).toFixed(1)}px`}>{p.amount}</strong>
				</div>
			{/each}
			</div>
		</section>
		<!-- The board's jelly rim and top gloss: a layer of its own over the board, so the clip the
		     board takes while blobs fall (.board.moving) doesn't cut the rim off. -->
		<div class="board-deco" aria-hidden="true"></div>
		{#if plaqueOn}
			<div
				class="win-plaque"
				aria-hidden="true"
				style={`--spd:${smallWin.speed}`}
				out:plaqueOut={{ speed: smallWin.speed }}
			>
				{#each PLAQUE_DROPS as d}<span
						class="plaque-drop"
						style={`--dx:${d.dx}px;--dy:${d.dy}px;width:${d.s}px;height:${d.s}px`}
					></span>{/each}
				<div class="plaque-land">
					<div class="plaque-body">
						<img src="./win/small-win-plaque.webp" alt="" width="405" height="304" />
						<span class="plaque-shine"><span></span></span>
						<!-- Sized for the final amount, so the count-up doesn't shrink as it grows. -->
						<strong
							class:counted={smallWin.counted}
							style={`font-size:${plaqueFont(win(smallWin.final))}px`}>{winCount(smallWin.shown, smallWin.final)}</strong
						>
					</div>
				</div>
			</div>
		{/if}

		<footer class="hud">
			<div class="hud-bar"></div>
			{#if menuOpen}
				<div class="menu-panel" id="game-menu" in:pop out:popOut>
					<button class="menu-row" aria-pressed={sound} onclick={() => (sound = !sound)}
						><span class="hud-icon"
							>{#if sound}<img class="menu-sound" src="./menu/sound.svg" alt="" />{:else}<img
									class="menu-sound-off"
									src="./menu/sound-off.webp"
									alt=""
								/>{/if}</span
						>{tr('SOUND')}</button
					>
					<button class="menu-row" aria-pressed={music} onclick={() => (music = !music)}
						><span class="hud-icon"
							>{#if music}<img src="./menu/music.svg" alt="" />{:else}<img
									class="menu-music-off"
									src="./menu/music-off.webp"
									alt=""
								/>{/if}</span
						>{tr('MUSIC')}</button
					>
					<button
						class="menu-row"
						onclick={() => {
							menuOpen = false;
							infoPage = 0;
							openModal('info');
						}}><span class="hud-icon"><img src="./menu/info.svg" alt="" /></span>{tr('INFO')}</button
					>
				</div>
			{/if}
			<button
				class="hud-icon menu-button"
				class:open={menuOpen}
				aria-label={menuOpen ? tr('INFO CTRL CLOSE') : tr('INFO CTRL MENU')}
				aria-expanded={menuOpen}
				aria-controls="game-menu"
				onclick={() => (menuOpen = !menuOpen)}
				>{#if menuOpen}<img class="menu-close" src="./menu/close.svg" alt="" />{:else}<img
						src="./base/menu.svg"
						alt=""
					/>{/if}</button
			>
			<button
				class="bonus-button"
				class:extra-on={!!toggled}
				bind:this={bonusBtn}
				bind:clientWidth={bonusW}
				disabled={locked || jurisdiction.disabledBuyFeature}
				onclick={() => (toggled ? (toggled = null) : openModal('bonus'))}
				><img class="bonus-mark" src="./base/bonus-mark.svg" alt="" /><span
					style={bonusFit.k < 1
						? `font-size:${bonusFit.k.toFixed(3)}em;letter-spacing:${(bonusFit.track * bonusFit.k).toFixed(2)}px`
						: ''}>{bonusLabel}</span
				></button
			>
			<div class="hud-metrics">
				<!-- A replay never authenticates, so it has no balance to show. -->
				<div class="metric" style:visibility={q.replay ? 'hidden' : null}>
					<span class="metric-label">{tr('BALANCE')}</span><strong style={hudFont(money(balance), 'metric')}
						>{money(balance)}</strong
					>
				</div>
				<span class="hud-divider"></span>
				<div class="metric">
					<span class="metric-label">{tr('WIN')}</span>{#key winRolls}<strong
							class:win-roll={winRolls > 0}
							style={hudFont(win(displayedWin), 'metric')}>{winCount(countedWin, displayedWin)}</strong
						>{/key}
				</div>
			</div>
			<span class="hud-divider bet-divider"></span>
			<div class="bet-controls" class:coinless={betCoinless}>
				<img class="bet-coins" src="./base/coins-white.svg" alt="" />
				<div class="metric">
					<!-- What a regular spin costs: its mode's price while Extra Feature or Feature Spin is on. -->
					<span class="metric-label bet-label">{tr('BET')}</span><strong
						class:extra={!!toggled}
						style={hudFont(betText, 'bet', betCoinless ? COIN_ROOM : 0)}>{betText}</strong
					>
				</div>
				<button
					class="hud-icon"
					aria-label={tr('INFO CTRL MINUS')}
					onclick={() => changeBet(-1)}
					disabled={locked || bet === bets[0]}><img class="minus" src="./base/minus.svg" alt="" /></button
				><button
					class="hud-icon"
					aria-label={tr('INFO CTRL PLUS')}
					onclick={() => changeBet(1)}
					disabled={locked || bet === bets.at(-1)}><img class="plus" src="./base/plus.svg" alt="" /></button
				>
			</div>
			<button
				class="spin-button"
				aria-label={q.replay ? tr('START REPLAY') : tr('INFO CTRL SPIN')}
				disabled={q.replay ? busy || !replay : locked || !started}
				onclick={() => (q.replay ? playReplay() : spin())}
				><img
					class="spin-arrow"
					src="./base/spin-arrow.svg"
					alt=""
				/></button
			>
			<!-- One button cycles the speed: normal (Figma 4148:16896), turbo (2503:7489), super turbo
			     (4148:16893), skipping super turbo where the jurisdiction disables it. -->
			<button
				class="hud-icon turbo-button"
				aria-label={superTurbo ? tr('SUPER TURBO SPIN') : turbo ? tr('TURBO SPIN') : tr('TURBO')}
				aria-pressed={turbo || superTurbo}
				disabled={!!jurisdiction.disabledTurbo}
				onclick={cycleSpeed}
				>{#if superTurbo}<img class="speed-icon" src="./base/speed-super.webp" alt="" />{:else if turbo}<span class="turbo-icon"
						><img src="./base/speed-turbo.webp" alt="" /></span
					>{:else}<img class="speed-icon" src="./base/speed-normal.webp" alt="" />{/if}</button
			>
			<button
				class="hud-icon auto-button"
				class:active={autoCount > 0}
				aria-label={autoCount ? tr('STOP') : tr('AUTOPLAY')}
				disabled={q.replay || !!jurisdiction.disabledAutoplay || (!autoCount && locked)}
				onclick={() => (autoCount ? (autoCount = 0) : openModal('auto'))}
				>{#if autoCount}<span class="auto-stop">■</span>{:else}<img src="./base/auto.svg" alt="" />{/if}<small
					>{autoCount || tr('AUTO')}</small
				></button
			>
		</footer>
	</div>
</main>
{#if bigWin}
	<div class="big-win" out:fade={{ duration: 350 }}>
		{#key bigWin.id}<WinScreen tier={bigWin.tier} amount={winCount(bigWin.shown, bigWin.final)} final={win(bigWin.final)} speed={bigWin.speed} onskip={() => !jurisdiction.disabledSlamstop && bigWinSkip?.()} />{/key}
	</div>
{/if}
{#if cardOpen && card}
	<div class="big-win" out:fade={{ duration: 350 }}>
		<BonusCard
			kind={card.kind}
			title={tr('CONGRATULATIONS')}
			won={tr('YOU WON')}
			count={card.count}
			sub={tr('FREE SPINS')}
			amount={card.amount}
			bonus={card.tier ? tr(card.tier.toUpperCase()) : ''}
			desc={card.tier ? tr(`MYSTERY ${card.tier.toUpperCase()} TEXT`) : ''}
			blobs={START_BLOBS[card.tier ?? ''] ?? 1}
			symbol={TIER_BLOB[card.tier ?? ''] ?? 'GRAPES'}
			pace={card.pace}
			prompt={tr('PRESS ANYWHERE TO CONTINUE')}
			onskip={() => cardSkip?.()}
		/>
	</div>
{/if}
{#if mystery}
	<MysteryEgg tier={mystery.tier} pace={mystery.pace} />
{/if}
{#if !started && !error && !loaded}
	<div out:fade={{ duration: 350 }}><Loading progress={loadProgress} label={tr('LOADING')} /></div>
{/if}
{#if !started && !error && loaded}
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
			<!-- An unfinished round to restore, or just a lost connection (nothing to restore). -->
			<span class="eyebrow">{pending ? tr('UNFINISHED ROUND') : tr('NOTICE')}</span>
			<h2 id="recovery-title">{pending ? tr('RECOVERY TITLE') : tr('ERROR')}</h2>
			<p>{pending ? tr('RECOVERY BODY') : tr('ERROR BODY')}</p>
<button
				class="primary"
				onclick={() => (pending ? resume() : boot())}
				disabled={busy}>{pending ? tr('RETRY RESUME') : tr('RELOAD')}</button
			>
		</section>
	</div>
{/if}
{#if notice && !error}
	<!-- Dismissible: the × button, Escape, or a click outside the card. -->
	<div class="overlay" role="presentation" transition:fade={{ duration: 180 }} onclick={(e) => e.target === e.currentTarget && (notice = '')}>
		<section class="dialog recovery" role="alertdialog" aria-modal="true" aria-labelledby="notice-title" in:pop out:popOut>
			<button class="screen-close" aria-label={tr('INFO CTRL CLOSE')} onclick={() => (notice = '')}
				><img src="./ui/close.svg" alt="" /></button
			>
			<h2 id="notice-title">{tr('NOTICE')}</h2>
			<p>{notice}</p>
			<button class="primary" onclick={() => (notice = '')}>{tr('OK')}</button>
		</section>
	</div>
{/if}
<!-- Up before the first playback and again after every one (R-15); gone while it plays. -->
{#if q.replay && !busy && !error}
	<div class="overlay" transition:fade={{ duration: 180 }}>
		<section class="dialog replay-card" role="dialog" aria-modal="true" aria-label={tr('REPLAY')} in:pop out:popOut>
			<!-- Stake's Bet Replay card (R-15): Total cost = base × cost multiplier, win = base × payout. -->
			<span class="eyebrow">{tr('REPLAY')}</span>
			<h2>{tr('BET REPLAY')}</h2>
			<div class="summary">
				<span>{tr('MODE')}</span><b>{tr(`REPLAY MODE ${activeMode.toUpperCase()}`)}</b>
				<span>{tr('BASE BET')}</span><b>{money(bet)}</b>
				<span>{tr('COST MULTIPLIER')}</span><b>{MODES[activeMode]}x</b>
				<span>{tr('TOTAL BET COST')}</span><b>{money(bet * MODES[activeMode])}</b>
				<span>{tr('PAYOUT MULTIPLIER')}</span><b>{replayX}x</b>
				<span>{tr('TOTAL WIN')}</span><b>{win(bet * replayX)}</b>
			</div>
			<button
				class="primary"
				onclick={() => {
					modal = '';
					void playReplay();
				}}>{tr('START REPLAY')} →</button
			>
			<p>{tr('REPLAY DISCLAIMER')}</p>
		</section>
	</div>
{/if}
{#if modal === 'bonus'}
	<!-- Figma 9164:11722 at the base game's stage size, 3 + 2 cards. Extra Chance has no bet mode
	     in the math yet, so it shows locked with no price; the four real modes keep their prices. -->
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
			class:compact={buyCompact}
			style={`width:${buyStage.w}px;height:${buyStage.h}px;--k:${buyK};transform:translate(-50%,-50%) scale(${buyK})`}
		>
			<h2 class="bonus-title" id="modal-title">{tr('BUY BONUS')}</h2>
			<div class="buy-cards" use:edgeFade>
				<!-- Not a buy: a switch for every following regular spin, priced per spin. -->
				<article class="buy-card" class:on={toggled === 'extra_chance'} style="--i:0">
					<h3>{tr('EXTRA')}</h3>
					<p>{tr('EXTRA DESC')}</p>
					<div class="buy-art extra"><Blob symbol="STRAWBERRY" uid="buy-extra" /></div>
					<b class="buy-price">{money(bet * MODES.extra_chance)}</b>
					<button
						class="buy-button activate"
						class:on={toggled === 'extra_chance'}
						aria-pressed={toggled === 'extra_chance'}
						disabled={autoCount > 0}
						onclick={() => toggleMode('extra_chance')}
						>{tr(toggled === 'extra_chance' ? 'DEACTIVATE' : 'ACTIVATE')}</button
					>
				</article>
				{#each BUYS as mode, j}{@const i = j + 1}
					<article class="buy-card" class:on={toggled === mode} style={`--i:${i}`}>
						<h3>{tr(mode.toUpperCase())}</h3>
						{#if mode === 'mystery'}{@const d = oddsCopy(tr('MYSTERY DESC'))}
							<p class="mystery-desc">
								{d.lead}{#each d.odds as o}<span class="odds"
										>{#if o.pct}<b>{o.pct}</b>{/if}<span><strong>{o.name}</strong>{#if o.what}&nbsp;– {o.what}{/if}</span></span
									>{/each}{#if d.foot}<span class="foot">{d.foot}</span>{/if}
							</p>
						{:else}
							<p>{tr(`${mode.toUpperCase()} DESC`)}</p>
						{/if}
						<div class={`buy-art ${mode}`}>
							{#if mode === 'feature'}
								{#each FEATURE_BLOBS as [x, y], j}<span class="feature-blob" style={`left:${x}px;top:${y}px`}
										><Blob symbol="STRAWBERRY" uid={`buy-feature-${j}`} /></span
									>{/each}
							{:else if mode === 'mystery'}
								<img class="mystery-ball" src="./ui/mystery.webp" alt="" />
							{:else}
								<span class="tier-badge">{mode === 'normal' ? 3 : 4}x</span><img
									class="buy-egg"
									src="./splash/egg.webp"
									alt=""
								/>
							{/if}
						</div>
						<b class="buy-price">{money(bet * MODES[mode])}</b>
						{#if mode === 'feature'}
							<!-- A switch like Extra Feature's: the price shows on the HUD bet while it is on. -->
							<button
								class="buy-button activate"
								class:on={toggled === 'feature'}
								aria-pressed={toggled === 'feature'}
								disabled={autoCount > 0}
								onclick={() => toggleMode('feature')}
								>{tr(toggled === 'feature' ? 'DEACTIVATE' : 'ACTIVATE')}</button
							>
						{:else}
							<button
								class="buy-button"
								disabled={balance < bet * MODES[mode]}
								onclick={() => {
									chosen = mode;
									modal = 'confirm';
								}}>{tr('BUY')}</button
							>
						{/if}
					</article>
				{/each}
			</div>
			<div class="bonus-bet">
				<button
					class="hud-icon"
					aria-label={tr('INFO CTRL MINUS')}
					onclick={() => changeBet(-1)}
					disabled={bet === bets[0]}><img class="minus" src="./base/minus.svg" alt="" /></button
				>
				<div class="metric">
					<span class="metric-label">{tr('BET')}</span><strong>{money(bet)}</strong>
				</div>
				<button
					class="hud-icon"
					aria-label={tr('INFO CTRL PLUS')}
					onclick={() => changeBet(1)}
					disabled={bet === bets.at(-1)}><img class="plus" src="./base/plus.svg" alt="" /></button
				>
			</div>
			<button class="screen-close" aria-label={tr('INFO CTRL CLOSE')} onclick={closeModal}
				><img src="./ui/close.svg" alt="" /></button
			>
		</div>
	</div>
{:else if modal === 'info'}
	<div
		class="overlay info-overlay"
		role="dialog"
		aria-modal="true"
		aria-labelledby="modal-title"
		dir={lang === 'ar' && !social ? 'rtl' : 'ltr'}
		transition:fade={{ duration: 200 }}
	>
		<GameInfo {tr} start={infoPage} {portrait} {stage} {fit} view={{ w: vw, h: vh }} onclose={closeModal} />
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
			><img src="./ui/close.svg" alt="" /></button
		>
		{#key modal}
			<section
				class={`dialog ${modal}`}
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
								onchange={() => ((turboHeld = null), turbo && (superTurbo = false))}
								disabled={!!jurisdiction.disabledTurbo}
							/></label
						>
						<label class="toggle-row"
							>{tr('SUPER TURBO SPIN')}<input
								type="checkbox"
								role="switch"
								bind:checked={superTurbo}
								onchange={() => ((turboHeld = null), superTurbo && (turbo = false))}
								disabled={!!(jurisdiction.disabledTurbo || jurisdiction.disabledSuperTurbo)}
							/></label
						>
						<label class="toggle-row"
							><span class="toggle-text"
								>{MODES.feature} X {tr('FEATURE')}<small>{tr('INFO PRICE')} {money(bet * MODES.feature)}</small></span
							><input
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
							><img class="minus" src="./base/minus.svg" alt="" /></button
						><output>{autoChoice}</output><button
							class="hud-icon"
							aria-label={tr('INFO CTRL PLUS')}
							onclick={() => stepAuto(1)}
							disabled={autoChoice === AUTO_STEPS.at(-1)}
							><img class="plus" src="./base/plus.svg" alt="" /></button
						>
					</div>
					<button class="primary start-auto" onclick={startAuto}
						>{tr('AUTO START')} ({autoChoice})</button
					>
				{/if}
			</section>
		{/key}
	</div>
{/if}
