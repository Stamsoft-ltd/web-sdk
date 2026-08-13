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
	import { bookEventAmountToCurrencyString } from 'utils-shared/amount';
	import { waitForResolve } from 'utils-shared/wait';
	import { CanvasSizeRectangle, MainContainer } from 'components-layout';
	import { OnMount } from 'components-shared';
	import { stateI18nDerived } from 'state-shared';

	import { POPUP_SCRIM_ALPHA } from '../game/constants';
	import { CONGRATS_PANEL_ASPECT } from '../game/congratsPanelParts';
	import { getContext } from '../game/context';
	import { popupPanelLimits } from '../game/utils';
	import CongratsPanel from './CongratsPanel.svelte';
	import PressToContinue from './PressToContinue.svelte';

	const context = getContext();

	let show = $state(false);
	let amount = $state(0);
	let winLevelData = $state<WinLevelData>();
	let oncomplete = $state(() => {});
	let runId = $state(0);

	// ── Bonus complete, Figma 6909:9366 ──────────────────────────────────────────────────────────
	//
	// The redesigned marquee panel, centred: CONGRATULATIONS! over YOU WON, the medallion with the
	// gold P inside it, and the total in the well at the bottom. <CongratsPanel> owns the layout and
	// the choreography; this file only decides how big it is and what goes in it.
	//
	// Sized off the REEL GRID (the design's 566-wide panel against its 457-tall grid), capped by
	// popupPanelLimits. The grid rule is what reproduces the design on its own frame; the caps are
	// what stop it on a squarish window, where the grid itself fills the frame — see the helper.
	const OVER_GRID_HEIGHT = 566 / 457;

	const main = $derived(context.stateLayoutDerived.mainLayout());
	const board = $derived(context.stateGameDerived.boardLayout());
	const limits = $derived(popupPanelLimits(context.stateLayoutDerived.canvasSizes(), main.scale));
	const panelWidth = $derived(
		Math.min(
			board.height * board.boardScale * OVER_GRID_HEIGHT,
			limits.maxWidth,
			limits.maxHeight * CONGRATS_PANEL_ASPECT,
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

				<MainContainer>
					<Container x={main.width * 0.5} y={main.height * 0.5}>
						<CongratsPanel
							size={panelWidth}
							active={show}
							{runId}
							title={stateI18nDerived.translate('CONGRATULATIONS!')}
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
