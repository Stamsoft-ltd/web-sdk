<script lang="ts">
	import { Sprite, Container, Text } from 'pixi-svelte';
	import { MainContainer } from 'components-layout';

	import { getContext } from '../game/context';
	import { GOLD_GRADIENT } from '../game/goldGradient';
	import { spriteKeyByName } from '../game/utils';

	const context = getContext();
	const main = $derived(context.stateLayoutDerived.mainLayout());
	const isPortrait = $derived(context.stateLayoutDerived.layoutType() === 'portrait');

	const LOGO_ASPECT = 1176 / 572;
	const LOGO_W = $derived(main.width * 0.15);
	const LOGO_H = $derived(LOGO_W / LOGO_ASPECT);
	const MARGIN_X = $derived(main.width * 0.02);
	const MARGIN_Y = $derived(main.height * 0.03);

	// Studio logo, top-right corner.
	const BRAND_ASPECT = 548 / 228;
	const BRAND_W = $derived(main.width * 0.11);
	const BRAND_H = $derived(BRAND_W / BRAND_ASPECT);

	// Portrait: big centred FOREST GANG logo above the board, small "Press Play" above it.
	const P_LOGO_W = $derived(main.width * 0.42);
	const P_LOGO_H = $derived(P_LOGO_W / LOGO_ASPECT);
	const P_LOGO_CY = $derived(main.height * 0.085);
	const P_PP_W = $derived(main.width * 0.16);
	const P_PP_H = $derived(P_PP_W / BRAND_ASPECT);

	// Portrait top-bar counters flanking the logo (Figma 2792-4133). Same data/logic as
	// desktop: free-spins current/total via events, bonus symbol + global multiplier from state.
	const BADGE_ASPECT = 1431 / 1099; // badge_frame.png
	const badgeW = $derived(main.width * 0.15);
	const badgeH = $derived(badgeW / BADGE_ASPECT);
	// Left column: bonus symbol badge on top, multiplier badge underneath (like the FS counter).
	const symBadgeCY = $derived(main.height * 0.072);
	const multBadgeCY = $derived(symBadgeCY + badgeH * 0.92);
	const fsBadgeCY = $derived(main.height * 0.098);
	const leftBadgeX = $derived(main.width * 0.135);
	const rightBadgeX = $derived(main.width * 0.865);

	// Free-spins counter state (mirrors FreeSpinCounter.svelte).
	let fsShow = $state(false);
	let fsCurrent = $state(0);
	let fsTotal = $state(0);
	// Hidden while the roe-deer presenter (rolling symbols) is on screen; shown once it
	// finishes — same gating as BonusSymbolPanel.svelte on desktop.
	let presenterActive = $state(false);
	context.eventEmitter.subscribeOnMount({
		freeSpinCounterShow: () => {
			fsShow = false;
			fsCurrent = 0;
		},
		freeSpinCounterHide: () => (fsShow = false),
		freeSpinCounterUpdate: (emitterEvent) => {
			if (emitterEvent.current !== undefined) {
				fsCurrent = emitterEvent.current;
				fsShow = true;
			}
			if (emitterEvent.total !== undefined) fsTotal = emitterEvent.total;
		},
		expandedPresenterShow: () => (presenterActive = true),
		expandedPresenterHide: () => (presenterActive = false),
	});

	const bonusMode = $derived(context.stateGame.bonusMode);
	const bonusSymbol = $derived(context.stateGame.selectedBonusSymbol);
	const bonusSymbolKey = $derived(bonusSymbol ? (spriteKeyByName[bonusSymbol] ?? null) : null);
	const globalMultiplier = $derived(context.stateGame.globalMultiplier);

	const showFsBadge = $derived(isPortrait && fsShow && bonusMode !== 'feature' && !presenterActive);
	const showBonusBadge = $derived(isPortrait && !!bonusSymbolKey && !!bonusMode && !presenterActive);

	const titleStyle = (fontSize: number) => ({
		fontFamily: 'Cinzel',
		fontWeight: '700',
		fontSize,
		fill: GOLD_GRADIENT,
		align: 'center' as const,
		letterSpacing: fontSize * 0.03,
		wordWrap: false,
	});
</script>

<MainContainer zIndex={20}>
	{#if isPortrait}
		<!-- Small "Press Play" centred above the logo -->
		<Sprite
			key="pressPlayLogo"
			anchor={{ x: 0.5, y: 1 }}
			x={main.width * 0.5}
			y={P_LOGO_CY - P_LOGO_H * 0.5 - main.height * 0.006}
			width={P_PP_W}
			height={P_PP_H}
		/>
		<!-- Big FOREST GANG logo, centred above the board -->
		<Sprite
			key="forestGangLogo"
			anchor={0.5}
			x={main.width * 0.5}
			y={P_LOGO_CY}
			width={P_LOGO_W}
			height={P_LOGO_H}
		/>

		<!-- Left column: bonus (expanding) symbol badge, multiplier badge underneath -->
		{#if showBonusBadge && bonusSymbolKey}
			<Container x={leftBadgeX} y={symBadgeCY}>
				<Sprite key="badgeFrame" anchor={0.5} width={badgeW} height={badgeH} />
				<Sprite key={bonusSymbolKey} anchor={0.5} width={badgeH * 0.6} height={badgeH * 0.6} />
			</Container>
			<Container x={leftBadgeX} y={multBadgeCY}>
				<Sprite key="badgeFrame" anchor={0.5} width={badgeW} height={badgeH} />
				<Text anchor={0.5} text={`x${globalMultiplier}`} style={titleStyle(badgeH * 0.34)} />
			</Container>
		{/if}

		<!-- Right badge: FREE SPINS current / total -->
		{#if showFsBadge}
			<Container x={rightBadgeX} y={fsBadgeCY}>
				<Sprite key="badgeFrame" anchor={0.5} width={badgeW} height={badgeH} />
				<Text anchor={0.5} y={-badgeH * 0.22} text="FREE SPINS" style={titleStyle(badgeH * 0.14)} />
				<Text anchor={0.5} y={badgeH * 0.15} text={`${fsCurrent}/${fsTotal}`} style={titleStyle(badgeH * 0.32)} />
			</Container>
		{/if}
	{:else}
		<!-- Text logo, anchored to the top-left corner of the game area -->
		<Sprite
			key="forestGangLogo"
			anchor={{ x: 0, y: 0 }}
			x={MARGIN_X}
			y={MARGIN_Y}
			width={LOGO_W}
			height={LOGO_H}
		/>

		<!-- Studio logo, anchored to the top-right corner of the game area -->
		<Sprite
			key="pressPlayLogo"
			anchor={{ x: 1, y: 0 }}
			x={main.width - MARGIN_X}
			y={MARGIN_Y + BRAND_H * 0.2}
			width={BRAND_W}
			height={BRAND_H}
		/>
	{/if}
</MainContainer>
