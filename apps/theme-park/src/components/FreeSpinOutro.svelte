<script lang="ts" module>
	import type { WinLevelData } from '../game/winLevelMap';

	export type EmitterEventFreeSpinOutro =
		| { type: 'freeSpinOutroShow' }
		| { type: 'freeSpinOutroHide' }
		| { type: 'freeSpinOutroCountUp'; amount: number; winLevelData: WinLevelData };
</script>

<script lang="ts">
	import { Container, Graphics, Sprite, Text } from 'pixi-svelte';
	import { FadeContainer, WinCountUpProvider } from 'components-pixi';
	import { bookEventAmountToCurrencyString } from 'utils-shared/amount';
	import { waitForResolve } from 'utils-shared/wait';
	import { CanvasSizeRectangle, MainContainer } from 'components-layout';
	import { OnMount } from 'components-shared';
	import { stateI18nDerived } from 'state-shared';

	import { POPUP_SCRIM_ALPHA } from '../game/constants';
	import { getContext } from '../game/context';
	import { popupPanelLimits } from '../game/utils';
	import PanelBorderLights from './PanelBorderLights.svelte';
	import PressToContinue from './PressToContinue.svelte';

	const context = getContext();

	let show = $state(false);
	let amount = $state(0);
	let winLevelData = $state<WinLevelData>();
	let oncomplete = $state(() => {});
	let amountWidth = $state(0);

	// ── Bonus complete, Figma 6094:4022 ──────────────────────────────────────────────────────────
	//
	// The design is a 486x486 panel centred in the 1200x670 frame; every position below is a fraction
	// of that panel, so the whole thing scales as one piece.
	//
	// Sized off the REEL GRID (486 against the design's 457-tall grid), capped by popupPanelLimits.
	// The grid rule is what reproduces the design on its own frame; the caps are what stop it on a
	// squarish window, where the grid itself fills the frame and grid-relative sizing swallowed the
	// screen — see the helper for why a fixed frame share cannot do that job.
	const PANEL = {
		overGridHeight: 486 / 457,
		title: -175 / 486,
		subtitle: -135 / 486,
		amountBox: { y: -49.5 / 486, width: 269 / 486, height: 81 / 486, radius: 12 / 486 },
		// Figma 6682:5285, whose box is the exported 740x392 image at half scale — so the design's
		// width and centre can be taken as-is and the art still lands at its own aspect.
		prize: { y: 107 / 486, width: 370 / 486, aspect: 740 / 392 },
		titleSize: 26 / 486,
		subtitleSize: 24 / 486,
		// Figma: 40px Helvetica 700, 1.4px letter-spacing (3.5%), white.
		amountSize: 40 / 486,
	};
	// Sampled from the design render: white heading, violet subheading, near-black amount well with
	// a magenta hairline.
	const TITLE_FILL = 0xffffff;
	const SUBTITLE_FILL = 0x8a4dff;
	const WELL_FILL = 0x010003;
	const WELL_STROKE = 0xab34f4;

	const main = $derived(context.stateLayoutDerived.mainLayout());
	const board = $derived(context.stateGameDerived.boardLayout());
	const limits = $derived(popupPanelLimits(context.stateLayoutDerived.canvasSizes(), main.scale));
	const panelSize = $derived(
		Math.min(
			board.height * board.boardScale * PANEL.overGridHeight,
			limits.maxWidth,
			limits.maxHeight,
		),
	);

	const headingStyle = (fontSize: number, fill: number) => ({
		fontFamily: 'Helvetica, Arial, sans-serif',
		fontWeight: '700' as const,
		fontSize,
		fill,
		align: 'center' as const,
		letterSpacing: fontSize * 0.02,
	});

	context.eventEmitter.subscribeOnMount({
		freeSpinOutroShow: () => {
			show = true;
			context.stateGame.freeSpinPopupShowing = true;
		},
		freeSpinOutroHide: async () => {
			show = false;
			context.stateGame.freeSpinPopupShowing = false;
		},
		freeSpinOutroCountUp: async (emitterEvent) => {
			amount = emitterEvent.amount;
			winLevelData = emitterEvent.winLevelData;
			await waitForResolve((resolve) => (oncomplete = resolve));
		},
	});
