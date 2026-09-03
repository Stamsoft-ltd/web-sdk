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
	import { INFO_BOX_ASPECT } from '../game/constants';
	import { i18nDerived } from '../i18n/i18nDerived';
	import InfoBox from './InfoBox.svelte';

	const context = getContext();
	const main = $derived(context.stateLayoutDerived.mainLayout());
	const board = $derived(context.stateGameDerived.boardLayout());

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
	// Capsule column comes from the shared derived (stateGameDerived) so the HTML buy-bonus button can
	// compute the exact same on-screen position and stay centred beneath the capsule at any ratio.
	const cap = $derived(context.stateGameDerived.landscapeCapsuleLayout());
	const colX = $derived(cap.colX);
	const tubeH = $derived(cap.tubeH);
	const tubeW = $derived(cap.tubeW);
	// New animated tesla tube (mp4 → keyed flipbook), rotated 90° to run vertically. The old glass was
	// only ~94% wide × ~43% tall opaque within its box, so draw the (trimmed) animation at those
	// fractions to land in the same on-screen tube. Falls back to the static glass + crackle.
	const tubeY = $derived(cap.tubeY);
	const gridHalfW = $derived(cap.gridHalfW);
	const canvasLeftX = $derived(
		main.width * 0.5 - context.stateLayoutDerived.canvasSizes().width / (2 * (main.scale || 1)),
	);

	// TOTAL WIN / FREE SPINS boxes — left gutter, stacked. Version2: the same wide steel InfoBox
	// the desktop rail uses, sized to the gutter so it cannot reach the board.
	const boardLeftX = $derived(board.x - gridHalfW);
	// 0.62/0.92 -> 0.55/0.84: the three gutter boxes read too wide on popout S (user pass 2026-08-10).
	const boxW = $derived(Math.min(gridHalfW * 0.55, (boardLeftX - canvasLeftX) * 0.84));
	const boxH = $derived(boxW / INFO_BOX_ASPECT);
	const boxX = $derived((canvasLeftX + boardLeftX) * 0.5);
	const boxGap = $derived(boxH * 0.24);
	// Stack the bonus boxes from the TOP (just below the logo) instead of centring them on the board, so
	// the RESPIN box (RespinPanel) can sit BENEATH FREE SPINS instead of being overlapped by it. The
	// logo/gutter geometry mirrors RespinPanel so the three boxes read as one left-gutter column.
	// Anchored just under the logo so TOTAL WIN sits below it and the three-box column (incl. RESPIN)
	// clears the balance/bet control on the shortest landscapes. Both the logo height and the offset
	// now come from stateGame — RespinPanel reads the SAME function, so the two can no longer drift
	// apart, and the offset tightens on popout S where there is least vertical room.
	const stackTopY = $derived(context.stateGameDerived.landscapeStackTopY());
</script>

{#if isLandscape}
	<MainContainer zIndex={25}>
		<!-- TOTAL WIN + FREE SPINS boxes, left gutter — only during a bonus. Version2 InfoBox
		     (same art/typography as the desktop rail). -->
		{#if isBonus}
			<InfoBox
				x={boxX}
				y={stackTopY + boxH * 0.5}
				width={boxW}
				label={i18nDerived.translate('TOTAL WIN')}
				value={totalWin}
			/>
			<InfoBox
				x={boxX}
				y={stackTopY + boxH * 1.5 + boxGap}
				width={boxW}
				label={i18nDerived.translate('FREE SPINS')}
				value={`${fsRemaining}`}
			/>
		{/if}
	</MainContainer>
{/if}
