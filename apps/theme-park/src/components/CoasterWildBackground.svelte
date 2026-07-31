<script lang="ts">
	import { Container, Graphics, Sprite } from 'pixi-svelte';

	import {
		FRAME_OVER_GRID_X,
		FRAME_OVER_GRID_Y,
		GRID_OFFSET_X,
		GRID_OFFSET_Y,
	} from '../game/boardArt';
	import { BOARD_SIZES, CELL_W, SYMBOL_H } from '../game/constants';
	import { getContext } from '../game/context';

	type Props = {
		reel: number;
		row: number;
	};

	const props: Props = $props();
	const context = getContext();
	const cellX = $derived(CELL_W * (props.reel + 0.5));
	const cellY = $derived(SYMBOL_H * (props.row + 0.5));
	const gridLineHalfWidth = 1.2;

	// Whichever pad <BoardFrame> is showing, so the crop matches the board underneath it rather than
	// dropping a bulb-pad patch onto the autoplay pad.
	const padKey = $derived(context.stateXstateDerived.isAutoBetting() ? 'themeBoardAuto' : 'themeBoard');

	// Same size and registration as <BoardFrame> — the art is the grid grown by the frame ratios and
	// nudged for the grid not being centred in the image. Anything else paints a stretched, offset
	// copy of the pad into the cell, which reads as a dark box around the wild.
	const frameW = $derived(BOARD_SIZES.width * FRAME_OVER_GRID_X);
	const frameH = $derived(BOARD_SIZES.height * FRAME_OVER_GRID_Y);
</script>

<!-- Repaint the exact aligned Theme Park board texture inside this cell.
     The inset leaves the shared gold grid visible and creates no extra border. -->
<Container>
	<Sprite
		key={padKey}
		x={BOARD_SIZES.width * 0.5 - cellX + frameW * GRID_OFFSET_X}
		y={BOARD_SIZES.height * 0.5 - cellY + frameH * GRID_OFFSET_Y}
		anchor={0.5}
		width={frameW}
		height={frameH}
	/>
	<Graphics
		isMask
		draw={(graphics) => {
			graphics.rect(
				-CELL_W * 0.5 + gridLineHalfWidth,
				-SYMBOL_H * 0.5 + gridLineHalfWidth,
				CELL_W - gridLineHalfWidth * 2,
				SYMBOL_H - gridLineHalfWidth * 2,
			);
			graphics.fill({ color: 0xffffff, alpha: 1 });
		}}
	/>
</Container>
