<script lang="ts">
	import { BaseSprite, Graphics, PIXI, getContextApp } from 'pixi-svelte';
	// PIXI is exported as a value, not a namespace, so it cannot be used in a type position — the
	// texture type comes from pixi-svelte's own re-export instead (never from a direct pixi.js dep).
	import type { Texture } from 'pixi-svelte';

	import { BOARD_SIZES, CELL_W, CELL_H, COASTER_SETUP_SCRIM } from '../game/constants';
	import { getCoasterWildRect, type CoasterCellKey } from '../game/coasterWildCells';

	type Props = {
		reel?: number;
		row?: number;
		/** True while <CoasterSetupPresenter> owns this tile, i.e. it is drawn above the setup dim. */
		underScrim?: boolean;
		/** Every cell currently carrying a Wild, so shared edges close instead of leaving a slot. */
		occupied?: ReadonlySet<CoasterCellKey>;
	};
	const props: Props = $props();

	const EMPTY_CELLS: ReadonlySet<CoasterCellKey> = new Set<CoasterCellKey>();
	const reel = $derived(props.reel ?? 0);
	const row = $derived(props.row ?? 0);
	// Board-unit rect shared with the layer's clip mask, so cover and mask always agree.
	const rect = $derived(getCoasterWildRect(reel, row, props.occupied ?? EMPTY_CELLS));
	// This tile draws at its cell centre, so the shared rect has to come back to local units.
	const cellLeft = $derived(rect.x - CELL_W * (reel + 0.5));
	const cellTop = $derived(rect.y - CELL_H * (row + 0.5));

	/**
	 * EXPERIMENT, asked for on 2026-08-31: the Wild's cell cover, OFF, so the splat sits straight on
	 * the board and we can see what an animated Wild would look like there.
	 *
	 * Everything below it stays exactly as it was — flip this back to `true` and the cover returns.
	 * It is a switch rather than a deletion because the cover is not decoration: a Wild persists
	 * across spins, and with nothing under it the reels scroll THROUGH the gaps in the splat. That is
	 * the thing to look for while this is off.
	 */
	const COVER_CELL = false;

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
				x + rect.x * perUnitX,
				y + rect.y * perUnitY,
				rect.width * perUnitX,
				rect.height * perUnitY,
			),
		});
	});
</script>

<!-- Opaque cell fill hides the reel symbols scrolling behind a persistent Wild. Free edges stay
     inset so a Wild never covers the one grid painted into BoardFrame or spills through the board's
     side border, while an edge shared with the next Wild closes flush against it. The flat rect
     stays underneath as the floor for the one frame before the board art has loaded — never let the
     reel show through here. -->
{#if COVER_CELL}
	<Graphics
		draw={(graphics) => {
			graphics.rect(cellLeft, cellTop, rect.width, rect.height);
			graphics.fill({ color: 0x15002f, alpha: 1 });
		}}
	/>
	{#if cellTexture}
		<BaseSprite
			texture={cellTexture}
			anchor={{ x: 0, y: 0 }}
			x={cellLeft}
			y={cellTop}
			width={rect.width}
			height={rect.height}
		/>
	{/if}
{/if}
<!-- Only over a cover of our own: with the cell open, what shows through is the board itself, which
     has already taken the dim. -->
{#if props.underScrim && COVER_CELL}
	<!-- Setup draws these tiles above its screen-wide dim, so the cut of board art has to take the
	     same dim the board around it is taking. Without this every stamped cell is a lit hole. -->
	<Graphics
		draw={(graphics) => {
			graphics.rect(cellLeft, cellTop, rect.width, rect.height);
			graphics.fill({ color: COASTER_SETUP_SCRIM.color, alpha: COASTER_SETUP_SCRIM.alpha });
		}}
	/>
{/if}
