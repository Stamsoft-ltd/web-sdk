<script lang="ts" module>
	import type { Position, RawSymbol } from '../game/types';

	export type EmitterEventBoard =
		| { type: 'boardSettle'; board: RawSymbol[][] }
		| { type: 'boardShow' }
		| { type: 'boardHide' }
		| { type: 'boardWithAnimateSymbols'; symbolPositions: Position[] };
</script>

<script lang="ts">
	import { Container, Graphics, Rectangle, Sprite, SpriteSheet } from 'pixi-svelte';

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
	let show = $state(true);

	const getX = (reelIndex: number) => SYMBOL_W * (reelIndex + 0.5);
	const getStaticY = (rowIndex: number) => SYMBOL_H * (rowIndex + 0.5);

	// ── "Being screwed in" lock animation: while a cell is locked in the cluster, its symbol keeps
	//    getting wrenched — repeating ratchet strokes (fast clockwise twist, quick return, brief
	//    pause), like a screwdriver driving it. Per-cell phase offsets so they don't twist in sync. ──
	// Twist pivot as a fraction of the sprite box: the bolt/screw HEADS sit toward the top-left of
	// the art (~36%), so pivoting there makes the twist read as torque on the fastener itself.
	const LOCK_PIVOT = 0.36;
	let lockStartByKey = $state<Record<string, number>>({});
	let animNow = $state(0);
	$effect(() => {
		const locked = flatCells.filter((c) => c.locked);
		const next: Record<string, number> = {};
		let changed = false;
		for (const c of locked) {
			const prev = lockStartByKey[c.key];
			next[c.key] = prev ?? performance.now();
			if (prev === undefined) changed = true;
		}
		if (changed || Object.keys(next).length !== Object.keys(lockStartByKey).length) {
			lockStartByKey = next;
		}
	});
	const keyPhase = (key: string) => {
		let h = 0;
		for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
		return Math.abs(h % 100) / 100;
	};
	// ── Cell electricity + wrench clock. ONE persistent rAF (started on mount, never stopped)
	//    drives both: it writes animNow (the wrench rotation reads it from the template) and
	//    redraws the electric borders IMPERATIVELY into a captured Graphics instance. Nothing
	//    reactive sits in the border render path, so the arcs cannot freeze when an upstream
	//    signal settles — they run for as long as any cell is locked, every cluster.
	//    (lockedCells itself is declared near the top of the script.) ──
	type LockG = {
		clear: () => void;
		moveTo: (x: number, y: number) => void;
		lineTo: (x: number, y: number) => void;
		stroke: (s: object) => void;
		circle: (x: number, y: number, r: number) => unknown;
		fill: (s: object) => void;
	};
	let lockG: LockG | null = null;
	let lockGDrawn = false;
	const drawLockBorders = (g: LockG, now: number, cells: typeof lockedCells) => {
		g.clear();
		const t = now / 1000;
		const jit = SYMBOL_W * 0.03;
		for (const cell of cells) {
			const cx = getX(cell.position.reel);
			const cy = getStaticY(cell.position.row);
			// Runners ride the cell SEAM (the dark gap between boxes) — high contrast even though
			// the locked box art itself is light.
			const hw = SYMBOL_W * 0.5;
			const hh = SYMBOL_H * 0.5;
			const per = 4 * (hw + hh);
			const pointAt = (p: number) => {
				let d = (((p % 1) + 1) % 1) * per;
				if (d < 2 * hw) return { x: cx - hw + d, y: cy - hh };
				d -= 2 * hw;
				if (d < 2 * hh) return { x: cx + hw, y: cy - hh + d };
				d -= 2 * hh;
				if (d < 2 * hw) return { x: cx + hw - d, y: cy + hh };
				d -= 2 * hw;
				return { x: cx - hw, y: cy + hh - d };
			};
			const phase = keyPhase(cell.key);
			// Constant flickering outline so the whole cell always reads electrified.
			const flick = 0.5 + 0.35 * Math.sin(t * 23 + phase * 12) * Math.sin(t * 7.7 + phase * 5);
			g.moveTo(cx - hw, cy - hh);
			g.lineTo(cx + hw, cy - hh);
			g.lineTo(cx + hw, cy + hh);
			g.lineTo(cx - hw, cy + hh);
			g.lineTo(cx - hw, cy - hh);
			g.stroke({ width: SYMBOL_W * 0.05, color: 0x2fa8ff, alpha: 0.18 * flick + 0.08, cap: 'round', join: 'round' });
			// Two crawling arc runners with layered glow + hot white core + head spark.
			const baseT = t * 0.45 + phase;
			for (const off of [0, 0.5]) {
				const N = 10;
				const SEG = 0.22;
				const pts: { x: number; y: number }[] = [];
				for (let i = 0; i <= N; i++) {
					const p = pointAt(baseT + off - (i / N) * SEG);
					pts.push({ x: p.x + (Math.random() - 0.5) * 2 * jit, y: p.y + (Math.random() - 0.5) * 2 * jit });
				}
				const trace = () => {
					g.moveTo(pts[0].x, pts[0].y);
					for (let i = 1; i <= N; i++) g.lineTo(pts[i].x, pts[i].y);
				};
				trace();
				g.stroke({ width: SYMBOL_W * 0.12, color: 0x1e8fff, alpha: 0.5, cap: 'round', join: 'round' });
				trace();
				g.stroke({ width: SYMBOL_W * 0.05, color: 0x66d4ff, alpha: 0.85, cap: 'round', join: 'round' });
				trace();
				g.stroke({ width: SYMBOL_W * 0.022, color: 0xffffff, alpha: 1, cap: 'round', join: 'round' });
				// Head spark
				g.circle(pts[0].x, pts[0].y, SYMBOL_W * 0.09);
				g.fill({ color: 0x2fa8ff, alpha: 0.4 });
				g.circle(pts[0].x, pts[0].y, SYMBOL_W * 0.04);
				g.fill({ color: 0xffffff, alpha: 0.9 });
			}
		}
	};
	// The one persistent frame loop — no reactive dependencies, so it never restarts or dies.
	$effect(() => {
		let raf = 0;
		const tick = (now: number) => {
			raf = requestAnimationFrame(tick);
			const cells = lockedCells; // untracked read inside rAF — always the current value
			if (cells.length) {
				animNow = now; // drives lockSpin() in the template
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

	// Ratchet stroke: 0-30% fast twist to +A (ease-out), 30-45% quick return, 45-100% rest.
	const lockSpin = (key: string) => {
		const start = lockStartByKey[key];
		if (start === undefined) return 0;
		const t = (animNow - start) / 1000;
		if (t <= 0) return 0;
		const A = 0.3; // ~17° stroke
		const p = (t * 1.6 + keyPhase(key)) % 1;
		if (p < 0.3) {
			const q = p / 0.3;
			return A * (1 - Math.pow(1 - q, 3));
		}
		if (p < 0.45) return A * (1 - (p - 0.3) / 0.15);
		return 0;
	};
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
	<Container x={layout.x} y={layout.y + BOARD_GRID_OFFSET_Y} pivot={layout.pivot} scale={layout.boardScale}>
		<Graphics
			isMask
			draw={(graphics) => {
				graphics.rect(0, 0, SYMBOL_W * BOARD_DIMENSIONS.x, SYMBOL_H * BOARD_DIMENSIONS.y);
				graphics.fill(0xffffff);
			}}
		/>

		<!-- Stationary box grid — the cell boxes never move; only the symbols roll inside them.
		     Winning cells (settle mode) swap to the win-state box. -->
		{#each board as reel, reelIndex (reelIndex)}
			{#each reel as cell, rowIndex (cell.key)}
				<Sprite
					key={cell.highlighted || cell.locked ? 'cellBoxWin' : 'cellBox'}
					x={getX(reelIndex)}
					y={getStaticY(rowIndex)}
					anchor={0.5}
					width={SYMBOL_W}
					height={SYMBOL_H}
				/>
			{/each}
		{/each}

		{#if boardMode === 'spin'}
			<!-- ── Spin mode: one rolling strip per reel. Locked cells are opaque covers above it. ── -->
			{#each spinBoard as reel, reelIndex (reelIndex)}
				{#each reel.reelState.symbols as reelSymbol, symbolIndex (symbolIndex)}
					{@const y = reelSymbol.symbolY()}
					{@const symbolInfo = getSymbolInfo({ rawSymbol: reelSymbol.rawSymbol, state: reelSymbol.symbolState })}
					<Sprite
						key={symbolInfo.assetKey}
						x={getX(reelIndex)}
						y={y}
						anchor={{ x: 0.5, y: 0.5 }}
						width={SYMBOL_W * symbolInfo.sizeRatios.width}
						height={SYMBOL_H * symbolInfo.sizeRatios.height}
						alpha={1}
					/>
				{/each}
			{/each}

			<!-- Locked cluster cells cover the closed reel windows, then render lock symbol above. -->
			{#each lockedCells as cell (cell.key)}
				{@const x = getX(cell.position.reel)}
				{@const y = getStaticY(cell.position.row)}
				{@const symbolInfo = getSymbolInfo({ rawSymbol: cell, state: 'locked' })}
				{@const width = SYMBOL_W * symbolInfo.sizeRatios.width}
				{@const height = SYMBOL_H * symbolInfo.sizeRatios.height}
				<!-- Opaque full outer cell cover sits ABOVE spinning reels. -->
				<Rectangle
					{x}
					{y}
					anchor={0.5}
					width={SYMBOL_W}
					height={SYMBOL_H}
					backgroundColor={0x05070b}
					backgroundAlpha={1}
				/>
				<Sprite
					key="cellBoxWin"
					{x}
					{y}
					anchor={0.5}
					width={SYMBOL_W}
					height={SYMBOL_H}
				/>
				{#if cell.name === 'L3'}
					<!-- Washer: true axial rotation via the 16-frame flipbook (designer frames). -->
					<SpriteSheet
						key="washerLockSheet"
						play
						loop
						animationSpeed={0.35}
						{x}
						{y}
						anchor={0.5}
						{width}
						{height}
					/>
				{:else}
					<!-- Twist pivots on the bolt HEAD (top-left of the art), not the image centre, so the
					     ratchet reads as torque on the bolt itself. Container sits at the pivot point and
					     the sprite is offset so its head lands on the pivot. -->
					<Container
						x={x - width * (0.5 - LOCK_PIVOT)}
						y={y - height * (0.5 - LOCK_PIVOT)}
						rotation={lockSpin(cell.key)}
					>
						<Sprite
							key={symbolInfo.assetKey}
							x={width * (0.5 - LOCK_PIVOT)}
							y={height * (0.5 - LOCK_PIVOT)}
							anchor={{ x: 0.5, y: 0.5 }}
							{width}
							{height}
							alpha={1}
							tint={0xffffff}
						/>
					</Container>
				{/if}
			{/each}
		{:else}
			<!-- ── Settle/respin mode: render per-cell board with decorations ── -->

			<!-- Static background grid cells -->
			{#each board as reel, reelIndex (reelIndex)}
				{#each reel as cell, rowIndex (cell.key)}
					<Rectangle
						x={getX(reelIndex)}
						y={getStaticY(rowIndex)}
						anchor={0.5}
						width={SYMBOL_W}
						height={SYMBOL_H}
						backgroundColor={cell.locked ? 0x05070b : 0x0b0f18}
						backgroundAlpha={cell.locked ? 1 : context.stateGame.boardSpinning ? 0.18 : 0.1}
					/>
				{/each}
			{/each}

			<!-- Base symbols stay mounted even when a cell becomes locked; locked overlay covers them. -->
			{#each flatCells as cell (cell.key)}
				{@const x = cell.locked ? getX(cell.position.reel) : getX(cell.position.reel) + cell.displayX.current}
				{@const y = cell.locked ? getStaticY(cell.position.row) : cell.displayY.current}
				{@const symbolInfo = getSymbolInfo({ rawSymbol: cell, state: cell.locked ? 'locked' : cell.symbolState })}
				{@const width = SYMBOL_W * symbolInfo.sizeRatios.width * cell.displayScale.current}
				{@const height = SYMBOL_H * symbolInfo.sizeRatios.height * cell.displayScale.current}


				<Sprite
					key={symbolInfo.assetKey}
					x={x}
					y={y}
					anchor={{ x: 0.5, y: 0.5 }}
					{width}
					{height}
					alpha={cell.locked ? 1 : cell.displayAlpha.current}
					tint={0xffffff}
				/>
			{/each}

			<!-- Locked overlay: full outer cover + highlighted rectangle + top symbol. -->
			{#each lockedCells as cell (`${cell.key}:locked`)}
				{@const x = getX(cell.position.reel)}
				{@const y = getStaticY(cell.position.row)}
				{@const symbolInfo = getSymbolInfo({ rawSymbol: cell, state: cell.symbolState === 'win' ? 'win' : 'locked' })}
				{@const width = SYMBOL_W * symbolInfo.sizeRatios.width * cell.displayScale.current}
				{@const height = SYMBOL_H * symbolInfo.sizeRatios.height * cell.displayScale.current}
				<Rectangle
					{x}
					{y}
					anchor={0.5}
					width={SYMBOL_W}
					height={SYMBOL_H}
					backgroundColor={0x05070b}
					backgroundAlpha={1}
				/>
				<Sprite
					key="cellBoxWin"
					{x}
					{y}
					anchor={0.5}
					width={SYMBOL_W}
					height={SYMBOL_H}
				/>
				{#if cell.name === 'L3'}
					<!-- Washer: true axial rotation via the 16-frame flipbook (designer frames). -->
					<SpriteSheet
						key="washerLockSheet"
						play
						loop
						animationSpeed={0.35}
						{x}
						{y}
						anchor={0.5}
						{width}
						{height}
					/>
				{:else}
					<!-- Twist pivots on the bolt HEAD (top-left of the art), not the image centre, so the
					     ratchet reads as torque on the bolt itself. Container sits at the pivot point and
					     the sprite is offset so its head lands on the pivot. -->
					<Container
						x={x - width * (0.5 - LOCK_PIVOT)}
						y={y - height * (0.5 - LOCK_PIVOT)}
						rotation={lockSpin(cell.key)}
					>
						<Sprite
							key={symbolInfo.assetKey}
							x={width * (0.5 - LOCK_PIVOT)}
							y={height * (0.5 - LOCK_PIVOT)}
							anchor={{ x: 0.5, y: 0.5 }}
							{width}
							{height}
							alpha={1}
							tint={0xffffff}
						/>
					</Container>
				{/if}
			{/each}
		{/if}

		<!-- Electric borders around every STACKED (locked) cell: two crawling jagged arc runners per
		     cell circle its edge (re-jittered every frame -> live-arc shimmer). Always mounted; the
		     draw prop only CAPTURES the Graphics instance — the persistent rAF in the script redraws
		     it imperatively every frame (and clears it when nothing is locked). -->
		<Graphics blendMode="add" draw={(gr) => (lockG = gr as unknown as LockG)} />
	</Container>
{/if}
