<script lang="ts" module>
	export type EmitterEventPortraitTopBar = { type: 'portraitTopBarNoop' };
</script>

<script lang="ts">
	import { Tween } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';
	import { FadeContainer } from 'components-pixi';
	import { MainContainer } from 'components-layout';
	import { stateBet } from 'state-shared';
	import { bookEventAmountToCurrencyString } from 'utils-shared/amount';

	import InfoBox from './InfoBox.svelte';
	import { getContext } from '../game/context';
	import { i18nDerived } from '../i18n/i18nDerived';

	const context = getContext();
	const main = $derived(context.stateLayoutDerived.mainLayout());
	// The capsule bar shows in portrait ALWAYS (mirrors the desktop CapsulePanel, whose tube is always
	// visible). The ALL WINS (reward) / FREE SPINS boxes flanking it only appear during the two
	// SPECIAL (bought) bonuses.
	const isPortrait = $derived(context.stateLayoutDerived.layoutType() === 'portrait');
	const isBonus = $derived(
		context.stateGame.bonusMode === 'freegame' || context.stateGame.bonusMode === 'superspin',
	);
	// TOTAL WIN — mirrors the desktop CapsulePanel: the running win counts up smoothly to the total on
	// every spin. A new bet resets winBookEventAmount to 0, which clears the running total.
	// (globalMultiplier is the wrong value here: it resets to 1 before every freegame spin, so the
	// box would read "x1" for the whole bonus.)
	let runningWin = $state(0);
	const winTarget = $derived(Math.max(runningWin, stateBet.winBookEventAmount));
	$effect(() => {
		if (stateBet.winBookEventAmount === 0) runningWin = 0;
	});
	const winDisplay = new Tween(0, { duration: 500, easing: cubicOut });
	$effect(() => {
		winDisplay.set(winTarget);
	});
	// Round only the IN-FLIGHT tween value: a fractional book amount mid-countup would otherwise
	// render a jittering 7-digit string. Once the tween lands, show the settled amount exactly —
	// rounding a settled book amount truncates the win (book 16.4 must read $0.00164, not $0.0016).
	const displayWinAmount = $derived(
		Math.abs(winDisplay.current - winTarget) < 0.5 ? winTarget : Math.round(winDisplay.current),
	);
	const totalWin = $derived(bookEventAmountToCurrencyString(displayWinAmount));

	// Free-spins counter (mirrors FreeSpinCounter events). Shown as spins REMAINING (total - current).
	let fsCurrent = $state(0);
	let fsTotal = $state(0);
	const fsRemaining = $derived(Math.max(0, fsTotal - fsCurrent));
	context.eventEmitter.subscribeOnMount({
		freeSpinCounterShow: () => (fsCurrent = 0),
		freeSpinCounterUpdate: (e) => {
			if (e.current !== undefined) fsCurrent = e.current;
			if (e.total !== undefined) fsTotal = e.total;
		},
		freeSpinIntroShow: () => (runningWin = 0),
		winUpdate: (e) => (runningWin += e.amount),
	});


	// Top row, above the board. The capsule that used to sit between these boxes is gone (removed
	// with the MOTHERSHIP redesign), so the row is just the boxes now — but they keep the SAME
	// positions, flanking the space where the tube was, rather than sliding together.
	const CY = $derived(main.height * 0.168);
	const BOX_ASPECT = 781 / 335;
	const spanW = $derived(main.width * 0.59);
	const boxW = $derived(main.width * 0.175);
	const boxH = $derived(boxW / BOX_ASPECT);
	const gap = $derived(main.width * 0.004);
	const capsuleX = $derived(main.width * 0.5);
	const leftX = $derived(capsuleX - spanW * 0.5 - gap - boxW * 0.5);
	const rightX = $derived(capsuleX + spanW * 0.5 + gap + boxW * 0.5);

	// RESPIN indicator, portrait. RespinPanel.svelte is gated `{#if !isPortrait}` and PortraitTopBar
	// had no RESPIN of its own, so portrait showed nothing at all during a cluster-growth respin.
	// It lives here rather than in RespinPanel because this component owns the portrait top-bar
	// layout (leftX/CY/boxW/boxH); RespinPanel keeps desktop and landscape.
	// The three boxes' typography lives in InfoBox (it owns the design's label/value metrics), so the
	// local Inter styles and the RESPIN gradient that went with the old smallPadMobile pad are gone.
	const showRespin = $derived(context.stateGame.respinIndicator);
</script>

{#if isPortrait}
	<MainContainer zIndex={25}>
		<!-- RESPIN indicator — sits above TOTAL WIN in the left column. Shown only while a cluster
		     grew and earned a free re-spin (stateGame.respinIndicator). -->
		<FadeContainer show={showRespin}>
			<InfoBox
				x={leftX}
				y={CY - boxH * 1.12}
				width={boxW}
				label={i18nDerived.translate('RESPIN')}
				iconKey="respinIcon"
			/>
		</FadeContainer>

		<!-- TOTAL WIN (running win, counts up each spin) — only during a bonus -->
		{#if isBonus}
			<InfoBox x={leftX} y={CY} width={boxW} label={i18nDerived.translate('TOTAL WIN')} value={totalWin} />
		{/if}

		<!-- FREE SPINS count (remaining) — only during a bonus -->
		{#if isBonus}
			<InfoBox
				x={rightX}
				y={CY}
				width={boxW}
				label={i18nDerived.translate('FREE SPINS')}
				value={`${fsRemaining}`}
			/>
		{/if}
	</MainContainer>
{/if}
