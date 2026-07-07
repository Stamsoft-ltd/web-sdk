<script lang="ts">
	import { MainContainer, OnPressFullScreen } from 'components-layout';
	import { OnHotkey } from 'components-shared';
	import { stateUrlDerived } from 'state-shared';
	import { Sprite } from 'pixi-svelte';

	import { getContext } from '../game/context';

	type Props = {
		onpress: () => void;
	};

	const props: Props = $props();
	const context = getContext();

	// Mobile-landscape keeps its controls (bet pad + BUY BONUS) at the bottom centre, so lift the
	// "press anywhere" text above them — otherwise it bleeds through behind the translucent button.
	const isLandscape = $derived(context.stateLayoutDerived.layoutType() === 'landscape');
	const bottomY = $derived(
		context.stateLayoutDerived.mainLayout().height * (isLandscape ? 0.86 : 1),
	);
</script>

<MainContainer alignVertical="bottom">
	<Sprite
		key="pressToContinueText_{stateUrlDerived.lang()}.png"
		width={800}
		height={134}
		anchor={{ x: 0.5, y: 1 }}
		x={context.stateLayoutDerived.mainLayout().width * 0.5}
		y={bottomY}
	/>
</MainContainer>
<OnHotkey hotkey="Space" onpress={() => props.onpress()} />
<OnPressFullScreen onpress={() => props.onpress()} />
