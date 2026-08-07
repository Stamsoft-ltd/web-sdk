<script lang="ts" module>
	import type { Position, RawSymbol } from '../game/types';

	export type EmitterEventBoard =
		| { type: 'boardSettle'; board: RawSymbol[][] }
		| { type: 'boardShow' }
		| { type: 'boardHide' }
		| { type: 'boardWithAnimateSymbols'; symbolPositions: Position[] };
</script>

<script lang="ts">
	import { Container, Graphics, Sprite } from 'pixi-svelte';

	import SymbolWinFx from './SymbolWinFx.svelte';
	import { getContext } from '../game/context';
	import { BOARD_DIMENSIONS, BOARD_GRID_OFFSET_Y, SYMBOL_H, SYMBOL_W } from '../game/constants';
	import { getSymbolInfo } from '../game/utils';

	const context = getContext();
	const board = $derived(context.stateGame.board);
	const spinBoard = $derived(context.stateGame.spinBoard);
	const boardMode = $derived(context.stateGame.boardMode);
	const layout = $derived(context.stateGameDerived.boardLayout());
	const flatCells = $derived(board.flatMap((reel) => reel));
	const lockedCells = $derived(flatCells.filter((cell) => cell.locked));
	const unlockedCells = $derived(flatCells.filter((cell) => !cell.locked));
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

	const keyPhase = (key: string) => {
		let h = 0;
		for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
		return Math.abs(h % 100) / 100;
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
				color: 0x2fa8ff,
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
					color: 0x1e8fff,
					alpha: 0.6 + surge * 0.3,
					cap: 'round',
					join: 'round',
				});
				trace();
				g.stroke({
					width: SYMBOL_W * 0.038,
					color: 0x66d4ff,
					alpha: 0.95,
					cap: 'round',
					join: 'round',
				});
				trace();
				g.stroke({
					width: SYMBOL_W * 0.016,
					color: 0xffffff,
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
							color: 0x9fdcff,
							alpha: 0.85,
							cap: 'round',
							join: 'round',
						});
					}
				}
				// Head spark
				g.circle(pts[0].x, pts[0].y, SYMBOL_W * 0.055);
				g.fill({ color: 0x2fa8ff, alpha: 0.4 });
				g.circle(pts[0].x, pts[0].y, SYMBOL_W * 0.025);
				g.fill({ color: 0xffffff, alpha: 0.9 });
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

		<!-- Stationary box grid — the cell boxes never move; only the symbols roll inside them.
		     EVERY cell draws its box, locked included. Locked cells used to skip it, which left a
		     hole straight through to the dark background and made a stack read as a black patch cut
		     out of the grid. This is independent of the cluster-hole MASK below: that stops falling
		     respin symbols showing through, and still does. -->
		{#each board as reel, reelIndex (reelIndex)}
			{#each reel as cell, rowIndex (cell.key)}
				<!-- cell_box_win.webp carries a 20px glow margin around the same 228×188 pad, so it is
				     drawn proportionally larger — the pad inside still lands exactly on SYMBOL_W/H. -->
				<Sprite
					key={cell.highlighted ? 'cellBoxWin' : 'cellBox'}
					x={getX(reelIndex)}
					y={getStaticY(rowIndex)}
					anchor={0.5}
					width={SYMBOL_W * (cell.highlighted ? 268 / 228 : 1)}
					height={SYMBOL_H * (cell.highlighted ? 228 / 188 : 1)}
					zIndex={Z.grid}
				/>
			{/each}
		{/each}

		<!-- Moving symbols use a grid mask with cluster-cell holes. The board/background stays
		     transparent there, while falling respin symbols disappear fully behind the cluster. -->
		<Container zIndex={Z.reel} sortableChildren={true}>
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
					{@const y = cell.displayY.current}
					{@const symbolInfo = getSymbolInfo({ rawSymbol: cell, state: cell.symbolState })}
					{@const width = SYMBOL_W * symbolInfo.sizeRatios.width * cell.displayScale.current}
					{@const height = SYMBOL_H * symbolInfo.sizeRatios.height * cell.displayScale.current}
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
					{#if cell.symbolState === 'win'}
						<!-- Winning cell: hi-res static win art with procedural pop/wobble/burst
						     choreography — see <SymbolWinFx> for why the flipbooks are gone. -->
						<SymbolWinFx
							assetKey={symbolInfo.assetKey}
							{x}
							{y}
							{width}
							{height}
							alpha={cell.displayAlpha.current}
							zIndex={cell.pulling ? Z.pulledSymbol : Z.symbol}
							phase={keyPhase(cell.key)}
						/>
					{:else}
						<Sprite
							key={symbolInfo.assetKey}
							{x}
							{y}
							anchor={{ x: 0.5, y: 0.5 }}
							{width}
							{height}
							alpha={cell.displayAlpha.current}
							tint={0xffffff}
							zIndex={cell.pulling ? Z.pulledSymbol : Z.symbol}
						/>
					{/if}
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
			{@const safeAssetKey = symbolInfo.assetKey ?? ''}
			{@const width = SYMBOL_W * symbolInfo.sizeRatios.width * cell.displayScale.current}
			{@const height = SYMBOL_H * symbolInfo.sizeRatios.height * cell.displayScale.current}
			{#if cell.symbolState === 'win'}
				<SymbolWinFx
					assetKey={safeAssetKey}
					{x}
					{y}
					{width}
					{height}
					zIndex={Z.lockedSymbol}
					phase={keyPhase(cell.key)}
				/>
			{:else}
				<Sprite
					key={safeAssetKey}
					{x}
					{y}
					anchor={{ x: 0.5, y: 0.5 }}
					{width}
					{height}
					alpha={1}
					tint={0xffffff}
					zIndex={Z.lockedSymbol}
				/>
			{/if}
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
	</Container>
{/if}
