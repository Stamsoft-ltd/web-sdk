<script lang="ts" module>
	export type EmitterEventCapsulePanel = { type: 'capsulePanelNoop' };
</script>

<script lang="ts">
	import { Tween } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';
	import { MainContainer } from 'components-layout';
	import { FadeContainer } from 'components-pixi';
	import { stateBet } from 'state-shared';
	import { bookEventAmountToCurrencyString } from 'utils-shared/amount';

	import { getContext } from '../game/context';
	import { i18nDerived } from '../i18n/i18nDerived';
	import InfoBox from './InfoBox.svelte';

	const context = getContext();
	const board = $derived(context.stateGameDerived.boardLayout());
	const scale = $derived(board.boardScale);

	// This tall vertical capsule is the DESKTOP/tablet column only. Portrait and mobile-landscape use
	// their own compact HUDs, so the whole panel is hidden in both of those.
	const layoutType = $derived(context.stateLayoutDerived.layoutType());
	const isPortrait = $derived(layoutType === 'portrait' || layoutType === 'landscape');
	// The capsule tube is ALWAYS shown (outside portrait) — clusters (and their magnet series) can
	// happen in the base game too. The TOTAL WIN / FREE SPINS boxes only appear during bought bonuses.
	const isBonus = $derived(
		(context.stateGame.bonusMode === 'freegame' || context.stateGame.bonusMode === 'superspin') &&
			!isPortrait,
	);
	// Running total win across the round. Some bonuses only send the cumulative `setTotalWin` at the
	// very end (0 each spin), so we also accumulate every spin's win (winUpdate) and show whichever is
	// larger — the box then grows each time a spin pays instead of only showing the final total.
	let runningWin = $state(0);
	const winTarget = $derived(Math.max(runningWin, stateBet.winBookEventAmount));
	// A new bet resets winBookEventAmount to 0 (a bonus is ONE bet, so it never hits 0 mid-bonus) —
	// use that to clear the base-game running total each spin.
	$effect(() => {
		if (stateBet.winBookEventAmount === 0) runningWin = 0;
	});
	// Count the box up smoothly whenever the total grows, so it visibly sums up on every spin.
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

	// Free-spins counter (mirrors FreeSpinCounter events). Shown as spins REMAINING (10 → 0):
	// `current` is the 1-based spin being played, so remaining = total - current.
	let fsCurrent = $state(0);
	let fsTotal = $state(0);
	const fsRemaining = $derived(Math.max(0, fsTotal - fsCurrent));
	context.eventEmitter.subscribeOnMount({
		freeSpinIntroShow: () => (runningWin = 0),
		freeSpinCounterShow: () => (fsCurrent = 0),
		freeSpinCounterUpdate: (e) => {
			if (e.current !== undefined) fsCurrent = e.current;
			if (e.total !== undefined) fsTotal = e.total;
		},
		winUpdate: (e) => (runningWin += e.amount),
	});

	// Left-rail stack (shared with RespinPanel) — FREE SPINS is slot 0 and TOTAL WIN slot 2, with
	// RESPIN between them, which is the MOTHERSHIP design's order.
	const rail = $derived(context.stateGameDerived.desktopRailStack());
</script>

<MainContainer zIndex={25}>
	<FadeContainer show={!isPortrait}>
		<!-- The magnet capsule (the tall glass pillar and the symbol held in its beam) was removed
		     with the MOTHERSHIP redesign — the design gives that column to the ship instead. What is
		     left of this panel is the bonus rail below. -->
		<!-- FREE SPINS / TOTAL WIN live in the LEFT RAIL now: slots 0 and 2, with RESPIN between.
		     Same plate and size. They used to cap the capsule's top and bottom on the
		     right, which the design does not do. Bonus only — in base game the capsule stands alone. -->
		{#if isBonus}
			<InfoBox
				x={rail.x}
				y={rail.slotY(0)}
				width={rail.boxW}
				label={i18nDerived.translate('FREE SPINS')}
				value={`${fsRemaining}`}
			/>
			<InfoBox
				x={rail.x}
				y={rail.slotY(2)}
				width={rail.boxW}
				label={i18nDerived.translate('TOTAL WIN')}
				value={totalWin}
			/>
		{/if}
	</FadeContainer>
</MainContainer>
