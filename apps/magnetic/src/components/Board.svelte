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
	const Z = {
		grid: 0,
		background: 5,
		reel: 10,
		symbol: 20,
		lockedCover: 30,
		lockedFrame: 31,
		lockedSymbol: 32,
	} as const;
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
	// Rotation flipbooks for locked (stacked) symbols, keyed by the RESOLVED sprite asset key —
	// NOT the symbol name (the art file names don't match their contents: nut.png is the gold
	// washer, bolt.png the green bolt). Add entries here as more frame sets arrive.
	const LOCK_SHEETS: Record<string, string> = {
		aTile: 'washerLockSheet',
		aWinTile: 'washerLockSheet',
		aTileMobile: 'washerLockSheet',
		aWinTileMobile: 'washerLockSheet',
		squirrelTile: 'boltLockSheet',
		squirrelWinTile: 'boltLockSheet',
		squirrelTileMobile: 'boltLockSheet',
		squirrelWinTileMobile: 'boltLockSheet',
		kTile: 'purpleScrewLockSheet',
		kWinTile: 'purpleScrewLockSheet',
		kTileMobile: 'purpleScrewLockSheet',
		kWinTileMobile: 'purpleScrewLockSheet',
		qTile: 'blueNutLockSheet',
		qWinTile: 'blueNutLockSheet',
		qTileMobile: 'blueNutLockSheet',
		qWinTileMobile: 'blueNutLockSheet',
		wolfTile: 'drillLockSheet',
		wolfWinTile: 'drillLockSheet',
		wolfTileMobile: 'drillLockSheet',
		wolfWinTileMobile: 'drillLockSheet',
		bearTile: 'cubeLockSheet',
		bearWinTile: 'cubeLockSheet',
		bearTileMobile: 'cubeLockSheet',
		bearWinTileMobile: 'cubeLockSheet',
		rabbitTile: 'generatorLockSheet',
		rabbitWinTile: 'generatorLockSheet',
		rabbitTileMobile: 'generatorLockSheet',
		rabbitWinTileMobile: 'generatorLockSheet',
	};
	// Per-sheet size tweaks (fraction of cell height; default 0.8) — art-specific corrections.
	const LOCK_SHEET_SIZE: Record<string, number> = {
		blueNutLockSheet: 1.21, // new frames: content ~63% of canvas; matches the static nut footprint
		purpleScrewLockSheet: 1.49, // frames have big registered padding (content ~54% of canvas)
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
		squirrelWinTile: 'boltWinSheet',
		squirrelWinTileMobile: 'boltWinSheet',
		aWinTile: 'washerWinSheet',
		aWinTileMobile: 'washerWinSheet',
		kWinTile: 'purpleScrewWinSheet',
		kWinTileMobile: 'purpleScrewWinSheet',
		qWinTile: 'blueNutWinSheet',
		qWinTileMobile: 'blueNutWinSheet',
		rabbitWinTile: 'generatorWinSheet',
		rabbitWinTileMobile: 'generatorWinSheet',
		wolfWinTile: 'drillWinSheet',
		wolfWinTileMobile: 'drillWinSheet',
		foxWinTile: 'magnetWinSheet',
		foxWinTileMobile: 'magnetWinSheet',
		magnetWinTile: 'magnetWinSheet',
		bearWinTile: 'cubeWinSheet',
		bearWinTileMobile: 'cubeWinSheet',
	};
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
						g.stroke({ width: SYMBOL_W * 0.018, color: 0x9fdcff, alpha: 0.85, cap: 'round', join: 'round' });
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

	// Zoom pulse for stacked MAGNET cells — the magnet breathes in/out (±8%) instead of getting
	// the wrench twist (rotating a horseshoe magnet reads wrong).
	const lockZoom = (key: string) => {
		const start = lockStartByKey[key];
		if (start === undefined) return 1;
		const t = (animNow - start) / 1000;
		if (t <= 0) return 1;
		// Heartbeat-style pulse: quick swell, slower release — clearly "pulsing", not twisting.
		const p = (t * 1.1 + keyPhase(key)) % 1;
		const beat = Math.exp(-((p - 0.18) * (p - 0.18)) / 0.012) + 0.55 * Math.exp(-((p - 0.42) * (p - 0.42)) / 0.02);
		return 1 + 0.14 * beat;
	};

	// Continuous centre rotation for stacked WILD cells — the medallion is round, so true
	// image rotation reads correctly (unlike the fasteners).
	const lockRotate = (key: string) => {
		const start = lockStartByKey[key];
		if (start === undefined) return 0;
		const t = (animNow - start) / 1000;
		if (t <= 0) return 0;
		return t * 6.5 + keyPhase(key) * Math.PI * 2;
	};

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
					zIndex={Z.grid}
				/>
			{/each}
		{/each}

		{#if boardMode === 'spin'}
			<!-- ── Spin mode: one rolling strip per reel. Locked cells are opaque covers above it. ── -->
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
					zIndex={Z.lockedCover}
				/>
				<Sprite
					key="cellBoxWin"
					{x}
					{y}
					anchor={0.5}
					width={SYMBOL_W}
					height={SYMBOL_H}
					zIndex={Z.lockedFrame}
				/>
				<!-- Win flipbook takes priority when the cell presents a win (assetKey is then the
				     win-art variant); otherwise the stacked rotation flipbook. -->
				{@const lockSheet = WIN_SHEETS[symbolInfo.assetKey] ?? LOCK_SHEETS[symbolInfo.assetKey]}
				{@const lockSheetSize = height * (LOCK_SHEET_SIZE[lockSheet ?? ''] ?? 0.8)}
				{#if lockSheet}
					<!-- True axial rotation via the symbol's flipbook. Sized down because the flipbook
					     frames are tightly cropped while the static art has large transparent padding. -->
					<SpriteSheet
						key={lockSheet}
						play
						loop
						animationSpeed={0.23}
						{x}
						{y}
						anchor={0.5}
						width={lockSheetSize}
						height={lockSheetSize}
						zIndex={Z.lockedSymbol}
					/>
				{:else if /wild\d/i.test(symbolInfo.assetKey)}
					<!-- Multiplier wild (medallion + Nx plaque): heartbeat pulse over the same looping
					     lightning burst as the plain wild. -->
					<SpriteSheet
						key="wildLightningSheet"
						play
						loop
						animationSpeed={0.23}
						blendMode="add"
						{x}
						{y}
						anchor={0.5}
						width={height * 1.35}
						height={height * 1.35}
						zIndex={Z.lockedSymbol}
					/>
					<Sprite
						key={symbolInfo.assetKey}
						{x}
						{y}
						anchor={0.5}
						width={width * lockZoom(cell.key)}
						height={height * lockZoom(cell.key)}
						alpha={1}
						tint={0xffffff}
						zIndex={Z.lockedSymbol}
					/>
				{:else if symbolInfo.assetKey.toLowerCase().includes('wild')}
					<!-- Plain wild medallion: heartbeat pulse while stacked, over a looping radial
					     lightning burst (additive, slightly larger than the cell). Same zIndex as the
					     symbol — insertion order keeps the burst behind the medallion. -->
					<SpriteSheet
						key="wildLightningSheet"
						play
						loop
						animationSpeed={0.23}
						blendMode="add"
						{x}
						{y}
						anchor={0.5}
						width={height * 1.35}
						height={height * 1.35}
						zIndex={Z.lockedSymbol}
					/>
					<Sprite
						key={symbolInfo.assetKey}
						{x}
						{y}
						anchor={0.5}
						width={width * 0.8 * lockZoom(cell.key)}
						height={height * 0.8 * lockZoom(cell.key)}
						alpha={1}
						tint={0xffffff}
						zIndex={Z.lockedSymbol}
					/>
				{:else if symbolInfo.assetKey.toLowerCase().includes('magnet') || symbolInfo.assetKey.startsWith('fox')}
					<!-- Magnet special symbol AND the H1 horseshoe-magnet premium (foxTile family — the
					     clean red/blue horseshoe art): heartbeat pulse while stacked, no rotation. -->
					<Sprite
						key={symbolInfo.assetKey}
						{x}
						{y}
						anchor={0.5}
						width={width * lockZoom(cell.key)}
						height={height * lockZoom(cell.key)}
						alpha={1}
						tint={0xffffff}
						zIndex={Z.lockedSymbol}
					/>
				{:else}
					<!-- Twist pivots on the bolt HEAD (top-left of the art), not the image centre, so the
					     ratchet reads as torque on the bolt itself. Container sits at the pivot point and
					     the sprite is offset so its head lands on the pivot. -->
					<Container
						x={x - width * (0.5 - LOCK_PIVOT)}
						y={y - height * (0.5 - LOCK_PIVOT)}
						rotation={lockSpin(cell.key)}
						zIndex={Z.lockedSymbol}
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
						zIndex={Z.background}
					/>
				{/each}
			{/each}

			<!-- Base symbols stay mounted even when a cell becomes locked; locked overlay covers them. -->
			{#each flatCells as cell (cell.key)}
				{@const x = cell.locked
					? getX(cell.position.reel)
					: getX(cell.position.reel) + cell.displayX.current}
				{@const y = cell.locked ? getStaticY(cell.position.row) : cell.displayY.current}
				{@const symbolInfo = getSymbolInfo({
					rawSymbol: cell,
					state: cell.locked ? 'locked' : cell.symbolState,
				})}
				{@const width = SYMBOL_W * symbolInfo.sizeRatios.width * cell.displayScale.current}
				{@const height = SYMBOL_H * symbolInfo.sizeRatios.height * cell.displayScale.current}
				{@const winSheet = !cell.locked && cell.symbolState === 'win' ? WIN_SHEETS[symbolInfo.assetKey] : undefined}

				{#if winSheet}
					<!-- Winning symbol with a dedicated win flipbook (symbol + electric arcs). -->
					<SpriteSheet
						key={winSheet}
						play
						loop
						animationSpeed={0.23}
						{x}
						{y}
						anchor={0.5}
						{width}
						{height}
						alpha={cell.displayAlpha.current}
						zIndex={Z.symbol}
					/>
				{:else}
					<Sprite
						key={symbolInfo.assetKey}
						{x}
						{y}
						anchor={{ x: 0.5, y: 0.5 }}
						{width}
						{height}
						alpha={cell.locked ? 1 : cell.displayAlpha.current}
						tint={0xffffff}
						zIndex={Z.symbol}
					/>
				{/if}
			{/each}

			<!-- Locked overlay: full outer cover + highlighted rectangle + top symbol. -->
			{#each lockedCells as cell (`${cell.key}:locked`)}
				{@const x = getX(cell.position.reel)}
				{@const y = getStaticY(cell.position.row)}
				{@const symbolInfo = getSymbolInfo({
					rawSymbol: cell,
					state: cell.symbolState === 'win' ? 'win' : 'locked',
				})}
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
					zIndex={Z.lockedCover}
				/>
				<Sprite
					key="cellBoxWin"
					{x}
					{y}
					anchor={0.5}
					width={SYMBOL_W}
					height={SYMBOL_H}
					zIndex={Z.lockedFrame}
				/>
				<!-- Win flipbook takes priority when the cell presents a win (assetKey is then the
				     win-art variant); otherwise the stacked rotation flipbook. -->
				{@const lockSheet = WIN_SHEETS[symbolInfo.assetKey] ?? LOCK_SHEETS[symbolInfo.assetKey]}
				{@const lockSheetSize = height * (LOCK_SHEET_SIZE[lockSheet ?? ''] ?? 0.8)}
				{#if lockSheet}
					<!-- True axial rotation via the symbol's flipbook. Sized down because the flipbook
					     frames are tightly cropped while the static art has large transparent padding. -->
					<SpriteSheet
						key={lockSheet}
						play
						loop
						animationSpeed={0.23}
						{x}
						{y}
						anchor={0.5}
						width={lockSheetSize}
						height={lockSheetSize}
						zIndex={Z.lockedSymbol}
					/>
				{:else if /wild\d/i.test(symbolInfo.assetKey)}
					<!-- Multiplier wild (medallion + Nx plaque): heartbeat pulse over the same looping
					     lightning burst as the plain wild. -->
					<SpriteSheet
						key="wildLightningSheet"
						play
						loop
						animationSpeed={0.23}
						blendMode="add"
						{x}
						{y}
						anchor={0.5}
						width={height * 1.35}
						height={height * 1.35}
						zIndex={Z.lockedSymbol}
					/>
					<Sprite
						key={symbolInfo.assetKey}
						{x}
						{y}
						anchor={0.5}
						width={width * lockZoom(cell.key)}
						height={height * lockZoom(cell.key)}
						alpha={1}
						tint={0xffffff}
						zIndex={Z.lockedSymbol}
					/>
				{:else if symbolInfo.assetKey.toLowerCase().includes('wild')}
					<!-- Plain wild medallion: heartbeat pulse while stacked, over a looping radial
					     lightning burst (additive, slightly larger than the cell). Same zIndex as the
					     symbol — insertion order keeps the burst behind the medallion. -->
					<SpriteSheet
						key="wildLightningSheet"
						play
						loop
						animationSpeed={0.23}
						blendMode="add"
						{x}
						{y}
						anchor={0.5}
						width={height * 1.35}
						height={height * 1.35}
						zIndex={Z.lockedSymbol}
					/>
					<Sprite
						key={symbolInfo.assetKey}
						{x}
						{y}
						anchor={0.5}
						width={width * 0.8 * lockZoom(cell.key)}
						height={height * 0.8 * lockZoom(cell.key)}
						alpha={1}
						tint={0xffffff}
						zIndex={Z.lockedSymbol}
					/>
				{:else if symbolInfo.assetKey.toLowerCase().includes('magnet') || symbolInfo.assetKey.startsWith('fox')}
					<!-- Magnet special symbol AND the H1 horseshoe-magnet premium (foxTile family — the
					     clean red/blue horseshoe art): heartbeat pulse while stacked, no rotation. -->
					<Sprite
						key={symbolInfo.assetKey}
						{x}
						{y}
						anchor={0.5}
						width={width * lockZoom(cell.key)}
						height={height * lockZoom(cell.key)}
						alpha={1}
						tint={0xffffff}
						zIndex={Z.lockedSymbol}
					/>
				{:else}
					<!-- Twist pivots on the bolt HEAD (top-left of the art), not the image centre, so the
					     ratchet reads as torque on the bolt itself. Container sits at the pivot point and
					     the sprite is offset so its head lands on the pivot. -->
					<Container
						x={x - width * (0.5 - LOCK_PIVOT)}
						y={y - height * (0.5 - LOCK_PIVOT)}
						rotation={lockSpin(cell.key)}
						zIndex={Z.lockedSymbol}
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
