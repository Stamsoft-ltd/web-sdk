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

	import { getContext } from '../game/context';
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
	// Sized off the REEL GRID, which is the one thing laid out per layout type. In the design the
	// panel is 486 against a 457-tall grid, so it is the grid plus 6% — and that holds up everywhere,
	// because the grid is never allowed to swallow the screen either. Taking a fraction of the frame
	// instead blew the panel up to 725px on the square tablet frame: 0.725 of a height only reads as
	// "the design's 486" when the frame is the design's 1.79 shape.
	const PANEL = {
		overGridHeight: 486 / 457,
		widthLimit: 0.9,
		title: -175 / 486,
		subtitle: -135 / 486,
		amountBox: { y: -49.5 / 486, width: 269 / 486, height: 81 / 486, radius: 12 / 486 },
		// Width and centre are the design's; the height follows the art's own aspect rather than the
		// design's box, which is a tighter crop than the exported image and would squash it.
		prize: { y: 110.5 / 486, width: 342 / 486, aspect: 478 / 293 },
		titleSize: 26 / 486,
		subtitleSize: 24 / 486,
		amountSize: 34 / 486,
	};
	// Sampled from the design render: white heading, violet subheading, near-black amount well with
	// a magenta hairline.
	const TITLE_FILL = 0xffffff;
	const SUBTITLE_FILL = 0x8a4dff;
	const WELL_FILL = 0x010003;
	const WELL_STROKE = 0xab34f4;

	const main = $derived(context.stateLayoutDerived.mainLayout());
	const board = $derived(context.stateGameDerived.boardLayout());
	const panelSize = $derived(
		Math.min(
			board.height * board.boardScale * PANEL.overGridHeight,
			main.width * PANEL.widthLimit,
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

<FadeContainer {show}>
	{#if winLevelData}
		<!-- Forest Gang contract: dedicated bonus-total board, capped count-up,
		     manual acknowledgement. Per-spin tier boards are handled by Win.svelte. -->
		{@const duration = Math.min(winLevelData.presentDuration, 2000)}
		<WinCountUpProvider {amount} {duration} oncomplete={() => {}}>
			{#snippet children({ countUpAmount, startCountUp, finishCountUp, countUpCompleted })}
				<OnMount onmount={() => startCountUp()} />

				<CanvasSizeRectangle backgroundColor={0x000000} backgroundAlpha={0.5} />

				{@const size = panelSize}
				<MainContainer>
					<Container x={main.width * 0.5} y={main.height * 0.5}>
						<Sprite key="bonusPanel" anchor={0.5} width={size} height={size} />

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
								<Text
									anchor={0.5}
									onresize={({ width }) => (amountWidth = width)}
									text={bookEventAmountToCurrencyString(countUpAmount)}
									style={headingStyle(Math.round(size * PANEL.amountSize), TITLE_FILL)}
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
