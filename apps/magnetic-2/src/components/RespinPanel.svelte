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

	const isPortrait = $derived(context.stateLayoutDerived.layoutType() === 'portrait');
	const show = $derived(context.stateGame.respinIndicator);

	const isLandscape = $derived(context.stateLayoutDerived.layoutType() === 'landscape');
	// Landscape: slot 2 of the shared left rail (stateGameDerived.landscapeRail), beneath the
	// TOTAL WIN / FREE SPINS boxes LandscapeCapsule draws in slots 0 and 1. Both files read the same
	// derived, so the three boxes are one column by construction — they used to each rebuild the
	// column from the board's edges, which drifted the moment the board resized.
	const lsRail = $derived(context.stateGameDerived.landscapeRail());
	// Desktop: the left-rail box (see stateGameDerived.desktopRailStack).
	const rail = $derived(context.stateGameDerived.desktopRailStack());
	const PANEL_W = $derived(isLandscape ? lsRail.boxW : rail.boxW);
	const PANEL_H = $derived(PANEL_W / INFO_BOX_ASPECT);

	const colX = $derived(lsRail.x);
	// Desktop: slot 1 of the left-rail stack — the MOTHERSHIP design orders the column
	// FREE SPINS / RESPIN / TOTAL WIN, so RESPIN sits in the middle.
	const panelY = $derived(
		isLandscape
			? lsRail.topY + lsRail.boxH * 2.5 + lsRail.gap * 2
			: rail.slotY(1),
	);

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
