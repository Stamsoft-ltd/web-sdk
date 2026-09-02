<script lang="ts">
	import { Graphics } from 'pixi-svelte';

	import { getContext } from '../game/context';
	import { drawPlate } from '../game/boardStyle';

	// The board plate the 7x7 grid sits on (Figma 9032:23056).
	//
	// This used to be board_pad.webp scaled against measured fractions of its own artwork. The
	// MOTHERSHIP design draws the plate instead — a fill, a 7-unit border and a 10-unit radius — so
	// there is nothing to export, no per-layout variant (the portrait/landscape pads were the same
	// file anyway), and no resampling at any board scale.
	//
	// Geometry lives in game/boardStyle.ts, shared with the cell pads in <Board> and with the
	// desktop board_y calculation in stateGame, so the plate cannot drift from what it frames.

	const context = getContext();
	const board = $derived(context.stateGameDerived.boardLayout());
</script>

<Graphics
	x={board.x}
	y={board.y}
	draw={(graphics) => drawPlate(graphics, board.boardScale)}
/>
