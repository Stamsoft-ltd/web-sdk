<script lang="ts">
	import { Container, Sprite, Text, type Sizes } from 'pixi-svelte';
	import { FadeContainer } from 'components-pixi';
	import { MainContainer } from 'components-layout';
	import { stateBet } from 'state-shared';
	import { Tween } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';

	import { bookEventAmountToCurrencyString } from 'utils-shared/amount';

	import BoardContainer from './BoardContainer.svelte';
	import { getContext } from '../game/context';
	import { SYMBOL_SIZE, SYMBOL_W } from '../game/constants';
	import { GOLD_GRADIENT } from '../game/goldGradient';
	import { i18nDerived } from '../i18n/i18nDerived';

	const context = getContext();

	// Match the multiplier board's horizontal geometry so the EARNED board lines up below it.
	const BOARD_W = SYMBOL_W * 1.1;
	const HAND_W = BOARD_W * (944 / 592);
	const HAND_H = HAND_W * (708 / 944);

	// EARNED board uses the leaf-corner wooden frame (confirm_frame.webp, 505×301). Its wood
	// interior is ~92.5% of the width, so size it so that interior matches the "100" board's
	// wood width (BOARD_W) — the reference shows the two boards at nearly equal width.
	const EARN_W = BOARD_W * 1.02;
	// Height matched to the multiplier board's wood region (its wood is ~0.65·BOARD_W tall),
	// not the frame's native 505/301 ratio — otherwise the EARNED board reads too short.
	// The confirm_frame wood interior is ~0.86 of the sprite height, so size up accordingly.
	const EARN_H = BOARD_W * 0.76;

	// Content scales with the board (ratios relative to EARN_W) so it stays proportional.
	const LABEL_FONT = EARN_W * 0.085;
	const AMOUNT_FONT = EARN_W * 0.108;
	const COIN_SIZE = LABEL_FONT * 1.7;
	const COIN_GAP = LABEL_FONT * 0.35;
	// Half of the vertical spacing between the EARNED row and the amount row (kept tight).
	const ROW_GAP = EARN_H * 0.06;

	// Mobile-landscape: the rail becomes a full-height LEFT column (rendered in MainContainer).
	const isLandscape = $derived(context.stateLayoutDerived.layoutType() === 'landscape');
	// Desktop: EARNED sits in the LEFT strip beside the board, stacked directly under the FREE SPINS
	// card (both render in MainContainer / main-layout units — see the two-column design reference).
	const isDesktop = $derived(context.stateLayoutDerived.layoutType() === 'desktop');
	const lsRail = $derived(context.stateGameDerived.landscapeRail());

	const _symPadW = SYMBOL_W * 1.1;
	const _symPadH = _symPadW * (420 / 624);
	const boardW = $derived(context.stateGameDerived.boardLayout().width);
	// Multiplier board wood bottom ≈ center + 0.35·HAND_H (empty space below the board); used only by
	// the portrait stacked layout, where EARNED still drops below the multiplier board.
	const BELOW_MULTIPLIER = HAND_H * 0.35;

	// FS card geometry (mirror FreeSpinCounter.svelte) so EARNED stacks directly beneath it on desktop.
	const FS_SIZE = 0.72;
	const fsPanelW = SYMBOL_SIZE * 2.0 * FS_SIZE;
	const fsPanelH = fsPanelW / (372 / 248);
	const desktopMainPosition = $derived.by(() => {
		const bl = context.stateGameDerived.boardLayout();
		const main = context.stateLayoutDerived.mainLayout();
		// Strip centre between the canvas left edge and the board's left grid edge (mirror FreeSpinCounter).
		const stripCenterX = (bl.x - bl.width * 0.54 * bl.boardScaleX) / 2;
		// FS card top-left Y (below the FOREST GANG logo); drop past the FS card + a gap to EARNED's centre,
		// then a small downward nudge (design ask — a bit more space under the FREE SPINS card).
		const fsTopY = main.height * 0.03 + (main.width * 0.12) / (1176 / 572) + SYMBOL_SIZE * 0.15;
		const gap = SYMBOL_SIZE * 0.12;
		return { x: stripCenterX, y: fsTopY + fsPanelH + gap + EARN_H * 0.5 + SYMBOL_SIZE * 0.35 };
	});

	const scale = $derived(
		isLandscape
			? lsRail.refWidth / EARN_W
			: isDesktop
				? fsPanelW / EARN_W // match the FS card width so the two left-strip boards read as one set
				: 1.28, // portrait / tablet stacked
	);

	const portraitPosition = $derived({
		x: boardW - _symPadW * 0.5 - 10,
		y: (-SYMBOL_SIZE * 0.6 + _symPadH * 0.5 + 18 + 30) + BELOW_MULTIPLIER + EARN_H * 0.5,
	});
	const position = $derived(
		isLandscape
			? { x: lsRail.x, y: lsRail.earnedY }
			: isDesktop
				? desktopMainPosition
				: portraitPosition,
	);

	let show = $state(false);
	// Hidden for single feature spins (no running total → it would just read $0.00), matching the
	// FreeSpinCounter which also hides in feature mode.
	const visible = $derived(show && context.stateGame.bonusMode !== 'feature');
	// Running total earned in the current bonus. winBookEventAmount is a book-event amount
	// (100 = 1× bet), so convert with bookEventAmountToCurrencyString — same as Win.svelte.
	const amountText = $derived(bookEventAmountToCurrencyString(stateBet.winBookEventAmount));

	// Pop the amount on every change (same feel as the FreeSpinCounter): jump enlarged, settle to 1.
	const popScale = new Tween(1, { duration: 450, easing: cubicOut });
	let lastAmount = amountText;
	$effect(() => {
		const a = amountText;
		if (a !== lastAmount) {
			lastAmount = a;
			popScale.set(1.45, { duration: 0 });
			popScale.set(1, { duration: 450, easing: cubicOut });
		}
	});

	let labelSizes: Sizes = $state({ width: 0, height: 0 });

	// Coin + EARNED sit on one centered row.
	const rowWidth = $derived(COIN_SIZE + COIN_GAP + labelSizes.width);

	context.eventEmitter.subscribeOnMount({
		// Appears alongside either multiplier board (Deal It / All In).
		dealItMultiplierStart: () => (show = true),
		globalMultiplierShow: () => (show = true),
		dealItMultiplierHide: () => (show = false),
		globalMultiplierHide: () => (show = false),
	});
