<script lang="ts" module>
	import type { WinLevelData } from '../game/winLevelMap';

	export type EmitterEventWin =
		| { type: 'winShow' }
		| { type: 'winHide' }
		| { type: 'winUpdate'; amount: number; winLevelData: WinLevelData };
</script>

<script lang="ts">
	import { Container, Text } from 'pixi-svelte';
	import { FadeContainer, WinCountUpProvider } from 'components-pixi';
	import { waitForResolve } from 'utils-shared/wait';
	import { bookEventAmountToCurrencyString, bookEventAmountToBetAmountMultiplier } from 'utils-shared/amount';
	import { CanvasSizeRectangle, MainContainer } from 'components-layout';
	import { OnMount } from 'components-shared';

	import WinCoins from './WinCoins.svelte';
	import WinBoard from './WinBoard.svelte';
	import MaxWinScreen from './MaxWinScreen.svelte';
	import PressToContinue from './PressToContinue.svelte';
	import { SYMBOL_SIZE } from '../game/constants';
	import { getContext } from '../game/context';
	import { WIN_GRADIENT } from '../game/goldGradient';
	import { stateBet } from 'state-shared';

	const context = getContext();

	let show = $state(false);
	let amount = $state(0);
	let winLevelData = $state<WinLevelData>();
	let oncomplete = $state(() => {});
	let boardClickHandled = false;
	let isCountingUp = $state(false);
	let winSizes = $state({ width: 0, height: 0 });

	// Breathing: gentle ±2% scale oscillation while counting up
	let breatheScale = $state(1);

	const boardLayout = $derived(context.stateGameDerived.boardLayout());
	const mainLayout = $derived(context.stateLayoutDerived.mainLayout());

	context.eventEmitter.subscribeOnMount({
		winShow: () => (show = true),
		winHide: () => (show = false),
		winUpdate: async (emitterEvent) => {
			boardClickHandled = false;
			amount = emitterEvent.amount;
			winLevelData = emitterEvent.winLevelData;
			breatheScale = 1;
			isCountingUp = true;
			await waitForResolve((resolve) => (oncomplete = resolve));
			isCountingUp = false;
		},
	});

	// Breathing loop
	$effect(() => {
		if (!isCountingUp || !winLevelData?.animation) {
			breatheScale = 1;
			return;
		}
		let raf = 0;
		let start = 0;
		const tick = (t: number) => {
			if (!start) start = t;
			breatheScale = 1 + Math.sin((t - start) * 0.0025) * 0.022;
			raf = requestAnimationFrame(tick);
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
					<CanvasSizeRectangle backgroundColor={0x000000} backgroundAlpha={0.3} />
				{/if}

				<OnMount onmount={() => startCountUp()} />

				<!-- Coins on a low zIndex so the win panel (zIndex 20 below) always stays the hero
				     on top of them — sibling MainContainers don't sort reliably by template order. -->
				<Container zIndex={0}>
					<WinCoins emit={true} levelAlias={winLevelData?.alias} boardMode={hasBoardAnimation} winMult={bookEventAmountToBetAmountMultiplier(countUpAmount)} />
				</Container>

				<Container zIndex={20}>
				{#if hasBoardAnimation && bookEventAmountToBetAmountMultiplier(countUpAmount) >= 1000}
					<!-- MAX WIN: only once the LIVE count-up crosses 1000×, so a max win still climbs
					     through the tier boards (Sweet→…→Legendary) before switching to this screen. -->
					<MaxWinScreen countUpText={bookEventAmountToCurrencyString(countUpAmount)} {breatheScale} />
				{:else}
				<MainContainer>
					<Container
						x={boardLayout.x}
						y={boardLayout.y}
					>
						{#if hasBoardAnimation}
							{@const bs = boardLayout.boardScale}
							<!-- Win multiplier = book amount ÷ 100 (100 book units = 1× bet). Do NOT divide by
							     betAmount — the book amount is already bet-relative, and doing so inflated the
							     tier ~100× (a 25× win showed LEGENDARY instead of SWEET). -->
							{@const mult = bookEventAmountToBetAmountMultiplier(countUpAmount)}
							<!-- Win-tier thresholds (× bet): 20 SWEET · 50 WILD · 100 EPIC · 200 MYTHIC · 500 LEGENDARY.
							     (1000×+ MAX WIN is a separate special screen.) A board only shows from 20× via the
							     winLevel gate, so <50× maps to SWEET. -->
							{@const boardKey = mult >= 500 ? 'legendaryWinBoard' : mult >= 200 ? 'mythicWinBoard' : mult >= 100 ? 'epicWinBoard' : mult >= 50 ? 'wildWinBoard' : 'sweetWinBoard'}
							{@const maxBoardSize = Math.min(boardLayout.width * bs * 0.55, boardLayout.height * bs * 0.85)}
							<WinBoard
								{boardKey}
								{maxBoardSize}
								{breatheScale}
								{mult}
								countUpText={bookEventAmountToCurrencyString(countUpAmount)}
								fontSize={SYMBOL_SIZE * bs * 0.21}
							/>
						{:else}
							<!-- Win amount — Cinzel 900 gold gradient with a black outline; scales to fit the board -->
							{@const winMaxW = context.stateLayoutDerived.canvasSizes().width / context.stateLayoutDerived.mainLayout().scale}
							{@const winScale = winSizes.width > winMaxW ? winMaxW / winSizes.width : 1}
							<Container scale={winScale}>
								<Text
									anchor={0.5}
									onresize={(s) => (winSizes = s)}
									text={bookEventAmountToCurrencyString(countUpAmount)}
									style={{
										fontFamily: 'Cinzel',
										fontWeight: '900',
										fontSize: SYMBOL_SIZE,
										fill: WIN_GRADIENT,
										align: 'center',
										letterSpacing: SYMBOL_SIZE * 0.03,
										stroke: { color: 0x000000, width: Math.max(2, Math.round(SYMBOL_SIZE * 0.04)) },
									}}
								/>
							</Container>
						{/if}
					</Container>
				</MainContainer>
				{/if}
				</Container>

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
