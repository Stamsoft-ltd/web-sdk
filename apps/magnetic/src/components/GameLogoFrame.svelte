<script lang="ts">
	import { Sprite } from 'pixi-svelte';
	import { MainContainer } from 'components-layout';

	import { getContext } from '../game/context';

	const context = getContext();
	const main = $derived(context.stateLayoutDerived.mainLayout());
	const isPortrait = $derived(context.stateLayoutDerived.layoutType() === 'portrait');

	// magnetic_logo.png is 1400×1098 INCLUDING a wide soft glow halo; the visible logo plate is
	// ~half the box width, so the box is sized bigger than the visible mark and the baked-in glow
	// acts as the top-left margin (hence the small offsets).
	const LOGO_ASPECT = 1400 / 1098;
	const LOGO_W = $derived(main.width * 0.3);
	const LOGO_H = $derived(LOGO_W / LOGO_ASPECT);
	const MARGIN_X = $derived(-main.width * 0.035);
	const MARGIN_Y = $derived(-main.height * 0.03);

	// Portrait: the logo is centred near the top of the screen and larger.
	const PT_W = $derived(main.width * 0.68);
	const PT_H = $derived(PT_W / LOGO_ASPECT);
	// Press Play studio mark, top-right corner (portrait only).
	const PP_ASPECT = 548 / 228;
	const PP_W = $derived(main.width * 0.26);
	const PP_H = $derived(PP_W / PP_ASPECT);
</script>

<MainContainer zIndex={20}>
	{#if isPortrait}
		<Sprite
			key="magneticLogo"
			anchor={0.5}
			x={main.width * 0.5}
			y={main.height * 0.088}
			width={PT_W}
			height={PT_H}
		/>
		<Sprite
			key="pressPlayLogo"
			anchor={{ x: 1, y: 0.5 }}
			x={main.width * 0.965}
			y={main.height * 0.088}
			width={PP_W}
			height={PP_H}
		/>
	{:else}
		<!-- Magnetic Megachain logo, anchored to the top-left corner of the game area -->
		<Sprite
			key="magneticLogo"
			anchor={{ x: 0, y: 0 }}
			x={MARGIN_X}
			y={MARGIN_Y}
			width={LOGO_W}
			height={LOGO_H}
		/>
	{/if}
</MainContainer>
