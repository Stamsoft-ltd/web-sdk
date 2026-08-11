<script lang="ts">
	import { Graphics } from 'pixi-svelte';

	import {
		BOARD_DIMENSIONS,
		BOARD_SIDE_CONTENT_INSET,
		CELL_W,
		COASTER_WILD_GRID_INSET,
		SYMBOL_H,
	} from '../game/constants';

	type Props = { reel?: number };
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
</script>

<!-- Opaque cell fill hides the replaced reel symbol. A local rectangle replaces the former
     full-board sprite + per-cell mask pair. Every edge stays inset so adjacent Wilds never cover
     the one grid painted into BoardFrame or spill through the board's side border. -->
<Graphics
	draw={(graphics) => {
		graphics.rect(
			-CELL_W * 0.5 + leftInset,
			-SYMBOL_H * 0.5 + COASTER_WILD_GRID_INSET,
			CELL_W - leftInset - rightInset,
			SYMBOL_H - COASTER_WILD_GRID_INSET * 2,
		);
		graphics.fill({ color: 0x15002f, alpha: 1 });
	}}
/>
