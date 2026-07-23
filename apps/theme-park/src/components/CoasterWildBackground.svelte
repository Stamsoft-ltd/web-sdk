<script lang="ts">
	import { Container, Graphics, Sprite } from 'pixi-svelte';

	import { BOARD_SIZES, SYMBOL_H, SYMBOL_W } from '../game/constants';

	type Props = {
		reel: number;
		row: number;
	};

	const props: Props = $props();
	const cellX = $derived(SYMBOL_W * (props.reel + 0.5));
	const cellY = $derived(SYMBOL_H * (props.row + 0.5));
	const gridLineHalfWidth = 1.2;
</script>

<!-- Repaint the exact aligned Theme Park board texture inside this cell.
     The inset leaves the shared gold grid visible and creates no extra border. -->
<Container>
	<Sprite
		key="themeBoard"
		x={BOARD_SIZES.width * 0.5 - cellX}
		y={BOARD_SIZES.height * 0.5 - cellY}
		anchor={0.5}
		width={BOARD_SIZES.width * 1.08}
		height={BOARD_SIZES.height * 1.08}
	/>
	<Graphics
		isMask
		draw={(graphics) => {
			graphics.rect(
				-SYMBOL_W * 0.5 + gridLineHalfWidth,
				-SYMBOL_H * 0.5 + gridLineHalfWidth,
				SYMBOL_W - gridLineHalfWidth * 2,
				SYMBOL_H - gridLineHalfWidth * 2,
			);
			graphics.fill({ color: 0xffffff, alpha: 1 });
		}}
	/>
</Container>
