<script lang="ts">
	import { Sprite } from 'pixi-svelte';

	import { getContext } from '../game/context';
	import { BOARD_GRID_OFFSET_Y } from '../game/constants';

	const context = getContext();
	const board = $derived(context.stateGameDerived.boardLayout());
	const isPortrait = $derived(context.stateLayoutDerived.layoutType() === 'portrait');
	const isLandscape = $derived(context.stateLayoutDerived.layoutType() === 'landscape');

	// Mobile board frame (board_frame_mobile.png) — full-width panel, top/bottom borders
	// only. Drawn centred on the grid, stretched so the reels fill its inner window.
	// Fractions mirror stateGame.svelte.ts MOBILE_FRAME_INNER_*.
	const MOBILE_INNER_W = 0.965;
	const MOBILE_INNER_H = 0.78;
	// +1% width: the exact-fit frame left a ~1px sliver of bright background visible at the left/right
	// screen edges (subpixel rounding of the board scale) — slight overscan guarantees full bleed.
	const mFrameW = $derived(((board.width * board.boardScale) / MOBILE_INNER_W) * 1.01);
	const mFrameH = $derived((board.height * board.boardScale) / MOBILE_INNER_H);

	// --- Desktop / portrait: rope-framed slot_pad (top-anchored) ---
	// slot_pad.png is 3220×2364. Geometry of the inner brown panel (where the reels
	// sit): inner panel ≈ 76% of image width, centred at ~(0.52, 0.50). We scale the
	// frame so the inner panel ≈ board grid + margin, then anchor it over the grid.
	const FRAME_ASPECT = 3220 / 2364;
	const INNER_W_FRAC = 0.762;
	const ANCHOR_X = 0.505; // = slot_pad window centre x (grid centred horizontally)
	const MARGIN = 1.04;
	const FRAME_EXTRA_SCALE = 1.30 / 1.15;
	// Draw the frame slightly narrower (height unchanged) so the bamboo poles sit
	// closer to the reels — reduces the left/right margin without touching top/bottom.
	const H_SQUASH = 0.93;
	// Shorten the frame vertically (top stays pinned at y=0) so its bottom border rises and
	// leaves a forest gap above the bet bar, matching the Figma.
	const V_SQUASH = 0.94;

	const frameH = $derived((board.width * board.boardScale * MARGIN * FRAME_EXTRA_SCALE) / INNER_W_FRAC / FRAME_ASPECT * V_SQUASH);
	const frameW = $derived(((board.width * board.boardScale * MARGIN * FRAME_EXTRA_SCALE) / INNER_W_FRAC) * H_SQUASH);

	// --- Mobile landscape: rope-hung reel_frame, sized/placed by boardLayout() (frame-driven).
	const lsFrameW = $derived(board.frameW ?? board.width * board.boardScale);
	const lsFrameH = $derived(board.frameH ?? board.height * board.boardScale);
	const lsCx = $derived(board.frameCx ?? board.x);
	const lsCy = $derived(board.frameCy ?? board.y + BOARD_GRID_OFFSET_Y);
</script>

{#if isLandscape}
	<Sprite key="reelFrameLs" anchor={0.5} x={lsCx} y={lsCy} width={lsFrameW} height={lsFrameH} />
{:else if isPortrait}
	<Sprite
		key="slotPadMobile"
		anchor={0.5}
		x={board.x}
		y={board.y}
		width={mFrameW}
		height={mFrameH}
	/>
{:else}
	<Sprite
		key="slotPad"
		anchor={{ x: ANCHOR_X, y: 0 }}
		x={board.x}
		y={board.frameTopY ?? 0}
		width={frameW}
		height={frameH}
	/>
{/if}
