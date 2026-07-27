<script lang="ts">
	import { onDestroy } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { MainContainer } from 'components-layout';
	import { AnimatedSprite, Container, Graphics, Sprite } from 'pixi-svelte';
	import { cubicOut } from 'svelte/easing';
	import type { Texture } from 'pixi-svelte';

	import { getContext } from '../game/context';
	import { SYMBOL_H, SYMBOL_W, BOARD_DIMENSIONS, BOARD_GRID_OFFSET_Y } from '../game/constants';
	import { getReelCenterX } from '../game/utils';
	import type { SymbolName } from '../game/types';

	const EXPANDED_ASSET: Partial<Record<SymbolName, string>> = {
		FOX:      'foxExpTile',
		WOLF:     'wolfExpTile',
		BEAR:     'bearExpTile',
		RABBIT:   'rabbitExpTile',
		SQUIRREL: 'squirrelExpTile',
	};

	const context = getContext();
	// LOW (card) expands drop out once the reveal has settled — from then on Board draws those
	// columns as normal win symbols (see `expandedSwap` there), so the overlay must stop or the two
	// would double-draw. ANIMAL expands STAY UP for the whole round: the big animated animal filling
	// the column IS the presentation, and handing it back to the reels replaced that hero art with
	// four separate symbols the moment the reveal finished.
	const expanded = $derived.by(() => {
		const current = context.stateGame.expandedSymbol;
		if (!current) return null;
		if (context.stateGame.expandedSettled && LOW_SYMBOLS.has(current.symbol)) return null;
		return current;
	});
	const bl = $derived(context.stateGameDerived.boardLayout());

	const LOW_SYMBOLS = new Set<SymbolName>(['T', 'J', 'Q', 'K', 'A']);
	const HIGH_SYMBOLS = new Set<SymbolName>(['FOX', 'WOLF', 'BEAR', 'RABBIT', 'SQUIRREL']);

	// The reel uses per-axis scaling (boardScaleX/Y); match it so the overlay aligns with the board.
	const isDesktop = $derived(context.stateLayoutDerived.layoutType() === 'desktop');
	const isLandscape = $derived(context.stateLayoutDerived.layoutType() === 'landscape');
	const scaleX = $derived(bl.boardScaleX ?? bl.boardScale);
	const scaleY = $derived(bl.boardScaleY ?? bl.boardScale);

	// Replicate Board.svelte's exact rendered symbol WIDTH so the expanded glow is the same width as
	// the reel symbols (not the full cell). symScale + SIZE_BOOST mirror Board.svelte.
	const symScale = (name: SymbolName | null) => {
		if (!name) return 1;
		if (LOW_SYMBOLS.has(name)) return 0.86;
		if (name === 'WILD' || name === 'SCATTER') return 1.1;
		if (HIGH_SYMBOLS.has(name)) return isLandscape ? 1.0 : 1.18;
		return 1;
	};
	const SIZE_BOOST = $derived(isDesktop ? 1.1 : 1);
	const tileW = $derived(
		SYMBOL_W * (bl.boardScale / scaleX) * SIZE_BOOST * symScale(expanded?.symbol ?? null),
	);

	const colHeight = SYMBOL_H * BOARD_DIMENSIONS.y;
	const halfH = colHeight * 0.5;

	// Wood frame around an expanding animal column. Deliberately still redrawn while `h` tweens:
	// it is a 3px STROKE, and a y-scale would squash the horizontal edges to 3 × h/colHeight px
	// (100/409 → 0.73px at the start of the 460 ms expansion) while leaving the verticals at 3px,
	// and would turn the 6px corner radius elliptical. Only the invariants are hoisted; the redraw
	// ends with the tween, so there is no steady-state per-frame cost.
	const FRAME_W = SYMBOL_W * 0.99;
	const FRAME_STROKE = { width: 3, color: 0x92673a, alpha: 1 };

	// Animated expanded animals (frames from the "win state" videos, tile border baked in —
	// see generate_expand_anim.py). The clips don't loop, so they play as a ping-pong
	// (forward → reverse) for a seamless idle.
	const EXPAND_ANIM_KEY: Partial<Record<SymbolName, string>> = {
		RABBIT: 'rabbitMoney',
		BEAR: 'bearMoney',
		FOX: 'foxMoney',
		WOLF: 'wolfMoney',
		SQUIRREL: 'squirrelMoney',
	};
	const animFrames = $derived.by(() => {
		const animKey = expanded ? EXPAND_ANIM_KEY[expanded.symbol] : undefined;
		if (!animKey) return [];
		const t = (context.stateApp.loadedAssets?.[animKey] ?? []) as Texture[];
		return t.length ? [...t, ...t.slice(1, -1).reverse()] : [];
	});

	// Low (card) expands show the CLEAN base tile with a continuous ±10% pulse (matching the reel
	// letter win) instead of the old win-animation sheet.
	const LOW_EXP_TILE: Partial<Record<SymbolName, string>> = {
		A: 'aExpTile',
		K: 'kExpTile',
		Q: 'qExpTile',
		J: 'jExpTile',
		T: 'tExpTile',
	};
	let expPulseT = $state(0);
	$effect(() => {
		if (!expanded) return;
		let raf = 0;
		const t0 = performance.now();
		const tick = (now: number) => {
			expPulseT = (now - t0) / 1000;
			raf = requestAnimationFrame(tick);
		};
		raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
	});
	const lowPulse = $derived(1 + 0.1 * (0.5 - 0.5 * Math.cos(expPulseT * 7.2)));

	type ReelAnim = { h: Tween<number>; y: Tween<number>; pop: Tween<number>; looping: boolean };
	const reelAnims: Record<number, ReelAnim> = {};
	const revealedReels = new Set<number>();
	const popTimers = new Set<ReturnType<typeof setTimeout>>();
	onDestroy(() => popTimers.forEach(clearTimeout));

	const getAnim = (reelIndex: number, originY: number): ReelAnim => {
		if (!reelAnims[reelIndex]) {
			reelAnims[reelIndex] = {
				h: new Tween(SYMBOL_H),
				y: new Tween(originY),
				pop: new Tween(1),
				looping: false,
			};
		}
		return reelAnims[reelIndex];
	};

	$effect(() => {
		if (!expanded || expanded.reels.length === 0) {
			revealedReels.clear();
			Object.keys(reelAnims).forEach((k) => delete reelAnims[+k]);
		}
	});

	// Every reel that has not started revealing yet, not just the newest one. A stop press (and
	// super-turbo) assigns all remaining columns in ONE update, so keying this on the last reel left
	// the columns in between with a freshly-created anim that nothing ever tweened — they sat frozen
	// at a single row.
	$effect(() => {
		if (!expanded) return;
		for (const reel of expanded.reels) {
			if (revealedReels.has(reel)) continue;
			revealedReels.add(reel);

			const reelPos = expanded.positions.filter((p) => p.reel === reel);
			const originRow = reelPos.length > 0 ? reelPos[0].row : 2;
			const originY = (originRow + 0.5) * SYMBOL_H;

			const anim = getAnim(reel, originY);

			anim.h.set(SYMBOL_H, { duration: 0 });
			anim.y.set(originY, { duration: 0 });
			anim.pop.set(1, { duration: 0 });
			anim.looping = false;

			anim.h.set(colHeight, { duration: 460, easing: cubicOut });
			anim.y.set(halfH, { duration: 460, easing: cubicOut });

			anim.pop.set(1.08, { duration: 0 });
			// NOT cleared when this effect re-runs — a later reel's reveal must not cancel an earlier
			// reel's settle. Only unmount clears them (see popTimers / onDestroy).
			const popTimer = setTimeout(() => {
				popTimers.delete(popTimer);
				anim.pop.set(1, { duration: 220, easing: (t) => 1 - (1 - t) ** 3 });
			}, 460);
			popTimers.add(popTimer);
		}
	});

	// ── Coverage: which ROWS of each reel the overlay currently paints over ──────────────────────
	//
	// Published to shared state so Board can hide exactly those cells. Board used to hide the WHOLE
	// reel on an 80ms timer, which produced both artefacts this replaces: for those 80ms the reel's
	// own symbol drew under the half-transparent expanded tile (a `Q` and a `10` merged into one
	// garbled glyph), and afterwards every row the reveal had not reached yet was bare wood.
	const isLowExpanded = $derived(!!expanded && LOW_SYMBOLS.has(expanded.symbol));
	const coverage = $derived.by(() => {
		const out: Record<number, [number, number]> = {};
		if (!expanded || expanded.reels.length === 0) return out;
		const rows = BOARD_DIMENSIONS.y;
		for (const reel of expanded.reels) {
			const anim = reelAnims[reel];
			if (!anim) {
				// The anim is created by the effect above, which runs AFTER this render. Until then a
				// freshly added reel covers just its origin cell — the same place its tween starts —
				// so the column never flashes fully hidden on the frame it appears.
				const pos = expanded.positions.find((p) => p.reel === reel);
				const originRow = pos ? pos.row : Math.floor(rows / 2);
				out[reel] = [Math.max(0, originRow), Math.min(rows, originRow + 1)];
				continue;
			}
			const top = (anim.y.current - anim.h.current / 2) / SYMBOL_H;
			const bottom = (anim.y.current + anim.h.current / 2) / SYMBOL_H;
			// Low expands quantise their mask to whole rows (see the markup), so match it exactly.
			// Animal expands stretch ONE opaque sprite, so round INWARD instead — never claim a row
			// the sprite only half covers, or that half row would be blanked out behind it.
			const first = isLowExpanded ? Math.round(top) : Math.ceil(top - 1e-6);
			const end = isLowExpanded ? Math.round(bottom) : Math.floor(bottom + 1e-6);
			out[reel] = [Math.max(0, first), Math.min(rows, Math.max(first + 1, end))];
		}
		return out;
	});
	$effect(() => {
		context.stateGame.expandedCoverage = coverage;
	});
