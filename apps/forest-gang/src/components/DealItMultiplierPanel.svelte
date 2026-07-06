<script lang="ts" module>
	export type EmitterEventDealItMultiplier =
		| { type: 'dealItMultiplierShow' }
		| { type: 'dealItMultiplierHide' }
		| { type: 'dealItMultiplierSpin'; multiplier: number }
		| { type: 'dealItMultiplierAwaitCycle' }
		| { type: 'dealItMultiplierSetTarget'; multiplier: number }
		| { type: 'dealItMultiplierStart' };
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

	// Bear-hand board sizing — multiplier_hand.png is 944×708; its board region is 592px wide,
	// centred at (368,324). Match the top symbol board (BonusSymbolPanel uses SYMBOL_W * 1.1).
	const BOARD_W = SYMBOL_W * 1.1;
	const HAND_W = BOARD_W * (944 / 592);
	const HAND_H = HAND_W * (708 / 944);
	const NUM_FONT = BOARD_W * 0.215;
	// Red X emblem (872×776 after crop) shown at 1x — matches GlobalMultiplier (All In board).
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

	// Mirror BonusSymbolPanel geometry so the DealIt panel sits directly below it.
	const _symPadW = SYMBOL_W * 1.1;
	const _symPadH = _symPadW * (420 / 624);
	const boardW = $derived(context.stateGameDerived.boardLayout().width);
	const desktopPosition = $derived({
		x: boardW + 40 + railAdj.x,
		y: SYMBOL_SIZE * 0.3 + _symPadH * 0.5 + 18 + 30,
	});
	const portraitPosition = $derived({
		x: boardW - _symPadW * 0.5 - 10,
		y: -SYMBOL_SIZE * 0.6 + _symPadH * 0.5 + 18 + 30,
	});
	const position = $derived(
		isLandscape
			? { x: lsRail.x, y: lsRail.multiplierY }
			: context.stateLayoutDerived.isStacked()
				? portraitPosition
				: desktopPosition,
	);

	// The hand is HIDDEN during spins and only appears when the multiplier CHANGES: it slides in with
	// the new value, holds, then slides out and hides again. `multiplier` is the last shown value, kept
	// across spins so a drop back to 1x still reads as a change (negative sting + red X).
	let show = $state(false);
	let multiplier = $state(1);
	let pendingTarget = $state(1);
	let groupX = new Tween(0);

	// Reveal the hand with the new value, hold, then hide it again.
	const revealChange = async (next: number) => {
		if (show) return; // guard against overlapping reveals
		multiplier = next;
		groupX.set(-SLIDE, { duration: 0 }); // start off to the left
		show = true; // FadeContainer fades it in
		groupX.set(0, { duration: 320, easing: backOut }); // slide into place
		await waitForTimeout(320 + 900); // slide-in + hold on the new value
		groupX.set(SLIDE, { duration: 240, easing: cubicIn }); // slide out to the right
		await waitForTimeout(240);
		show = false; // FadeContainer fades it out
	};

	context.eventEmitter.subscribeOnMount({
		// Bonus start / each winning spin — the hand stays hidden; only the per-spin target resets to 1x.
		// `multiplier` (last shown value) is NOT reset, so a spin that lands on 1x after a higher one is
		// treated as a change and reveals the red X with the negative sting.
		dealItMultiplierStart: () => {
			pendingTarget = 1;
		},
		// The multiplier for this spin (only broadcast when a multiplier applies).
		dealItMultiplierSetTarget: ({ multiplier: m }: { multiplier: number }) => {
			pendingTarget = m;
		},
		// Commit point (after the win resolves): reveal the hand ONLY when the value changed — positive
		// sting when it lands on a multiplier, negative when it drops back to 1x.
		dealItMultiplierAwaitCycle: async () => {
			if (pendingTarget === multiplier) return; // no change → keep the hand hidden
			context.eventEmitter.broadcast({
				type: 'soundOnce',
				name: pendingTarget > multiplier ? 'sfx_multiplier_hand_up' : 'sfx_multiplier_hand_reset',
			});
			await revealChange(pendingTarget);
		},
		// Bonus end (or switch to All In): clear and hide.
		dealItMultiplierHide: () => {
			show = false;
			multiplier = 1;
			pendingTarget = 1;
			groupX.set(0, { duration: 0 });
		},
	});
</script>

{#snippet panel()}
	<!-- The hand+board+number group slides in/out when the multiplier changes (fade via FadeContainer) -->
	<Container x={position.x + groupX.current} y={position.y} {scale}>
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
