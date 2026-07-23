<script lang="ts" module>
	import type { WinLevelData } from '../game/winLevelMap';

	export type EmitterEventWin =
		| { type: 'winShow' }
		| { type: 'winHide' }
		| { type: 'winUpdate'; amount: number; winLevelData: WinLevelData };
</script>

<script lang="ts">
	import { Container, Sprite, Text } from 'pixi-svelte';
	import { FadeContainer, WinCountUpProvider } from 'components-pixi';
	import { waitForResolve } from 'utils-shared/wait';
	import { bookEventAmountToCurrencyString } from 'utils-shared/amount';
	import { CanvasSizeRectangle, MainContainer } from 'components-layout';
	import { OnMount } from 'components-shared';

	import PressToContinue from './PressToContinue.svelte';
	import { SYMBOL_SIZE } from '../game/constants';
	import { getContext } from '../game/context';
	import { stateBet } from 'state-shared';
	import { Tween } from 'svelte/motion';
	import { backOut, cubicOut } from 'svelte/easing';

	const context = getContext();

	let show = $state(false);
	let amount = $state(0);
	let winLevelData = $state<WinLevelData>();
	let oncomplete = $state(() => {});
	let boardClickHandled = false;
	let isCountingUp = $state(false);
	let shakeX = $state(0);
	let shakeY = $state(0);
	let floatScale = $state(1);
	const boardIntroScale = new Tween(1);
	const boardRotation = new Tween(0);

	const boardLayout = $derived(context.stateGameDerived.boardLayout());
	const winBoardKey = (level: number) => {
		if (level >= 10) return 'winMythic';
		if (level >= 9) return 'winLegendary';
		if (level >= 8) return 'winEpic';
		if (level >= 7) return 'winWild';
		return 'winSweet';
	};

	const playBoardIntro = async () => {
		boardIntroScale.set(0.35, { duration: 0 });
		boardRotation.set(-0.055, { duration: 0 });
		await Promise.all([
			boardIntroScale.set(1.08, { duration: 520, easing: backOut }),
			boardRotation.set(0.018, { duration: 420, easing: cubicOut }),
		]);
		await Promise.all([
			boardIntroScale.set(1, { duration: 220, easing: cubicOut }),
			boardRotation.set(0, { duration: 220, easing: cubicOut }),
		]);
	};

	context.eventEmitter.subscribeOnMount({
		winShow: () => (show = true),
		winHide: () => (show = false),
		winUpdate: async (emitterEvent) => {
			boardClickHandled = false;
			amount = emitterEvent.amount;
			winLevelData = emitterEvent.winLevelData;
			isCountingUp = true;
			if (emitterEvent.winLevelData.animation) void playBoardIntro();
			await waitForResolve((resolve) => (oncomplete = resolve));
			isCountingUp = false;
		},
	});

	$effect(() => {
		if (!isCountingUp || !winLevelData?.animation) {
			shakeX = 0;
			shakeY = 0;
			floatScale = 1;
			return;
		}

		const alias = winLevelData.alias;
		const amp =
			alias === 'max'
				? 14
				: alias === 'epic'
					? 10
					: alias === 'mega'
						? 7
						: alias === 'superwin'
							? 5
							: 3;
		const duration = winLevelData.presentDuration;

		let raf = 0;
		let startTime = 0;

		const tick = (t: number) => {
			if (!startTime) startTime = t;
			const elapsed = t - startTime;
			const progress = Math.min(elapsed / duration, 1);
			const decay = 1 - progress * progress;
			const angle = elapsed * 0.016; // ~15Hz shake
			shakeX = Math.round(Math.sin(angle) * amp * decay);
			shakeY = Math.round(Math.cos(angle * 0.73) * amp * 0.45 * decay);
			floatScale = 1 + Math.sin(elapsed * 0.0045) * 0.012;
			if (progress < 1) raf = requestAnimationFrame(tick);
		};
		raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
	});
</script>

<FadeContainer {show}>
	{#if winLevelData}
		{@const isBigWin = winLevelData.type === 'big'}
		{@const hasBoardAnimation = !!winLevelData?.animation}
		{@const duration =
			(stateBet.isTurbo || stateBet.isSuperTurbo) && !hasBoardAnimation
				? Math.min(winLevelData.presentDuration, 400)
				: winLevelData.presentDuration}
		{#key oncomplete}
			<WinCountUpProvider
				{amount}
				{duration}
				oncomplete={() => {
					if (!hasBoardAnimation) oncomplete();
				}}
			>
				{#snippet children({ countUpAmount, startCountUp, finishCountUp, countUpCompleted })}
					{#if isBigWin}
						<CanvasSizeRectangle backgroundColor={0x000000} backgroundAlpha={0.5} />
					{/if}

					<OnMount onmount={() => startCountUp()} />

					<MainContainer>
						<Container x={boardLayout.x + shakeX} y={boardLayout.y + shakeY}>
							{#if hasBoardAnimation}
								{@const bs = boardLayout.boardScale}
								{@const boardSize = Math.min(
									boardLayout.width * bs * 0.68,
									boardLayout.height * bs * 0.72,
								)}
								<Container
									scale={boardIntroScale.current * floatScale}
									rotation={boardRotation.current}
								>
									<Sprite
										key={winBoardKey(winLevelData.level)}
										anchor={0.5}
										width={boardSize}
										height={boardSize}
									/>
									<Text
										anchor={0.5}
										y={boardSize * 0.405}
										text={bookEventAmountToCurrencyString(countUpAmount)}
										style={{
											fontFamily: 'Arial Black, sans-serif',
											fontSize: SYMBOL_SIZE * bs * 0.22,
											align: 'center',
											fontWeight: 'bold',
											fill: 0xffffff,
											stroke: { color: 0x2b082f, width: 5 },
										}}
									/>
								</Container>
							{:else}
								<Text
									anchor={0.5}
									text={bookEventAmountToCurrencyString(countUpAmount)}
									style={{
										fontFamily: 'Arial Black, sans-serif',
										fontSize: SYMBOL_SIZE * 0.7,
										align: 'center',
										fontWeight: 'bold',
										fill: 0xffe36b,
										stroke: { color: 0x5c116f, width: 8 },
									}}
								/>
							{/if}
						</Container>
					</MainContainer>

					{#if hasBoardAnimation}
						<PressToContinue
							onpress={() => {
								if (!countUpCompleted) {
									finishCountUp();
								} else {
									if (boardClickHandled) return;
									boardClickHandled = true;
									oncomplete();
								}
							}}
						/>
					{/if}
				{/snippet}
			</WinCountUpProvider>
		{/key}
	{/if}
</FadeContainer>
