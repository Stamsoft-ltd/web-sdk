<script lang="ts" module>
	import type { WinLevelAlias, WinLevelData } from '../game/winLevelMap';

	export type EmitterEventWin =
		| { type: 'winShow' }
		| { type: 'winHide' }
		| { type: 'winUpdate'; amount: number; winLevelData: WinLevelData };
</script>

<script lang="ts">
	import { Container, Sprite, Text } from 'pixi-svelte';
	import { FadeContainer, WinCountUpProvider } from 'components-pixi';
	import { CanvasSizeRectangle, MainContainer } from 'components-layout';
	import { stateBet } from 'state-shared';
	import {
		bookEventAmountToBetAmountMultiplier,
		bookEventAmountToCurrencyString,
	} from 'utils-shared/amount';
	import { waitForResolve } from 'utils-shared/wait';

	import { SYMBOL_SIZE } from '../game/constants';
	import { getContext } from '../game/context';
	import { boardKeyForMultiplier } from '../game/winPresentation';
	import PressToContinue from './PressToContinue.svelte';
	import ThemeWinBoard from './ThemeWinBoard.svelte';

	const context = getContext();

	let show = $state(false);
	let amount = $state(0);
	let winLevelData = $state<WinLevelData>();
	let oncomplete = $state(() => {});
	let winId = $state(0);
	let boardClickHandled = false;
	let snappedToFinal = false;
	let autoCloseTimer: ReturnType<typeof setTimeout> | null = null;
	let dismissTimer: ReturnType<typeof setTimeout> | null = null;
	let isCountingUp = $state(false);
	let breatheScale = $state(1);
	let smallWinSize = $state({ width: 0, height: 0 });

	const boardLayout = $derived(context.stateGameDerived.boardLayout());

	// Keep the amount moving linearly through most tier thresholds, then settle smoothly.
	const EASE_T = 0.8;
	const EASE_V = (2 * EASE_T) / (1 + EASE_T);
	const countCurve = (t: number) => {
		if (t < EASE_T) return (EASE_V / EASE_T) * t;
		const u = (t - EASE_T) / (1 - EASE_T);
		return EASE_V + (1 - EASE_V) * u * (2 - u);
	};

	const BIG_COUNT_MS: Partial<Record<WinLevelAlias, number>> = {
		big: 2500,
		superwin: 3500,
		mega: 4500,
		epic: 5250,
		max: 6000,
	};
	const turboFactor = () => (stateBet.isSuperTurbo ? 0.4 : stateBet.isTurbo ? 0.6 : 1);
	const bigCountDuration = (alias: WinLevelAlias) =>
		Math.max(1500, (BIG_COUNT_MS[alias] ?? 3000) * turboFactor());
	const bigHoldDuration = () =>
		bookEventAmountToBetAmountMultiplier(amount) >= 25000
			? 3500
			: stateBet.isSuperTurbo
				? 1200
				: stateBet.isTurbo
					? 1800
					: 2500;

	const clearTimers = () => {
		if (autoCloseTimer) clearTimeout(autoCloseTimer);
		if (dismissTimer) clearTimeout(dismissTimer);
		autoCloseTimer = null;
		dismissTimer = null;
	};

	const snapToFinal = (finishCountUp: () => void) => {
		if (snappedToFinal) return;
		snappedToFinal = true;
		finishCountUp();
	};

	const dismiss = () => {
		if (boardClickHandled) return;
		boardClickHandled = true;
		clearTimers();
		dismissTimer = setTimeout(() => oncomplete(), 220);
	};

	context.eventEmitter.subscribeOnMount({
		winShow: () => (show = true),
		winHide: () => {
			show = false;
			clearTimers();
		},
		winUpdate: async (event) => {
			clearTimers();
			boardClickHandled = false;
			snappedToFinal = false;
			amount = event.amount;
			winLevelData = event.winLevelData;
			isCountingUp = true;
			breatheScale = 1;
			winId += 1;
			await waitForResolve((resolve) => (oncomplete = resolve));
			isCountingUp = false;
		},
	});

	$effect(() => {
		if (!isCountingUp || !winLevelData?.animation) {
			breatheScale = 1;
			return;
		}
		let frame = 0;
		const start = performance.now();
		const tick = (now: number) => {
			breatheScale = 1 + Math.sin((now - start) * 0.0025) * 0.02;
			frame = requestAnimationFrame(tick);
		};
		frame = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(frame);
	});
