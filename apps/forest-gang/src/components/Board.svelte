<script lang="ts" module>
	import type { RawSymbol, Position } from '../game/types';

	export type EmitterEventBoard =
		| { type: 'boardSettle'; board: RawSymbol[][] }
		| { type: 'boardShow' }
		| { type: 'boardHide' }
		| { type: 'boardWithAnimateSymbols'; symbolPositions: Position[] }
		| { type: 'skipToAnticipation' };
</script>

<script lang="ts">
	import { AnimatedSprite, Container, Graphics, Rectangle, Sprite } from 'pixi-svelte';
	import { OnPressFullScreen } from 'components-layout';
	import type { Texture } from 'pixi-svelte';

	import { getContext } from '../game/context';
	import { SYMBOL_W, SYMBOL_H, SYMBOL_SIZE, BOARD_DIMENSIONS, BOARD_GRID_OFFSET_Y } from '../game/constants';
	import {
		spriteKeyByName,
		bonusSpriteKeyByName,
		winSpriteKeyByName,
		spriteKeyByNameLandscape,
		winSpriteKeyByNameLandscape,
	} from '../game/utils';
	import type { SymbolName } from '../game/types';

	const LOW_SYMBOLS_SET = new Set<SymbolName>(['T', 'J', 'Q', 'K', 'A']);

	const context = getContext();
	const board = $derived(context.stateGame.board);
	const layout = $derived(context.stateGameDerived.boardLayout());
	const isAnyReelSpinning = $derived(board.some((r) => r.reelState.motion !== 'stopped'));
	// Freeze the reel animations (wild / scatter / win-anims) while the Buy Bonus modal is open,
	// so nothing moves behind its blurred backdrop.
	const boardAnimate = $derived(!context.stateGame.buyModalOpen);
	let show = $state(true);

	// Mobile-landscape uses dedicated framed symbol art; desktop/portrait keep the standard maps.
	const isLandscape = $derived(context.stateLayoutDerived.layoutType() === 'landscape');
	const isPortrait = $derived(context.stateLayoutDerived.layoutType() === 'portrait');
	const activeMap = $derived(
		isLandscape
			? spriteKeyByNameLandscape
			: context.stateGame.bonusMode
				? bonusSpriteKeyByName
				: spriteKeyByName,
	);
	const activeWinMap = $derived(isLandscape ? winSpriteKeyByNameLandscape : winSpriteKeyByName);
	const getSpriteKey = (name: SymbolName, state?: string) => {
		if (state === 'win') return activeWinMap[name] ?? activeMap[name] ?? activeMap.A;
		return activeMap[name] ?? activeMap.A;
	};

	// Premium win-state cards play the animated "win state" frames (from the Magnific videos,
	// card border baked in — generate_win_anim.py). Ping-ponged since the clips don't loop.
	const WIN_ANIM_KEY: Partial<Record<SymbolName, string>> = {
		RABBIT: 'rabbitWinAnim',
		BEAR: 'bearWinAnim',
		FOX: 'foxWinAnim',
		WOLF: 'wolfWinAnim',
		SQUIRREL: 'squirrelWinAnim',
		T: 'tenWinAnim',
		A: 'aWinAnim',
		J: 'jWinAnim',
		K: 'kWinAnim',
		Q: 'qWinAnim',
	};
	// The card-letter win videos fade IN and OUT through black, so the first ~7 and last ~3 frames show
	// the enclosed counter of 0 / A / Q as a solid black hole (before the sparkle glow fills it). Drop
	// those edge frames so the ping-pong loop stays clean. Animal win videos are full-frame (no counter),
	// so they're left untrimmed.
	const LETTER_WIN_TRIM_START = 7;
	const LETTER_WIN_TRIM_END = 3;
	const winAnimTextures = $derived.by(() => {
		const map: Partial<Record<SymbolName, Texture[]>> = {};
		for (const [sym, key] of Object.entries(WIN_ANIM_KEY) as [SymbolName, string][]) {
			let t = (context.stateApp.loadedAssets?.[key] ?? []) as Texture[];
			if (LOW_SYMBOLS_SET.has(sym as SymbolName) && t.length > LETTER_WIN_TRIM_START + LETTER_WIN_TRIM_END + 4) {
				t = t.slice(LETTER_WIN_TRIM_START, t.length - LETTER_WIN_TRIM_END);
			}
			if (t.length) map[sym as SymbolName] = [...t, ...t.slice(1, -1).reverse()];
		}
		return map;
	});

	// The scatter shimmers with the same animated medallion used on the free-spin popups
	// (seamless 40-frame loop). Falls back to the static scatter sprite until it loads.
	const scatterFrames = $derived((context.stateApp.loadedAssets?.fsMedallionAnim ?? []) as Texture[]);
	// Animated WILD symbol (background-removed video frames; 40-frame loop). Falls back to static.
	const wildFrames = $derived((context.stateApp.loadedAssets?.wildAnim ?? []) as Texture[]);

	// Animated base-state (idle blink) animals. Each cutout is trimmed to its subject so it keeps a
	// native (non-cell) aspect — width is derived from height with the same board non-uniform-scale
	// correction used for wild/scatter. Animals without an idle sheet (bear/rabbit) fall back to the
	// static tile. All animals share the brown frame drawn behind them (animalBorder).
	const IDLE_ANIM_KEY: Partial<Record<SymbolName, string>> = {
		WOLF: 'wolfIdleAnim',
		FOX: 'foxIdleAnim',
		SQUIRREL: 'squirrelIdleAnim',
		BEAR: 'bearIdleAnim',
		RABBIT: 'rabbitIdleAnim',
	};
	const IDLE_ASPECT: Partial<Record<SymbolName, number>> = {
		WOLF: 337 / 360,
		FOX: 249 / 360,
		SQUIRREL: 282 / 360,
		BEAR: 360 / 327,
		RABBIT: 284 / 360,
	};
	const idleAnimTextures = $derived.by(() => {
		const map: Partial<Record<SymbolName, Texture[]>> = {};
		for (const [sym, key] of Object.entries(IDLE_ANIM_KEY) as [SymbolName, string][]) {
			const t = (context.stateApp.loadedAssets?.[key] ?? []) as Texture[];
			if (t.length) map[sym as SymbolName] = t;
		}
		return map;
	});
	const BORDER_SIZE = 0.8; // brown frame footprint relative to the cell — tune THIS one
	// Portrait reel cells are much taller than wide, so the frame there must be SHORTER — otherwise the
	// stacked frames overlap and the top/bottom ones get clipped. Landscape/desktop keep full height.
	const BORDER_H_MULT = $derived(isPortrait ? 1.05 : 0.90);
	// Animals sit INSIDE the frame's inner panel so the brown border stays visible on every side.
	// Idle busts are tall/narrow → fit by HEIGHT (uses the shorter portrait height); win busts are
	// full-frame/wide → fit by WIDTH. Both derive from BORDER_SIZE so the border margin is automatic.
	const INNER_FRAC = 0.83; // fraction of the frame the idle animal fills (the rest shows the border)
	// The win videos are full-frame and (for the squirrel) opaque, so they'd cover the border if they
	// filled the frame like the idle. Keep them a bit smaller so the brown frame stays visible on a win.
	const WIN_INNER_FRAC = 0.84;
	// Framed animals read a touch low (the idle blink's union bbox includes the highest ear position),
	// so lift them slightly so the top/bottom border gap is even. Reads SYMBOL_H directly (rather
	// than the symbolH derived declared further down) so declaration order stays valid — the two
	// differ only by the board-scale factor, which cancels out in this small relative nudge.
	const ANIMAL_Y_NUDGE = $derived(SYMBOL_H * BORDER_SIZE * BORDER_H_MULT * -0.05);
	const idleFit = $derived(BORDER_SIZE * BORDER_H_MULT * INNER_FRAC);
	const winFit = $derived(BORDER_SIZE * WIN_INNER_FRAC);
	// Portrait cells are narrow and the idle busts (fit by height) read too thin — widen them a touch
	// so they fill the frame better (a small deliberate stretch, only in portrait).
	const IDLE_W_STRETCH = $derived(isPortrait ? 1.18 : 1.0);
	// Winning card letters use the win-anim art, which fills its frame more than the base tile — so at
	// the same draw size a winning letter reads BIGGER than its neighbours. Trim it a little (more on
	// portrait, where cells are tighter) so a winning letter matches the surrounding symbols.
	const LOW_WIN_FIT = $derived(isPortrait ? 0.86 : 0.94);
	// Animal WIN animations (new videos): kept full-frame (no crop) so nothing is clipped.
	const WIN_ASPECT: Partial<Record<SymbolName, number>> = {
		WOLF: 1128 / 816,
		FOX: 1128 / 816,
		BEAR: 1128 / 816,
		RABBIT: 1128 / 816,
		SQUIRREL: 1108 / 832,
	};

	const getX = (reelIndex: number) => SYMBOL_W * (reelIndex + 0.5);

	// Landscape spreads the reel pitch on each axis (boardScaleX/Y) to fill the panel. Compensate
	// each symbol's width/height so it renders at the uniform boardScale size (undistorted).
	const scaleX = $derived(layout.boardScaleX ?? layout.boardScale);
	const scaleY = $derived(layout.boardScaleY ?? layout.boardScale);
	// Desktop symbols carry a lot of built-in tile padding, so enlarge them to fill the cell more
	// (reduces the gaps between symbols). Landscape/portrait keep their own tuned sizing.
	const isDesktop = $derived(context.stateLayoutDerived.layoutType() === 'desktop');
	const SIZE_BOOST = $derived(isDesktop ? 1.1 : 1);
	const symbolW = $derived(SYMBOL_W * (layout.boardScale / scaleX) * SIZE_BOOST);
	const symbolH = $derived(SYMBOL_H * (layout.boardScale / scaleY) * SIZE_BOOST);
	// Column divider width in LOCAL units, chosen so it renders ~2.5px wide after the container's
	// scaleX (the line stays thin at any board size).
	const DIVIDER_W = $derived(2.5 / scaleX);

	// Per-type visual balance: card (low) letters fill their tile much more than the framed
	// animal / wild / scatter art, so they read bigger. Shrink the low cards and nudge the
	// wild/scatter emblems up so all symbol types appear a similar size on the reels.
	const HIGH_SYMBOLS_SET = new Set<SymbolName>(['FOX', 'WOLF', 'BEAR', 'RABBIT', 'SQUIRREL']);
	const symScale = (name: SymbolName) => {
		// Portrait: draw symbols a bit larger than the cell so they fill the width/height better
		// (the mobile PNGs carry padding that otherwise leaves gaps). Same scale for every type.
		if (isPortrait) return 1.15;
		if (LOW_SYMBOLS_SET.has(name)) return 0.86;
		if (name === 'WILD' || name === 'SCATTER') return 1.1;
		// Premium animals: desktop art has built-in margin (reads small) so enlarge it; the
		// landscape art already fills its tile, so keep it at reference size there.
		if (HIGH_SYMBOLS_SET.has(name)) return isLandscape ? 1.0 : 1.18;
		return 1;
	};

	// A winning symbol keeps its win animation through BOTH the per-line 'win' state AND the
	// 'postWinStatic' state used during the total-win / SWEET WIN presentation (all lines shown at
	// once). Without postWinStatic here the symbols freeze to static art during that presentation.
	const isWinState = (state?: string) => state === 'win' || state === 'postWinStatic';

	// ── Win zoom: a small zoom in/out on the special symbols (scatter / wild) while one is in its
	//    WIN state (idle frame shimmer comes from the AnimatedSprite itself). Clock runs only then. ──
	const hasSpecialWin = $derived(
		board.some((reel) =>
			reel.reelState.symbols.some(
				(sym) =>
					(sym.rawSymbol.name === 'SCATTER' || sym.rawSymbol.name === 'WILD') &&
					isWinState(sym.symbolState),
			),
		),
	);
	let specialT = $state(0);
	$effect(() => {
		if (!hasSpecialWin) return;
		let raf = 0;
		const t0 = performance.now();
		const tick = (now: number) => {
			specialT = (now - t0) / 1000;
			raf = requestAnimationFrame(tick);
		};
		raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
	});
	const specialZoom = $derived(1 + 0.05 * Math.sin(specialT * 2.6));
	// The wild pulses more aggressively than the scatter on a win.
	const wildZoom = $derived(1 + 0.1 * Math.sin(specialT * 4.6));
	// Scatter draws a bit smaller than a full cell so the medallion + leaves sit clear of neighbours.
	const SCATTER_SIZE = 0.72;
	// The animated medallion frames are 485×443 (nearly square). Height derives from width via this
	// ratio (with the board's per-axis scale compensation) so the emblem stays round, not stretched.
	const SCATTER_ASPECT = 443 / 485;
	// WILD animated frames are 210×225 (w×h). Sized by cell HEIGHT so the near-square emblem fits the
	// cell; width derives from height at the frame's native aspect (with per-axis scale compensation).
	const WILD_ASPECT = 210 / 225; // w/h
	const WILD_SIZE = 0.78;

	// True while any symbol is in 'win' state — used to dim non-winning symbols
	const hasWinState = $derived(
		context.stateGame.board.some((reel) =>
			reel.reelState.symbols.some((s) => isWinState(s.symbolState)),
		),
	);


	// Reels whose symbols should be hidden behind the low-symbol expanded overlay.
	// Added one-by-one with a small delay so the overlay sprite starts drawing first.
	let hiddenReels = $state(new Set<number>());

	$effect(() => {
		const expanded = context.stateGame.expandedSymbol;
		// Reset when no expansion, non-low symbol, OR reels cleared for next spin
		if (!expanded || !LOW_SYMBOLS_SET.has(expanded.symbol) || expanded.reels.length === 0) {
			if (hiddenReels.size > 0) hiddenReels = new Set<number>();
			return;
		}
		const lastReel = expanded.reels[expanded.reels.length - 1];
		if (hiddenReels.has(lastReel)) return;
		const t = setTimeout(() => {
			hiddenReels = new Set([...hiddenReels, lastReel]);
		}, 80);
		return () => clearTimeout(t);
	});

	const hasActiveAnticipation = () =>
		context.stateGame.board.some((reel) => reel.reelState.anticipating);

	const stopReelsForSkip = () => {
		// Normal/autoplay skip should still resolve through the reel landing path (bounce + final
		// symbol position).  Only anticipation/noStop reels need forceStop, otherwise they keep
		// waiting and the round can feel stuck.
		if (hasActiveAnticipation()) {
			context.stateGameDerived.enhancedBoard.forceStop();
			return;
		}
		context.stateGameDerived.enhancedBoard.stop();
	};

	const requestSpinSkip = () => {
		if (context.stateGame.awaitingFirstReveal) {
			context.stateGame.pendingStop = true;
			return;
		}
		if (context.stateGame.hasAnticipationPending && !hasActiveAnticipation()) {
			context.stateGame.hasAnticipationPending = false;
			context.eventEmitter.broadcast({ type: 'skipToAnticipation' });
			return;
		}
		context.eventEmitter.broadcast({ type: 'stopButtonClick' });
	};

	context.eventEmitter.subscribeOnMount({
		stopButtonClick: () => stopReelsForSkip(),
		skipToAnticipation: () => {
			context.stateGame.board.forEach((reel) => reel.stop());
		},
		boardSettle: ({ board }) => context.stateGameDerived.enhancedBoard.settle(board),
		boardShow: () => (show = true),
		boardHide: () => (show = false),
		boardWithAnimateSymbols: async ({ symbolPositions }) => {
			for (const position of symbolPositions) {
				const reelSymbol = context.stateGame.board[position.reel].reelState.symbols[position.row];
				reelSymbol.symbolState = 'win';
			}
		},
	});

	context.stateGameDerived.enhancedBoard.readyToSpinEffect();
