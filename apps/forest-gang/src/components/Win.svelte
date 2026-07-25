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

	import WinCoins from './WinCoins.svelte';
	import WinBoard, { boardKeyForMult } from './WinBoard.svelte';
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
	// Bumped once per win. The win subtree used to be wrapped in `{#key oncomplete}`, so every win
	// tore down and rebuilt it just to reset the count-up; now the provider resets itself on this.
	let winId = $state(0);

	// ── Count curve (R8) ──────────────────────────────────────────────────────────────────────
	// Linear for the first 80% of the time, then a quadratic ease-out over the last 20%. A plain
	// cubicOut would bunch every tier crossing into the first second (each crossing is an amount
	// threshold, so front-loading the amount front-loads all of them); staying linear through the
	// tier range keeps them spread and still lets the number settle instead of stopping dead.
	// EASE_V = 2T/(1+T) makes the two segments share a slope at the join, so there is no kink.
	const EASE_T = 0.8;
	const EASE_V = (2 * EASE_T) / (1 + EASE_T); // 0.888…
	const countCurve = (t: number) => {
		if (t < EASE_T) return (EASE_V / EASE_T) * t;
		const u = (t - EASE_T) / (1 - EASE_T);
		return EASE_V + (1 - EASE_V) * u * (2 - u);
	};

	// ── Big-win count-up length (R8) ──────────────────────────────────────────────────────────
	// Explicit per-tier lengths in ms, replacing `presentDuration × 0.25` — that formula gave
	// LEGENDARY an 11.25 s climb (45 s presentDuration) on top of a 3 s hold.
	const BIG_COUNT_MS: Record<string, number> = {
		big: 2500, // SWEET
		superwin: 3500, // WILD
		mega: 4500, // EPIC
		epic: 5250, // MYTHIC
		max: 6000, // LEGENDARY / MAX WIN
	};
	// Turbo now shortens big wins too (it never did), but never to a flash: each tier cross-fade
	// needs ~400 ms and MAX WIN needs its entrance, so the floor keeps the choreography readable.
	const BIG_COUNT_MIN_MS = 1500;
	const turboFactor = () => (stateBet.isSuperTurbo ? 0.4 : stateBet.isTurbo ? 0.6 : 1);
	const bigCountDuration = (alias: string) =>
		Math.max(BIG_COUNT_MIN_MS, (BIG_COUNT_MS[alias] ?? 3000) * turboFactor());
	// Hold after the count finishes before the board auto-closes. Follows turbo for the same reason.
	const bigHoldMs = () => (stateBet.isSuperTurbo ? 1200 : stateBet.isTurbo ? 2000 : 2500);

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
			// Tell the (now persistent) WinCountUpProvider a new win started: it resets to 0 and
			// starts counting. Must come after `amount` so it counts up to the right total.
			winId += 1;
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
		     count-up rather than an instant pop; big-win boards use explicit per-tier lengths
		     (BIG_COUNT_MS above) instead of a fraction of their 10–45s presentDuration. -->
		{@const duration = hasBoardAnimation
			? bigCountDuration(winLevelData.alias)
			: (stateBet.isTurbo || stateBet.isSuperTurbo)
				? Math.min(winLevelData.presentDuration, 400)
				: winLevelData.presentDuration * 0.5}
		<WinCountUpProvider {amount} {duration} easing={countCurve} restartKey={winId} oncomplete={() => {
			context.eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_win_count_end' });
			if (!hasBoardAnimation) {
				if (!boardClickHandled) { snappedToFinal = true; context.stateGame.paylineSnap = true; boardClickHandled = true; oncomplete(); }
			} else if (!boardClickHandled) {
				// Board-animation (big) win finished counting (naturally or via a press-snap) → auto-close
				// after a short hold instead of waiting for a manual press. A further press closes sooner.
				context.stateGame.paylineSnap = true;
				clearTimeout(autoCloseTimer);
				autoCloseTimer = setTimeout(() => oncomplete(), bigHoldMs()) as unknown as number;
			}
		}}>
			{#snippet children({ countUpAmount, finishCountUp, countUpCompleted })}

				{#if isBigWin}
					<CanvasSizeRectangle backgroundColor={0x000000} backgroundAlpha={0.3} />
				{/if}

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
							<!-- Live board vs. the board this win ends on (thresholds live in WinBoard). The final
							     one is the only crossing that still pops — the rest cross-fade. -->
							{@const boardKey = boardKeyForMult(mult)}
							{@const finalKey = boardKeyForMult(bookEventAmountToBetAmountMultiplier(amount))}
							{@const maxBoardSize = Math.min(boardLayout.width * bs * 0.55, boardLayout.height * bs * 0.85) * winBoardBoost}
							<!-- Golden radial glow behind the board — the fsIntro spine's glow layers with the
							     frame stripped (fs_glow.json), slightly smaller than on the congratulations screen. -->
							<SpineProvider key="winGlow" width={maxBoardSize * 1.3}>
								<SpineTrack trackIndex={0} animationName="idle" loop />
							</SpineProvider>
							<WinBoard
								{boardKey}
								{finalKey}
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
	{/if}
</FadeContainer>
