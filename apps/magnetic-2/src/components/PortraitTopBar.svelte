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

	// Top row, above the board — straight off the mobile design (4336:15793), which flanks the logo
	// with RESPIN over TOTAL WIN on the left and FREE SPINS on the right.
	//
	// Everything is a fraction of the VISIBLE canvas, not of main.width: the virtual box is 800 wide
	// and at the design's own ~0.62 aspect the player sees ~887 of it, so a fraction of main.width
	// lands each box inboard of where the design measured it — which is what left the pair floating
	// mid-sky rather than tucked into the corners.
	//
	// The design's plates are 90.9 x 38.1 of its 360-wide screen. That aspect is 2.386 against
	// INFO_BOX_ASPECT's 2.387, and its type sizes (7.37 label / 13.11 value on a 90.9 plate) are the
	// same fractions InfoBox already draws — so the plate needs a width here and nothing else.
	const canvas = $derived(context.stateLayoutDerived.canvasSizes());
	const visibleW = $derived(canvas.width / (main.scale || 1));
	const visibleH = $derived(canvas.height / (main.scale || 1));
	const canvasLeftX = $derived(main.width * 0.5 - visibleW * 0.5);
	const canvasTopY = $derived(main.height * 0.5 - visibleH * 0.5);
	const BOX_W_FRACTION = 90.9 / 360;
	/** Column centres. The design's left pair sits a hair inboard of its right box; averaged. */
	const COLUMN_CX = 0.1543;
	const RESPIN_CY = 0.0711;
	const ROW_CY = 0.1655;
	const boxW = $derived(visibleW * BOX_W_FRACTION);
	const leftX = $derived(canvasLeftX + visibleW * COLUMN_CX);
	const rightX = $derived(canvasLeftX + visibleW * (1 - COLUMN_CX));
	const respinY = $derived(canvasTopY + visibleH * RESPIN_CY);
	const rowY = $derived(canvasTopY + visibleH * ROW_CY);

	// RESPIN indicator, portrait. RespinPanel.svelte is gated `{#if !isPortrait}` and PortraitTopBar
	// had no RESPIN of its own, so portrait showed nothing at all during a cluster-growth respin.
	// It lives here rather than in RespinPanel because this component owns the portrait top-bar
	// layout (leftX / respinY / boxW); RespinPanel keeps desktop and landscape.
	// The three boxes' typography lives in InfoBox (it owns the design's label/value metrics), so the
	// local Inter styles and the RESPIN gradient that went with the old smallPadMobile pad are gone.
	const showRespin = $derived(context.stateGame.respinIndicator);
</script>

{#if isPortrait}
	<MainContainer zIndex={25}>
		<!-- RESPIN indicator — sits above TOTAL WIN in the left column. Shown only while a cluster
		     grew and earned a free re-spin (stateGame.respinIndicator). -->
		<FadeContainer show={showRespin}>
			<InfoBox x={leftX} y={respinY} width={boxW} label={i18nDerived.translate('RESPIN')} icon />
		</FadeContainer>

		<!-- TOTAL WIN (running win, counts up each spin) — only during a bonus -->
		{#if isBonus}
			<InfoBox
				x={leftX}
				y={rowY}
				width={boxW}
				label={i18nDerived.translate('TOTAL WIN')}
				value={totalWin}
			/>
		{/if}

		<!-- FREE SPINS count (remaining) — only during a bonus -->
		{#if isBonus}
			<InfoBox
				x={rightX}
				y={rowY}
				width={boxW}
				label={i18nDerived.translate('FREE SPINS')}
				value={`${fsRemaining}`}
			/>
		{/if}
	</MainContainer>
{/if}
