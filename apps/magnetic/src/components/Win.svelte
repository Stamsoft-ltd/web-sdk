<script lang="ts" module>
	import type { WinLevelData } from '../game/winLevelMap';

	export type EmitterEventWin =
		| { type: 'winShow' }
		| { type: 'winHide' }
		| { type: 'winUpdate'; amount: number; winLevelData: WinLevelData };
</script>

<script lang="ts">
	import { Container, Graphics, Text, type Sizes } from 'pixi-svelte';
	import { FadeContainer, WinCountUpProvider } from 'components-pixi';
	import { waitForResolve } from 'utils-shared/wait';
	import { bookEventAmountToCurrencyString } from 'utils-shared/amount';
	import { CanvasSizeRectangle, MainContainer } from 'components-layout';
	import { OnMount } from 'components-shared';

	import WinCoins from './WinCoins.svelte';
	import PressToContinue from './PressToContinue.svelte';
	import { Sprite } from 'pixi-svelte';
	import { SYMBOL_SIZE } from '../game/constants';
	import { getContext } from '../game/context';
	import { winBoardByAlias } from '../game/utils';
	import { WIN_GRADIENT } from '../game/goldGradient';
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
	// Measured text sizes for scale-to-fit (board plaque / full-screen win).
	let boardSizes = $state<Sizes>({ width: 0, height: 0 });
	let winSizes = $state<Sizes>({ width: 0, height: 0 });

	const boardLayout = $derived(context.stateGameDerived.boardLayout());
	const mainLayout = $derived(context.stateLayoutDerived.mainLayout());

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
							{@const mult = stateBet.betAmount > 0 ? countUpAmount / stateBet.betAmount : 0}
							<!-- MAX WIN board is reserved for the 20000x win cap; LEGENDARY covers 250x up to the cap. -->
							{@const boardKey = mult >= 20000 ? 'maxWinBoard' : mult >= 250 ? winBoardByAlias.epic : mult >= 100 ? winBoardByAlias.mega : mult >= 50 ? winBoardByAlias.superwin : winBoardByAlias.big}
							{@const boardSize = Math.min(boardLayout.width * bs * 0.55, boardLayout.height * bs * 0.85)}
							<!-- The MAX WIN art is wide (1535×1025), not square; its amount plaque sits lower/narrower. -->
							{@const isMaxBoard = boardKey === 'maxWinBoard'}
							{@const boardW = isMaxBoard ? boardSize * 1.35 : boardSize}
							{@const boardH = isMaxBoard ? boardW * (1025 / 1535) : boardSize}
							<!-- Soft ambient glow behind the board, tinted to the tier (matches the Figma ellipse
							     and the forest-gang treatment). Additive concentric circles = cheap radial glow. -->
							{@const glowColor =
								boardKey === 'sweetWinBoard' ? 0x2fb4ff
								: boardKey === 'wildWinBoard' ? 0x46e04b
								: boardKey === 'epicWinBoard' ? 0xff4032
								: boardKey === 'mythicWinBoard' ? 0xa64dff
								: 0xffb428 /* legendary + max win: gold */}
							<Graphics
								blendMode="add"
								draw={(g) => {
									g.clear();
									const R = boardW * 0.78;
									const steps = 14;
									for (let i = steps; i >= 1; i--) {
										const t = i / steps;
										g.beginFill(glowColor, 0.05 * (1 - t) * (1 - t) + 0.004);
										g.drawCircle(0, 0, R * t);
										g.endFill();
									}
								}}
							/>
							{#if boardKey}
								<Sprite
									key={boardKey}
									anchor={0.5}
									width={boardW}
									height={boardH}
								/>
							{/if}
							<!-- Win amount — Cinzel 900 gold gradient with a black outline; scales to fit the board -->
							{@const boardFont = SYMBOL_SIZE * bs * 0.295}
							{@const boardMaxW = isMaxBoard ? boardW * 0.4 : boardSize * 0.62}
							{@const boardScale = boardSizes.width > boardMaxW ? boardMaxW / boardSizes.width : 1}
							<!-- 0.37: digits sit visually centred in the plaque (Cinzel's ascender space pushes them up) -->
							<Container y={isMaxBoard ? boardH * 0.31 : boardSize * 0.37} scale={boardScale}>
								<Text
									anchor={0.5}
									onresize={(s) => (boardSizes = s)}
									text={bookEventAmountToCurrencyString(countUpAmount)}
									style={{
										fontFamily: 'Cinzel',
										fontWeight: '900',
										fontSize: boardFont,
										fill: WIN_GRADIENT,
										align: 'center',
										letterSpacing: boardFont * 0.03,
										stroke: { color: 0x000000, width: Math.max(2, Math.round(boardFont * 0.04)) },
									}}
								/>
							</Container>
						{:else}
							{@const winMaxW = context.stateLayoutDerived.canvasSizes().width / context.stateLayoutDerived.mainLayout().scale}
							{@const winScale = winSizes.width > winMaxW ? winMaxW / winSizes.width : 1}
							<!-- Line-win amount (no board animation) — white, per design feedback -->
							<Container scale={winScale}>
								<Text
									anchor={0.5}
									onresize={(s) => (winSizes = s)}
									text={bookEventAmountToCurrencyString(countUpAmount)}
									style={{
										fontFamily: 'Cinzel',
										fontWeight: '900',
										fontSize: SYMBOL_SIZE,
										fill: 0xffffff,
										align: 'center',
										letterSpacing: SYMBOL_SIZE * 0.03,
										stroke: { color: 0x000000, width: Math.max(2, Math.round(SYMBOL_SIZE * 0.04)) },
									}}
								/>
							</Container>
						{/if}
					</Container>
				</MainContainer>

				<WinCoins emit={true} levelAlias={winLevelData?.alias} boardMode={hasBoardAnimation} />

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
