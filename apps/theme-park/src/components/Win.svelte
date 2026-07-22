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

	const context = getContext();

	let show = $state(false);
	let amount = $state(0);
	let winLevelData = $state<WinLevelData>();
	let oncomplete = $state(() => {});
	let boardClickHandled = false;
	let isCountingUp = $state(false);
	let shakeX = $state(0);
	let shakeY = $state(0);

	const boardLayout = $derived(context.stateGameDerived.boardLayout());

	context.eventEmitter.subscribeOnMount({
		winShow: () => (show = true),
		winHide: () => (show = false),
		winUpdate: async (emitterEvent) => {
			boardClickHandled = false;
			amount = emitterEvent.amount;
			winLevelData = emitterEvent.winLevelData;
			isCountingUp = true;
			await waitForResolve((resolve) => (oncomplete = resolve));
			isCountingUp = false;
		},
	});

	$effect(() => {
		if (!isCountingUp || !winLevelData?.animation) {
			shakeX = 0;
			shakeY = 0;
			return;
		}

		const alias = winLevelData.alias;
		const amp = alias === 'max' ? 14 : alias === 'epic' ? 10 : alias === 'mega' ? 7 : alias === 'superwin' ? 5 : 3;
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
		{@const duration = (stateBet.isTurbo || stateBet.isSuperTurbo) && !hasBoardAnimation ? Math.min(winLevelData.presentDuration, 400) : winLevelData.presentDuration}
		{#key oncomplete}
		<WinCountUpProvider {amount} {duration} oncomplete={() => { if (!hasBoardAnimation) oncomplete(); }}>
			{#snippet children({ countUpAmount, startCountUp, finishCountUp, countUpCompleted })}
				{#if isBigWin}
					<CanvasSizeRectangle backgroundColor={0x000000} backgroundAlpha={0.5} />
				{/if}

				<OnMount onmount={() => startCountUp()} />

				<MainContainer>
					<Container
						x={boardLayout.x + shakeX}
						y={boardLayout.y + shakeY}
					>
						{#if hasBoardAnimation}
							{@const bs = boardLayout.boardScale}
							{@const boardSize = Math.min(boardLayout.width * bs * 0.68, boardLayout.height * bs * 0.72)}
							<Sprite
								key="forestBonusBadge"
								anchor={0.5}
								width={boardSize}
								height={boardSize * 0.62}
							/>
							<Text
								anchor={0.5}
								y={-boardSize * 0.105}
								text={winLevelData.text ?? 'WIN'}
								style={{
									fontFamily: 'Arial Black, sans-serif',
									fontSize: SYMBOL_SIZE * bs * 0.22,
									align: 'center',
									fontWeight: 'bold',
									letterSpacing: 3,
									fill: 0xffe36b,
									stroke: { color: 0x6b166f, width: 5 },
								}}
							/>
							<Text
								anchor={0.5}
								y={boardSize * 0.095}
								text={bookEventAmountToCurrencyString(countUpAmount)}
								style={{
									fontFamily: 'Arial Black, sans-serif',
									fontSize: SYMBOL_SIZE * bs * 0.25,
									align: 'center',
									fontWeight: 'bold',
									fill: 0xffffff,
									stroke: { color: 0x2b082f, width: 5 },
								}}
							/>
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
					<PressToContinue onpress={() => {
						if (!countUpCompleted) {
							finishCountUp();
						} else {
							if (boardClickHandled) return;
							boardClickHandled = true;
							oncomplete();
						}
					}} />
				{/if}
			{/snippet}
		</WinCountUpProvider>
		{/key}
	{/if}
</FadeContainer>
