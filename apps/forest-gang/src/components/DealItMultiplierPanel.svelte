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
	import { hold } from '../game/sequenceHold';
	import { SYMBOL_SIZE, SYMBOL_W } from '../game/constants';
	import { GOLD_GRADIENT } from '../game/goldGradient';

	// Flat leaf-corner board (counterFrame — same art as the FREE SPINS / EARNED card). Match the
	// top symbol board width (BonusSymbolPanel uses SYMBOL_W * 1.1). The bear paw is retired; the
	// value zooms onto this board instead (design ask — same reveal as GlobalMultiplier).
	const BOARD_W = SYMBOL_W * 1.1;
	const NUM_FONT = BOARD_W * 0.215;
	// Red X emblem (872×776 after crop) shown at 1x — matches GlobalMultiplier (All In board).
	const X_RED_W = BOARD_W * 0.34;
	// Vertical centre nudge so the Cinzel caps sit in the middle of the wood board.
	const NUM_Y = BOARD_W * 0.012;

	const context = getContext();
	// Mobile-landscape: the rail becomes a full-height LEFT column (rendered in MainContainer).
	const isLandscape = $derived(context.stateLayoutDerived.layoutType() === 'landscape');
	// Desktop: MULTIPLIER sits in the RIGHT strip beside the board, aligned with the EARNED card on the
	// left (both render in MainContainer / main-layout units — see the two-margin design reference).
	const isDesktop = $derived(context.stateLayoutDerived.layoutType() === 'desktop');
	const lsRail = $derived(context.stateGameDerived.landscapeRail());

	// FS + EARNED card geometry (mirror FreeSpinCounter / BonusEarnedPanel) so MULTIPLIER lines up with
	// the EARNED card on the left.
	const FS_SIZE = 0.72;
	const fsPanelW = SYMBOL_SIZE * 2.0 * FS_SIZE;
	const fsPanelH = fsPanelW / (372 / 248);
	const EARN_H = BOARD_W * 0.76;
	const desktopMainPosition = $derived.by(() => {
		const bl = context.stateGameDerived.boardLayout();
		const main = context.stateLayoutDerived.mainLayout();
		// Same centre X as the symbol panel above (both boards' wood is fsPanelW wide and centred
		// on the container origin, so equal centres give equal left edges — mirror its formula).
		const rightStripCenterX = (bl.x + bl.width * 0.522 * bl.boardScaleX + main.width) / 2 - SYMBOL_SIZE * 0.1;
		const fsTopY = main.height * 0.03 + (main.width * 0.12) / (1176 / 572) + SYMBOL_SIZE * 0.15;
		const gap = SYMBOL_SIZE * 0.12;
		// Mirror the LEFT column's spacing (design ask): the gap between the symbol panel above and
		// this board's wood top equals the FREE SPINS → EARNED gap (gap + 0.35·SYMBOL_SIZE, see
		// BonusEarnedPanel.desktopMainPosition). The symbol panel's box matches the FS card box
		// (fsTopY + fsPanelH bottom), and the board wood is ~0.65·BOARD_W tall rendered at
		// fsPanelW/BOARD_W scale — so its half-height in main units is 0.325·fsPanelW.
		return {
			x: rightStripCenterX,
			y: fsTopY + fsPanelH + gap + SYMBOL_SIZE * 0.35 + fsPanelW * 0.325,
		};
	});
	const scale = $derived(
		isLandscape
			? lsRail.refWidth / BOARD_W
			: isDesktop
				? fsPanelW / BOARD_W // match the FREE SPINS / EARNED card width
				: 1.28, // portrait / tablet stacked
	);

	// Mirror BonusSymbolPanel geometry so the DealIt panel sits directly below it (portrait stacked).
	const _symPadW = SYMBOL_W * 1.1;
	const _symPadH = _symPadW * (420 / 624);
	const boardW = $derived(context.stateGameDerived.boardLayout().width);
	const portraitPosition = $derived({
		x: boardW - _symPadW * 0.5 - 10,
		y: -SYMBOL_SIZE * 0.6 + _symPadH * 0.5 + 18 + 30,
	});
	const position = $derived(
		isLandscape
			? { x: lsRail.x, y: lsRail.multiplierY }
			: isDesktop
				? desktopMainPosition
				: portraitPosition,
	);

	// This is the "ALL IN" bonus board (internally `freegame`/`feature` — the UI labels are the reverse
	// of the mode names). Its hand is HIDDEN during spins and only appears when the multiplier CHANGES:
	// it slides in with the new value, holds, then slides out and hides again. `multiplier` is the last
	// shown value, kept across spins so a drop back to 1x still reads as a change (negative sting).
	let show = $state(false);
	let multiplier = $state(1);
	let pendingTarget = $state(1);
	// Zoom reveal (matches GlobalMultiplier): the board fades in oversized then settles to 1x
	// (backOut), holds, then fades out — no bear paw sliding across.
	let groupScale = new Tween(1);
	let groupAlpha = new Tween(1);
	// Value pops onto the board once it has landed (backOut scale) for a distinct landing moment.
	let numReveal = new Tween(1);
	let revealed = false;
	let skipReveal: (() => void) | null = null;
	// True only during the hold phase (after the zoom-in settles). Prevents the stopButtonClick that
	// triggered forceStop from also immediately skipping the reveal on the same key press.
	let readyToSkip = false;

	const skipNow = (fromStopClick = false) => {
		if (!show) return;
		if (fromStopClick && !readyToSkip) return;
		revealed = true;
		show = false;
		groupScale.set(1, { duration: 0 });
		groupAlpha.set(1, { duration: 0 });
		skipReveal?.();
	};

	// Reveal the board with the new value (zoom out onto the board), hold, then fade it out.
	const revealChange = async (next: number) => {
		if (show) return; // guard against overlapping reveals
		revealed = false;
		readyToSkip = false;
		multiplier = next;
		groupScale.set(1.45, { duration: 0 }); // oversized start
		groupAlpha.set(0, { duration: 0 });
		numReveal.set(0, { duration: 0 }); // value hidden until the board has landed
		show = true; // FadeContainer fades it in
		groupScale.set(1, { duration: 300, easing: backOut }); // zoom out to settle
		groupAlpha.set(1, { duration: 200 });
		// DELIBERATELY RAW, in all speed modes: this 300/80/180 window is the reveal itself, and
		// `readyToSkip` exists precisely so the press that triggered forceStop cannot also hide the
		// board before the player has seen it. It is also lock-stepped with the 300 ms / 240 ms
		// tweens above and below — scaling the waits without scaling those would hide the board
		// mid-zoom. Only the HOLD after it (below) is scaled and skippable.
		await waitForTimeout(300);
		if (revealed) { readyToSkip = false; return; }
		// Beat, then pop the value onto the board.
		await waitForTimeout(80);
		numReveal.set(1, { duration: 240, easing: backOut });
		await waitForTimeout(180);
		if (revealed) { readyToSkip = false; return; }
		readyToSkip = true;
		// The read-the-value hold and the fade-out: scaled by speed mode, and cut short by a stop
		// press either directly (skipReveal, when the press lands during this phase) or via the
		// round's sticky interrupt (when it landed earlier — e.g. the press that stopped the reels).
		await Promise.race([hold(900), new Promise<void>((r) => { skipReveal = r; })]);
		skipReveal = null;
		readyToSkip = false;
		if (revealed) return;
		groupAlpha.set(0, { duration: 260 }); // fade the board out (slight zoom for a soft exit)
		groupScale.set(1.12, { duration: 260, easing: cubicIn });
		await Promise.race([hold(260), new Promise<void>((r) => { skipReveal = r; })]);
		skipReveal = null;
		if (revealed) return;
		show = false; // FadeContainer fades it out
	};

	$effect(() => {
		if (!context.stateGame.paylineSnap) return;
		skipNow();
	});

	context.eventEmitter.subscribeOnMount({
		// Bonus start / each winning spin — the hand stays hidden; only the per-spin target resets to 1x.
		dealItMultiplierStart: () => {
			pendingTarget = 1;
		},
		// The multiplier for this spin (only broadcast when a multiplier applies).
		dealItMultiplierSetTarget: ({ multiplier: m }: { multiplier: number }) => {
			pendingTarget = m;
		},
		// Commit point (after the win resolves): reveal the hand ONLY when the value changed.
		dealItMultiplierAwaitCycle: async () => {
			if (pendingTarget === multiplier) return; // no change → keep the hand hidden
			context.eventEmitter.broadcast({
				type: 'soundOnce',
				name: pendingTarget > multiplier ? 'sfx_multiplier_hand_up' : 'sfx_multiplier_hand_reset',
			});
			await revealChange(pendingTarget);
		},
		// Player press during the multiplier hold — skip to win immediately (ignored during slide-in).
		stopButtonClick: () => skipNow(true),
		// Bonus end (or switch to the other bonus): clear and hide.
		dealItMultiplierHide: () => {
			show = false;
			multiplier = 1;
			pendingTarget = 1;
			groupScale.set(1, { duration: 0 });
			groupAlpha.set(1, { duration: 0 });
		},
	});
</script>

{#snippet panel()}
	<!-- Flat leaf-corner board; the value zooms out onto it when the multiplier changes (fade via
	     FadeContainer + groupAlpha, scale settle via groupScale). No bear paw. -->
	<Container x={position.x} y={position.y} scale={scale * groupScale.current} alpha={groupAlpha.current}>
			<!-- Hand-less board (same art as the FREE SPINS / EARNED card), centred on the origin. -->
			<Sprite key="counterFrame" anchor={0.5} width={BOARD_W * 1.02} height={BOARD_W * 0.76} />

			<!-- At 1x, show the red X emblem; otherwise the Cinzel 900 gold number.
			     Wrapped in a scaling container for the pop-in reveal (numReveal). -->
			<Container y={NUM_Y} scale={numReveal.current}>
				{#if multiplier === 1}
					<Sprite
						key="multiplierXRed"
						anchor={0.5}
						width={X_RED_W}
						height={X_RED_W * (776 / 872)}
					/>
				{:else}
					<Text
						anchor={0.5}
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
