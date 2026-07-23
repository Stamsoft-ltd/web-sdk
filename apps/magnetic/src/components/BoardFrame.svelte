<script lang="ts">
	import { Sprite } from 'pixi-svelte';

	import { getContext } from '../game/context';

	const context = getContext();
	const board = $derived(context.stateGameDerived.boardLayout());
	// Portrait / landscape use their own mobile board panels; all frames are thin borders hugging the grid.
	const layoutType = $derived(context.stateLayoutDerived.layoutType());
	const frameKey = $derived(
		layoutType === 'portrait' ? 'boardPadMobile' : layoutType === 'landscape' ? 'boardPadLand' : 'boardPad',
	);

	// board_pad.webp (2492×2056) is a thin blue-tech HUD frame: glowing border + corner brackets
	// around a dark interior. The interior (where the grid sits) is ≈93% of the image (border ~3.5%
	// per side). Fit width + height independently to the grid so the border stays a thin, even margin
	// around the 7×7 cells, centred on the grid centre (layout.x / layout.y).
	const INNER_FRAC = 0.95;
	const MARGIN = 1.0; // grid fills the interior — border hugs the cells (minimal padding)
	const frameW = $derived((board.width * board.boardScale * MARGIN) / INNER_FRAC);
	const frameH = $derived((board.height * board.boardScale * MARGIN) / INNER_FRAC);
</script>

<Sprite
	key={frameKey}
	anchor={0.5}
	x={board.x}
	y={board.y}
	width={frameW}
	height={frameH}
/>
