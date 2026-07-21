<script lang="ts">
	import { Sprite } from 'pixi-svelte';
	import { MainContainer } from 'components-layout';

	import { getContext } from '../game/context';

	// Press Play studio mark — top-right corner in landscape. Mounted AFTER CapsulePanel in
	// Game.svelte because pixi layering here follows mount order (MainContainer zIndex props
	// don't cross-sort), and the mark must sit above the capsule tube like in the Figma.
	const context = getContext();
	const main = $derived(context.stateLayoutDerived.mainLayout());
	const isPortrait = $derived(context.stateLayoutDerived.layoutType() === 'portrait');

	const PP_ASPECT = 548 / 228;
	const canvasTopY = $derived(
		main.height * 0.5 - context.stateLayoutDerived.canvasSizes().height / (2 * (main.scale || 1)),
	);
	const canvasRightX = $derived(
		main.width * 0.5 + context.stateLayoutDerived.canvasSizes().width / (2 * (main.scale || 1)),
	);
</script>

{#if !isPortrait}
	<MainContainer>
		<Sprite
			key="pressPlayLogo"
			anchor={{ x: 1, y: 0 }}
			x={canvasRightX - main.width * 0.016}
			y={canvasTopY + main.height * 0.025}
			width={main.width * 0.072}
			height={(main.width * 0.072) / PP_ASPECT}
		/>
	</MainContainer>
{/if}
