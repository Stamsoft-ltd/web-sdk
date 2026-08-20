<script lang="ts" module>
	export type EmitterEventFreeSpinIntro =
		| { type: 'freeSpinIntroShow' }
		| { type: 'freeSpinIntroHide' }
		| {
				type: 'freeSpinIntroUpdate';
				count: number;
				title?: string;
				countLabel?: string;
		  };
</script>

<script lang="ts">
	import { CanvasSizeRectangle, MainContainer } from 'components-layout';
	import { FadeContainer } from 'components-pixi';
	import { waitForResolve } from 'utils-shared/wait';
	import { Container } from 'pixi-svelte';
	import { stateI18nDerived } from 'state-shared';

	import { POPUP_SCRIM_ALPHA } from '../game/constants';
	import { CONGRATS_MARQUEES } from '../game/congratsPanelParts';
	import { getContext } from '../game/context';
	import { getSpecialSymbolKey, popupPanelLimits } from '../game/utils';
	import CongratsPanel from './CongratsPanel.svelte';
	import PressToContinue from './PressToContinue.svelte';
	import WinConfettiRain from './WinConfettiRain.svelte';

	const context = getContext();

	let show = $state(false);
	let awardedCount = $state(0);
	let title = $state('FREE SPINS');
	let countLabel = $state('FREE SPINS');
	let oncomplete = $state(() => {});
	let runId = $state(0);

	const layoutType = $derived(context.stateLayoutDerived.layoutType());
	const badgeKey = $derived(
		getSpecialSymbolKey(
			title === 'DUCK YOUR LUCK'
				? 'duckScatter'
				: title === 'MEGA COASTER'
					? 'coasterScatter'
					: 'rollerScatter',
			layoutType,
		),
	);
	// The name and the feature blurb the buy menu already shows for this bonus, so the two screens
	// never drift. `title` arrives from the book event as the English name, which is also the
	// fallback when a bonus lands here without a bet mode of its own.
	const BONUS_COPY: Record<string, { name: string; desc: string }> = {
		'DUCK YOUR LUCK': { name: 'BET MODE DUCK TITLE', desc: 'BET MODE DUCK DIALOG' },
		'MEGA COASTER': { name: 'BET MODE COASTER TITLE', desc: 'BET MODE COASTER DIALOG' },
		'ROLLER WILDS': { name: 'BET MODE ROLLER TITLE', desc: 'BET MODE ROLLER DIALOG' },
	};
	const copy = $derived(BONUS_COPY[title]);

	// ── Bonus won, Figma 7033:24761 ──────────────────────────────────────────────────────────────
	//
	// The TALL congratulations marquee. <CongratsPanel> owns the layout and the choreography; this
	// file decides how big it is and what goes in it. The slot the old design gave a medallion now
	// holds the bonus's own scatter symbol, and the well holds the spins awarded with the label
	// spelled out under it.
	//
	// Sized off the REEL GRID (the design's 524-wide marquee against its 457-tall grid), capped by
	// popupPanelLimits — see that helper for why a fixed frame share cannot do the capping.
	const OVER_GRID_HEIGHT = 524 / 457;
	// The design sits the marquee above the frame's centre, which lifts its bottom edge clear of the
	// HUD bar: its box spans y 1..601 of the 670 frame, so the middle of it is 34px up. As a fraction
	// of the marquee's width that holds at every size.
	const CENTRE_Y = -34 / 524;
	/** The badge art is 448x360, fitted to this share of the marquee at its own aspect. */
	const BADGE_WIDTH = 0.3;
	const BADGE_ASPECT = 448 / 360;
	/** Scraps falling behind the board. A fixed handful: nothing has been won here yet but a bonus. */
	const CONFETTI = 40;

	const main = $derived(context.stateLayoutDerived.mainLayout());
	const board = $derived(context.stateGameDerived.boardLayout());
	const limits = $derived(popupPanelLimits(context.stateLayoutDerived.canvasSizes(), main.scale));
	const panelWidth = $derived(
		Math.min(
			board.height * board.boardScale * OVER_GRID_HEIGHT,
			limits.maxWidth,
			limits.maxHeight * CONGRATS_MARQUEES.tall.aspect,
		),
	);

	context.eventEmitter.subscribeOnMount({
		freeSpinIntroShow: () => {
			show = true;
			runId += 1;
			context.stateGame.freeSpinPopupShowing = true;
		},
		freeSpinIntroHide: () => {
			show = false;
			context.stateGame.freeSpinPopupShowing = false;
		},
		freeSpinIntroUpdate: async (emitterEvent) => {
			awardedCount = emitterEvent.count;
			title = emitterEvent.title ?? 'FREE SPINS';
			countLabel = emitterEvent.countLabel ?? 'FREE SPINS';
			await waitForResolve((resolve) => (oncomplete = resolve));
		},
	});
</script>

<!-- Quick fade on dismissal: at the Tween default 400ms the HUD un-dims the moment `show` flips,
     and the panel text hung readable over the restored UI for the rest of the fade. -->
<FadeContainer {show} duration={150}>
	<!-- The design's scrim covers the whole frame, HUD included; this rectangle only reaches the
	     canvas, so the HUD dims itself to match — see .hud-shell--blocked. -->
	<CanvasSizeRectangle backgroundColor={0x000000} backgroundAlpha={POPUP_SCRIM_ALPHA} />

	<!-- The design's static confetti is NOT drawn (design ask, 2026-08-18): this falls the same
	     scraps down the whole canvas instead. Mounted BEHIND the marquee — layering here is mount
	     order — so it never comes between the player and what the screen is telling them. -->
	<WinConfettiRain count={CONFETTI} intensity={show ? 1 : 0} delay={0.4} restartKey={runId} />

	<MainContainer>
		<Container x={main.width * 0.5} y={main.height * 0.5 + panelWidth * CENTRE_Y}>
			<!-- The bonus's own NAME goes on the design's third line, under YOU WON, with the feature
			     blurb the buy menu shows under that. -->
			<CongratsPanel
				variant="tall"
				size={panelWidth}
				active={show}
				{runId}
				title={stateI18nDerived.translate('CONGRATS!')}
				subtitle={stateI18nDerived.translate('YOU WON')}
				name={stateI18nDerived.translate(copy?.name ?? title)}
				desc={copy ? stateI18nDerived.translate(copy.desc) : undefined}
				centreKey={badgeKey}
				centreWidth={BADGE_WIDTH}
				centreAspect={BADGE_ASPECT}
				wellText={`${awardedCount}`}
				wellLabel={stateI18nDerived.translate(countLabel)}
			/>
		</Container>
	</MainContainer>

	<PressToContinue onpress={() => oncomplete()} />
</FadeContainer>