</script>

{#snippet panel()}
	<Container x={position.x} y={position.y} {scale}>
			<!-- Leaf-corner wooden board -->
			<Sprite key="counterFrame" anchor={0.5} width={EARN_W} height={EARN_H} />

			<!-- Row 1: coin + EARNED, centered -->
			<Container x={-rowWidth / 2} y={-ROW_GAP - LABEL_FONT * 0.5}>
				<Sprite
					key="earnedCoin"
					anchor={{ x: 0, y: 0.5 }}
					x={0}
					y={0}
					width={COIN_SIZE}
					height={COIN_SIZE}
				/>
				<Text
					x={COIN_SIZE + COIN_GAP}
					y={0}
					anchor={{ x: 0, y: 0.5 }}
					text={i18nDerived.translate('EARNED')}
					onresize={(sizes) => (labelSizes = sizes)}
					style={{
						fontFamily: 'Cinzel',
						fontWeight: '700',
						fontSize: LABEL_FONT,
						fill: GOLD_GRADIENT,
						align: 'center',
						letterSpacing: LABEL_FONT * 0.03,
						wordWrap: false,
					}}
				/>
			</Container>

			<!-- Row 2: earned amount — pops (enlarges then settles) whenever the value changes -->
			<Container x={0} y={ROW_GAP + AMOUNT_FONT * 0.5} scale={popScale.current}>
				<Text
					x={0}
					y={0}
					anchor={0.5}
					text={amountText}
					style={{
						fontFamily: 'Cinzel',
						fontWeight: '700',
						fontSize: AMOUNT_FONT,
						fill: GOLD_GRADIENT,
						align: 'center',
						letterSpacing: AMOUNT_FONT * 0.03,
					}}
				/>
			</Container>
		</Container>
{/snippet}

{#if isLandscape || isDesktop}
	<FadeContainer show={visible}>
		<MainContainer>{@render panel()}</MainContainer>
	</FadeContainer>
{:else}
	<FadeContainer show={visible}>
		<BoardContainer>{@render panel()}</BoardContainer>
	</FadeContainer>
{/if}
