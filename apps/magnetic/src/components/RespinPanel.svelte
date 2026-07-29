<script lang="ts">
	import { Container, Sprite, Text } from 'pixi-svelte';
	import { FadeContainer } from 'components-pixi';
	import { MainContainer } from 'components-layout';
	import { FillGradient } from 'pixi-svelte';

	import { getContext } from '../game/context';
	import { i18nDerived } from '../i18n/i18nDerived';

	// RESPIN indicator (Figma 4504-3586): a blue tech panel in the LEFT rail under the logo with a
	// spinning circular-arrow icon and a cyan-gradient RESPIN label. Shown only while a BONUS
	// reveal is a cluster-growth respin — i.e. the cluster grew and the player was awarded a
	// free re-spin (stateGame.respinIndicator).
	const context = getContext();

	const main = $derived(context.stateLayoutDerived.mainLayout());
	const board = $derived(context.stateGameDerived.boardLayout());
	const isPortrait = $derived(context.stateLayoutDerived.layoutType() === 'portrait');
	const show = $derived(context.stateGame.respinIndicator);

	// Same geometry family as the capsule's TOTAL WIN / FREE SPINS boxes (panel_border art).
	const PANEL_ASPECT = 200 / 98;
	const isLandscape = $derived(context.stateLayoutDerived.layoutType() === 'landscape');
	const scale = $derived(board.boardScale);
	// Landscape: match the LandscapeCapsule TOTAL WIN / FREE SPINS column width so RESPIN lines up
	// beneath them as one stack. Desktop keeps its own (wider) left-rail panel width.
	const gridHalfW = $derived(board.width * 0.5 * scale);
	// 0.49 / 0.12 kept in sync with LandscapeCapsule so RESPIN matches the TOTAL WIN / FREE SPINS boxes
	// and the whole column stays compact enough to clear the balance/bet control on the largest landscapes.
	const lcBoxW = $derived(gridHalfW * 0.49);
	const lcBoxH = $derived(lcBoxW / (323 / 228));
	const lcBoxGap = $derived(lcBoxH * 0.12);
	const PANEL_W = $derived(isLandscape ? lcBoxW : board.width * 0.32 * scale);
	// Landscape: match the TOTAL WIN / FREE SPINS box HEIGHT exactly (equal-sized boxes) using the same
	// smallPad art. Desktop keeps the wide-short panel_border aspect.
	const PANEL_H = $derived(isLandscape ? lcBoxH : PANEL_W / PANEL_ASPECT);

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
	const LOGO_H = $derived(main.width * 0.3 / (1400 / 1098));
	// Landscape: sit BENEATH the TOTAL WIN / FREE SPINS stack (mirrors LandscapeCapsule's top-anchored
	// geometry). Desktop: the usual spot in the left rail under the logo.
	// Keep 0.60 in sync with LandscapeCapsule.stackTopY so RESPIN lines up beneath the FREE SPINS box
	// with the SAME gap between all three boxes (even column).
	const stackTopY = $derived(canvasTopY + LOGO_H * 0.6);
	const fsBottomY = $derived(stackTopY + lcBoxH * 2 + lcBoxGap);
	const panelY = $derived(
		isLandscape ? fsBottomY + lcBoxGap + PANEL_H * 0.5 : canvasTopY + LOGO_H * 0.78 + PANEL_H * 0.5,
	);

	// Landscape uses the taller (equal-sized) box, so give the icon + label more presence to match the
	// TOTAL WIN / FREE SPINS boxes; desktop keeps its original wide-short proportions.
	const iconSize = $derived(PANEL_H * (isLandscape ? 0.42 : 0.3));
	const iconOffY = $derived(-PANEL_H * (isLandscape ? 0.11 : 0.16));
	const labelSize = $derived(PANEL_H * (isLandscape ? 0.17 : 0.2));
	const labelOffY = $derived(PANEL_H * (isLandscape ? 0.22 : 0.16));

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
		fontFamily: 'Inter',
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
			<Container x={colX} y={panelY}>
				<Sprite key={isLandscape ? 'smallPadMobile' : 'panelBorder'} anchor={0.5} width={PANEL_W} height={PANEL_H} />
				<Sprite
					key="respinIcon"
					anchor={0.5}
					y={iconOffY}
					width={iconSize}
					height={iconSize}
				/>
				<Text anchor={0.5} y={labelOffY} text={i18nDerived.translate('RESPIN')} style={labelStyle(labelSize)} />
			</Container>
		</FadeContainer>
	</MainContainer>
{/if}
