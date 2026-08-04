<script lang="ts" module>
	export type EmitterEventFreeSpinIntro =
		| { type: 'freeSpinIntroShow' }
		| { type: 'freeSpinIntroHide' }
		| { type: 'freeSpinIntroUpdate'; totalFreeSpins: number; title?: string };
</script>

<script lang="ts">
	import { CanvasSizeRectangle, MainContainer } from 'components-layout';
	import { FadeContainer } from 'components-pixi';
	import { waitForResolve } from 'utils-shared/wait';
	import { Container, Graphics, Sprite, Text } from 'pixi-svelte';
	import { stateI18nDerived } from 'state-shared';

	import { POPUP_SCRIM_ALPHA } from '../game/constants';
	import { getContext } from '../game/context';
	import { getSpecialSymbolKey, popupPanelLimits } from '../game/utils';
	import PanelBorderLights from './PanelBorderLights.svelte';
	import PressToContinue from './PressToContinue.svelte';

	const context = getContext();

	let show = $state(false);
	let freeSpinsFromEvent = $state(0);
	let title = $state('FREE SPINS');
	let oncomplete = $state(() => {});
	let descHeight = $state(0);

	const layoutType = $derived(context.stateLayoutDerived.layoutType());
	const badgeKey = $derived(
		getSpecialSymbolKey(title === 'MEGA COASTER' ? 'coasterScatter' : 'rollerScatter', layoutType),
	);
	// The name and the feature blurb the buy menu already shows for this bonus, so the two screens
	// never drift. `title` arrives from the book event as the English name, which is also the
	// fallback when a bonus lands here without a bet mode of its own.
	const BONUS_COPY: Record<string, { name: string; desc: string }> = {
		'MEGA COASTER': { name: 'BET MODE COASTER TITLE', desc: 'BET MODE COASTER DIALOG' },
		'ROLLER WILDS': { name: 'BET MODE ROLLER TITLE', desc: 'BET MODE ROLLER DIALOG' },
	};
	const copy = $derived(BONUS_COPY[title]);

	// ── Bonus won, Figma 6094:4788 ───────────────────────────────────────────────────────────────
	//
	// A 486x526 panel centred in the 1200x670 frame. Every offset below is a fraction of the panel
	// HEIGHT so the block scales as one piece. The panel is sized off the reel grid, capped by
	// popupPanelLimits — see that helper for why a fixed frame share cannot do the capping.
	const PANEL = {
		overGridHeight: 486 / 457,
		aspect: 486 / 526,
		// The design sits the panel 20px above the frame's centre, which lifts its bottom edge clear
		// of the HUD bar; as a fraction of the panel it holds at every size.
		centreY: -20 / 526,
		title: -196 / 526,
		subtitle: -159 / 526,
		bonusName: -87 / 526,
		// The design's blurb is three lines; the shipped copy runs to four, and four still clears the
		// symbol below, so the scale-to-fit only bites on a translation longer than that.
		desc: { y: -44.5 / 526, width: 302 / 526, height: 62 / 526, lineHeight: 15.5 / 526 },
		// The design's slot is 98x85.86; the badge art is 448x360, so it is fitted to the slot's
		// width at its own aspect rather than stretched to fill.
		symbol: { y: 31.93 / 526, width: 98 / 526, aspect: 448 / 360 },
		countBox: { y: 124 / 526, width: 143.95 / 526, height: 62 / 526, radius: 10 / 526 },
		freeSpins: 195 / 526,
		titleSize: 28.6 / 526,
		bonusNameSize: 26 / 526,
		descSize: 14.3 / 526,
		countSize: 39 / 526,
		freeSpinsSize: 26 / 526,
	};
	// Sampled from the design render: white headings, a violet bonus name and footer, near-black
	// count well with a magenta hairline.
	const TITLE_FILL = 0xffffff;
	const ACCENT_FILL = 0xb934f6;
	const DESC_FILL = 0xd7d7d7;
	const WELL_FILL = 0x03000c;
	const WELL_STROKE = 0xab34f4;

	const main = $derived(context.stateLayoutDerived.mainLayout());
	const board = $derived(context.stateGameDerived.boardLayout());
	const limits = $derived(
		popupPanelLimits(context.stateLayoutDerived.canvasSizes(), main.scale),
	);
	const panelWidth = $derived(
		Math.min(
			board.height * board.boardScale * PANEL.overGridHeight,
			limits.maxWidth,
			limits.maxHeight * PANEL.aspect,
		),
	);
	const size = $derived(panelWidth / PANEL.aspect);

	const headingStyle = (fontSize: number, fill: number) => ({
		fontFamily: 'Helvetica, Arial, sans-serif',
		fontWeight: '700' as const,
		fontSize,
		fill,
		align: 'center' as const,
		letterSpacing: fontSize * 0.02,
	});

	context.eventEmitter.subscribeOnMount({
		freeSpinIntroShow: () => {
			show = true;
			context.stateGame.freeSpinPopupShowing = true;
		},
		freeSpinIntroHide: () => {
			show = false;
			context.stateGame.freeSpinPopupShowing = false;
		},
		freeSpinIntroUpdate: async (emitterEvent) => {
			freeSpinsFromEvent = emitterEvent.totalFreeSpins;
			title = emitterEvent.title ?? 'FREE SPINS';
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
		<Container x={main.width * 0.5} y={main.height * 0.5 + size * PANEL.centreY}>
			<Sprite key="bonusPanel" anchor={0.5} width={panelWidth} height={size} />
			<PanelBorderLights width={panelWidth} height={size} />

			<Text
				anchor={0.5}
				y={size * PANEL.title}
				text={stateI18nDerived.translate('CONGRATULATIONS!')}
				style={headingStyle(Math.round(size * PANEL.titleSize), TITLE_FILL)}
			/>

			<Text
				anchor={0.5}
				y={size * PANEL.subtitle}
				text={stateI18nDerived.translate('YOU WON')}
				style={headingStyle(Math.round(size * PANEL.titleSize), TITLE_FILL)}
			/>

			<Text
				anchor={0.5}
				y={size * PANEL.bonusName}
				text={stateI18nDerived.translate(copy?.name ?? title)}
				style={headingStyle(Math.round(size * PANEL.bonusNameSize), ACCENT_FILL)}
			/>

			<!-- The blurb wraps to the design's three lines for the copy it was drawn with; a longer
			     translation is scaled down rather than allowed to run into the symbol below it. -->
			{@const descMaxHeight = size * PANEL.desc.height}
			{@const descFit = descHeight > descMaxHeight ? descMaxHeight / descHeight : 1}
			<Container y={size * PANEL.desc.y} scale={descFit}>
				<Text
					anchor={0.5}
					onresize={({ height }) => (descHeight = height)}
					text={copy ? stateI18nDerived.translate(copy.desc) : ''}
					style={{
						...headingStyle(Math.round(size * PANEL.descSize), DESC_FILL),
						fontWeight: '400',
						lineHeight: size * PANEL.desc.lineHeight,
						wordWrap: true,
						wordWrapWidth: size * PANEL.desc.width,
					}}
				/>
			</Container>

			<Sprite
				key={badgeKey}
				anchor={0.5}
				y={size * PANEL.symbol.y}
				width={size * PANEL.symbol.width}
				height={(size * PANEL.symbol.width) / PANEL.symbol.aspect}
			/>

			<!-- The spin-count well: a plain rounded rectangle, drawn rather than shipped as art so its
			     hairline stays crisp at every panel size. -->
			{@const wellW = size * PANEL.countBox.width}
			{@const wellH = size * PANEL.countBox.height}
			<Container y={size * PANEL.countBox.y}>
				<Graphics
					draw={(graphics) => {
						graphics
							.roundRect(-wellW / 2, -wellH / 2, wellW, wellH, size * PANEL.countBox.radius)
							.fill({ color: WELL_FILL })
							.stroke({ width: Math.max(1, size * 0.004), color: WELL_STROKE, alpha: 0.9 });
					}}
				/>
				<Text
					anchor={0.5}
					text={`${freeSpinsFromEvent}`}
					style={headingStyle(Math.round(size * PANEL.countSize), TITLE_FILL)}
				/>
			</Container>

			<Text
				anchor={0.5}
				y={size * PANEL.freeSpins}
				text={stateI18nDerived.translate('FREE SPINS')}
				style={headingStyle(Math.round(size * PANEL.freeSpinsSize), ACCENT_FILL)}
			/>
		</Container>
	</MainContainer>

	<PressToContinue onpress={() => oncomplete()} />
</FadeContainer>
