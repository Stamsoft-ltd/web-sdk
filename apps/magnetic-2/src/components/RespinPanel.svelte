<script lang="ts">
	import { Container, Sprite, Text } from 'pixi-svelte';
	import { FadeContainer } from 'components-pixi';
	import { MainContainer } from 'components-layout';
	import { FillGradient } from 'pixi-svelte';

	import { getContext } from '../game/context';
	import { i18nDerived } from '../i18n/i18nDerived';
	import InfoBox from './InfoBox.svelte';

	// RESPIN indicator (Figma 4504-3586): a blue tech panel in the LEFT rail under the logo with a
	// spinning circular-arrow icon and a cyan-gradient RESPIN label. Shown only while a BONUS
	// reveal is a cluster-growth respin — i.e. the cluster grew and the player was awarded a
	// free re-spin (stateGame.respinIndicator).
	const context = getContext();

	const main = $derived(context.stateLayoutDerived.mainLayout());
	const board = $derived(context.stateGameDerived.boardLayout());
	const isPortrait = $derived(context.stateLayoutDerived.layoutType() === 'portrait');
	const show = $derived(context.stateGame.respinIndicator);

	const PANEL_ASPECT = 781 / 335;
	const isLandscape = $derived(context.stateLayoutDerived.layoutType() === 'landscape');
	const scale = $derived(board.boardScale);
	// Landscape: match the LandscapeCapsule TOTAL WIN / FREE SPINS column (Version2 InfoBox) so
	// RESPIN lines up beneath them as one stack. Width/gap formulas kept in sync with that file.
	const gridHalfW = $derived(board.width * 0.5 * scale);
	const lcBoxW = $derived(
		Math.min(
			gridHalfW * 0.55,
			(board.x -
				gridHalfW -
				(main.width * 0.5 -
					context.stateLayoutDerived.canvasSizes().width / (2 * (main.scale || 1)))) *
				0.84,
		),
	);
	const lcBoxH = $derived(lcBoxW / PANEL_ASPECT);
	const lcBoxGap = $derived(lcBoxH * 0.24);
	// Desktop: the Version2 left-rail box (see stateGameDerived.desktopRailStack). Landscape keeps
	// its own compact smallPad box so the mobile gutter column is unchanged.
	const rail = $derived(context.stateGameDerived.desktopRailStack());
	const PANEL_W = $derived(isLandscape ? lcBoxW : rail.boxW);
	const PANEL_H = $derived(PANEL_W / PANEL_ASPECT);

	// Centre of the LEFT rail (mirror of the capsule column): between the screen's left edge and
	// the board's left edge, below the logo (which occupies the top of the rail).
	const boardLeftX = $derived(board.x - board.width * 0.5 * scale);
	const canvasLeftX = $derived(
		main.width * 0.5 - context.stateLayoutDerived.canvasSizes().width / (2 * (main.scale || 1)),
	);
	const canvasTopY = $derived(
		main.height * 0.5 - context.stateLayoutDerived.canvasSizes().height / (2 * (main.scale || 1)),
	);
	const colX = $derived((canvasLeftX + boardLeftX) * 0.5);
	const LOGO_H = $derived(context.stateGameDerived.landscapeLogoHeight());
	// Landscape: sit BENEATH the TOTAL WIN / FREE SPINS stack. This reads the SAME landscapeStackTopY()
	// that LandscapeCapsule uses, so RESPIN lines up under FREE SPINS with an even gap by construction
	// — the two files previously each carried their own copy of the formula and a comment asking future
	// editors to keep them in sync by hand.
	const stackTopY = $derived(context.stateGameDerived.landscapeStackTopY());
	const fsBottomY = $derived(stackTopY + lcBoxH * 2 + lcBoxGap);
	// Desktop: slot 0 of the left-rail stack (design order RESPIN / FREE SPINS / TOTAL WIN).
	const panelY = $derived(isLandscape ? fsBottomY + lcBoxGap + PANEL_H * 0.5 : rail.slotY(0));


	// The refresh icon is STATIC — it used to spin continuously off its own rAF, which pulled the
	// eye away from the board during respins.

	// Figma: Inter Bold, uppercase, vertical gradient #00FCFF -> #0046A9.
	const RESPIN_GRADIENT = new FillGradient({
		type: 'linear',
		start: { x: 0, y: 0 },
		end: { x: 0, y: 1 },
		colorStops: [
			{ offset: 0, color: 0x00fcff },
			{ offset: 1, color: 0x0046a9 },
		],
		textureSpace: 'local',
	});
	const labelStyle = (fontSize: number) => ({
		fontFamily: 'Chakra Petch, Inter, sans-serif',
		fontWeight: '700' as const,
		fontSize,
		fill: RESPIN_GRADIENT,
		letterSpacing: fontSize * 0.03,
		align: 'center' as const,
	});
</script>

{#if !isPortrait}
	<MainContainer zIndex={25}>
		<FadeContainer {show}>
			<!-- Version2 steel/navy box on BOTH layouts (landscape joined 2026-08-10; it kept the
			     old smallPad art long after the desktop rail was redesigned). -->
			<InfoBox
				x={isLandscape ? colX : rail.x}
				y={panelY}
				width={PANEL_W}
				label={i18nDerived.translate('RESPIN')}
				iconKey="respinIcon"
			/>
		</FadeContainer>
	</MainContainer>
{/if}
