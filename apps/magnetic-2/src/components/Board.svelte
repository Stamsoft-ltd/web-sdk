<script lang="ts" module>
	import type { Position, RawSymbol } from '../game/types';

	export type EmitterEventBoard =
		| { type: 'boardSettle'; board: RawSymbol[][] }
		| { type: 'boardShow' }
		| { type: 'boardHide' }
		| { type: 'boardWithAnimateSymbols'; symbolPositions: Position[] };
</script>

	<!-- One cell's ARTWORK. Lives in a snippet because two places draw it: the falling/settled grid
	     above, and the locked CLUSTER below. The cluster used to call <SymbolWinFx> with nothing but
	     the base texture, which gutted every rebuilt symbol -- a portal with a hole where its galaxy
	     goes, a chip with an empty white screen -- and played the old pop/wobble under it. It gets the
	     same layered art as any other cell now, and `winning` false, because a cluster already reads
	     as a win through its perimeter electricity; animating the symbols inside it too is noise. -->
	{#snippet symbolArt(
		cell: BoardCell,
		symbolInfo: ReturnType<typeof getSymbolInfo>,
		x: number,
		y: number,
		width: number,
		height: number,
		alpha: number,
		zIndex: number,
		winning: boolean,
	)}
		{@const isScatterCell = cell.scatter || cell.name === 'SCATTER'}
		{@const isWildCell = cell.wild || cell.name === 'WILD'}
		{#if isScatterCell}
			<!-- Layered capsule: base machine + bubbles + alien + eye + band arcs. It
			     covers the win state itself, so it replaces <SymbolWinFx> here rather
			     than stacking with it. -->
			<ScatterSymbol
				assetKey={symbolInfo.assetKey}
				{x}
				{y}
				{width}
				{height}
				{alpha}
				{zIndex}
				phase={keyPhase(cell.key)}
				{winning}
			/>
		{:else if cell.name === 'H1'}
			<!-- Compass: bezel + turning needle + zooming alien + popping poles. Covers
			     its own win state, so it stands in for <SymbolWinFx> here. -->
			<CompassSymbol
				assetKey={symbolInfo.assetKey}
				{x}
				{y}
				{width}
				{height}
				{alpha}
				{zIndex}
				phase={keyPhase(cell.key)}
				{winning}
			/>
		{:else if isWildCell}
			<!-- Wild: magnet + popping bolt + blinking eye + lighting plaque. Covers its own
			     win state, so it stands in for <SymbolWinFx> here, and the board-wide
			     wild idle layer is gone for the same reason the scatter left it.
			     MULTIPLIER wilds come through here too: the design's multiplier lockup is
			     this same lockup with the bolt swapped for a numbered disc, so the component
			     takes the multiplier and swaps that one layer. Its assetKey has to be the
			     PLAIN wild for the current layout, not symbolInfo.assetKey — that still
			     resolves to the old flat wild_xN texture with the number baked in, which
			     would show through as a second multiplier behind the disc. -->
			<WildSymbol
				assetKey={getSpriteKeyByName({ name: 'WILD', state: 'static' })}
				multiplier={cell.multiplier}
				{x}
				{y}
				{width}
				{height}
				{alpha}
				{zIndex}
				phase={keyPhase(cell.key)}
				{winning}
			/>
		{:else if cell.name === 'H2'}
			<!-- Lightning badge: the bolt pops and blinks and the corner balls chase. Covers its
			     own win state, so it stands in for <SymbolWinFx> here. -->
			<LightningSymbol
				assetKey={symbolInfo.assetKey}
				{x}
				{y}
				{width}
				{height}
				{alpha}
				{zIndex}
				phase={keyPhase(cell.key)}
				{winning}
			/>
		{:else if cell.name === 'H3'}
			<!-- Portal: the galaxy in the middle blinks while it is still, and spins up fast
			     on a win while the alien's antennae flap. Covers its own win state, so it
			     stands in for <SymbolWinFx> here. -->
			<PortalSymbol
				assetKey={symbolInfo.assetKey}
				{x}
				{y}
				{width}
				{height}
				{alpha}
				{zIndex}
				phase={keyPhase(cell.key)}
				{winning}
			/>
		{:else if cell.name === 'H4'}
			<!-- Electromagnetic device: drums + shaking antennae, with current arcing between
			     the balls on a win. Covers its own win state, so it stands in for
			     <SymbolWinFx> here. -->
			<EmDeviceSymbol
				assetKey={symbolInfo.assetKey}
				{x}
				{y}
				{width}
				{height}
				{alpha}
				{zIndex}
				phase={keyPhase(cell.key)}
				{winning}
			/>
		{:else if cell.name === 'L4'}
			<!-- Circuit chip: the slime oozes down the board while it sits still, and on a
			     win the alien zooms and grins while current jumps between the two screws.
			     Covers its own win state, so it stands in for <SymbolWinFx> here. -->
			<CircuitSymbol
				assetKey={symbolInfo.assetKey}
				{x}
				{y}
				{width}
				{height}
				{alpha}
				{zIndex}
				phase={keyPhase(cell.key)}
				{winning}
			/>
		{:else if cell.name === 'L3'}
			<!-- Astronaut: the alien's eyes look around while it sits still, and the head
			     zooms and shakes on a win. Covers its own win state, so it stands in for
			     <SymbolWinFx> here. -->
			<CoilSymbol
				assetKey={symbolInfo.assetKey}
				{x}
				{y}
				{width}
				{height}
				{alpha}
				{zIndex}
				phase={keyPhase(cell.key)}
				{winning}
			/>
		{:else if cell.name === 'L2'}
			<!-- Magnet: body + shaking antennae + a terminal arc on a win. Like the
			     scatter it covers its own win state, so it stands in for
			     <SymbolWinFx> here. -->
			<MagnetSymbol
				assetKey={symbolInfo.assetKey}
				{x}
				{y}
				{width}
				{height}
				{alpha}
				{zIndex}
				phase={keyPhase(cell.key)}
				{winning}
			/>
		{:else if cell.name === 'L1'}
			<!-- Battery: housing + balloons + the popping cell. Like the scatter it
			     covers its own win state, so it stands in for <SymbolWinFx> here. -->
			<BatterySymbol
				assetKey={symbolInfo.assetKey}
				{x}
				{y}
				{width}
				{height}
				{alpha}
				{zIndex}
				phase={keyPhase(cell.key)}
				{winning}
			/>
		{:else if winning}
			<!-- Winning cell: hi-res static win art with procedural pop/wobble/burst
			     choreography — see <SymbolWinFx> for why the flipbooks are gone. -->
			<SymbolWinFx
				assetKey={symbolInfo.assetKey}
				{x}
				{y}
				{width}
				{height}
				{alpha}
				{zIndex}
				phase={keyPhase(cell.key)}
			/>
		{:else}
			{@const wig = wiggleFor(cell)}
			<Sprite
				key={symbolInfo.assetKey}
				{x}
				y={y + (wig?.dy ?? 0)}
				anchor={{ x: 0.5, y: 0.5 }}
				rotation={wig?.rot ?? 0}
				width={width * (wig?.scale ?? 1)}
				height={height * (wig?.scale ?? 1)}
				{alpha}
				tint={0xffffff}
				{zIndex}
			/>
		{/if}
	{/snippet}

<script lang="ts">
	import { Container, Graphics, Sprite } from 'pixi-svelte';
	import { Tween } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';

	import SymbolWinFx from './SymbolWinFx.svelte';
	import ScatterSymbol from './ScatterSymbol.svelte';
	import BatterySymbol from './BatterySymbol.svelte';
	import MagnetSymbol from './MagnetSymbol.svelte';
	import CompassSymbol from './CompassSymbol.svelte';
	import EmDeviceSymbol from './EmDeviceSymbol.svelte';
	import LightningSymbol from './LightningSymbol.svelte';
	import PortalSymbol from './PortalSymbol.svelte';
	import CoilSymbol from './CoilSymbol.svelte';
	import CircuitSymbol from './CircuitSymbol.svelte';
	import WildSymbol from './WildSymbol.svelte';
	import {
		drawRingMagIdle,
		type SpecialIdleG,
	} from '../game/specialIdleFx';
	import { getContext } from '../game/context';
	import { BOARD_DIMENSIONS, BOARD_GRID_OFFSET_Y, SYMBOL_H, SYMBOL_W } from '../game/constants';
	import { BOARD_COLORS, drawPad } from '../game/boardStyle';
	import { getSpriteKeyByName, getSymbolInfo } from '../game/utils';

	const context = getContext();

	const board = $derived(context.stateGame.board);


	const spinBoard = $derived(context.stateGame.spinBoard);
	const boardMode = $derived(context.stateGame.boardMode);
	const layout = $derived(context.stateGameDerived.boardLayout());
	const flatCells = $derived(board.flatMap((reel) => reel));
	const lockedCells = $derived(flatCells.filter((cell) => cell.locked));
	const unlockedCells = $derived(flatCells.filter((cell) => !cell.locked));
	/** One board cell, as the snippet below and both render passes see it. */
	type BoardCell = (typeof flatCells)[number];
	const Z = {
		grid: 0,
		reel: 10,
		symbol: 20,
		pulledSymbol: 26,
		lockedSymbol: 32,
		// Above everything in the cell stack — the electric border arcs ride the seams
		// BETWEEN locked cells, so anything higher (opaque covers) would overdraw them.
		lockBorder: 40,
	} as const;
	let show = $state(true);

	const getX = (reelIndex: number) => SYMBOL_W * (reelIndex + 0.5);
	const getStaticY = (rowIndex: number) => SYMBOL_H * (rowIndex + 0.5);

	// ── Win focus ──
	// A paying cluster used to sit in a board of 48 equally bright symbols, so the only thing
	// marking it was the cyan pad underneath it — nothing pulled the eye. Everything that is NOT
	// part of the win now recedes for as long as it pays, which costs no assets and is what makes
	// a cluster read as a cluster. Tweened rather than switched: a hard alpha step looks like a
	// rendering fault.
	const LOSER_DIM = 0.34;
	const hasWinCells = $derived(flatCells.some((cell) => cell.symbolState === 'win'));
	const winFocus = new Tween(0, { duration: 260, easing: cubicOut });
	$effect(() => {
		winFocus.set(hasWinCells ? 1 : 0);
	});
	const loserAlpha = $derived(1 - (1 - LOSER_DIM) * winFocus.current);

	const keyPhase = (key: string) => {
		let h = 0;
		for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
		return Math.abs(h % 100) / 100;
	};

	// Landing impact: how far a cell spreads and flattens at full squash (stateGame.displaySquash
	// springs this back out over DROP_SQUASH_MS). Deliberately asymmetric — a stone hitting the
	// ground loses more height than it gains width.
	const SQUASH_X = 0.14;
	const SQUASH_Y = 0.2;
	// Whole-board knock, as a fraction of a symbol's height. The value oscillates as it decays so
	// the board rings out instead of sliding back.
	const THUMP_H = 0.05;
	const boardThump = $derived(context.stateGame.boardThump.current);
	const thumpY = $derived(SYMBOL_H * THUMP_H * boardThump * Math.sin(boardThump * 16));

	// ── Idle liveliness ──
	// A resting board is 49 stickers. Every few seconds of genuine idle, one symbol TYPE twitches:
	// all its cells shake and lift a little, rippling out from the top-left of the group. It is
	// deliberately unlike anything the game uses to mean something — no glow, no scale-up, no
	// electricity — so it reads as the machine idling rather than as a hint about a win.
	//
	// Gated on the state machine being idle, not merely on the reels having stopped: mid-round the
	// board sits still for long stretches (count-ups, cascades, the bonus hand-off) and a twitch
	// there would look like a bug. Specials are excluded — a scatter or magnet shivering on its own
	// would read as an anticipation tease.
	const WIGGLE_GAP = [4.5, 9.5]; // seconds between twitches
	const WIGGLE_MS = 900;
	const WIGGLE_STAGGER = 0.3; // fraction of the run spent rippling through the group
	let wiggleName = $state<string | null>(null);
	let wiggleClock = $state(0); // seconds into the current twitch; only ticks while one runs
	let wiggleT0 = 0;
	let nextWiggleAt = 0;
	const wiggleGap = () => (WIGGLE_GAP[0] + Math.random() * (WIGGLE_GAP[1] - WIGGLE_GAP[0])) * 1000;

	const wiggleTick = (now: number) => {
		const idle =
			context.stateXstateDerived.isIdle() &&
			context.stateGame.boardMode === 'settle' &&
			!context.stateGame.celebrationActive &&
			!context.stateGame.bonusHandoffActive &&
			!lockedCells.length &&
			!hasWinCells;
		if (!idle) {
			if (wiggleName) wiggleName = null;
			nextWiggleAt = now + wiggleGap();
			return;
		}
		if (wiggleName) {
			wiggleClock = (now - wiggleT0) / 1000;
			if (now - wiggleT0 >= WIGGLE_MS) {
				wiggleName = null;
				nextWiggleAt = now + wiggleGap();
			}
			return;
		}
		if (!nextWiggleAt) nextWiggleAt = now + wiggleGap();
		if (now < nextWiggleAt) return;
		// Pick a type that actually has a group on the board — a lone symbol twitching by itself
		// reads as a glitch, three or more reads as a deliberate ripple.
		const counts = new Map<string, number>();
		for (const cell of unlockedCells) {
			if (cell.wild || cell.scatter || cell.magnet) continue;
			counts.set(cell.name, (counts.get(cell.name) ?? 0) + 1);
		}
		const names = [...counts].filter(([, n]) => n >= 3).map(([n]) => n);
		if (!names.length) {
			nextWiggleAt = now + wiggleGap();
			return;
		}
		wiggleName = names[Math.floor(Math.random() * names.length)];
		wiggleT0 = now;
		wiggleClock = 0;
	};

	/** Per-cell twitch transform, or null when this cell is not part of the current one. */
	const wiggleFor = (cell: { name: string; position: { reel: number; row: number } }) => {
		if (!wiggleName || cell.name !== wiggleName) return null;
		const u = wiggleClock / (WIGGLE_MS / 1000);
		if (u <= 0 || u >= 1) return null;
		// Ripple order: top-left first, bottom-right last.
		const order = ((cell.position.reel + cell.position.row) % 7) / 7;
		const v = (u - order * WIGGLE_STAGGER) / (1 - WIGGLE_STAGGER);
		if (v <= 0 || v >= 1) return null;
		const env = Math.sin(Math.PI * v) ** 1.3;
		return {
			rot: 0.11 * env * Math.sin(v * Math.PI * 6),
			dy: -SYMBOL_H * 0.055 * env,
			scale: 1 + 0.045 * env,
		};
	};

	// ── Cell electricity clock. ONE persistent rAF (started on mount, never stopped)
	//    redraws the electric borders IMPERATIVELY into a captured Graphics instance. Nothing
	//    reactive sits in the border render path, so the arcs cannot freeze when an upstream
	//    signal settles — they run for as long as any cell is locked, every cluster. ──
	type LockG = {
		destroyed: boolean;
		clear: () => void;
		moveTo: (x: number, y: number) => void;
		lineTo: (x: number, y: number) => void;
		stroke: (s: object) => void;
		circle: (x: number, y: number, r: number) => unknown;
		fill: (s: object) => void;
	};
	let lockG: LockG | null = null;
	let lockGDrawn = false;
	// Impact dust, drawn into its own captured Graphics from the same frame loop. Imperative for the
	// same reason the lock borders are: 49 cells landing in a rain would otherwise re-render the
	// whole board every frame just to fade a puff.
	let dustG: LockG | null = null;
	let dustGDrawn = false;
	// Idle layer: the specials' own animation plus a magnetic charge that sweeps the grid every few
	// seconds. Same captured-Graphics pattern — the board is otherwise completely still between
	// spins, which is the other half of the "poor animations" verdict.
	let idleG: SpecialIdleG | null = null;
	/**
	 * The cluster's electric border, in the MOTHERSHIP's magenta rather than the electric blue it
	 * was. The four tones are sampled off the UFO in the room art (#e070f0 / #d070f0 for its lit
	 * lozenges) and laid out as the same ladder the blue used -- a wide dark underglow, a mid body,
	 * a bright edge and a white core -- so only the hue moves and the arcs keep their shape.
	 *
	 * The core stays WHITE. Tinting it magenta too flattens the whole strike into one colour; the
	 * white is what makes it read as something too hot to have a colour.
	 */
	const ARC = {
		underglow: 0xb43ad6,
		body: 0xd45ce6,
		edge: 0xf07ff0,
		core: 0xffffff,
		fork: 0xf5aef5,
	} as const;

	/** Contact shadows + the spin sheen. Below the symbols, above the pads. */
	let shadowG: SpecialIdleG | null = null;
	let shadowGDrawn = false;
	const SWEEP_PERIOD_S = 7.5;
	const SWEEP_WIDTH = 1.6; // columns the leading edge lights at once
	const DUST_MS = 380;
	// A landing kicks a low, wide cloud out along the floor plus a few flecks that hop and fall
	// back. Both are pure functions of (now - cell.landAt), so nothing accumulates per frame.
	const drawDust = (g: LockG, now: number) => {
		g.clear();
		let any = false;
		for (const cell of unlockedCells) {
			const t = (now - cell.landAt) / DUST_MS;
			if (!cell.landAt || t < 0 || t > 1) continue;
			any = true;
			const cx = getX(cell.position.reel);
			const floor = getStaticY(cell.position.row) + SYMBOL_H * 0.42;
			const fade = (1 - t) ** 2;
			// Cloud: spreads sideways and flattens as it dissipates.
			for (let i = 0; i < 3; i++) {
				const s = 1 - i * 0.22;
				const rx = SYMBOL_W * (0.16 + 0.34 * t) * s;
				const ry = SYMBOL_H * (0.07 + 0.05 * t) * s * (1 - 0.4 * t);
				g.circle(cx, floor - ry * 0.3, Math.max(rx, ry));
				g.fill({ color: 0xbcd6f0, alpha: 0.1 * fade * s });
			}
			// Flecks: hopped out on impact, pulled back down by gravity.
			const phase = keyPhase(cell.key);
			for (let i = 0; i < 5; i++) {
				const dir = i % 2 === 0 ? 1 : -1;
				const spread = 0.2 + ((i * 0.17 + phase) % 1) * 0.5;
				const fx = cx + dir * SYMBOL_W * spread * t;
				const hop = Math.sin(Math.min(1, t * 1.6) * Math.PI);
				const fy = floor - SYMBOL_H * 0.16 * hop * (0.5 + spread);
				g.circle(fx, fy, SYMBOL_W * 0.016 * (1 - t * 0.5));
				g.fill({ color: 0xe4f1ff, alpha: 0.5 * fade });
			}
		}
		return any;
	};
	// Contact shadows, and a sheen that runs down the reels while they spin.
	//
	// Both live BELOW the symbols and ABOVE the pads, in one Graphics: they are the only two things
	// drawn in that gap, and they share a clear/redraw cycle.
	//
	// The shadow is what puts a symbol IN its cell rather than on top of the board. It tracks the
	// cell's live position, so during a drop it stays on the pad the symbol is falling toward while
	// the symbol is still above it -- and it shrinks and fades with that distance, which is the
	// whole cue for height. A shadow that simply followed the sprite would just be a dark smear
	// glued underneath and would read as nothing at all.
	// Seated LOW and slightly wider than the symbol on purpose. The art fills about 95% of its pad,
	// so a shadow tucked under the symbol's middle is completely hidden by the symbol itself and the
	// whole layer renders as nothing; only the rim that clears the art's bottom edge ever reads.
	const SHADOW_RX = 0.4; // of SYMBOL_W, at rest
	const SHADOW_RY = 0.075; // of SYMBOL_H, at rest
	const SHADOW_DY = 0.41; // below the cell centre
	const SHADOW_ALPHA = 0.38;
	/** Fall distance, in cells, over which the shadow reaches its smallest. */
	const SHADOW_LIFT = 1.6;
	/** Seconds for the sheen to travel the full grid height, and how many rows it lights at once. */
	const SHEEN_PERIOD_S = 1.15;
	const SHEEN_ROWS = 1.9;

	const drawShadows = (g: SpecialIdleG, now: number) => {
		g.clear();
		let any = false;

		for (const cell of flatCells) {
			const alpha = (cell.locked ? 1 : cell.displayAlpha.current) * loserAlpha;
			if (alpha <= 0.02) continue;
			const restY = getStaticY(cell.position.row);
			// How far the symbol is ABOVE its pad, in cells. Below the pad (the exit) counts as
			// zero: an exiting symbol is leaving the cell and its shadow should stay put and fade
			// with it, not swell as it drops past.
			const lift = Math.max(0, (restY - cell.displayY.current) / SYMBOL_H);
			const f = Math.max(0, 1 - lift / SHADOW_LIFT);
			if (f <= 0.02) continue;
			any = true;
			const cx = getX(cell.position.reel) + cell.displayX.current;
			const cy = restY + SYMBOL_H * SHADOW_DY;
			// Two ellipses, not one: a wide faint one for the penumbra and a tight one for the
			// contact patch. A single flat ellipse reads as a painted oval on the pad.
			const k = 0.55 + 0.45 * f;
			g.ellipse(cx, cy, SYMBOL_W * SHADOW_RX * k * 1.35, SYMBOL_H * SHADOW_RY * k * 1.5);
			g.fill({ color: BOARD_COLORS.symbolShadow, alpha: SHADOW_ALPHA * 0.4 * f * alpha });
			g.ellipse(cx, cy, SYMBOL_W * SHADOW_RX * k, SYMBOL_H * SHADOW_RY * k);
			g.fill({ color: BOARD_COLORS.symbolShadow, alpha: SHADOW_ALPHA * f * alpha });
		}

		// The sheen only exists while the reels are actually turning, which is what makes it read as
		// motion rather than as decoration. It runs DOWN, the way the symbols do.
		if (context.stateGame.boardSpinning) {
			const head =
				((now / 1000 / SHEEN_PERIOD_S) % 1) * (BOARD_DIMENSIONS.y + SHEEN_ROWS) - SHEEN_ROWS;
			for (let row = 0; row < BOARD_DIMENSIONS.y; row++) {
				const d = Math.abs(row - head);
				if (d > SHEEN_ROWS) continue;
				any = true;
				const f = (1 - d / SHEEN_ROWS) ** 2;
				g.ellipse(
					(SYMBOL_W * BOARD_DIMENSIONS.x) / 2,
					getStaticY(row),
					(SYMBOL_W * BOARD_DIMENSIONS.x) / 2,
					SYMBOL_H * 0.46,
				);
				g.fill({ color: 0xffffff, alpha: 0.05 * f });
			}
		}
		return any;
	};

	// The specials' idle, plus the charge sweep. Runs on the settled board only: during a drop the
	// symbols are mid-flight and their cells are not where the FX would be drawn.
	const drawIdle = (g: SpecialIdleG, now: number) => {
		g.clear();
		if (context.stateGame.boardSpinning) return false;
		const t = now / 1000;
		let any = false;

		// Charge sweep: a soft vertical band crosses the grid, brightening the cell boxes it passes.
		// It reads as the machine idling rather than as an effect ON any one symbol.
		const cycle = (t % SWEEP_PERIOD_S) / SWEEP_PERIOD_S;
		if (cycle < 0.42) {
			const head = (cycle / 0.42) * (BOARD_DIMENSIONS.x + SWEEP_WIDTH) - SWEEP_WIDTH;
			for (let ri = 0; ri < BOARD_DIMENSIONS.x; ri++) {
				const d = Math.abs(ri - head);
				if (d > SWEEP_WIDTH) continue;
				const f = (1 - d / SWEEP_WIDTH) ** 2;
				any = true;
				const cx = getX(ri);
				g.ellipse(cx, (SYMBOL_H * BOARD_DIMENSIONS.y) / 2, SYMBOL_W * 0.42, (SYMBOL_H * BOARD_DIMENSIONS.y) / 2);
				g.fill({ color: 0x6fc4ff, alpha: 0.09 * f });
			}
		}

		// WILD idle used to be drawn here. It is gone: <WildSymbol> now owns every wild end to end,
		// idle and win, plain and multiplier, so anything drawn here would double the effect.
		//
		// SCATTER left this layer for the same reason. It is one board-wide additive Graphics in FRONT
		// of every symbol, which was fine for the old flat art but cannot express the new capsule: its
		// bubbles have to pass BEHIND the alien.

		// RING MAGNET (L2) cluster idle — replaces the `ringmag_stack` flipbook. Scoped to LOCKED
		// cells like the flipbook it replaces: this is the cluster's charge, not a per-symbol idle,
		// and every loose L2 on a busy board arcing at once was noise.
		for (const cell of lockedCells) {
			if (cell.name !== 'L2') continue;
			if (cell.symbolState === 'win') continue; // SymbolWinFx owns the cell during a win
			const info = getSymbolInfo({ rawSymbol: cell, state: cell.symbolState });
			any = true;
			drawRingMagIdle(g, {
				x: getX(cell.position.reel),
				y: getStaticY(cell.position.row),
				w: SYMBOL_W * info.sizeRatios.width,
				h: SYMBOL_H * info.sizeRatios.height,
				t,
				phase: keyPhase(cell.key),
				alpha: loserAlpha,
			});
		}
		return any;
	};

	// Trace the OUTLINE OF THE WHOLE STACKED PACK, not each locked cell. Outlining every cell drew
	// the seams BETWEEN adjacent locked cells too, which is what read as lightning "inside" the
	// stack. An edge is kept only when the neighbour across it is not locked, and the surviving
	// edges are stitched into closed loops so the runners can crawl the pack's real perimeter.
	//
	// Each cell contributes its 4 edges wound CLOCKWISE (screen coords, y down). Consistent winding
	// is what makes the stitch trivial: the next edge of a loop is simply the one starting where the
	// current edge ends. Disjoint clusters and holes each come out as their own loop.
	const buildLockLoops = (cells: typeof lockedCells) => {
		const k = (r: number, w: number) => `${r},${w}`;
		const locked = new Set(cells.map((c) => k(c.position.reel, c.position.row)));
		type E = { ax: number; ay: number; bx: number; by: number };
		const edges: E[] = [];
		for (const cell of cells) {
			const r = cell.position.reel;
			const w = cell.position.row;
			if (!locked.has(k(r, w - 1))) edges.push({ ax: r, ay: w, bx: r + 1, by: w });
			if (!locked.has(k(r + 1, w))) edges.push({ ax: r + 1, ay: w, bx: r + 1, by: w + 1 });
			if (!locked.has(k(r, w + 1))) edges.push({ ax: r + 1, ay: w + 1, bx: r, by: w + 1 });
			if (!locked.has(k(r - 1, w))) edges.push({ ax: r, ay: w + 1, bx: r, by: w });
		}
		const byStart = new Map<string, E[]>();
		for (const e of edges) {
			const key = k(e.ax, e.ay);
			const list = byStart.get(key);
			if (list) list.push(e);
			else byStart.set(key, [e]);
		}
		const used = new Set<E>();
		const loops: { x: number; y: number }[][] = [];
		for (const seed of edges) {
			if (used.has(seed)) continue;
			const loop: { x: number; y: number }[] = [];
			let cur: E | undefined = seed;
			// Bounded by the edge count: a malformed stitch must not spin the frame loop forever.
			for (let guard = 0; cur && !used.has(cur) && guard <= edges.length; guard++) {
				used.add(cur);
				loop.push({ x: cur.ax * SYMBOL_W, y: cur.ay * SYMBOL_H });
				const nexts = byStart.get(k(cur.bx, cur.by));
				cur = nexts?.find((e) => !used.has(e));
			}
			if (loop.length > 2) loops.push(loop);
		}
		return loops;
	};

	const drawLockBorders = (g: LockG, now: number, cells: typeof lockedCells) => {
		g.clear();
		const t = now / 1000;
		const jit = SYMBOL_W * 0.02;
		const loops = buildLockLoops(cells);

		for (let li = 0; li < loops.length; li++) {
			const loop = loops[li];
			// Arc-length parametrisation of the loop, so runners move at a constant PIXEL speed and
			// carry a constant PIXEL-length tail regardless of how big the pack is. Fractions of the
			// perimeter would make a 2-cell stack whip round while a 12-cell one crawled.
			const n = loop.length;
			const segLen: number[] = [];
			let per = 0;
			for (let i = 0; i < n; i++) {
				const a = loop[i];
				const b = loop[(i + 1) % n];
				const L = Math.hypot(b.x - a.x, b.y - a.y);
				segLen.push(L);
				per += L;
			}
			if (per < 1) continue;
			const pointAt = (p: number) => {
				let d = ((((p % 1) + 1) % 1)) * per;
				for (let i = 0; i < n; i++) {
					if (d <= segLen[i]) {
						const a = loop[i];
						const b = loop[(i + 1) % n];
						const f = segLen[i] ? d / segLen[i] : 0;
						return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
					}
					d -= segLen[i];
				}
				return loop[0];
			};

			const phase = keyPhase(`loop${li}:${n}`);
			// Constant flickering outline so the whole pack always reads electrified — with random
			// hard surges for aggression.
			const surge = Math.random() < 0.06 ? 1 : 0;
			const flick =
				0.55 + 0.4 * Math.sin(t * 29 + phase * 12) * Math.sin(t * 9.3 + phase * 5) + surge * 0.5;
			g.moveTo(loop[0].x, loop[0].y);
			for (let i = 1; i < n; i++) g.lineTo(loop[i].x, loop[i].y);
			g.lineTo(loop[0].x, loop[0].y);
			g.stroke({
				width: SYMBOL_W * 0.04,
				color: ARC.body,
				alpha: 0.22 * flick + 0.1,
				cap: 'round',
				join: 'round',
			});

			// Crawling arc runners with layered glow, hot white core, forked branches and head sparks.
			// Runner COUNT is derived from a target coverage rather than picked by feel: each runner
			// lights TAIL_PX of the outline, so it takes COVERAGE * per / TAIL_PX of them to keep the
			// perimeter almost continuously lit. The per-cell version ran 3 runners over a single
			// cell's 416px outline (~78% covered); carrying that count onto a whole pack's outline
			// left it mostly dark, which is why the lights went sparse.
			const TAIL_PX = SYMBOL_W * 1.1;
			const COVERAGE = 0.88;
			const SEG = Math.min(0.45, TAIL_PX / per);
			const baseT = (t * SYMBOL_W * 2.2) / per + phase;
			const runners = Math.max(3, Math.round((COVERAGE * per) / TAIL_PX));
			for (let ri = 0; ri < runners; ri++) {
				const off = ri / runners;
				const N = 10;
				const pts: { x: number; y: number }[] = [];
				for (let i = 0; i <= N; i++) {
					const p = pointAt(baseT + off - (i / N) * SEG);
					pts.push({
						x: p.x + (Math.random() - 0.5) * 3 * jit,
						y: p.y + (Math.random() - 0.5) * 3 * jit,
					});
				}
				const trace = () => {
					g.moveTo(pts[0].x, pts[0].y);
					for (let i = 1; i <= N; i++) g.lineTo(pts[i].x, pts[i].y);
				};
				trace();
				g.stroke({
					width: SYMBOL_W * 0.085,
					color: ARC.underglow,
					alpha: 0.6 + surge * 0.3,
					cap: 'round',
					join: 'round',
				});
				trace();
				g.stroke({
					width: SYMBOL_W * 0.038,
					color: ARC.edge,
					alpha: 0.95,
					cap: 'round',
					join: 'round',
				});
				trace();
				g.stroke({
					width: SYMBOL_W * 0.016,
					color: ARC.core,
					alpha: 1,
					cap: 'round',
					join: 'round',
				});
				// Forked branches shooting off the runner body. Aimed OUTWARD only — an inward fork
				// lands inside the pack, which is the look being removed here.
				for (const bi of [2, 5, 8]) {
					if (Math.random() < 0.45) {
						const b = pts[bi];
						const ang = Math.random() * Math.PI * 2;
						const len = SYMBOL_W * (0.08 + Math.random() * 0.12);
						const mx = b.x + Math.cos(ang) * len * 0.55 + (Math.random() - 0.5) * jit * 2;
						const my = b.y + Math.sin(ang) * len * 0.55 + (Math.random() - 0.5) * jit * 2;
						g.moveTo(b.x, b.y);
						g.lineTo(mx, my);
						g.lineTo(b.x + Math.cos(ang) * len, b.y + Math.sin(ang) * len);
						g.stroke({
							width: SYMBOL_W * 0.013,
							color: ARC.fork,
							alpha: 0.85,
							cap: 'round',
							join: 'round',
						});
					}
				}
				// Head spark
				g.circle(pts[0].x, pts[0].y, SYMBOL_W * 0.055);
				g.fill({ color: ARC.body, alpha: 0.4 });
				g.circle(pts[0].x, pts[0].y, SYMBOL_W * 0.025);
				g.fill({ color: ARC.core, alpha: 0.9 });
			}
		}
	};
	// The one persistent frame loop — no reactive dependencies, so it never restarts or dies.
	$effect(() => {
		let raf = 0;
		const tick = (now: number) => {
			raf = requestAnimationFrame(tick);
			// The {#if show} teardown destroys the captured Graphics; drawing into it then
			// throws every frame. Drop the stale capture — a remount recaptures via draw.
			if (lockG?.destroyed) {
				lockG = null;
				lockGDrawn = false;
			}
			if (dustG?.destroyed) {
				dustG = null;
				dustGDrawn = false;
			}
			if (idleG?.destroyed) idleG = null;
			if (idleG) drawIdle(idleG, now);
			if (shadowG?.destroyed) {
				shadowG = null;
				shadowGDrawn = false;
			}
			if (shadowG) {
				const drew = drawShadows(shadowG, now);
				if (drew) shadowGDrawn = true;
				else if (shadowGDrawn) {
					shadowG.clear();
					shadowGDrawn = false;
				}
			}
			if (dustG) {
				const drew = drawDust(dustG, now);
				if (drew) dustGDrawn = true;
				else if (dustGDrawn) {
					dustG.clear();
					dustGDrawn = false;
				}
			}
			wiggleTick(now);
			const cells = lockedCells; // untracked read inside rAF — always the current value
			if (cells.length) {
				if (lockG) {
					drawLockBorders(lockG, now, cells);
					lockGDrawn = true;
				}
			} else if (lockG && lockGDrawn) {
				lockG.clear();
				lockGDrawn = false;
			}
		};
		raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
	});
	context.eventEmitter.subscribeOnMount({
		stopButtonClick: () => {
			context.stateGameDerived.speedUpMotion();
		},
		boardSettle: ({ board }) => context.stateGameDerived.setBoardFromRaw({ rawBoard: board }),
		boardShow: () => (show = true),
		boardHide: () => (show = false),
		boardWithAnimateSymbols: async ({ symbolPositions }) => {
			await context.stateGameDerived.animateWinningPositions(symbolPositions);
		},
	});
</script>

{#if show}
	<Container
		x={layout.x}
		y={layout.y + BOARD_GRID_OFFSET_Y}
		pivot={layout.pivot}
		scale={layout.boardScale}
		sortableChildren={true}
	>
		<!-- The frame bezel now hugs the grid (BoardFrame INTERIOR_MARGIN 1.01), so the mask must
		     clip almost exactly at the grid edge — the old half-cell overflow room let exiting
		     symbols draw straight over the bottom border. Symbols at the current ratios stay
		     inside their cells; 0.06 cell absorbs the landing bounce and AA fringes. -->
		<Graphics
			isMask
			draw={(graphics) => {
				graphics.rect(
					-SYMBOL_W * 0.06,
					-SYMBOL_H * 0.06,
					SYMBOL_W * (BOARD_DIMENSIONS.x + 0.12),
					SYMBOL_H * (BOARD_DIMENSIONS.y + 0.12),
				);
				graphics.fill(0xffffff);
			}}
		/>

		<!-- Stationary pad grid — the pads never move; only the symbols roll inside them.
		     EVERY cell draws its pad, locked included. Locked cells used to skip it, which left a
		     hole straight through to the background and made a stack read as a patch cut out of the
		     grid. This is independent of the cluster-hole MASK below: that stops falling respin
		     symbols showing through, and still does.
		     ONE Graphics for all 49, not 49 sprites: the pads are drawn shapes now (see
		     game/boardStyle.ts), and the whole grid is one path list that only rebuilds when a cell's
		     highlight actually flips. -->
		<Graphics
			zIndex={Z.grid}
			draw={(graphics) => {
				for (let reelIndex = 0; reelIndex < board.length; reelIndex++) {
					const reel = board[reelIndex];
					for (let rowIndex = 0; rowIndex < reel.length; rowIndex++) {
						drawPad(
							graphics,
							getX(reelIndex),
							getStaticY(rowIndex),
							reel[rowIndex].highlighted,
						);
					}
				}
			}}
		/>

		<!-- Moving symbols use a grid mask with cluster-cell holes. The board/background stays
		     transparent there, while falling respin symbols disappear fully behind the cluster.
		     `thumpY` knocks this whole layer on every landing — the grid boxes and frame stay put,
		     so the symbols jolt INSIDE the machine rather than the machine bouncing. -->
		<Container zIndex={Z.reel} sortableChildren={true} y={thumpY}>
			<Graphics
				isMask
				draw={(graphics) => {
					for (const cell of unlockedCells) {
						// Padded past the cell so the oversized Version2 art isn't clipped by its own
						// hole; adjacent unlocked rects union anyway, locked clusters still occlude.
						graphics.rect(
							(cell.position.reel - 0.16) * SYMBOL_W,
							(cell.position.row - 0.16) * SYMBOL_H,
							SYMBOL_W * 1.32,
							SYMBOL_H * 1.32,
						);
					}
					graphics.fill(0xffffff);
				}}
			/>

			{#if boardMode === 'spin'}
				<!-- Legacy reel mode retained for stale HMR/resume state. -->
				{#each spinBoard as reel, reelIndex (reelIndex)}
					{#each reel.reelState.symbols as reelSymbol, symbolIndex (symbolIndex)}
						{@const y = reelSymbol.symbolY()}
						{@const symbolInfo = getSymbolInfo({
							rawSymbol: reelSymbol.rawSymbol,
							state: reelSymbol.symbolState,
						})}
						<Sprite
							key={symbolInfo.assetKey}
							x={getX(reelIndex)}
							{y}
							anchor={{ x: 0.5, y: 0.5 }}
							width={SYMBOL_W * symbolInfo.sizeRatios.width}
							height={SYMBOL_H * symbolInfo.sizeRatios.height}
							alpha={1}
							zIndex={Z.reel}
						/>
					{/each}
				{/each}
			{:else}
				<!-- Base state: only unlocked symbols render here. Cluster symbols use the win state below. -->
				{#each unlockedCells as cell (cell.key)}
					{@const x = getX(cell.position.reel) + cell.displayX.current}
					<!-- Landing squash: the cell spreads sideways and flattens against the floor, and its
					     centre drops by half the height it loses so the BASE stays planted — squashing
					     about the centre alone leaves the symbol hovering over its own impact. -->
					{@const sq = cell.displaySquash.current}
					{@const symbolInfo = getSymbolInfo({ rawSymbol: cell, state: cell.symbolState })}
					{@const baseH = SYMBOL_H * symbolInfo.sizeRatios.height * cell.displayScale.current}
					{@const y = cell.displayY.current + baseH * SQUASH_Y * sq * 0.5}
					{@const width =
						SYMBOL_W * symbolInfo.sizeRatios.width * cell.displayScale.current * (1 + SQUASH_X * sq)}
					{@const height = baseH * (1 - SQUASH_Y * sq)}
					{@const targetY = getStaticY(cell.position.row)}
					{@const fallDist = targetY - y}
					<!-- Motion-blur trail while a symbol RAINS IN (never on the exit — there the
					     symbol leaves the board before its trail does, and the leftover sweeping
					     line was the reported artifact). Drawn BEHIND the sprite and starting
					     inside its footprint, so it reads as blur coming off the symbol, not a
					     separate floating line; fades out just before landing. -->
					{@const falling =
						context.stateGame.boardSpinning && !cell.pulling && fallDist > SYMBOL_H * 0.5}
					{@const trailFade = Math.min(1, (fallDist - SYMBOL_H * 0.5) / SYMBOL_H)}
					{#if falling}
						<Graphics
							blendMode="add"
							zIndex={Z.symbol}
							draw={(g) => {
								g.clear();
								// Stacked segments, widest+brightest at the symbol, dying upward.
								for (let i = 0; i < 4; i++) {
									const f = 1 - i / 4;
									const top = y - SYMBOL_H * (0.25 + 0.28 * (i + 1));
									g.roundRect(
										x - SYMBOL_W * 0.055 * f,
										top,
										SYMBOL_W * 0.11 * f,
										SYMBOL_H * 0.34,
										SYMBOL_W * 0.055 * f,
									);
									g.fill({ color: 0xbfe2ff, alpha: 0.16 * f * trailFade });
								}
							}}
						/>
					{/if}
					{@render symbolArt(
						cell,
						symbolInfo,
						x,
						y,
						width,
						height,
						cell.displayAlpha.current * (cell.symbolState === 'win' ? 1 : loserAlpha),
						cell.pulling ? Z.pulledSymbol : Z.symbol,
						cell.symbolState === 'win',
					)}
				{/each}
			{/if}
		</Container>

		<!-- The per-cell electric burst that used to render behind every stacked symbol was removed
		     (user pass 2026-08-07): the cluster reads through the perimeter electricity alone. -->

		<!-- Cluster state: stacked cells hold the PLAIN STATIC symbol. This used to hardcode
		     state: 'win', so every locked cell rendered win art and looped its win flipbook for the
		     whole respin chain — the stack read as a wall of animation. Only the actual win pass
		     (symbolState === 'win') swaps in the animated art now; being stacked is not a win. -->
		{#each lockedCells as cell (`${cell.key}:locked`)}
			{@const x = getX(cell.position.reel)}
			{@const y = getStaticY(cell.position.row)}
			{@const symbolInfo = getSymbolInfo({ rawSymbol: cell, state: cell.symbolState })}
			{@const width = SYMBOL_W * symbolInfo.sizeRatios.width * cell.displayScale.current}
			{@const height = SYMBOL_H * symbolInfo.sizeRatios.height * cell.displayScale.current}
			<!-- A locked CLUSTER cell, drawn by the same snippet as every other cell. It used to have
			     two special paths and both showed the wrong thing:
			       * winning cells went to <SymbolWinFx> with only the base texture, which hollowed
			         out every rebuilt symbol (a portal missing its galaxy, a chip with a blank white
			         screen) and played the old pop/wobble over the hole;
			       * everything else played a `stackAnim*` flipbook, and those sheets are PRE-REBUILD
			         art -- a stack of astronauts came up as the old blue coil springs.
			     Being LOCKED is not a win: a cell only animates during the actual win pass, and then
			     it is its own component's choreography, not the old shared one. The rest of the
			     respin chain a stack just sits there, which is what stops it reading as a wall of
			     animation. -->
			{@render symbolArt(
				cell,
				symbolInfo,
				x,
				y,
				width,
				height,
				cell.symbolState === 'win' ? 1 : loserAlpha,
				Z.lockedSymbol,
				cell.symbolState === 'win',
			)}
		{/each}

		<!-- Electric borders around every STACKED (locked) cell: two crawling jagged arc runners per
		     cell circle its edge (re-jittered every frame -> live-arc shimmer). Always mounted; the
		     draw prop only CAPTURES the Graphics instance — the persistent rAF in the script redraws
		     it imperatively every frame (and clears it when nothing is locked). -->
		<Graphics
			blendMode="add"
			zIndex={Z.lockBorder}
			draw={(gr) => (lockG = gr as unknown as LockG)}
		/>

		<!-- Impact dust — same capture-only pattern, redrawn imperatively by the frame loop. Sits
		     just under the symbols so the cloud reads as kicked up from behind their feet. -->
		<Graphics
			blendMode="add"
			zIndex={Z.symbol - 1}
			draw={(gr) => (dustG = gr as unknown as LockG)}
		/>

		<!-- Contact shadows and the spin sheen: below every symbol, above the pads. NORMAL blend, not
		     additive — a shadow has to darken the pad, and an additive layer can only lighten it. -->
		<Graphics
			zIndex={Z.grid + 1}
			draw={(gr) => (shadowG = gr as unknown as SpecialIdleG)}
		/>

		<!-- Specials' idle animation + the grid charge sweep. Above the symbols: the wild's field
		     arcs across its poles and the scatter's motes orbit its core, both in front of the art. -->
		<Graphics
			blendMode="add"
			zIndex={Z.lockedSymbol + 1}
			draw={(gr) => (idleG = gr as unknown as SpecialIdleG)}
		/>
	</Container>
{/if}
