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
	import { CONGRATS_PANEL_ASPECT } from '../game/congratsPanelParts';
	import { getContext } from '../game/context';
	import { getSpecialSymbolKey, popupPanelLimits } from '../game/utils';
	import CongratsPanel from './CongratsPanel.svelte';
	import PressToContinue from './PressToContinue.svelte';

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

	// ── Bonus won, Figma 6909:9366 ───────────────────────────────────────────────────────────────
	//
	// The same redesigned marquee panel the bonus-complete screen uses — <CongratsPanel> owns the
	// layout and the choreography, so the two screens move alike and only their content differs.
	// Here the medallion holds the bonus's own scatter symbol rather than the P, and the well counts
	// the spins awarded.
	//
	// Sized off the REEL GRID (the design's 566-wide panel against its 457-tall grid), capped by
	// popupPanelLimits — see that helper for why a fixed frame share cannot do the capping.
	const OVER_GRID_HEIGHT = 566 / 457;
	// The design sits the panel a little above the frame's centre, which lifts its bottom edge clear
	// of the HUD bar; as a fraction of the panel it holds at every size.
	const CENTRE_Y = -0.02;
	// The bonus badge stands on its own here — no medallion ring around it. The badge is already a
	// lit gold roundel with its own bulbs, and ringing it with a second circle of bulbs made both
	// harder to read; without the ring it can also be drawn about as wide as the ring used to be.
	/** The badge art is 448x360, fitted to this share of the panel at its own aspect. */
	const BADGE_WIDTH = 0.42;
	const BADGE_ASPECT = 448 / 360;
	/** The medallion's slot gives up this much of its size to make room for the blurb above it. */
	const RING_SCALE = 0.8;

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

	<MainContainer>
		<Container x={main.width * 0.5} y={main.height * 0.5 + panelWidth * CENTRE_Y}>
			<!-- The bonus's NAME takes the design's subtitle line: on this screen it says more than
			     'YOU WON' does, and the spins awarded are already spelled out in the well. -->
			<CongratsPanel
				size={panelWidth}
				active={show}
				{runId}
				title={stateI18nDerived.translate('CONGRATULATIONS!')}
				subtitle={stateI18nDerived.translate(copy?.name ?? title)}
				desc={copy ? stateI18nDerived.translate(copy.desc) : undefined}
				ring={false}
				centreKey={badgeKey}
				centreWidth={BADGE_WIDTH}
				centreAspect={BADGE_ASPECT}
				ringScale={RING_SCALE}
				wellText={`${awardedCount} ${stateI18nDerived.translate(countLabel)}`}
			/>
		</Container>
	</MainContainer>

	<PressToContinue onpress={() => oncomplete()} />
</FadeContainer>