</script>

<!-- The MainContainer is mounted UNCONDITIONALLY and the `{#if}` lives inside it. A pixi container
     created lazily is APPENDED to the end of the stage's child list, so a top-level container that
     only exists while a symbol is expanded draws above everything mounted before it — including the
     big-win panel, which is why expanded letters showed on top of the SWEET WIN board. Keeping the
     container mounted pins this layer at its template position in the display list. -->
<MainContainer>
	{#if expanded}
		{@const assetKey = EXPANDED_ASSET[expanded.symbol] ?? 'foxExpTile'}
		{@const isLowExpanded = LOW_SYMBOLS.has(expanded.symbol)}
		<Container
			x={bl.x}
			y={bl.y + BOARD_GRID_OFFSET_Y}
			pivot={bl.pivot}
			scale={{ x: bl.boardScaleX ?? bl.boardScale, y: bl.boardScaleY ?? bl.boardScale }}
		>
			{#each expanded.reels as reelIndex (reelIndex)}
				{@const cx = getReelCenterX(reelIndex)}
				{@const leftX = cx - SYMBOL_W * 0.5}
				{@const anim = getAnim(reelIndex, halfH)}
				{@const h = anim.h.current}
				{@const cy = anim.y.current}
				{@const px = anim.pop.current}
				{#if isLowExpanded}
					<!-- The reveal window is SNAPPED TO WHOLE ROWS. The column's content is a stack of
					     discrete card tiles, so a continuous wipe cut in half whichever tiles straddled the
					     window's edges — the sliced "10"s. Rounding the window to row boundaries means a
					     tile is always either fully revealed or not yet revealed, never sliced, and the
					     column grows as a cascade of whole cards. The tween itself is unchanged; only the
					     mask reads a quantised version of it — read straight off `coverage` so the rows the
					     mask reveals and the rows Board hides can never disagree. -->
					{@const window = coverage[reelIndex] ?? [0, BOARD_DIMENSIONS.y]}
					{@const topRow = window[0]}
					{@const rowsShown = Math.max(1, window[1] - window[0])}
					<Container x={leftX} y={0} scale={{ x: px, y: 1 }}>
						<!-- Mask rect drawn ONCE at ONE row's height; the reveal is a transform on the
						     Graphics (y = the top row's edge, y-scale = how many rows are shown) rather than
						     a re-tessellated rect every frame. A filled rect survives non-uniform scale
						     exactly, so the masked region is [topRow, topRow + rowsShown] × [0, SYMBOL_W]. -->
						<Graphics
							isMask
							y={topRow * SYMBOL_H}
							scale={{ x: 1, y: rowsShown }}
							draw={(graphics) => graphics.rect(0, 0, SYMBOL_W, SYMBOL_H).fill(0xffffff)}
						/>
						{@const lowTileKey = LOW_EXP_TILE[expanded.symbol] ?? 'aExpTile'}
						{#each Array.from({ length: BOARD_DIMENSIONS.y }, (_, rowIndex) => rowIndex) as rowIndex (rowIndex)}
							<Sprite
								key={lowTileKey}
								x={SYMBOL_W * 0.5}
								y={(rowIndex + 0.5) * SYMBOL_H}
								anchor={0.5}
								width={tileW * lowPulse}
								height={SYMBOL_H * lowPulse}
							/>
						{/each}
					</Container>
				{:else}
					<Container x={cx} y={cy} scale={{ x: px, y: 1 }}>
						<!-- Premium expanded animal fills the whole reel (cell width), not the symbol width. -->
						{#if animFrames.length > 0}
							<AnimatedSprite
								textures={animFrames}
								anchor={0.5}
								width={SYMBOL_W}
								height={h}
								animationSpeed={0.25}
								loop={true}
								play={true}
							/>
						{:else}
							<Sprite anchor={0.5} key={assetKey} width={SYMBOL_W} height={h} />
						{/if}
					</Container>
				{/if}
				<!-- Thin wood frame (same brown as the animal borders) around the expanded reel column,
				     grows with the expansion. ONLY for expanding ANIMALS — low (card) expands get none. -->
				{#if !isLowExpanded}
					<Graphics
						x={cx}
						y={cy}
						scale={{ x: px, y: 1 }}
						draw={(g) => {
							const hh = Math.max(0, h - 3);
							const r = Math.min(FRAME_W, hh) * 0.05;
							g.roundRect(-FRAME_W / 2, -hh / 2, FRAME_W, hh, r);
							g.stroke(FRAME_STROKE);
						}}
					/>
				{/if}
			{/each}
		</Container>
	{/if}
</MainContainer>
