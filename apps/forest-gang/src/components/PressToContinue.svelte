<script lang="ts">
	import { MainContainer, OnPressFullScreen } from 'components-layout';
	import { OnHotkey } from 'components-shared';
	import { Container } from 'pixi-svelte';

	import { getContext } from '../game/context';
	import PressAnywhereText from './PressAnywhereText.svelte';

	type Props = {
		onpress: () => void;
		// When the screen anchors its own PressAnywhereText to the board (intro/outro in
		// landscape/desktop), set false so only the press handlers are mounted here.
		showText?: boolean;
	};

	const props: Props = $props();
	const context = getContext();

	// Fallback placement for screens without a board anchor: keep the text above the HTML HUD
	// bar. The main box is bottom-aligned to the canvas, so in tall desktop windows the HUD
	// intrudes deep into it — desktop therefore sits highest.
	const layoutType = $derived(context.stateLayoutDerived.layoutType());
	const bottomFrac = $derived(
		layoutType === 'desktop' ? 0.75 : layoutType === 'landscape' ? 0.84 : 0.95,
	);
	const fontSize = $derived(
		layoutType === 'portrait'
			? context.stateLayoutDerived.mainLayout().width * 0.03
			: context.stateLayoutDerived.mainLayout().width * (18 / 1200),
	);
</script>

{#if props.showText ?? true}
	<MainContainer alignVertical="bottom">
		<Container
			x={context.stateLayoutDerived.mainLayout().width * 0.5}
			y={context.stateLayoutDerived.mainLayout().height * bottomFrac}
		>
			<PressAnywhereText y={0} {fontSize} />
		</Container>
	</MainContainer>
{/if}
<OnHotkey hotkey="Space" onpress={() => props.onpress()} />
<OnPressFullScreen onpress={() => props.onpress()} />
