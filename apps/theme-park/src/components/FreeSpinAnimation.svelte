<script lang="ts">
	import type { Snippet } from 'svelte';
	import {
		anchorToPivot,
		Container,
		SpineProvider,
		SpineSlot,
		SpineTrack,
		type Sizes,
	} from 'pixi-svelte';
	import { MainContainer } from 'components-layout';

	import { getContext } from '../game/context';
	import { SYMBOL_SIZE, SYMBOL_W, BOARD_DIMENSIONS } from '../game/constants';

	type Props = {
		children: Snippet<[{ sizes: Sizes }]>;
		xOffset?: number;
		portraitScale?: number;
	};

	const props: Props = $props();
	const context = getContext();
	type AnimationName = 'intro' | 'idle';
	let animationName = $state<AnimationName>('intro');

	// Forest Gang panel sizing. Screen-relative sizing prevents the popup from
	// shrinking with the taller 5×5 Theme Park board.
	const BACKGROUND_RATIO = 920 / 720;
	const LAYOUT_WIDTH = SYMBOL_SIZE * BOARD_DIMENSIONS.x;
	const PANEL_WIDTH = SYMBOL_W * BOARD_DIMENSIONS.x;
	const main = $derived(context.stateLayoutDerived.mainLayout());
	const sizeFactor = $derived(
		context.stateLayoutDerived.layoutType() === 'portrait'
			? (props.portraitScale ?? 0.72)
			: 0.72,
	);
	const scale = $derived((Math.min(main.width, main.height) * sizeFactor) / LAYOUT_WIDTH);
	const background = $derived({
		width: LAYOUT_WIDTH * scale,
		height: (LAYOUT_WIDTH / BACKGROUND_RATIO) * scale,
	});
	const panel = $derived({ width: PANEL_WIDTH * scale, height: LAYOUT_WIDTH * scale });
</script>

<MainContainer>
	<Container
		x={main.width / 2 + (props.xOffset ?? 0)}
		y={main.height / 2}
		pivot={anchorToPivot({ anchor: 0.5, sizes: background })}
	>
		<SpineProvider
			key="fsIntro"
			width={panel.width}
			x={background.width * 0.5}
			y={panel.height * 0.4}
		>
			<SpineTrack
				trackIndex={0}
				{animationName}
				loop={animationName === 'idle'}
				listener={{ complete: () => (animationName = 'idle') }}
			/>
			<SpineSlot slotName="slot_text_placeholder">
				{@render props.children({ sizes: background })}
			</SpineSlot>
		</SpineProvider>
	</Container>
</MainContainer>
