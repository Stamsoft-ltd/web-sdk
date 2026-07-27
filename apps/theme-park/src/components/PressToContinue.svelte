<script lang="ts">
	import { MainContainer, OnPressFullScreen } from 'components-layout';
	import { OnHotkey } from 'components-shared';
	import { ResponsiveBitmapText } from 'components-pixi';
	import { stateI18nDerived } from 'state-shared';

	import { getContext } from '../game/context';

	type Props = {
		onpress: () => void;
		showText?: boolean;
	};

	const { onpress, showText = true }: Props = $props();
	const context = getContext();
</script>

{#if showText}
	<MainContainer alignVertical="bottom">
		<ResponsiveBitmapText
			text={stateI18nDerived.translate('PRESS TO CONTINUE')}
			style={{ fontFamily: 'silver', fontSize: 34, align: 'center', letterSpacing: 3 }}
			maxWidth={650}
			anchor={{ x: 0.5, y: 1 }}
			x={context.stateLayoutDerived.mainLayout().width * 0.5}
			y={context.stateLayoutDerived.mainLayout().height - 28}
		/>
	</MainContainer>
{/if}
<OnHotkey hotkey="Space" onpress={() => onpress()} />
<OnPressFullScreen onpress={() => onpress()} />
