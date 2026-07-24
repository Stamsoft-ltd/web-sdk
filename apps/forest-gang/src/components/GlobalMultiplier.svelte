<script lang="ts" module>
	export type EmitterEventGlobalMultiplier =
		| { type: 'globalMultiplierShow' }
		| { type: 'globalMultiplierHide' }
		| { type: 'globalMultiplierUpdate'; multiplier: number };
</script>

<script lang="ts">
	import { Tween } from 'svelte/motion';
	import { cubicIn, backOut } from 'svelte/easing';

	import { Container, Sprite, Text } from 'pixi-svelte';
	import { FadeContainer } from 'components-pixi';
	import { MainContainer } from 'components-layout';
	import { waitForTimeout } from 'utils-shared/wait';

	import BoardContainer from './BoardContainer.svelte';
	import { getContext } from '../game/context';
	import { SYMBOL_SIZE, SYMBOL_W } from '../game/constants';
	import { GOLD_GRADIENT } from '../game/goldGradient';

	// Bear-hand board sizing (board panel ≈ 58% of the 944×708 image width)
	// Match the top symbol board (BonusSymbolPanel uses SYMBOL_W * 1.1).
	// The hand image is 944×708; its board region is 592px wide, centred at (368,324).
	const BOARD_W = SYMBOL_W * 1.1;
	const HAND_W = BOARD_W * (944 / 592);
	const HAND_H = HAND_W * (708 / 944);
	const NUM_FONT = BOARD_W * 0.215;
	// Red X emblem (872×776 after crop) shown at 1x — sized to sit on the wood board.
	const X_RED_W = BOARD_W * 0.34;
	// Vertical centre nudge so the Cinzel caps sit in the middle of the wood board.
	const NUM_Y = BOARD_W * 0.012;
	const SLIDE = BOARD_W * 0.55;
	const context = getContext();
	// Shrink-to-fit + centred in the strip right of the board on desktop (see bonusRailAdjust).
	const railAdj = $derived(context.stateGameDerived.bonusRailAdjust(BOARD_W));
	// Mobile-landscape: the rail becomes a full-height LEFT column (rendered in MainContainer).
	const isLandscape = $derived(context.stateLayoutDerived.layoutType() === 'landscape');
	// Desktop: the board sits in the RIGHT strip in MainContainer / main-layout units, mirroring
	// BonusSymbolPanel / DealItMultiplierPanel — NOT BoardContainer, whose origin/scale drift
	// with the viewport and pushed this board away from the symbol card on laptop windows.
	const isDesktop = $derived(context.stateLayoutDerived.layoutType() === 'desktop');
	const lsRail = $derived(context.stateGameDerived.landscapeRail());
	// FS-card geometry (mirror FreeSpinCounter / BonusEarnedPanel) — shared width unit for the
	// right-strip cards so this board matches the symbol panel above it.
	const FS_SIZE = 0.72;
	const fsPanelW = SYMBOL_SIZE * 2.0 * FS_SIZE;
	const fsPanelH = fsPanelW / (372 / 248);
	const scale = $derived(
		isLandscape
			? lsRail.refWidth / (BOARD_W * 1.02) // flat board wood spans its full sprite — normalise to the rail card width
			: isDesktop
				? fsPanelW / BOARD_W // match the FREE SPINS / EARNED / SYMBOL card width
				: 1.28 * railAdj.scale,
	);
	// Mirror BonusSymbolPanel geometry to place multiplier directly below it
	const _symPadW = SYMBOL_W * 1.1;
	const _symPadH = _symPadW * (420 / 624);
	const desktopMainPosition = $derived.by(() => {
		const bl = context.stateGameDerived.boardLayout();
		const main = context.stateLayoutDerived.mainLayout();
		// Same centre X as the symbol panel above (equal wood widths → equal left edges).
		const rightStripCenterX = (bl.x + bl.width * 0.522 * bl.boardScaleX + main.width) / 2 - SYMBOL_SIZE * 0.1;
		const fsTopY = main.height * 0.03 + (main.width * 0.12) / (1176 / 572) + SYMBOL_SIZE * 0.15;
		const gap = SYMBOL_SIZE * 0.12;
		// Mirror the LEFT column's FREE SPINS → EARNED spacing: symbol-panel bottom (fsTopY +
		// fsPanelH) + the same gap, then down by the board wood's half-height (0.325·fsPanelW).
		return {
			x: rightStripCenterX,
			y: fsTopY + fsPanelH + gap + SYMBOL_SIZE * 0.35 + fsPanelW * 0.325,
		};
	});
	const portraitPosition = $derived({
		x: context.stateGameDerived.boardLayout().width - _symPadW * 0.5 - 10,
		y: -SYMBOL_SIZE * 0.6 + _symPadH * 0.5 + 18 + 30,
	});
	const position = $derived(
		isLandscape
			? { x: lsRail.x, y: lsRail.multiplierY }
			: isDesktop
				? desktopMainPosition
				: portraitPosition,
	);

	// This is the "DEAL IT" bonus board (internally `superspin` — the UI labels are the reverse of the
	// mode names). Its hand is PERSISTENT: it stays on screen for the whole bonus (red X at 1x) and
	// animates (slide out, swap value, slide in) only when the global multiplier CHANGES.
	let show = $state(false);
	let multiplier = $state(1);
	let groupX = new Tween(0);
	let groupAlpha = new Tween(1);
	let groupScale = new Tween(1);
	let swapTarget: number | null = null;
	let swapped = false;

	// ALL layouts now show a hand-less leaf-corner board; the multiplier value zooms out onto it
	// (fade + oversized → settle) rather than the bear paw sliding in (design ask — apply the
	// zoom pad everywhere the multiplier appears: Deal It, All In, and every other situation).
	const useFlatBoard = true;

	// Swap the displayed value — desktop/landscape: slide-out / swap / slide-in (the hand moves);
	// portrait: fade, then the new value zooms out onto the static board.
	const swapTo = async (next: number) => {
		swapTarget = next;
		swapped = false;
		if (!useFlatBoard) groupX.set(SLIDE, { duration: 170, easing: cubicIn });
		groupAlpha.set(0, { duration: 150 });
		await waitForTimeout(170);
		if (swapped) return;
		swapTarget = null;
		multiplier = next;
		if (useFlatBoard) {
			groupScale.set(1.45, { duration: 0 });
			groupScale.set(1, { duration: 280, easing: backOut });
		} else {
			groupX.set(-SLIDE, { duration: 0 });
			groupX.set(0, { duration: 280, easing: backOut });
		}
		groupAlpha.set(1, { duration: 190 });
		await waitForTimeout(280);
	};

	$effect(() => {
		if (!context.stateGame.paylineSnap) return;
		swapped = true;
		if (swapTarget !== null) {
			multiplier = swapTarget;
			swapTarget = null;
		}
		groupX.set(0, { duration: 0 });
		groupScale.set(1, { duration: 0 });
		groupAlpha.set(1, { duration: 0 });
	});

	context.eventEmitter.subscribeOnMount({
		// Bonus start — show the board at 1x (red X) and keep it visible for the whole bonus.
		globalMultiplierShow: () => {
			show = true;
			multiplier = 1;
			groupX.set(0, { duration: 0 });
			groupAlpha.set(1, { duration: 0 });
		},
		globalMultiplierHide: () => {
			show = false;
			multiplier = 1;
			groupX.set(0, { duration: 0 });
			groupAlpha.set(1, { duration: 0 });
		},
		globalMultiplierUpdate: async (emitterEvent) => {
			const next = emitterEvent.multiplier;
			if (next === multiplier) return; // no change → stay on the current value

			context.eventEmitter.broadcast({
				type: 'soundOnce',
				name: next < multiplier ? 'sfx_multiplier_hand_reset' : 'sfx_multiplier_hand_up',
			});

			await swapTo(next);
		},
	});
