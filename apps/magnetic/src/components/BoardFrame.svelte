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

	// board_pad.webp is the Version2 holo panel (same art as the splash feature panels). Its flat
	// navy interior measures 0.9245w x 0.9033h of the trimmed file (measured by center-line color
	// run) — the rest is the thin metal frame plus a wide baked glow. In the Figma base screen the
	// metal edge HUGS the grid (~0.2 cell margin), so size the sprite so the interior comes out at
	// grid x INTERIOR_MARGIN. Getting this wrong by trusting the design's 762x615 frame BOX (which
	// includes the glow) inflated the navy margins to a full cell per side.
	const ART_INNER_W = 0.9245;
	const ART_INNER_H = 0.9033;
	// 1.06 → 1.01 (user round vs the design edge crop): the design's outer pads sit almost flush
	// against the bezel (~3–6px at 158px pitch), while 1.06 left ~0.21 cell of navy per side.
	// 1.01 keeps just a hair of clearance for the interior's rounded corners.
	const INTERIOR_MARGIN = 1.01;
	const frameW = $derived((board.width * board.boardScale * INTERIOR_MARGIN) / ART_INNER_W);
	const frameH = $derived((board.height * board.boardScale * INTERIOR_MARGIN) / ART_INNER_H);
</script>

<Sprite
	key={frameKey}
	anchor={0.5}
	x={board.x}
	y={board.y}
	width={frameW}
	height={frameH}
/>
