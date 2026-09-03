<script lang="ts">
	import { FadeContainer } from 'components-pixi';
	import { MainContainer } from 'components-layout';

	import { getContext } from '../game/context';
	import { INFO_BOX_ASPECT } from '../game/constants';
	import { i18nDerived } from '../i18n/i18nDerived';
	import InfoBox from './InfoBox.svelte';

	// RESPIN indicator — the middle plate of the left rail, a circular-arrow glyph over the RESPIN
	// label (MOTHERSHIP design 9051:27159). Shown only while a BONUS reveal is a cluster-growth
	// respin — i.e. the cluster grew and the player was awarded a free re-spin
	// (stateGame.respinIndicator). The plate itself is drawn by InfoBox.
	const context = getContext();

	const main = $derived(context.stateLayoutDerived.mainLayout());
	const board = $derived(context.stateGameDerived.boardLayout());
	const isPortrait = $derived(context.stateLayoutDerived.layoutType() === 'portrait');
	const show = $derived(context.stateGame.respinIndicator);

	const isLandscape = $derived(context.stateLayoutDerived.layoutType() === 'landscape');
	const scale = $derived(board.boardScale);
	// Landscape: match the LandscapeCapsule TOTAL WIN / FREE SPINS column so
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
	const lcBoxH = $derived(lcBoxW / INFO_BOX_ASPECT);
	const lcBoxGap = $derived(lcBoxH * 0.24);
	// Desktop: the left-rail box (see stateGameDerived.desktopRailStack). Landscape keeps its own
	// gutter-sized box so the mobile column is unchanged.
	const rail = $derived(context.stateGameDerived.desktopRailStack());
	const PANEL_W = $derived(isLandscape ? lcBoxW : rail.boxW);
	const PANEL_H = $derived(PANEL_W / INFO_BOX_ASPECT);

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
	// Desktop: slot 1 of the left-rail stack — the MOTHERSHIP design orders the column
	// FREE SPINS / RESPIN / TOTAL WIN, so RESPIN sits in the middle.
	const panelY = $derived(isLandscape ? fsBottomY + lcBoxGap + PANEL_H * 0.5 : rail.slotY(1));

	// The glyph is STATIC — it used to spin continuously off its own rAF, which pulled the eye away
	// from the board during respins.
</script>

{#if !isPortrait}
	<MainContainer zIndex={25}>
		<FadeContainer {show}>
			<!-- The same plate on BOTH layouts (landscape joined 2026-08-10; it kept the old
			     smallPad art long after the desktop rail was redesigned). -->
			<InfoBox
				x={isLandscape ? colX : rail.x}
				y={panelY}
				width={PANEL_W}
				label={i18nDerived.translate('RESPIN')}
				icon
			/>
		</FadeContainer>
	</MainContainer>
{/if}
