<script lang="ts" module>
	import type { WinLevelData } from '../game/winLevelMap';

	export type EmitterEventFreeSpinOutro =
		| { type: 'freeSpinOutroShow' }
		| { type: 'freeSpinOutroHide' }
		| { type: 'freeSpinOutroCountUp'; amount: number; winLevelData: WinLevelData };
</script>

<script lang="ts">
	import { Container } from 'pixi-svelte';
	import { FadeContainer, WinCountUpProvider } from 'components-pixi';
	import {
		bookEventAmountToBetAmountMultiplier,
		bookEventAmountToCurrencyString,
	} from 'utils-shared/amount';
	import { waitForResolve } from 'utils-shared/wait';
	import { CanvasSizeRectangle, MainContainer } from 'components-layout';
	import { OnMount } from 'components-shared';
	import { stateI18nDerived } from 'state-shared';

	import { POPUP_SCRIM_ALPHA } from '../game/constants';
	import { CONGRATS_MARQUEES } from '../game/congratsPanelParts';
	import { getContext } from '../game/context';
	import { popupPanelLimits } from '../game/utils';
	import CongratsPanel from './CongratsPanel.svelte';
	import PressToContinue from './PressToContinue.svelte';
	import WinConfettiRain, { confettiForMultiplier } from './WinConfettiRain.svelte';

	const context = getContext();

	let show = $state(false);
	let amount = $state(0);
	let winLevelData = $state<WinLevelData>();
	let oncomplete = $state(() => {});
	let runId = $state(0);

	// ── Bonus complete, Figma 7032:19821 ─────────────────────────────────────────────────────────
	//
	// The WIDE congratulations marquee — the circus cloud — carrying CONGRATS! over YOU WON, with the
	// total in a well that hangs below it. <CongratsPanel> owns the layout and the choreography; this
	// file only decides how big it is and what goes in it.
	//
	// Sized off the REEL GRID (the design's 532-wide marquee against its 457-tall grid), capped by
	// popupPanelLimits. The grid rule is what reproduces the design on its own frame; the caps are
	// what stop it on a squarish window, where the grid itself fills the frame — see the helper.
	const OVER_GRID_HEIGHT = 532 / 457;
	/**
	 * The well hangs BELOW the marquee, so the screen is taller than the art: the assembly runs from
	 * the marquee's top edge to the well's bottom, 460 of the design's frame against the 377-tall
	 * art. The height cap has to be against THAT, or the well is what gets pushed off a short window.
	 */
	const ASSEMBLY_ASPECT = CONGRATS_MARQUEES.wide.aspect / (460.1 / 377);
	/**
	 * And the assembly's own middle is not the art's: it sits 47.9px above the design frame's centre,
	 * which is what keeps the well clear of the HUD bar. As a fraction of the marquee's width it
	 * holds at every size.
	 */
	const CENTRE_Y = -47.9 / 532;

	const main = $derived(context.stateLayoutDerived.mainLayout());
	const board = $derived(context.stateGameDerived.boardLayout());
	const limits = $derived(popupPanelLimits(context.stateLayoutDerived.canvasSizes(), main.scale));
	const panelWidth = $derived(
		Math.min(
			board.height * board.boardScale * OVER_GRID_HEIGHT,
			limits.maxWidth,
			limits.maxHeight * ASSEMBLY_ASPECT,
		),
	);

	context.eventEmitter.subscribeOnMount({
		freeSpinOutroShow: () => {
			show = true;
			runId += 1;
			context.stateGame.freeSpinPopupShowing = true;
		},
		freeSpinOutroHide: async () => {
			show = false;
			context.stateGame.freeSpinPopupShowing = false;
		},
		freeSpinOutroCountUp: async (emitterEvent) => {
			amount = emitterEvent.amount;
			winLevelData = emitterEvent.winLevelData;
			await waitForResolve((resolve) => (oncomplete = resolve));
		},
	});
</script>

<!-- Quick fade on dismissal: at the Tween default 400ms the HUD un-dims the moment `show` flips,
     and the panel text hung readable over the restored UI for the rest of the fade. -->
<FadeContainer {show} duration={150}>
	{#if winLevelData}
		<!-- Forest Gang contract: dedicated bonus-total board, capped count-up,
		     manual acknowledgement. Per-spin tier boards are handled by Win.svelte. -->
		{@const duration = Math.min(winLevelData.presentDuration, 2000)}
		<WinCountUpProvider {amount} {duration} oncomplete={() => {}}>
			{#snippet children({ countUpAmount, startCountUp, finishCountUp, countUpCompleted })}
				<OnMount onmount={() => startCountUp()} />

				<!-- The design's scrim covers the whole frame, HUD included; this rectangle only reaches
				     the canvas, so the HUD dims itself to match — see .hud-shell--blocked. -->
				<CanvasSizeRectangle backgroundColor={0x000000} backgroundAlpha={POPUP_SCRIM_ALPHA} />

				<!-- The design's static confetti is NOT drawn (design ask, 2026-08-18): this falls the
				     same scraps down the whole canvas instead, at a count set by how big the bonus
				     paid out. Mounted BEHIND the marquee — layering here is mount order — so it never
				     comes between the player and the total. -->
				<WinConfettiRain
					count={confettiForMultiplier(bookEventAmountToBetAmountMultiplier(amount))}
					intensity={show ? 1 : 0}
					delay={0.4}
					restartKey={runId}
				/>

				<MainContainer>
					<Container x={main.width * 0.5} y={main.height * 0.5 + panelWidth * CENTRE_Y}>
						<CongratsPanel
							variant="wide"
							size={panelWidth}
							active={show}
							{runId}
							title={stateI18nDerived.translate('CONGRATS!')}
							subtitle={stateI18nDerived.translate('YOU WON')}
							wellText={bookEventAmountToCurrencyString(countUpAmount).toUpperCase()}
						/>
					</Container>
				</MainContainer>

				<PressToContinue onpress={() => (countUpCompleted ? oncomplete() : finishCountUp())} />
			{/snippet}
		</WinCountUpProvider>
	{/if}
</FadeContainer>
