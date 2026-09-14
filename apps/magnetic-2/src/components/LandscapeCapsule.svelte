<script lang="ts" module>
	export type EmitterEventLandscapeCapsule = { type: 'landscapeCapsuleNoop' };
</script>

<script lang="ts">
	import { Tween } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';
	import { MainContainer } from 'components-layout';
	import { stateBet } from 'state-shared';
	import { bookEventAmountToCurrencyString } from 'utils-shared/amount';

	import { getContext } from '../game/context';
	import { i18nDerived } from '../i18n/i18nDerived';
	import InfoBox from './InfoBox.svelte';

	const context = getContext();

	// Only in mobile-landscape. The tall vertical capsule (mobile art, lightning baked in) sits in the
	// gutter right of the board; the ALL WINS / FREE SPINS boxes stack in the left gutter during bonus.
	const isLandscape = $derived(context.stateLayoutDerived.layoutType() === 'landscape');
	const isBonus = $derived(
		context.stateGame.bonusMode === 'freegame' || context.stateGame.bonusMode === 'superspin',
	);
	// TOTAL WIN — mirrors the desktop CapsulePanel: the running win counts up to the total each spin.
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

	// The old live tube electricity (crackle/flicker rAF loop feeding CapsuleBolts and symbol
	// jitter) is removed with the Version2 empty-tube pillar — no per-frame loop runs here until
	// the new in-tube animation is designed.

	// Free-spins counter (spins REMAINING = total - current).
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

	// ── geometry ──
	// TOTAL WIN / FREE SPINS boxes — the top two slots of the left rail. Size and position come from
	// stateGameDerived.landscapeRail(), which is the design's own column (4161:22199). This file and
	// RespinPanel each used to derive the column from the board's left edge and the canvas edge, so
	// the two copies drifted whenever the board moved, and the whole column drifted with the board
	// instead of holding the design's margin.
	const rail = $derived(context.stateGameDerived.landscapeRail());
	const boxW = $derived(rail.boxW);
	const boxH = $derived(rail.boxH);
	const boxX = $derived(rail.x);
	const boxGap = $derived(rail.gap);
	const stackTopY = $derived(rail.topY);
</script>

{#if isLandscape}
	<MainContainer zIndex={25}>
		<!-- FREE SPINS + TOTAL WIN boxes, left rail — only during a bonus. Version2 InfoBox (same
		     art/typography as the desktop rail). Slot order is the DESIGN's (4161:22199):
		     FREE SPINS / TOTAL WIN / RESPIN, which is not the desktop rail's order. -->
		{#if isBonus}
			<InfoBox
				x={boxX}
				y={stackTopY + boxH * 0.5}
				width={boxW}
				label={i18nDerived.translate('FREE SPINS')}
				value={`${fsRemaining}`}
			/>
			<InfoBox
				x={boxX}
				y={stackTopY + boxH * 1.5 + boxGap}
				width={boxW}
				label={i18nDerived.translate('TOTAL WIN')}
				value={totalWin}
			/>
		{/if}
	</MainContainer>
{/if}
