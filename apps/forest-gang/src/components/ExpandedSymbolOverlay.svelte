<script lang="ts">
	import { Tween } from 'svelte/motion';
	import { MainContainer } from 'components-layout';
	import { AnimatedSprite, Container, Graphics, Sprite } from 'pixi-svelte';
	import { cubicOut } from 'svelte/easing';
	import type { Texture } from 'pixi.js';

	import { getContext } from '../game/context';
	import { SYMBOL_H, SYMBOL_W, BOARD_DIMENSIONS, BOARD_GRID_OFFSET_Y } from '../game/constants';
	import { getReelCenterX, winSpriteKeyByName } from '../game/utils';
	import type { SymbolName } from '../game/types';

	const EXPANDED_ASSET: Partial<Record<SymbolName, string>> = {
		FOX:      'foxExpTile',
		WOLF:     'wolfExpTile',
		BEAR:     'bearExpTile',
		RABBIT:   'rabbitExpTile',
		SQUIRREL: 'squirrelExpTile',
	};

	const context = getContext();
	const expanded = $derived(context.stateGame.expandedSymbol);
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

	// Low (card) symbols now expand with their WIN animation too — the same gold-sparkle sheets the
	// reels use — instead of the old static cracked win tile. Ping-ponged (clips don't loop).
	const LOW_WIN_ANIM_KEY: Partial<Record<SymbolName, string>> = {
		T: 'tenWinAnim',
		A: 'aWinAnim',
		J: 'jWinAnim',
		K: 'kWinAnim',
		Q: 'qWinAnim',
	};
	const lowAnimFrames = $derived.by(() => {
		const animKey = expanded && LOW_SYMBOLS.has(expanded.symbol) ? LOW_WIN_ANIM_KEY[expanded.symbol] : undefined;
		if (!animKey) return [];
		const t = (context.stateApp.loadedAssets?.[animKey] ?? []) as Texture[];
		return t.length ? [...t, ...t.slice(1, -1).reverse()] : [];
	});

	type ReelAnim = { h: Tween<number>; y: Tween<number>; pop: Tween<number>; looping: boolean };
	const reelAnims: Record<number, ReelAnim> = {};
	const revealedReels = new Set<number>();

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

	$effect(() => {
		if (!expanded) return;
		const lastReel = expanded.reels[expanded.reels.length - 1];
		if (lastReel === undefined) return;
		if (revealedReels.has(lastReel)) return;
		revealedReels.add(lastReel);

		const reelPos = expanded.positions.filter((p) => p.reel === lastReel);
		const originRow = reelPos.length > 0 ? reelPos[0].row : 2;
		const originY = (originRow + 0.5) * SYMBOL_H;

		const anim = getAnim(lastReel, originY);

		anim.h.set(SYMBOL_H, { duration: 0 });
		anim.y.set(originY, { duration: 0 });
		anim.pop.set(1, { duration: 0 });
		anim.looping = false;

		anim.h.set(colHeight, { duration: 460, easing: cubicOut });
		anim.y.set(halfH, { duration: 460, easing: cubicOut });

		anim.pop.set(1.08, { duration: 0 });
		setTimeout(() => anim.pop.set(1, { duration: 220, easing: (t) => 1 - (1 - t) ** 3 }), 460);
	});
</script>

{#if expanded}
	{@const assetKey = EXPANDED_ASSET[expanded.symbol] ?? 'foxExpTile'}
	{@const isLowExpanded = LOW_SYMBOLS.has(expanded.symbol)}
	{@const lowAssetKey = winSpriteKeyByName[expanded.symbol] ?? 'aWinTile'}
	<MainContainer>
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
					<Container x={leftX} y={0} scale={{ x: px, y: 1 }}>
						<Graphics
							isMask
							draw={(graphics) => {
								graphics.clear();
								graphics.beginFill(0xffffff);
								graphics.rect(0, cy - h * 0.5, SYMBOL_W, h);
								graphics.endFill();
							}}
						/>
						{#each Array.from({ length: BOARD_DIMENSIONS.y }, (_, rowIndex) => rowIndex) as rowIndex (rowIndex)}
							{#if lowAnimFrames.length > 0}
								<AnimatedSprite
									textures={lowAnimFrames}
									x={SYMBOL_W * 0.5}
									y={(rowIndex + 0.5) * SYMBOL_H}
									anchor={0.5}
									width={tileW}
									height={SYMBOL_H}
									animationSpeed={0.25}
									loop={true}
									play={true}
								/>
							{:else}
								<Sprite
									key={lowAssetKey}
									x={SYMBOL_W * 0.5}
									y={(rowIndex + 0.5) * SYMBOL_H}
									anchor={0.5}
									width={tileW}
									height={SYMBOL_H}
								/>
							{/if}
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
			{/each}
		</Container>
	</MainContainer>
{/if}
