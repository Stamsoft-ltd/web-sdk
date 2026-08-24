<script lang="ts">
	import { BaseSprite, Graphics, PIXI, getContextApp } from 'pixi-svelte';
	// PIXI is exported as a value, not a namespace, so it cannot be used in a type position — the
	// texture type comes from pixi-svelte's own re-export instead (never from a direct pixi.js dep).
	import type { Texture } from 'pixi-svelte';

	import {
		BOARD_DIMENSIONS,
		BOARD_SIDE_CONTENT_INSET,
		BOARD_SIZES,
		CELL_W,
		CELL_H,
		COASTER_SETUP_SCRIM,
		COASTER_WILD_GRID_INSET,
	} from '../game/constants';

	type Props = { reel?: number; row?: number; underScrim?: boolean };
	const props: Props = $props();

	// Edge reel centres move inward by half the shared side reserve. Match that here so this local
	// fill still ends exactly at the wider board-content edge during the setup overlay.
	const EDGE_LOCAL_INSET = BOARD_SIDE_CONTENT_INSET * 0.5;
	const leftInset = $derived(
		props.reel === 0 ? EDGE_LOCAL_INSET : COASTER_WILD_GRID_INSET,
	);
	const rightInset = $derived(
		props.reel === BOARD_DIMENSIONS.x - 1 ? EDGE_LOCAL_INSET : COASTER_WILD_GRID_INSET,
	);
	const cellLeft = $derived(-CELL_W * 0.5 + leftInset);
	const cellTop = -CELL_H * 0.5 + COASTER_WILD_GRID_INSET;
	const cellWidth = $derived(CELL_W - leftInset - rightInset);
	const cellHeight = CELL_H - COASTER_WILD_GRID_INSET * 2;

	const context = getContextApp();
	const gridTexture = $derived(context.stateApp.loadedAssets?.themeBoardGrid as Texture | undefined);

	/**
	 * This cell, cut out of the board's own grid art.
	 *
	 * The cover used to be a flat near-black rectangle, which read as a black box: the field is a
	 * radial gradient running from about #1a0238 at the corners to #3c016e in the middle, so no one
	 * colour can sit in twenty-five different cells. Cutting a texture frame rather than masking a
	 * full-board sprite keeps this to one sprite per Wild and no stencil.
	 *
	 * <BoardFrame> stretches that art onto the gameplay rect, so grid pixels and board units are the
	 * same thing scaled — the only difference left is the vignette <BoardFrame> strokes over the top,
	 * which is worth about 5% at a cell centre and nothing like the gap this closes.
	 */
	const cellTexture = $derived.by(() => {
		if (!gridTexture || gridTexture === PIXI.Texture.EMPTY) return null;
		const { x, y, width, height } = gridTexture.frame;
		const perUnitX = width / BOARD_SIZES.width;
		const perUnitY = height / BOARD_SIZES.height;
		return new PIXI.Texture({
			source: gridTexture.source,
			frame: new PIXI.Rectangle(
				x + (CELL_W * (props.reel ?? 0) + leftInset) * perUnitX,
				y + (CELL_H * (props.row ?? 0) + COASTER_WILD_GRID_INSET) * perUnitY,
				cellWidth * perUnitX,
				cellHeight * perUnitY,
			),
		});
	});
</script>

<!-- Opaque cell fill hides the reel symbols scrolling behind a persistent Wild. Every edge stays
     inset so adjacent Wilds never cover the one grid painted into BoardFrame or spill through the
     board's side border. The flat rect stays underneath as the floor for the one frame before the
     board art has loaded — never let the reel show through here. -->
<Graphics
	draw={(graphics) => {
		graphics.rect(cellLeft, cellTop, cellWidth, cellHeight);
		graphics.fill({ color: 0x15002f, alpha: 1 });
	}}
/>
{#if cellTexture}
	<BaseSprite
		texture={cellTexture}
		anchor={{ x: 0, y: 0 }}
		x={cellLeft}
		y={cellTop}
		width={cellWidth}
		height={cellHeight}
	/>
{/if}
{#if props.underScrim}
	<!-- Setup draws these tiles above its screen-wide dim, so the cut of board art has to take the
	     same dim the board around it is taking. Without this every stamped cell is a lit hole. -->
	<Graphics
		draw={(graphics) => {
			graphics.rect(cellLeft, cellTop, cellWidth, cellHeight);
			graphics.fill({ color: COASTER_SETUP_SCRIM.color, alpha: COASTER_SETUP_SCRIM.alpha });
		}}
	/>
{/if}
