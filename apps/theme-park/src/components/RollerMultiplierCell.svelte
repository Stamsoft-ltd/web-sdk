<script lang="ts">
	import { Container, Graphics } from 'pixi-svelte';

	import { CELL_W, SYMBOL_H } from '../game/constants';
	import RollerMultiplierText from './RollerMultiplierText.svelte';

	type Props = {
		x?: number;
		y?: number;
		text: string;
		contentScale?: number;
		contentOffsetY?: number;
		alpha?: number;
		zIndex?: number;
	};

	const props: Props = $props();
	const GRID_LINE_INSET = 1.4;
</script>

<!-- Fixed cell mask. Pop/combine motion applies only to content, never across a slot border. -->
<Container x={props.x} y={props.y} alpha={props.alpha ?? 1} zIndex={props.zIndex}>
	<Graphics
		isMask
		draw={(graphics) => {
			graphics
				.rect(
					-CELL_W * 0.5 + GRID_LINE_INSET,
					-SYMBOL_H * 0.5 + GRID_LINE_INSET,
					CELL_W - GRID_LINE_INSET * 2,
					SYMBOL_H - GRID_LINE_INSET * 2,
				)
				.fill(0xffffff);
		}}
	/>
	<Container y={props.contentOffsetY ?? 0} scale={props.contentScale ?? 1}>
		<RollerMultiplierText text={props.text} />
	</Container>
</Container>