</script>

<FadeContainer {show}>
	{#if winLevelData}
		{@const isBigWin = winLevelData.type === 'big'}
		{@const hasBoardAnimation = !!winLevelData.animation}
		{@const duration = hasBoardAnimation
			? bigCountDuration(winLevelData.alias)
			: stateBet.isTurbo || stateBet.isSuperTurbo
				? Math.min(winLevelData.presentDuration, 400)
				: winLevelData.presentDuration * 0.5}

		<WinCountUpProvider
			{amount}
			{duration}
			easing={countCurve}
			restartKey={winId}
			oncomplete={() => {
				if (!hasBoardAnimation) {
					if (!boardClickHandled) {
						snappedToFinal = true;
						boardClickHandled = true;
						oncomplete();
					}
					return;
				}
				if (!boardClickHandled) {
					if (autoCloseTimer) clearTimeout(autoCloseTimer);
					autoCloseTimer = setTimeout(() => oncomplete(), bigHoldDuration());
				}
			}}
		>
			{#snippet children({ countUpAmount, finishCountUp, countUpCompleted })}
				{#if isBigWin}
					<CanvasSizeRectangle backgroundColor={0x000000} backgroundAlpha={0.42} />
				{/if}

				<MainContainer>
					<Container x={boardLayout.x} y={boardLayout.y}>
						{#if hasBoardAnimation}
							{@const boardScale = boardLayout.boardScale}
							{@const boardSize = Math.min(
								boardLayout.width * boardScale * 0.72,
								boardLayout.height * boardScale * 0.82,
							)}
							{@const currentMultiplier =
								bookEventAmountToBetAmountMultiplier(countUpAmount)}
							{@const finalMultiplier = bookEventAmountToBetAmountMultiplier(amount)}
							{#if currentMultiplier >= 25000}
								<Container scale={breatheScale}>
									<Sprite
										key="winMax"
										anchor={0.5}
										width={boardSize * 1.5}
										height={boardSize}
									/>
									<Text
										anchor={0.5}
										y={boardSize * 0.29}
										text={bookEventAmountToCurrencyString(countUpAmount)}
										style={{
											fontFamily: 'Cinzel',
											fontWeight: '900',
											fontSize: SYMBOL_SIZE * boardScale * 0.22,
											align: 'center',
											fill: 0xffffff,
											stroke: { color: 0x2b082f, width: 5 },
										}}
									/>
								</Container>
							{:else}
								<ThemeWinBoard
									boardKey={boardKeyForMultiplier(currentMultiplier)}
									finalKey={boardKeyForMultiplier(finalMultiplier)}
									{winId}
									{boardSize}
									amountText={bookEventAmountToCurrencyString(countUpAmount)}
									fontSize={SYMBOL_SIZE * boardScale * 0.22}
									{breatheScale}
								/>
							{/if}
						{:else}
							{@const maxWidth =
								context.stateLayoutDerived.canvasSizes().width /
								context.stateLayoutDerived.mainLayout().scale}
							{@const scale =
								smallWinSize.width > maxWidth ? maxWidth / smallWinSize.width : 1}
							<Container {scale}>
								<Text
									anchor={0.5}
									onresize={(size) => (smallWinSize = size)}
									text={bookEventAmountToCurrencyString(countUpAmount)}
									style={{
										fontFamily: 'Cinzel',
										fontWeight: '900',
										fontSize: SYMBOL_SIZE * 0.7,
										align: 'center',
										fill: 0xffe36b,
										stroke: { color: 0x5c116f, width: 8 },
									}}
								/>
							</Container>
						{/if}
					</Container>
				</MainContainer>

				{#if hasBoardAnimation}
					<PressToContinue
						showText={false}
						onpress={() => {
							if (!countUpCompleted && !snappedToFinal) {
								snapToFinal(finishCountUp);
							} else {
								dismiss();
							}
						}}
					/>
				{/if}
			{/snippet}
		</WinCountUpProvider>
	{/if}
</FadeContainer>
