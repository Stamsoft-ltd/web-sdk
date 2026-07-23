<script lang="ts">
	import { Sprite } from 'pixi-svelte';
	import { MainContainer } from 'components-layout';

	import { getContext } from '../game/context';

	const context = getContext();
	const main = $derived(context.stateLayoutDerived.mainLayout());
	const isPortrait = $derived(context.stateLayoutDerived.layoutType() === 'portrait');

	// magnetic_logo.webp is 1400×1098 INCLUDING a wide soft glow halo; the visible logo plate is
	// ~half the box width, so the box is sized bigger than the visible mark and the baked-in glow
	// acts as the top-left margin (hence the small offsets).
	const LOGO_ASPECT = 1400 / 1098;
	const LOGO_W = $derived(main.width * 0.3);
	const LOGO_H = $derived(LOGO_W / LOGO_ASPECT);

	// Centre the logo horizontally in the gap between the screen's LEFT edge and the board's left
	// edge (mirrors the capsule column on the right), sitting near the true screen top.
	const board = $derived(context.stateGameDerived.boardLayout());
	const boardLeftX = $derived(board.x - board.width * 0.5 * board.boardScale);
	const canvasLeftX = $derived(
		main.width * 0.5 - context.stateLayoutDerived.canvasSizes().width / (2 * (main.scale || 1)),
	);
	const canvasTopY = $derived(
		main.height * 0.5 - context.stateLayoutDerived.canvasSizes().height / (2 * (main.scale || 1)),
	);
	const logoCX = $derived((canvasLeftX + boardLeftX) * 0.5);
	// The art has a baked glow halo, so the visible mark sits slightly above the box centre.
	const logoCY = $derived(canvasTopY + LOGO_H * 0.4);

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
		<!-- Magnetic Megachain logo — centred in the left rail, near the screen top -->
		<Sprite
			key="magneticLogo"
			anchor={0.5}
			x={logoCX}
			y={logoCY}
			width={LOGO_W}
			height={LOGO_H}
		/>
		<!-- The landscape Press Play studio mark is rendered by PressPlayMark.svelte (mounted in
		     Game.svelte), so it is intentionally NOT drawn here to avoid a duplicate. -->
	{/if}
</MainContainer>

