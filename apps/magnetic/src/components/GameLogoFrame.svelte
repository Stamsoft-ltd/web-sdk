<script lang="ts">
	import { Sprite } from 'pixi-svelte';
	import { MainContainer } from 'components-layout';

	import { getContext } from '../game/context';

	const context = getContext();
	const main = $derived(context.stateLayoutDerived.mainLayout());

	// magnetic_logo.png is 1400×1098 INCLUDING a wide soft glow halo; the visible logo plate is
	// ~half the box width, so the box is sized bigger than the visible mark and the baked-in glow
	// acts as the top-left margin (hence the small offsets).
	const LOGO_ASPECT = 1400 / 1098;
	const LOGO_W = $derived(main.width * 0.3);
	const LOGO_H = $derived(LOGO_W / LOGO_ASPECT);
	const MARGIN_X = $derived(-main.width * 0.035);
	const MARGIN_Y = $derived(-main.height * 0.03);
</script>

<MainContainer zIndex={20}>
	<!-- Magnetic Megachain logo, anchored to the top-left corner of the game area -->
	<Sprite
		key="magneticLogo"
		anchor={{ x: 0, y: 0 }}
		x={MARGIN_X}
		y={MARGIN_Y}
		width={LOGO_W}
		height={LOGO_H}
	/>
</MainContainer>
