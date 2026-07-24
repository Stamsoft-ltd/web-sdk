<script lang="ts" module>
	import type { WinLevelData } from '../game/winLevelMap';

	export type EmitterEventWin =
		| { type: 'winShow' }
		| { type: 'winHide' }
		| { type: 'winUpdate'; amount: number; winLevelData: WinLevelData };
</script>

<script lang="ts">
	import { Container, Text, SpineProvider, SpineTrack } from 'pixi-svelte';
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
	let snappedToFinal = false;
	let dismissTimer = 0;
	// Board-animation (big) wins auto-close this long after the count-up finishes (no press needed).
	let autoCloseTimer = 0;
	let isCountingUp = $state(false);
	let winSizes = $state({ width: 0, height: 0 });

	// Breathing: gentle ±2% scale oscillation while counting up
	let breatheScale = $state(1);

	const boardLayout = $derived(context.stateGameDerived.boardLayout());
	const mainLayout = $derived(context.stateLayoutDerived.mainLayout());
	// Enlarge the win-tier popups (SWEET/WILD/EPIC/MYTHIC/LEGENDARY) for more impact — a bit
	// more on portrait phones where the celebration should dominate the screen. Board + amount
	// text both scale by this so their proportions are preserved.
	const layoutType = $derived(context.stateLayoutDerived.layoutType());
	// Mobile (portrait + landscape) win boards run 20% smaller than desktop (design ask).
	// Portrait gets +10%, then another +10% (design ask "win animations a bit bigger, all") so the
	// celebration reads bigger on phones — applies to every win tier.
	const winBoardBoost = $derived(
		layoutType === 'portrait' ? 1.58 * 0.8 * 1.1 * 1.1 : layoutType === 'landscape' ? 1.6 * 0.8 : 1.6,
	);

	const snapToFinal = (finishCountUp: () => void) => {
		if (snappedToFinal) return;
		snappedToFinal = true;
		finishCountUp();
		context.stateGame.paylineSnap = true;
	};

	const scheduleDismiss = () => {
		if (boardClickHandled) return;
		boardClickHandled = true;
		clearTimeout(autoCloseTimer);
		dismissTimer = setTimeout(() => oncomplete(), 300) as unknown as number;
	};

	context.eventEmitter.subscribeOnMount({
		winShow: () => (show = true),
		winHide: () => {
			show = false;
			// Win-screen audio (coins loop, payline loop, celebration music) runs until the screen
			// CLOSES — not until the count-up finishes (space/click only snaps the counter).
			context.eventEmitter.broadcast({ type: 'soundStop', name: 'sfx_win_coins_loop' });
			context.eventEmitter.broadcast({ type: 'soundStop', name: 'sfx_payline_win' });
			context.eventEmitter.broadcast({ type: 'soundStop', name: 'bgm_win_animation' });
		},
		winUpdate: async (emitterEvent) => {
			boardClickHandled = false;
			snappedToFinal = false;
			clearTimeout(dismissTimer);
			dismissTimer = 0;
			clearTimeout(autoCloseTimer);
			autoCloseTimer = 0;
			amount = emitterEvent.amount;
			winLevelData = emitterEvent.winLevelData;
			breatheScale = 1;
			isCountingUp = true;
			// Board-animation (big) wins auto-close a short hold after the count-up finishes — no manual
			// press required (see the WinCountUpProvider oncomplete below). Non-board wins self-resolve
			// on count-up completion there too. A manual press can still snap/close earlier.
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
		<!-- Small/medium wins tally at half their present duration (600ms–1.75s) so they read as a
		     count-up rather than an instant pop; big-win boards keep the quarter scale (2.5s–11s)
		     since their presentDurations are an order of magnitude longer. -->
		{@const duration = (stateBet.isTurbo || stateBet.isSuperTurbo) && !hasBoardAnimation ? Math.min(winLevelData.presentDuration, 400) : winLevelData.presentDuration * (winLevelData.type === 'big' ? 0.25 : 0.5)}
		{#key oncomplete}
		<WinCountUpProvider {amount} {duration} oncomplete={() => {
			context.eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_win_count_end' });
			if (!hasBoardAnimation) {
				if (!boardClickHandled) { snappedToFinal = true; context.stateGame.paylineSnap = true; boardClickHandled = true; oncomplete(); }
			} else if (!boardClickHandled) {
				// Board-animation (big) win finished counting (naturally or via a press-snap) → auto-close
				// after a 3s hold instead of waiting for a manual press. A further press still closes sooner.
				context.stateGame.paylineSnap = true;
				clearTimeout(autoCloseTimer);
				autoCloseTimer = setTimeout(() => oncomplete(), 3000) as unknown as number;
			}
		}}>
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
				{#if hasBoardAnimation && bookEventAmountToBetAmountMultiplier(countUpAmount) >= 25000}
					<!-- MAX WIN: only at the game's true max (25000×). 500×–24999× stays LEGENDARY. The
					     live count-up still climbs through the tier boards before reaching this screen. -->
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
							{@const maxBoardSize = Math.min(boardLayout.width * bs * 0.55, boardLayout.height * bs * 0.85) * winBoardBoost}
							<!-- Golden radial glow behind the board — the fsIntro spine's glow layers with the
							     frame stripped (fs_glow.json), slightly smaller than on the congratulations screen. -->
							<SpineProvider key="winGlow" width={maxBoardSize * 1.3}>
								<SpineTrack trackIndex={0} animationName="idle" loop />
							</SpineProvider>
							<WinBoard
								{boardKey}
								{maxBoardSize}
								{breatheScale}
								{mult}
								countUpText={bookEventAmountToCurrencyString(countUpAmount)}
								fontSize={SYMBOL_SIZE * bs * 0.21 * winBoardBoost}
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

				<!-- No text on the win screen. First press snaps the count-up to the final amount; once the
				     count is done (snapped or naturally finished) the next press closes it immediately. -->
				<PressToContinue showText={false} onpress={() => {
					if (!countUpCompleted && !snappedToFinal) {
						snapToFinal(finishCountUp);
					} else {
						scheduleDismiss();
					}
				}} />
			{/snippet}
		</WinCountUpProvider>
		{/key}
	{/if}
</FadeContainer>
