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
	// Shrink + pull-in on short desktop laptop canvases so the rail fits alongside the enlarged board.
	const railAdj = $derived(context.stateGameDerived.bonusRailAdjust());
	// Mobile-landscape: the rail becomes a full-height LEFT column (rendered in MainContainer).
	const isLandscape = $derived(context.stateLayoutDerived.layoutType() === 'landscape');
	const lsRail = $derived(context.stateGameDerived.landscapeRail());
	const scale = $derived(
		isLandscape
			? lsRail.refWidth / BOARD_W
			: (context.stateLayoutDerived.isStacked() ? 1.28 : 1) * railAdj.scale,
	);
	// Mirror BonusSymbolPanel geometry to place multiplier directly below it
	const _symPadW = SYMBOL_W * 1.1;
	const _symPadH = _symPadW * (420 / 624);
	// Desktop: symbol pad center is at boardW + 40
	const desktopPosition = $derived({
		x: context.stateGameDerived.boardLayout().width + 40 + railAdj.x,
		y: SYMBOL_SIZE * 0.3 + _symPadH * 0.5 + 18 + 30,
	});
	const portraitPosition = $derived({
		x: context.stateGameDerived.boardLayout().width - _symPadW * 0.5 - 10,
		y: -SYMBOL_SIZE * 0.6 + _symPadH * 0.5 + 18 + 30,
	});
	const position = $derived(
		isLandscape
			? { x: lsRail.x, y: lsRail.multiplierY }
			: context.stateLayoutDerived.isStacked()
				? portraitPosition
				: desktopPosition,
	);

	// This is the "DEAL IT" bonus board (internally `superspin` — the UI labels are the reverse of the
	// mode names). Its hand is PERSISTENT: it stays on screen for the whole bonus (red X at 1x) and
	// animates (slide out, swap value, slide in) only when the global multiplier CHANGES.
	let show = $state(false);
	let multiplier = $state(1);
	let groupX = new Tween(0);
	let groupAlpha = new Tween(1);
	let swapTarget: number | null = null;
	let swapped = false;

	// Swap the displayed value with a slide-out / swap / slide-in — the board never hides.
	const swapTo = async (next: number) => {
		swapTarget = next;
		swapped = false;
		groupX.set(SLIDE, { duration: 170, easing: cubicIn });
		groupAlpha.set(0, { duration: 150 });
		await waitForTimeout(170);
		if (swapped) return;
		swapTarget = null;
		multiplier = next;
		groupX.set(-SLIDE, { duration: 0 });
		groupX.set(0, { duration: 280, easing: backOut });
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
	<Container x={position.x + groupX.current} y={position.y} alpha={groupAlpha.current} {scale}>
			<!-- Bear-hand board: panel centre (0.39/0.458) at the container origin, paw extends right -->
			<Sprite key="multiplierHand" anchor={{ x: 0.39, y: 0.458 }} width={HAND_W} height={HAND_H} />

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

{#if isLandscape}
	<FadeContainer {show}>
		<MainContainer>{@render panel()}</MainContainer>
	</FadeContainer>
{:else}
	<FadeContainer {show}>
		<BoardContainer>{@render panel()}</BoardContainer>
	</FadeContainer>
{/if}