</script>

<!-- Quick fade on dismissal: at the Tween default 400ms the HUD un-dims the moment `show` flips,
     and the panel text hung readable over the restored UI for the rest of the fade. -->
<FadeContainer {show} duration={150}>
	{#if winLevelData}
		<!-- Forest Gang contract: dedicated bonus-total board, capped count-up,
		     manual acknowledgement. Per-spin tier boards are handled by Win.svelte. -->
		{@const duration = Math.min(winLevelData.presentDuration, 2000)}
		<WinCountUpProvider {amount} {duration} oncomplete={() => {}}>
			{#snippet children({ countUpAmount, startCountUp, finishCountUp, countUpCompleted })}
				<OnMount onmount={() => startCountUp()} />

					<!-- The design's scrim covers the whole frame, HUD included; this rectangle only reaches
					     the canvas, so the HUD dims itself to match — see .hud-shell--blocked. -->
					<CanvasSizeRectangle backgroundColor={0x000000} backgroundAlpha={POPUP_SCRIM_ALPHA} />

				{@const size = panelSize}
				<MainContainer>
					<Container x={main.width * 0.5} y={main.height * 0.5}>
						<Sprite key="bonusPanel" anchor={0.5} width={size} height={size} />
						<PanelBorderLights width={size} height={size} />

						<Text
							anchor={0.5}
							y={size * PANEL.title}
							text={stateI18nDerived.translate('CONGRATULATIONS!')}
							style={headingStyle(Math.round(size * PANEL.titleSize), TITLE_FILL)}
						/>

						<Text
							anchor={0.5}
							y={size * PANEL.subtitle}
							text={stateI18nDerived.translate('YOU WON')}
							style={headingStyle(Math.round(size * PANEL.subtitleSize), SUBTITLE_FILL)}
						/>

						<!-- The amount well. Drawn rather than shipped as art: it is a plain rounded
					     rectangle, and drawing it keeps its hairline crisp at every panel size. -->
						{@const wellW = size * PANEL.amountBox.width}
						{@const wellH = size * PANEL.amountBox.height}
						<Container y={size * PANEL.amountBox.y}>
							<Graphics
								draw={(graphics) => {
									graphics
										.roundRect(-wellW / 2, -wellH / 2, wellW, wellH, size * PANEL.amountBox.radius)
										.fill({ color: WELL_FILL })
										.stroke({ width: Math.max(1, size * 0.004), color: WELL_STROKE, alpha: 0.9 });
								}}
							/>
							<!-- Long currency strings are scaled down rather than clipped by the well. -->
							{@const fit = amountWidth > wellW * 0.86 ? (wellW * 0.86) / amountWidth : 1}
							<Container scale={fit}>
								{@const amountFontSize = Math.round(size * PANEL.amountSize)}
								<Text
									anchor={0.5}
									onresize={({ width }) => (amountWidth = width)}
									text={bookEventAmountToCurrencyString(countUpAmount).toUpperCase()}
									style={{
										...headingStyle(amountFontSize, TITLE_FILL),
										letterSpacing: amountFontSize * 0.035,
									}}
								/>
							</Container>
						</Container>

						<Sprite
							key="bonusPrize"
							anchor={0.5}
							y={size * PANEL.prize.y}
							width={size * PANEL.prize.width}
							height={(size * PANEL.prize.width) / PANEL.prize.aspect}
						/>
					</Container>
				</MainContainer>

				<PressToContinue onpress={() => (countUpCompleted ? oncomplete() : finishCountUp())} />
			{/snippet}
		</WinCountUpProvider>
	{/if}
</FadeContainer>
