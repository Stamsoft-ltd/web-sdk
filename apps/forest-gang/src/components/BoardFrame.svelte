<script lang="ts">
	import { Sprite } from 'pixi-svelte';

	import { getContext } from '../game/context';
	import { BOARD_GRID_OFFSET_Y } from '../game/constants';

	const context = getContext();
	const board = $derived(context.stateGameDerived.boardLayout());
	const isPortrait = $derived(context.stateLayoutDerived.layoutType() === 'portrait');
	const isLandscape = $derived(context.stateLayoutDerived.layoutType() === 'landscape');

	// --- Desktop: new-design rounded log frame (board_frame_desktop.webp, 2048×1276) ---
	// Measured interior (dark wood panel) as fractions of the image: x 0.034..0.961,
	// y 0.040..0.947 (multi-column scan — the top rail dips to 0.043 at the centre vine).
	// The frame is sized so that interior box = reel grid + a tiny margin (~1px), and
	// anchored so the interior's centre sits on the grid centre.
	const INNER_X0 = 0.034;
	const INNER_X1 = 0.961;
	const INNER_Y0 = 0.04;
	const INNER_Y1 = 0.947;
	const INNER_CX = (INNER_X0 + INNER_X1) / 2;
	const INNER_CY = (INNER_Y0 + INNER_Y1) / 2;
	const MARGIN_W = 1.004;
	// Grid wrap tightness. stateGame positions the GRID with 1.004 (its bottom gap is tuned).
	// The frame sprite draws ~0.002 LOOSER and the drop formula below keeps the bottom rail
	// anchored, so the extra wrap lands entirely on the TOP rail gap (~+2px of space there).
	const MARGIN_H_GRID = 1.004;
	const MARGIN_H = 1.006;

	// Use the ACTUAL grid pixel span: desktop spreads reel pitch via boardScaleX/boardScaleY,
	// so sizing from the uniform boardScale would leave the frame narrower than the reels.
	const frameW = $derived(
		(board.width * (board.boardScaleX ?? board.boardScale) * MARGIN_W) / (INNER_X1 - INNER_X0),
	);
	const frameH = $derived(
		(board.height * (board.boardScaleY ?? board.boardScale) * MARGIN_H) / (INNER_Y1 - INNER_Y0),
	);
	// Half the frameH delta between the grid margin and the sprite margin — keeps the bottom
	// rail anchored while the tighter sprite trims the top rail gap.
	const FRAME_Y_DROP = $derived(
		((board.height * (board.boardScaleY ?? board.boardScale) * (MARGIN_H_GRID - MARGIN_H)) /
			(INNER_Y1 - INNER_Y0)) *
			(1 - INNER_CY),
	);

	// --- Mobile landscape: rope-hung reel_frame, sized/placed by boardLayout() (frame-driven).
	const lsFrameW = $derived(board.frameW ?? board.width * board.boardScale);
	const lsFrameH = $derived(board.frameH ?? board.height * board.boardScale);
	const lsCx = $derived(board.frameCx ?? board.x);
	const lsCy = $derived(board.frameCy ?? board.y + BOARD_GRID_OFFSET_Y);
</script>

{#if isLandscape}
	<!-- New-design rounded log frame (same art as desktop, Figma 3451-2143) wrapped around the
	     landscape grid with the desktop interior-fraction math — replaces the old rope-hung frame. -->
	<Sprite
		key="boardFrameDesktop"
		anchor={{ x: INNER_CX, y: INNER_CY }}
		x={board.x}
		y={board.y + BOARD_GRID_OFFSET_Y + FRAME_Y_DROP}
		width={frameW}
		height={frameH}
	/>
{:else if isPortrait}
	<!-- Portrait now uses the same rounded log frame as desktop/landscape (design ask), wrapped
	     around the portrait grid with the desktop interior-fraction math (boardScaleX/Y fall back
	     to the uniform portrait boardScale). Replaces the old flat board_frame_mobile pad. -->
	<Sprite
		key="boardFrameDesktop"
		anchor={{ x: INNER_CX, y: INNER_CY }}
		x={board.x}
		y={board.y + BOARD_GRID_OFFSET_Y + FRAME_Y_DROP}
		width={frameW}
		height={frameH}
	/>
{:else}
	<Sprite
		key="boardFrameDesktop"
		anchor={{ x: INNER_CX, y: INNER_CY }}
		x={board.x}
		y={board.y + BOARD_GRID_OFFSET_Y + FRAME_Y_DROP}
		width={frameW}
		height={frameH}
	/>
{/if}
