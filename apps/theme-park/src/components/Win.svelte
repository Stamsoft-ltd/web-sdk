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
	import { CanvasSizeRectangle, MainContainer } from 'components-layout';
	import { stateBet } from 'state-shared';
	import { Tween } from 'svelte/motion';
	import { backOut } from 'svelte/easing';
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
	import WinCoinRain, { coinsForMultiplier } from './WinCoinRain.svelte';

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

	// One climb time for EVERY big win (design ask, matching Forest Gang): the count rate scales
	// with the amount instead of the time, so 50x and 5000x both land in the same beat. Only the
	// turbo modes shorten it.
	const BIG_COUNT_MS = 2500;
	const turboFactor = () => (stateBet.isSuperTurbo ? 0.4 : stateBet.isTurbo ? 0.6 : 1);
	const bigCountDuration = () => Math.max(1500, BIG_COUNT_MS * turboFactor());
	// How long the finished card sits there before it closes itself. EXTRA_HOLD is a flat design ask
	// (2026-08-12): the card was leaving too soon to take in, so every mode holds three seconds
	// longer. It is on top of the per-mode figures rather than folded into them so the turbo modes
	// keep their relative pacing, and a player who wants it gone can still press to dismiss.
	const EXTRA_HOLD = 3000;
	const bigHoldDuration = () =>
		EXTRA_HOLD +
		(bookEventAmountToBetAmountMultiplier(amount) >= 25000
			? 3500
			: stateBet.isSuperTurbo
				? 1200
				: stateBet.isTurbo
					? 1800
					: 2500);

	// ── Small wins (levels 1-5, no card) ────────────────────────────────────────────────────────
	//
	// These used to be a bare gold number over the reels that finished counting and vanished in the
	// same frame — on a grid of lit marquee symbols there was nothing to read it against and no time
	// to read it in. Three things fix that, and none of them touch the card tiers: it lands on its own
	// dark lozenge, it pops in rather than appearing, and it holds for a beat once the count lands.
	const SMALL_POP_MS = 280;
	const SMALL_HOLD_MS = 750;

	/**
	 * The gold marquee plaque the amount sits inside, drawn at its authored aspect.
	 *
	 * It replaces a stack of dark ellipses that did the same job — separate the number from the lit
	 * reels behind it — but read as a smudge rather than as part of the park. Aspect is fixed and the
	 * TEXT is what shrinks to fit, because the frame's corner scrollwork and its two centred gems make
	 * it the one piece of art in this game that cannot be stretched: 3-slicing it would space out the
	 * bulbs running along its edges and put a second gem in the wrong place.
	 */
	const PLAQUE_ASPECT = 244 / 163;
	const PLAQUE_H = SYMBOL_SIZE * 1.5;
	const PLAQUE_W = PLAQUE_H * PLAQUE_ASPECT;
	/**
	 * How much of the plaque the amount may fill. Well inside the flat purple: the frame's inner edge
	 * curves in at the corners and the gems bite into the top and bottom centre, so the largest
	 * genuinely clear rectangle is much smaller than the purple region's bounding box.
	 */
	const PLAQUE_TEXT_W = 0.62;
	const PLAQUE_TEXT_H = 0.4;

	const smallPop = new Tween(1, { duration: SMALL_POP_MS, easing: backOut });
	const smallHoldDuration = () => SMALL_HOLD_MS * turboFactor();

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
			if (!event.winLevelData.animation) {
				smallPop.set(0.7, { duration: 0 });
				smallPop.set(1, { duration: SMALL_POP_MS, easing: backOut });
			}
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
			? bigCountDuration()
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
						// Held rather than closed on the frame the number lands — see SMALL_HOLD_MS.
						if (autoCloseTimer) clearTimeout(autoCloseTimer);
						autoCloseTimer = setTimeout(() => oncomplete(), smallHoldDuration());
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

				<!-- Coin rain, entirely BEHIND the card: in front it competed with the amount, which
				     is the one thing on this screen the player is actually reading. Mounted
				     unconditionally and gated by `intensity` — layering here is MOUNT ORDER, so a
				     layer mounted on demand would jump above the card. -->
				<WinCoinRain
					count={coinsForMultiplier(bookEventAmountToBetAmountMultiplier(amount))}
					intensity={hasBoardAnimation ? 1 : 0}
				/>

				<MainContainer>
					<Container x={boardLayout.x} y={boardLayout.y}>
						{#if hasBoardAnimation}
							{@const boardScale = boardLayout.boardScale}
							{@const boardSize = Math.min(
								boardLayout.width * boardScale * 0.72,
								boardLayout.height * boardScale * 0.82,
							)}
							<!-- The FINAL tier's card shows from the first frame (design ask, matching
							     Forest Gang) — no SWEET→…→LEGENDARY ladder while the number climbs. -->
							{@const finalMultiplier = bookEventAmountToBetAmountMultiplier(amount)}
							{#if finalMultiplier >= 25000}
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
											fontFamily: 'Lilita One',
											fontWeight: '400',
											fontSize: SYMBOL_SIZE * boardScale * 0.22,
											align: 'center',
											fill: 0xffffff,
											stroke: { color: 0x2b082f, width: 5 },
										}}
									/>
								</Container>
							{:else}
								<ThemeWinBoard
									boardKey={boardKeyForMultiplier(finalMultiplier)}
									active={show}
									{winId}
									{boardSize}
									amountText={bookEventAmountToCurrencyString(countUpAmount)}
									fontSize={boardSize * 0.105}
									{breatheScale}
								/>
							{/if}
						{:else}
							{@const maxWidth =
								context.stateLayoutDerived.canvasSizes().width /
								context.stateLayoutDerived.mainLayout().scale}
							{@const scale = PLAQUE_W > maxWidth ? maxWidth / PLAQUE_W : 1}
							{@const textFit = Math.min(
								1,
								smallWinSize.width ? (PLAQUE_W * PLAQUE_TEXT_W) / smallWinSize.width : 1,
								smallWinSize.height ? (PLAQUE_H * PLAQUE_TEXT_H) / smallWinSize.height : 1,
							)}
							<Container scale={scale * smallPop.current}>
								<!-- Behind the number, so it is read against something other than lit reels. -->
								<Sprite key="tpSmallWinPlaque" anchor={0.5} width={PLAQUE_W} height={PLAQUE_H} />
								<!-- Scaled rather than re-sized: dropping fontSize per amount re-rasterises the
								     glyphs, which makes the number crawl as it counts up. -->
								<Container scale={textFit}>
									<Text
										anchor={0.5}
										onresize={(size) => (smallWinSize = size)}
										text={bookEventAmountToCurrencyString(countUpAmount)}
										style={{
											fontFamily: 'Lilita One',
											fontWeight: '400',
											fontSize: SYMBOL_SIZE * 0.8,
											align: 'center',
											fill: 0xffe36b,
											stroke: { color: 0x3d0b4a, width: 10 },
											dropShadow: {
												color: 0x000000,
												alpha: 0.55,
												blur: 6,
												distance: 3,
												angle: Math.PI / 2,
											},
										}}
									/>
								</Container>
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
