<script lang="ts">
	import { Sprite } from 'pixi-svelte';
	import { MainContainer } from 'components-layout';

	import { getContext } from '../game/context';

	const context = getContext();
	const main = $derived(context.stateLayoutDerived.mainLayout());
	const isPortrait = $derived(context.stateLayoutDerived.layoutType() === 'portrait');

	// Version2 logo plate (splash/logo_plate.webp) is tight-trimmed — no baked halo margins.
	const LOGO_ASPECT = 900 / 601;
	// Size comes from stateGame so the left-gutter box column (LandscapeCapsule / RespinPanel), which
	// anchors itself just below this mark, can never drift out of sync with what is actually drawn.
	// It shrinks on popout-S sizes only; popout L and desktop keep the original full size.
	const LOGO_W = $derived(context.stateGameDerived.landscapeLogoWidth());
	const LOGO_H = $derived(context.stateGameDerived.landscapeLogoHeight());

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
	// Tight art: centre sits half its height below the screen top plus a whisker of margin,
	// matching the design's near-flush top-left plate.
	const logoCY = $derived(canvasTopY + LOGO_H * 0.54);

	// Portrait: the logo is centred near the top of the screen and larger.
	const PT_W = $derived(main.width * 0.5);
	const PT_H = $derived(PT_W / LOGO_ASPECT);
	// Press Play studio mark, top-right corner (portrait only).
	const PP_ASPECT = 548 / 228;
	const PP_W = $derived(main.width * 0.26);
	const PP_H = $derived(PP_W / PP_ASPECT);
</script>

<!-- While the splash logo plate is flying to this spot (logoHandoffActive) the sprite stays
     hidden — the HTML plate IS the logo until it lands, then the swap is invisible (same art). -->
<MainContainer zIndex={20}>
	{#if isPortrait}
		{#if !context.stateGame.logoHandoffActive}
			<Sprite
				key="magneticLogo"
				anchor={0.5}
				x={main.width * 0.5}
				y={main.height * 0.088}
				width={PT_W}
				height={PT_H}
			/>
		{/if}
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
		{#if !context.stateGame.logoHandoffActive}
			<Sprite
				key="magneticLogo"
				anchor={0.5}
				x={logoCX}
				y={logoCY}
				width={LOGO_W}
				height={LOGO_H}
			/>
		{/if}
		<!-- The landscape Press Play studio mark is rendered by PressPlayMark.svelte (mounted in
		     Game.svelte), so it is intentionally NOT drawn here to avoid a duplicate. -->
	{/if}
</MainContainer>