</script>

{#if isAnyReelSpinning}
	<OnPressFullScreen onpress={requestSpinSkip} />
{/if}

{#if show}
	<Container x={layout.x + (isDesktop ? 3 : 0)} y={layout.y + BOARD_GRID_OFFSET_Y} pivot={layout.pivot} scale={{ x: scaleX, y: scaleY }}>
		<Graphics
			isMask
			draw={(graphics) => {
				// Inset the mask a few units top & bottom so the top slivers of the buffer symbols
				// (just outside the visible rows) don't bleed in as thin lines at the grid edge.
				const inset = isDesktop ? 2 : 0;
				graphics.beginFill(0xffffff);
				graphics.rect(0, inset, SYMBOL_W * BOARD_DIMENSIONS.x, SYMBOL_H * BOARD_DIMENSIONS.y - inset * 2);
				graphics.endFill();
			}}
		/>
		<!-- Thin vertical divider lines between the reel columns (behind the symbols). -->
		{#each Array.from({ length: BOARD_DIMENSIONS.x - 1 }) as _, i (i)}
			<Sprite
				key="reelDivider"
				x={SYMBOL_W * (i + 1)}
				y={0}
				anchor={{ x: 0.5, y: 0 }}
				width={DIVIDER_W}
				height={SYMBOL_H * BOARD_DIMENSIONS.y}
				alpha={0.55}
			/>
		{/each}
		{#each board as reel, reelIndex (reelIndex)}
			{@const reelAnticipating = reel.reelState.anticipating}
			{#if !hiddenReels.has(reelIndex)}
			{#each reel.reelState.symbols as reelSymbol, symbolIndex (symbolIndex)}
				{@const y = reelSymbol.symbolY()}
				<Rectangle
					x={getX(reelIndex) - SYMBOL_W * 0.5}
					y={y - SYMBOL_H * 0.5}
					width={SYMBOL_W}
					height={SYMBOL_H}
					backgroundColor={0x000000}
					alpha={0.02}
				/>
				{@const isWin = isWinState(reelSymbol.symbolState)}
				{@const s = symScale(reelSymbol.rawSymbol.name)}
				{#if reelSymbol.rawSymbol.name === 'SCATTER' && scatterFrames.length > 0}
					<!-- Scatter shimmers with the animated medallion (same loop as the free-spin
					     popups) plus a small idle zoom in/out. Drawn a bit smaller than a cell. -->
					<AnimatedSprite
						textures={scatterFrames}
						x={getX(reelIndex)}
						y={y}
						anchor={0.5}
						width={symbolW * s * SCATTER_SIZE * (isWin ? specialZoom : 1)}
						height={symbolH * s * SCATTER_SIZE * (isWin ? specialZoom : 1) * (SYMBOL_W / SYMBOL_H) * SCATTER_ASPECT}
						animationSpeed={0.14}
						loop={true}
						play={boardAnimate}
						alpha={hasWinState && !isWin ? 0.35 : 1}
					/>
				{:else if reelSymbol.rawSymbol.name === 'WILD' && wildFrames.length > 0}
					<!-- Animated WILD: plays its loop briskly on every spin; zooms in/out on a win. -->
					<AnimatedSprite
						textures={wildFrames}
						x={getX(reelIndex)}
						y={y}
						anchor={0.5}
						height={symbolH * WILD_SIZE * 0.9 * (isWin ? wildZoom : 1)}
						width={symbolW * WILD_SIZE * (isWin ? wildZoom : 1) * (SYMBOL_H / SYMBOL_W) * WILD_ASPECT}
						animationSpeed={0.26}
						loop={true}
						play={boardAnimate}
						alpha={hasWinState && !isWin ? 0.35 : 1}
					/>
				{:else if reelSymbol.rawSymbol.name === 'SCATTER'}
					<!-- Fallback until the animation frames load: static medallion (no tilt). -->
					<Sprite
						key={getSpriteKey(reelSymbol.rawSymbol.name, reelSymbol.symbolState)}
						x={getX(reelIndex)}
						y={y}
						anchor={{ x: 0.5, y: 0.5 }}
						width={symbolW * s * SCATTER_SIZE}
						height={symbolH * s * SCATTER_SIZE}
						alpha={hasWinState && !isWin ? 0.35 : 1}
					/>
				{:else if isWin && winAnimTextures[reelSymbol.rawSymbol.name]}
					{#if HIGH_SYMBOLS_SET.has(reelSymbol.rawSymbol.name)}
						<!-- Animal win: same brown frame + the full (uncropped) win animation on top.
						     Hidden while the reel is anticipating (the brown frame clashes with the glow). -->
						{#if !reelAnticipating}
							<Sprite
								key="animalBorder"
								x={getX(reelIndex)}
								y={y}
								anchor={{ x: 0.5, y: 0.5 }}
								width={symbolW * s * BORDER_SIZE}
								height={symbolH * s * BORDER_SIZE * BORDER_H_MULT}
							/>
						{/if}
						<AnimatedSprite
							textures={winAnimTextures[reelSymbol.rawSymbol.name]}
							x={getX(reelIndex)}
							y={y}
							anchor={0.5}
							width={symbolW * s * winFit}
							height={symbolW * s * winFit * (SYMBOL_W / SYMBOL_H) / (WIN_ASPECT[reelSymbol.rawSymbol.name] ?? 1)}
							animationSpeed={0.3}
							loop={true}
							play={boardAnimate}
						/>
					{:else}
						<AnimatedSprite
							textures={winAnimTextures[reelSymbol.rawSymbol.name]}
							x={getX(reelIndex)}
							y={y}
							anchor={0.5}
							width={symbolW * s * LOW_WIN_FIT}
							height={symbolH * s * LOW_WIN_FIT}
							animationSpeed={0.25}
							loop={true}
							play={boardAnimate}
						/>
					{/if}
				{:else if HIGH_SYMBOLS_SET.has(reelSymbol.rawSymbol.name)}
					<!-- Base-state animal: shared brown frame + animated idle blink (or static tile for
					     the animals without an idle sheet yet). Frame hidden while the reel anticipates. -->
					{#if !reelAnticipating}
						<Sprite
							key="animalBorder"
							x={getX(reelIndex)}
							y={y}
							anchor={{ x: 0.5, y: 0.5 }}
							width={symbolW * s * BORDER_SIZE}
							height={symbolH * s * BORDER_SIZE * BORDER_H_MULT}
							alpha={hasWinState && !isWin ? 0.35 : 1}
						/>
					{/if}
					{#if idleAnimTextures[reelSymbol.rawSymbol.name]}
						<AnimatedSprite
							textures={idleAnimTextures[reelSymbol.rawSymbol.name]}
							x={getX(reelIndex)}
							y={y - ANIMAL_Y_NUDGE}
							anchor={0.5}
							height={symbolH * s * idleFit}
							width={symbolH * s * idleFit * (SYMBOL_H / SYMBOL_W) * (IDLE_ASPECT[reelSymbol.rawSymbol.name] ?? 1) * IDLE_W_STRETCH}
							animationSpeed={0.28 + ((reelIndex * 2 + symbolIndex) % 4) * 0.008}
							startFrame={reelIndex * 13 + symbolIndex * 7}
							loop={true}
							play={boardAnimate}
							alpha={hasWinState && !isWin ? 0.35 : 1}
						/>
					{:else}
						<Sprite
							key={getSpriteKey(reelSymbol.rawSymbol.name, reelSymbol.symbolState)}
							x={getX(reelIndex)}
							y={y}
							anchor={{ x: 0.5, y: 0.5 }}
							width={symbolW * s * idleFit}
							height={symbolH * s * idleFit}
							alpha={hasWinState && !isWin ? 0.35 : 1}
						/>
					{/if}
				{:else}
					<!-- A WINNING symbol only reaches this fallback if its win animation failed to load
					     (missing/stale-cached sheet). Show the CLEAN base tile then — never the old
					     cracked, undersized `*WinTile` art (getSpriteKey(name,'win')), which read as a
					     smaller "old win state" with an ugly size jump. Non-winning symbols keep their
					     normal state art. -->
					<Sprite
						key={getSpriteKey(reelSymbol.rawSymbol.name, isWin ? undefined : reelSymbol.symbolState)}
						x={getX(reelIndex)}
						y={y}
						anchor={{ x: 0.5, y: 0.5 }}
						width={symbolW * s}
						height={symbolH * s}
						alpha={hasWinState && !isWin ? 0.35 : 1}
					/>
				{/if}
			{/each}
			{/if}
		{/each}
	</Container>
{/if}
