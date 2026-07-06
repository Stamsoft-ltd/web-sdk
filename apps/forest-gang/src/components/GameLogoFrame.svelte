<script lang="ts">
	import { Sprite, Container, Text } from 'pixi-svelte';
	import { MainContainer } from 'components-layout';
	import { stateBet } from 'state-shared';
	import { bookEventAmountToCurrencyString } from 'utils-shared/amount';

	import { getContext } from '../game/context';
	import { GOLD_GRADIENT } from '../game/goldGradient';
	import { spriteKeyByName } from '../game/utils';
	import { i18nDerived } from '../i18n/i18nDerived';

	const context = getContext();
	const main = $derived(context.stateLayoutDerived.mainLayout());
	const isPortrait = $derived(context.stateLayoutDerived.layoutType() === 'portrait');
	const isLandscape = $derived(context.stateLayoutDerived.layoutType() === 'landscape');

	const LOGO_ASPECT = 1176 / 572;
	// Landscape uses a smaller logo than desktop.
	const LOGO_W = $derived(main.width * (isLandscape ? 0.10 : 0.15));
	const LOGO_H = $derived(LOGO_W / LOGO_ASPECT);
	const MARGIN_X = $derived(main.width * 0.02);
	const MARGIN_Y = $derived(main.height * 0.03);

	// Studio logo, top-right corner.
	const BRAND_ASPECT = 548 / 228;
	const BRAND_W = $derived(main.width * 0.11);
	const BRAND_H = $derived(BRAND_W / BRAND_ASPECT);

	// Portrait: big FOREST GANG logo centred over the board, with a small "Press Play" above it.
	const P_LOGO_W = $derived(main.width * 0.42);
	const P_LOGO_H = $derived(P_LOGO_W / LOGO_ASPECT);
	const P_LOGO_CX = $derived(main.width * 0.5);
	const P_PP_W = $derived(main.width * 0.16);
	const P_PP_H = $derived(P_PP_W / BRAND_ASPECT);
	// The Press Play sprite stacks above the logo; on very short screens the floor keeps the whole
	// stack below a small top margin. Sits near the top of the screen (above the board).
	const P_LOGO_TOP_MARGIN = $derived(main.height * 0.008);
	const P_LOGO_CY = $derived(
		Math.max(
			main.height * 0.055,
			P_LOGO_TOP_MARGIN + P_PP_H + main.height * 0.006 + P_LOGO_H * 0.5,
		),
	);

	// Portrait top-bar counters flanking the logo (Figma 2792-4133). Same data/logic as
	// desktop: free-spins current/total via events, bonus symbol + global multiplier from state.
	const BADGE_ASPECT = 1431 / 1099; // badge_frame.png
	// Both columns stack TWO badges (left: symbol+multiplier, right: FREE SPINS+EARNED), aligned
	// at a shared top. The board frame sprite top is at 236 (800×1422 main-layout) but its top
	// ~5% is transparent padding, so the visible wood sits lower — leaving room for this size.
	const badgeW = $derived(main.width * 0.22);
	const badgeH = $derived(badgeW / BADGE_ASPECT);
	// Left column: bonus symbol badge on top, multiplier badge underneath (like the FS counter).
	const symBadgeCY = $derived(main.height * 0.05);
	const multBadgeCY = $derived(symBadgeCY + badgeH * 0.9);
	const fsBadgeCY = $derived(main.height * 0.05);
	const leftBadgeX = $derived(main.width * 0.145);
	const rightBadgeX = $derived(main.width * 0.855);
	// Right column: EARNED badge under the FREE SPINS badge (mirrors the left column's stack).
	// Running total won in the current bonus — winBookEventAmount is a book-event amount
	// (100 = 1× bet), converted the same way as Win.svelte / BonusEarnedPanel.
	const earnedBadgeCY = $derived(fsBadgeCY + badgeH * 0.9);
	const earnedText = $derived(bookEventAmountToCurrencyString(stateBet.winBookEventAmount));
	let earnedLabelW = $state(0);
	const earnedCoinSize = $derived(badgeH * 0.22);
	const earnedGap = $derived(badgeW * 0.025);
	const earnedRowW = $derived(earnedCoinSize + earnedGap + earnedLabelW);

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
	// Wrapping variant for the FREE SPINS / EARNED labels — long translations wrap inside
	// the badge instead of spilling past its wooden edges.
	const titleWrap = (fontSize: number) => ({
		...titleStyle(fontSize),
		wordWrap: true,
		wordWrapWidth: badgeW * 0.86,
	});
</script>

<MainContainer zIndex={20}>
	{#if isPortrait}
		<!-- Small "Press Play" centred above the logo -->
		<Sprite
			key="pressPlayLogo"
			anchor={{ x: 0.5, y: 1 }}
			x={P_LOGO_CX}
			y={P_LOGO_CY - P_LOGO_H * 0.5 - main.height * 0.006}
			width={P_PP_W}
			height={P_PP_H}
		/>
		<!-- Big FOREST GANG logo, centred above the board and matched to its width -->
		<Sprite
			key="forestGangLogo"
			anchor={0.5}
			x={P_LOGO_CX}
			y={P_LOGO_CY}
			width={P_LOGO_W}
			height={P_LOGO_H}
		/>

		<!-- Left column: bonus (expanding) symbol badge, multiplier badge underneath -->
		{#if showBonusBadge && bonusSymbolKey}
			<Container x={leftBadgeX} y={symBadgeCY}>
				<Sprite key="badgeFrame" anchor={0.5} width={badgeW} height={badgeH} />
				<Sprite key={bonusSymbolKey} anchor={0.5} y={-badgeH * 0.02} width={badgeH * 0.56} height={badgeH * 0.42} />
			</Container>
			<Container x={leftBadgeX} y={multBadgeCY}>
				<Sprite key="badgeFrame" anchor={0.5} width={badgeW} height={badgeH} />
				<Text anchor={0.5} y={-badgeH * 0.02} text={`x${globalMultiplier}`} style={titleStyle(badgeH * 0.3)} />
			</Container>
		{/if}

		<!-- Right column top: FREE SPINS current / total -->
		{#if showFsBadge}
			<Container x={rightBadgeX} y={fsBadgeCY}>
				<Sprite key="badgeFrame" anchor={0.5} width={badgeW} height={badgeH} />
				<Text anchor={0.5} y={-badgeH * 0.15} text={i18nDerived.freeSpins()} style={titleWrap(badgeH * 0.13)} />
				<Text anchor={0.5} y={badgeH * 0.08} text={`${fsCurrent}/${fsTotal}`} style={titleStyle(badgeH * 0.26)} />
			</Container>

			<!-- Right column bottom: EARNED running total (coin + label, amount below) -->
			<Container x={rightBadgeX} y={earnedBadgeCY}>
				<Sprite key="badgeFrame" anchor={0.5} width={badgeW} height={badgeH} />
				<Container x={-earnedRowW / 2} y={-badgeH * 0.16}>
					<Sprite
						key="earnedCoin"
						anchor={{ x: 0, y: 0.5 }}
						x={0}
						y={0}
						width={earnedCoinSize}
						height={earnedCoinSize}
					/>
					<Text
						anchor={{ x: 0, y: 0.5 }}
						x={earnedCoinSize + earnedGap}
						y={0}
						text={i18nDerived.earned()}
						onresize={(sizes) => (earnedLabelW = sizes.width)}
						style={titleWrap(badgeH * 0.13)}
					/>
				</Container>
				<Text anchor={0.5} y={badgeH * 0.13} text={earnedText} style={titleStyle(badgeH * 0.2)} />
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
