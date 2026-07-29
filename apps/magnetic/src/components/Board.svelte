<script lang="ts" module>
	import type { Position, RawSymbol } from '../game/types';

	export type EmitterEventBoard =
		| { type: 'boardSettle'; board: RawSymbol[][] }
		| { type: 'boardShow' }
		| { type: 'boardHide' }
		| { type: 'boardWithAnimateSymbols'; symbolPositions: Position[] };
</script>

<script lang="ts">
	import { Container, Graphics, Sprite, SpriteSheet } from 'pixi-svelte';

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

	// Per-sheet size tweaks (fraction of cell height; default 0.8) — art-specific corrections.
	const WIN_SHEET_SIZE: Record<string, number> = {
		cubeWinSheet: 1.2, // enlarged again per design feedback
		magnetWinSheet: 1.32, // horseshoe + magnet special win size (tuned up per design feedback)
		drillWinSheet: 1.0, // +25% over the default win size
		generatorWinSheet: 1.0, // +25% over the default win size
		// Win flipbooks include the electric aura around the symbol, so they render larger for
		// the symbol core to match the static art's footprint.
		boltWinSheet: 1.17, // +6% per design feedback
		washerWinSheet: 1.1,
		purpleScrewWinSheet: 1.1,
		blueNutWinSheet: 1.2, // aura is feathered in the sheet; nut core sized to match static art
	};
	// WIN-state flipbooks (symbol + baked electric arcs), played while a cell presents a win.
	const WIN_SHEETS: Record<string, string> = {
		// Scatter frames are framed exactly like the static tile (Magnific video, black keyed),
		// so they render at the standard win-sprite box with no size correction.
		scatterWin: 'scatterWinAnim',
		scatterWinMobile: 'scatterWinAnim',
		squirrelWinTile: 'boltWinSheet',
		squirrelWinTileMobile: 'boltWinSheet',
		squirrelWinTileLand: 'boltWinSheet',
		aWinTile: 'washerWinSheet',
		aWinTileMobile: 'washerWinSheet',
		aWinTileLand: 'washerWinSheet',
		kWinTile: 'purpleScrewWinSheet',
		kWinTileMobile: 'purpleScrewWinSheet',
		kWinTileLand: 'purpleScrewWinSheet',
		qWinTile: 'blueNutWinSheet',
		qWinTileMobile: 'blueNutWinSheet',
		qWinTileLand: 'blueNutWinSheet',
		rabbitWinTile: 'generatorWinSheet',
		rabbitWinTileMobile: 'generatorWinSheet',
		rabbitWinTileLand: 'generatorWinSheet',
		wolfWinTile: 'drillWinSheet',
		wolfWinTileMobile: 'drillWinSheet',
		wolfWinTileLand: 'drillWinSheet',
		foxWinTile: 'magnetWinSheet',
		foxWinTileMobile: 'magnetWinSheet',
		foxWinTileLand: 'magnetWinSheet',
		magnetWinTile: 'magnetWinSheet',
		bearWinTile: 'cubeWinSheet',
		bearWinTileMobile: 'cubeWinSheet',
		bearWinTileLand: 'cubeWinSheet',
	};
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
			// Constant flickering outline so the whole cell always reads electrified — with random
			// hard surges for aggression.
			const surge = Math.random() < 0.06 ? 1 : 0;
			const flick =
				0.55 + 0.4 * Math.sin(t * 29 + phase * 12) * Math.sin(t * 9.3 + phase * 5) + surge * 0.5;
			g.moveTo(cx - hw, cy - hh);
			g.lineTo(cx + hw, cy - hh);
			g.lineTo(cx + hw, cy + hh);
			g.lineTo(cx - hw, cy + hh);
			g.lineTo(cx - hw, cy - hh);
			g.stroke({
				width: SYMBOL_W * 0.06,
				color: 0x2fa8ff,
				alpha: 0.22 * flick + 0.1,
				cap: 'round',
				join: 'round',
			});
			// Three fast crawling arc runners with layered glow, hot white core, forked branches
			// and head sparks.
			const baseT = t * 0.75 + phase;
			for (const off of [0, 0.33, 0.66]) {
				const N = 10;
				const SEG = 0.26;
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
					width: SYMBOL_W * 0.14,
					color: 0x1e8fff,
					alpha: 0.6 + surge * 0.3,
					cap: 'round',
					join: 'round',
				});
				trace();
				g.stroke({
					width: SYMBOL_W * 0.06,
					color: 0x66d4ff,
					alpha: 0.95,
					cap: 'round',
					join: 'round',
				});
				trace();
				g.stroke({
					width: SYMBOL_W * 0.025,
					color: 0xffffff,
					alpha: 1,
					cap: 'round',
					join: 'round',
				});
				// Forked branches shooting off the runner body
				for (const bi of [2, 5, 8]) {
					if (Math.random() < 0.55) {
						const b = pts[bi];
						const ang = Math.random() * Math.PI * 2;
						const len = SYMBOL_W * (0.1 + Math.random() * 0.16);
						const mx = b.x + Math.cos(ang) * len * 0.55 + (Math.random() - 0.5) * jit * 2;
						const my = b.y + Math.sin(ang) * len * 0.55 + (Math.random() - 0.5) * jit * 2;
						g.moveTo(b.x, b.y);
						g.lineTo(mx, my);
						g.lineTo(b.x + Math.cos(ang) * len, b.y + Math.sin(ang) * len);
						g.stroke({
							width: SYMBOL_W * 0.018,
							color: 0x9fdcff,
							alpha: 0.85,
							cap: 'round',
							join: 'round',
						});
					}
				}
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
		<Graphics
			isMask
			draw={(graphics) => {
				graphics.rect(0, 0, SYMBOL_W * BOARD_DIMENSIONS.x, SYMBOL_H * BOARD_DIMENSIONS.y);
				graphics.fill(0xffffff);
			}}
		/>

		<!-- Stationary box grid — the cell boxes never move; only the symbols roll inside them.
		     Cluster cells leave the board art fully visible: no gray locked-cell background. -->
		{#each board as reel, reelIndex (reelIndex)}
			{#each reel as cell, rowIndex (cell.key)}
				{#if !cell.locked}
					<Sprite
						key={cell.highlighted ? 'cellBoxWin' : 'cellBox'}
						x={getX(reelIndex)}
						y={getStaticY(rowIndex)}
						anchor={0.5}
						width={SYMBOL_W}
						height={SYMBOL_H}
						zIndex={Z.grid}
					/>
				{/if}
			{/each}
		{/each}

		<!-- Moving symbols use a grid mask with cluster-cell holes. The board/background stays
		     transparent there, while falling respin symbols disappear fully behind the cluster. -->
		<Container zIndex={Z.reel} sortableChildren={true}>
			<Graphics
				isMask
				draw={(graphics) => {
					for (const cell of unlockedCells) {
						graphics.rect(
							cell.position.reel * SYMBOL_W,
							cell.position.row * SYMBOL_H,
							SYMBOL_W,
							SYMBOL_H,
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
					{@const winSheet = cell.symbolState === 'win'
						? WIN_SHEETS[symbolInfo.assetKey]
						: undefined}

					{#if winSheet}
						{@const winBoost = winSheet === 'scatterWinAnim' ? 1.15 : 1}
						<SpriteSheet
							key={winSheet}
							play
							loop
							animationSpeed={0.23}
							{x}
							{y}
							anchor={0.5}
							width={width * winBoost}
							height={height * winBoost}
							alpha={cell.displayAlpha.current}
							zIndex={cell.pulling ? Z.pulledSymbol : Z.symbol}
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
			{@const winSheet = cell.symbolState === 'win' ? WIN_SHEETS[safeAssetKey] : undefined}
			{@const winSheetSize = height * (WIN_SHEET_SIZE[winSheet ?? ''] ?? 0.8)}
			{#if winSheet}
				<SpriteSheet
					key={winSheet}
					play
					loop
					animationSpeed={0.23}
					{x}
					{y}
					anchor={0.5}
					width={winSheetSize}
					height={winSheetSize}
					zIndex={Z.lockedSymbol}
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
