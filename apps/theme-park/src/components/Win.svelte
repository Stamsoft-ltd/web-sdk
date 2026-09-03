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
		bookEventAmountToCurrencyStringAtTargetPrecision,
	} from 'utils-shared/amount';
	import { waitForResolve } from 'utils-shared/wait';

	import { SYMBOL_SIZE } from '../game/constants';
	import { getContext } from '../game/context';
	import type { MarqueeTier } from '../game/winCardMarquee';
	import { isMaxWin, tierForMultiplier } from '../game/winPresentation';
	import type { MusicName } from '../game/sound';
	import MaxWinCard, { MAXWIN_IMPACT_MS } from './MaxWinCard.svelte';
	import PressToContinue from './PressToContinue.svelte';
	import WinCard, { CARD_IMPACT_MS } from './WinCard.svelte';
	import WinConfettiRain, { confettiForMultiplier } from './WinConfettiRain.svelte';

	const context = getContext();

	// The five big-win beds track the marquee tiers (tierForMultiplier), so the music the player hears
	// matches the wordmark they see. MAX WIN has no bed of its own — it shows <MaxWinCard> instead of
	// a sixth wordmark, and rides the top bed.
	const BIGWIN_MUSIC: Record<MarqueeTier, MusicName> = {
		sweet: 'bgm_bigwin_sweet',
		wild: 'bgm_bigwin_wild',
		epic: 'bgm_bigwin_epic',
		mythic: 'bgm_bigwin_mythic',
		legendary: 'bgm_bigwin_legendary',
	};
	const bigWinMusicFor = (multiplier: number): MusicName =>
		isMaxWin(multiplier) ? 'bgm_bigwin_legendary' : BIGWIN_MUSIC[tierForMultiplier(multiplier)];

	// The big-win bed currently replacing the background bed, so winHide can stop the right one.
	let activeBigWinMusic: MusicName | null = null;
	const stopWinCountLoop = () =>
		context.eventEmitter.broadcast({ type: 'soundStop', name: 'sfx_win_count_loop' });

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
	/** The canvas in the units everything inside <MainContainer> is drawn in. */
	const mainWidth = $derived(
		context.stateLayoutDerived.canvasSizes().width / context.stateLayoutDerived.mainLayout().scale,
	);

	// === Big-win card ===
	//
	// The marquee is sized against the REELS at the proportions the design has it (Figma 7013:9117:
	// a 653.6px-wide card over a 691x457 board), so it covers the same share of the game whatever
	// the viewport. Both figures are that ONE card measured two ways — against the board's width and
	// against its height — so a layout whose board is proportionally taller than the design's cannot
	// push the card off the top.
	//
	// Held at 80% of the design's figures (design ask, 2026-08-18): at full size the card ran the
	// whole width of the board and its amount plate hung off the bottom edge, so the win covered the
	// grid it is celebrating instead of sitting on it.
	const CARD_SIZE = 0.8;
	const CARD_TO_BOARD_W = 0.946 * CARD_SIZE;
	const CARD_TO_BOARD_H = 1.43 * CARD_SIZE;
	/**
	 * The assembly's full width in card widths. The plate IS the widest piece now that the design's
	 * static confetti fan is no longer drawn — the stars land well inside it — so this is 1 plus a
	 * hair for the bloom.
	 */
	const ASSEMBLY_W = 1.02;
	/** The card sits above the board's centre — the amount plate takes the space below it. */
	const CARD_Y = -0.11;

	// The MAX WIN card is a different shape: its plate is the same unit, but the rides, balloons and
	// tents hang a long way outside it and the logo sits under its foot, so the assembly is 1.32 card
	// widths across and 1.14 tall against the marquee's ~1.0 and ~0.79. These figures hold the max
	// card's assembly to the same footprint the marquee's gets rather than to the same PLATE size,
	// which would put its wheel through the top of the board.
	const MAXWIN_TO_BOARD_W = 0.585;
	const MAXWIN_TO_BOARD_H = 0.788;
	const MAXWIN_ASSEMBLY_W = 1.32;
	/** Centred on the board: this card carries its own amount lozenge rather than hanging one below. */
	const MAXWIN_Y = -0.02;

	const isMax = $derived(isMaxWin(bookEventAmountToBetAmountMultiplier(amount)));
	const cardWidth = $derived(
		isMax
			? Math.min(
					boardLayout.width * boardLayout.boardScale * MAXWIN_TO_BOARD_W,
					boardLayout.height * boardLayout.boardScale * MAXWIN_TO_BOARD_H,
					(mainWidth * 0.94) / MAXWIN_ASSEMBLY_W,
				)
			: Math.min(
					boardLayout.width * boardLayout.boardScale * CARD_TO_BOARD_W,
					boardLayout.height * boardLayout.boardScale * CARD_TO_BOARD_H,
					(mainWidth * 0.94) / ASSEMBLY_W,
				),
	);

	// Keep the amount moving linearly through most tier thresholds, then settle smoothly.
	const EASE_T = 0.8;
	const EASE_V = (2 * EASE_T) / (1 + EASE_T);
	const countCurve = (t: number) => {
		if (t < EASE_T) return (EASE_V / EASE_T) * t;
		const u = (t - EASE_T) / (1 - EASE_T);
		return EASE_V + (1 - EASE_V) * u * (2 - u);
	};
	const formatCountUpAmount = (value: number) =>
		bookEventAmountToCurrencyStringAtTargetPrecision(value, amount);

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
		EXTRA_HOLD + (isMax ? 3500 : stateBet.isSuperTurbo ? 1200 : stateBet.isTurbo ? 1800 : 2500);

	// ── Small wins (levels 1-5, no card) ────────────────────────────────────────────────────────
	//
	// These used to be a bare gold number over the reels that finished counting and vanished in the
	// same frame — on a grid of lit marquee symbols there was nothing to read it against and no time
	// to read it in. Three things fix that, and none of them touch the card tiers: it lands on its own
	// dark lozenge, it pops in rather than appearing, and it holds for a beat once the count lands.
	const SMALL_POP_MS = 280;
	const SMALL_HOLD_MS = 750;

	/**
	 * The neon plate the amount sits inside, drawn at its authored aspect — cut by
	 * `scripts/win-plate/build_win_plate.py`.
	 *
	 * It replaces a stack of dark ellipses that did the same job — separate the number from the lit
	 * reels behind it — but read as a smudge rather than as part of the park. Aspect is fixed and the
	 * TEXT is what shrinks to fit: stretching a neon keyline to the width of a long amount would
	 * thin the tube out along the top and bottom rails and thicken it up the sides.
	 */
	const PLAQUE_ASPECT = 512 / 307;
	const PLAQUE_H = SYMBOL_SIZE * 1.5;
	const PLAQUE_W = PLAQUE_H * PLAQUE_ASPECT;
	/**
	 * How much of the plate the amount may fill, and where its middle is — the numbers the builder
	 * prints. The field inside the keyline is 0.928 x 0.902 of the plate and is centred on it, so
	 * the amount is centred too (PLAQUE_TEXT_Y 0, where the starred v1 card had to sit low to clear
	 * the star), and these leave a margin of field showing on all four sides of the number.
	 */
	const PLAQUE_TEXT_W = 0.86;
	const PLAQUE_TEXT_H = 0.58;
	const PLAQUE_TEXT_Y = 0;

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
			stopWinCountLoop();
			// End of the big-win presentation — stop its bed, which resumes the background bed.
			if (activeBigWinMusic) {
				context.eventEmitter.broadcast({ type: 'soundStop', name: activeBigWinMusic });
				activeBigWinMusic = null;
			}
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
			if (event.winLevelData.animation) {
				// Big win: its tier bed takes over the music and the coin-count loop runs while it climbs.
				activeBigWinMusic = bigWinMusicFor(bookEventAmountToBetAmountMultiplier(event.amount));
				context.eventEmitter.broadcast({ type: 'soundMusic', name: activeBigWinMusic });
				context.eventEmitter.broadcast({ type: 'soundLoop', name: 'sfx_win_count_loop' });
			} else {
				smallPop.set(0.7, { duration: 0 });
				smallPop.set(1, { duration: SMALL_POP_MS, easing: backOut });
				if (event.amount > 0) {
					context.eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_regular_win' });
				}
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
				// The amount has landed — the coin-count loop belongs to the climb, so end it here
				// while the big-win bed keeps playing under the held card.
				stopWinCountLoop();
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
			{#snippet children({ countUpDisplayAmount, finishCountUp, countUpCompleted })}
				{#if isBigWin}
					<CanvasSizeRectangle backgroundColor={0x000000} backgroundAlpha={0.42} />
				{/if}

				<!-- Confetti rain, entirely BEHIND the card: in front it competed with the amount,
				     which is the one thing on this screen the player is actually reading. Mounted
				     unconditionally and gated by `intensity` — layering here is MOUNT ORDER, so a
				     layer mounted on demand would jump above the card.

				     Held until the wordmark lands, so the rain reads as thrown by the impact rather
				     than as weather the card fell into. It is the ONLY confetti on screen: the
				     design's static fan around the plate is not drawn (design ask, 2026-08-18). -->
				<WinConfettiRain
					count={confettiForMultiplier(bookEventAmountToBetAmountMultiplier(amount))}
					intensity={hasBoardAnimation ? 1 : 0}
					delay={(isMax ? MAXWIN_IMPACT_MS : CARD_IMPACT_MS) / 1000}
					restartKey={winId}
				/>

				<MainContainer>
					<Container x={boardLayout.x} y={boardLayout.y}>
						{#if hasBoardAnimation}
							<!-- The FINAL tier's card shows from the first frame (design ask, matching
							     Forest Gang) — no SWEET→…→LEGENDARY ladder while the number climbs. -->
							{@const finalMultiplier = bookEventAmountToBetAmountMultiplier(amount)}
							<Container y={(isMax ? MAXWIN_Y : CARD_Y) * cardWidth} scale={breatheScale}>
								{#if isMax}
									<!-- The win cap gets its own lockup, not a sixth wordmark on the
									     marquee plate — see winPresentation.ts. -->
									<MaxWinCard
										active={show}
										{winId}
										{cardWidth}
										amountText={formatCountUpAmount(countUpDisplayAmount)}
									/>
								{:else}
									<WinCard
										tier={tierForMultiplier(finalMultiplier)}
										active={show}
										{winId}
										{cardWidth}
										amountText={formatCountUpAmount(countUpDisplayAmount)}
									/>
								{/if}
							</Container>
						{:else}
							{@const scale = PLAQUE_W > mainWidth ? mainWidth / PLAQUE_W : 1}
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
								<Container scale={textFit} y={PLAQUE_H * PLAQUE_TEXT_Y}>
									<Text
										anchor={0.5}
										onresize={(size) => (smallWinSize = size)}
										text={formatCountUpAmount(countUpDisplayAmount)}
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
