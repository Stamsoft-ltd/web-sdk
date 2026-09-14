<script lang="ts">
	import { Sprite } from 'pixi-svelte';
	import { MainContainer } from 'components-layout';

	import { getContext } from '../game/context';

	const context = getContext();
	const main = $derived(context.stateLayoutDerived.mainLayout());
	const isPortrait = $derived(context.stateLayoutDerived.layoutType() === 'portrait');

	// The whole rect comes from stateGame, for two reasons: the left rail (LandscapeCapsule /
	// RespinPanel) anchors itself against this mark, and SplashIntro's hand-off flight aims at this
	// same rect — a copy of the formula in either place lands the flight with a visible snap.
	const logoRect = $derived(context.stateGameDerived.landscapeLogoRect());
	const LOGO_W = $derived(logoRect.w);
	const LOGO_H = $derived(logoRect.h);
	const logoCX = $derived(logoRect.cx);
	const logoCY = $derived(logoRect.cy);

	// Portrait: the logo sits near the top of the screen. 0.5 -> 0.32 over three user passes on
	// 2026-08-10 — it dominated the top row, crowded the studio mark beside it, and the top row now
	// belongs to the (bigger) Version2 capsule tube, with the plate reading as its header.
	// Size and centre come from stateGame so SplashIntro's handoff flight aims at the SAME rect —
	// they were literals in both files, so every resize here silently broke the flight's landing.
	const PT_W = $derived(context.stateGameDerived.portraitLogoWidth());
	const PT_H = $derived(context.stateGameDerived.portraitLockupHeight());
	const PT_CY = $derived(context.stateGameDerived.portraitLockupCY());
	// Press Play studio mark, top-right corner (portrait only). Pushed further into the corner in
	// the same pass ("more to top and right").
	const PP_ASPECT = 548 / 228;
	const PP_W = $derived(main.width * 0.26);
	const PP_H = $derived(PP_W / PP_ASPECT);
</script>

<!-- While the splash logo plate is flying to this spot (logoHandoffActive) the sprite stays
     hidden — the HTML plate IS the logo until it lands, then the swap is invisible (same art). -->
<MainContainer zIndex={20}>
	{#if isPortrait}
		{#if !context.stateGame.logoHandoffActive}
			<!-- The WHOLE lockup, saucer and all. Portrait's ship is that saucer and it does not
			     fly or hover in game — the splash hands the assembled lockup over and it stays put
			     (user, 2026-09-11) — so there is nothing for a separate sprite to buy here.
			     <Background> still hangs the tractor beam off the saucer's own beam mouth. -->
			<Sprite
				key="magneticLogo"
				anchor={0.5}
				x={main.width * 0.5}
				y={PT_CY}
				width={PT_W}
				height={PT_H}
			/>
		{/if}
		<Sprite
			key="pressPlayLogo"
			anchor={{ x: 1, y: 0.5 }}
			x={main.width * 0.99}
			y={main.height * 0.055}
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