</script>

{#snippet panel()}
	<!-- Persistent board; the group slides + fades when the multiplier value changes -->
	<Container
		x={position.x + groupX.current}
		y={position.y}
		alpha={groupAlpha.current}
		scale={scale * groupScale.current}
	>
			{#if useFlatBoard}
				<!-- Portrait: hand-less leaf-corner board (same art as the EARNED card) — the bear
				     paw crowded the stacked column (design ask). -->
				<Sprite key="counterFrame" anchor={0.5} width={BOARD_W * 1.02} height={BOARD_W * 0.76} />
			{:else}
				<!-- Bear-hand board: panel centre (0.39/0.458) at the container origin, paw extends right -->
				<Sprite key="multiplierHand" anchor={{ x: 0.39, y: 0.458 }} width={HAND_W} height={HAND_H} />
			{/if}

			<!-- At 1x, show the red X emblem; otherwise the Cinzel 900 gold number -->
			{#if multiplier === 1}
				<Sprite
					key="multiplierXRed"
					anchor={0.5}
					y={NUM_Y}
					width={X_RED_W}
					height={X_RED_W * (776 / 872)}
				/>
			{:else}
				<Text
					anchor={0.5}
					y={NUM_Y}
					text={`${multiplier}X`}
					style={{
						fontFamily: 'Cinzel',
						fontWeight: '900',
						fontSize: NUM_FONT,
						fill: GOLD_GRADIENT,
						align: 'center',
						letterSpacing: NUM_FONT * 0.03,
					}}
				/>
			{/if}
		</Container>
{/snippet}

{#if isLandscape || isDesktop}
	<FadeContainer {show}>
		<MainContainer>{@render panel()}</MainContainer>
	</FadeContainer>
{:else}
	<FadeContainer {show}>
		<BoardContainer>{@render panel()}</BoardContainer>
	</FadeContainer>
{/if}
