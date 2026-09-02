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
	<!-- zIndex above CapsulePanel's 25: the lengthened pillar's top cables now reach the mark's
	     corner, and the studio mark must sit over them. -->
	<MainContainer zIndex={40}>
		<!-- The art file carries ~8.9% transparent padding on its right side, so the sprite box is
		     pushed PAST the screen edge by that amount — the VISIBLE mark then sits 0.4% from the
		     edge (user: "move logo a bit to the right"). -->
		<Sprite
			key="pressPlayLogo"
			anchor={{ x: 1, y: 0 }}
			x={canvasRightX - main.width * 0.004 + main.width * 0.072 * 0.089}
			y={canvasTopY + main.height * 0.006}
			width={main.width * 0.072}
			height={(main.width * 0.072) / PP_ASPECT}
		/>
	</MainContainer>
{/if}
