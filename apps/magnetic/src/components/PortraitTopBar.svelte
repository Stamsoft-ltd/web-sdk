<script lang="ts" module>
	export type EmitterEventPortraitTopBar = { type: 'portraitTopBarNoop' };
</script>

<script lang="ts">
	import { Tween } from 'svelte/motion';
	import { backOut, cubicOut } from 'svelte/easing';
	import { FadeContainer } from 'components-pixi';
	import { MainContainer } from 'components-layout';
	import { Container, Sprite } from 'pixi-svelte';
	import { stateBet } from 'state-shared';
	import { bookEventAmountToCurrencyString } from 'utils-shared/amount';

	import CapsuleBeam from './CapsuleBeam.svelte';
	import InfoBox from './InfoBox.svelte';
	import { getContext } from '../game/context';
	import { i18nDerived } from '../i18n/i18nDerived';
	import { getSpriteKeyByName } from '../game/utils';
	import type { SymbolName } from '../game/types';

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

	// Element inside the capsule = the symbol currently being combined (magnet target, else the active
	// cluster's symbol); empty tube when nothing is combining — same as the desktop CapsulePanel.
	const displaySymbol = $derived(
		(context.stateGame.magnetTargetSymbol ??
			context.stateGame.activeSeries[0]?.symbol ??
			null) as SymbolName | null,
	);
	const symbolKey = $derived(displaySymbol ? getSpriteKeyByName({ name: displaySymbol }) : null);

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


	// Horizontal bar centred at the top of the portrait area, above the board.
	const CY = $derived(main.height * 0.168);
	// magnetic_tube_v2.webp is the TRIMMED Version2 art (1400x553) — no transparent margins, so the
	// sprite box is exactly the visible tube. The old art was padded (content only 94% wide and 43%
	// tall of its box), hence the width factor drops 0.56 -> 0.53 to keep the drawn tube the same
	// LENGTH on screen — then 0.5 -> 0.59 (user pass 2026-08-10, "make the tube bigger"), with CY
	// pulled up (0.186 -> 0.168 over two passes) so the taller tube keeps its clearance over the
	// board frame and the whole top row sits higher.
	const TUBE_ASPECT = 1400 / 553;
	// TOTAL WIN / FREE SPINS / RESPIN wear the shared Version2 InfoBox (781/335 art), the same plate
	// the desktop rail and the landscape gutter use — portrait was still on the old smallPadMobile
	// pad. Slightly narrower with it (0.22 -> 0.175 of the width over two user passes 2026-08-10) —
	// the plate is also much wider than it is tall (2.33 vs the old 1.42), so at the old width its
	// inner end tucked under the tube's cap and its outer end ran at the screen edge.
	const BOX_ASPECT = 781 / 335;
	const capsuleW = $derived(main.width * 0.59);
	const capsuleH = $derived(capsuleW / TUBE_ASPECT);
	const boxW = $derived(main.width * 0.175);
	const boxH = $derived(boxW / BOX_ASPECT);
	// Clearance between the capsule's caps and the boxes. This used to be NEGATIVE, which tucked each
	// box under the tube art (user report) — it is a real gap now.
	const gap = $derived(main.width * 0.004);
	const capsuleX = $derived(main.width * 0.5);
	const leftX = $derived(capsuleX - capsuleW * 0.5 - gap - boxW * 0.5);
	const rightX = $derived(capsuleX + capsuleW * 0.5 + gap + boxW * 0.5);
	// The held symbol fills most of the CLEAR GLASS window, which on the trimmed v2 art is the
	// y 0.168..0.835 band (measured) — 0.667 of the tube height.
	const symSize = $derived(capsuleH * 0.55);

	// Symbol pop-in. The bob/jitter/breathe that used to live here as a local rAF is now CapsuleBeam's
	// job (it drives the symbol inside the beam), so this is only the entrance scale it consumes.
	const symbolScale = new Tween(0, { duration: 450, easing: backOut });
	$effect(() => {
		if (symbolKey) {
			symbolScale.set(0.08, { duration: 0 });
			symbolScale.set(1, { duration: 450, easing: backOut });
		} else {
			symbolScale.set(0, { duration: 0 });
		}
	});
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

		<!-- Capsule — ALWAYS shown. Glass housing plus the SAME in-tube animation the desktop and
		     landscape capsules run (CapsuleBeam: hot laser, drifting light particles, and the held
		     symbol bobbing in the beam with an impact flare). Portrait used to run the older
		     CapsuleBolts web here, so the three capsules did not match. -->
		<Container x={capsuleX} y={CY}>
			<Sprite key="capsuleTubeGlass" anchor={0.5} width={capsuleW} height={capsuleH} />
			<!-- CapsuleBeam runs its laser along local +y, so the whole thing is rotated 90deg to lie
			     along this tube; `symbolRotation` cancels that on the held symbol so it stays upright.
			     glassW/glassH are the CLEAR BARREL, measured off magnetic_tube_v2.webp
			     (scratchpad/tube_v2/build_tube.py): x 0.289-0.704 (0.4157 of the length) and y
			     0.168-0.835 (0.667 of the height). beamTop/beamBot are symmetric here — the vertical
			     tube's asymmetric default is tuned to its cap and base, which a barrel does not have. -->
			<Container rotation={Math.PI / 2}>
				<CapsuleBeam
					glassW={capsuleH * 0.667}
					glassH={capsuleW * 0.4157}
					beamTop={-0.46}
					beamBot={0.46}
					symbolRotation={-Math.PI / 2}
					symbolKey={symbolKey}
					symbolScale={symbolScale.current}
					symbolW={symSize}
				/>
			</Container>
		</Container>

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
