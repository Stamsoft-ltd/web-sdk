<script lang="ts" module>
	// The RESPIN glyph, straight out of Figma (node 9076:28692, a vectorised circular arrow) as SVG
	// path data rather than an exported bitmap. Pixi rasterises it at whatever size the box happens
	// to be, so it stays crisp on a 4K desktop and costs no download; the blue lightning-textured
	// respin_icon.webp it replaces was Version2 art and read as a leftover against the flat design.
	// Two overlapping fills is how Figma traced it — drawing both is exactly what the design shows.
	const RESPIN_GLYPH_BOX = 33;
	const RESPIN_GLYPH_SVG =
		'<svg width="33" height="33" viewBox="0 0 33 33" xmlns="http://www.w3.org/2000/svg">' +
		'<path d="M4.07315 17.1309C3.93593 13.5834 4.91559 10.418 7.17009 7.64625C9.3839 4.92462 12.5118 3.20546 16.0166 2.87553C19.2777 2.56854 22.671 3.544 25.2068 5.64756C25.239 5.60437 25.2721 5.5619 25.3061 5.52013C25.7447 4.97773 26.2631 4.45637 26.7217 3.92814C26.9034 3.71877 27.1583 3.45612 27.4457 3.43118C27.6489 3.41539 27.8501 3.47926 28.007 3.60932C28.3866 3.92808 28.2663 5.08076 28.2632 5.56825L28.2601 7.77616L28.2585 10.1765C28.2576 10.5953 28.265 11.0369 28.2421 11.4528C28.2207 11.6515 28.1927 11.862 28.0593 12.0192C27.8902 12.2185 27.6631 12.3289 27.3994 12.3358C26.9306 12.3481 26.4596 12.3428 25.9897 12.3424L23.3691 12.3405L21.4725 12.3398C20.8571 12.3401 19.6541 12.5179 19.6184 11.5926C19.5969 11.0311 20.3261 10.4383 20.7124 10.0318L22.0953 8.55897C21.5074 8.13174 21.0739 7.84141 20.3952 7.54422C18.3712 6.65799 15.9493 6.68477 13.9059 7.50042C11.5136 8.45536 9.77616 10.2413 8.75319 12.5798C8.10695 14.3726 7.84466 15.7312 8.08675 17.6619C8.41185 20.196 9.72453 22.4992 11.7392 24.0705C13.6282 25.5427 16.0255 26.2024 18.4018 25.904C21.2868 25.5303 23.8864 23.6576 25.2529 21.1196C25.3195 20.9958 25.4118 20.8422 25.4987 20.7322C25.624 20.5701 25.8106 20.4667 26.0145 20.4464C26.4393 20.4001 28.0799 21.4539 28.5606 21.704C28.691 21.7717 28.9232 22.1299 28.9025 22.3026C28.7659 23.4435 27.7976 24.5964 27.1044 25.4907C24.9433 28.0324 21.8107 29.7194 18.4797 29.9924C14.9816 30.307 11.5042 29.1992 8.83282 26.9189C6.49978 24.9292 4.91198 22.2059 4.32974 19.1954C4.18698 18.4729 4.133 17.8666 4.07315 17.1309Z" fill="#ffffff"/>' +
		'<path d="M4.36427 17.0634C4.20346 13.7011 5.14361 10.5678 7.248 7.92864C10.8042 3.37796 16.9964 1.82309 22.2805 4.15388C22.926 4.43641 23.5601 4.77092 24.1413 5.1695C24.373 5.32841 24.8751 5.77101 25.1534 5.78319C25.7263 5.80826 26.8345 3.76648 27.49 3.70641C27.634 3.6932 27.7262 3.75147 27.8343 3.83861C27.9069 3.97093 27.9665 4.20754 27.9663 4.36551C27.9636 6.73748 28.0909 9.12992 27.9166 11.4956C27.9085 11.576 27.7987 11.8385 27.7154 11.8605C27.1187 12.0176 26.4418 11.9322 25.8277 11.9576C24.6699 12.0056 23.4887 11.9978 22.333 11.9372C21.8392 11.9114 20.5036 11.995 20.1263 11.8486C19.6188 11.3348 20.2006 10.9406 20.5368 10.5636C21.0958 9.93687 21.8152 9.30861 22.2901 8.62789C22.6876 8.05819 20.8521 7.34392 20.521 7.15633C15.4862 5.10531 10.4322 7.76 8.44309 12.417C6.84907 16.581 7.87432 21.4365 11.451 24.243C13.4054 25.7914 15.8994 26.4905 18.3738 26.1835C20.9825 25.8678 23.2505 24.3866 24.8262 22.3192C25.1595 21.8819 25.3599 21.3429 25.6993 20.9205C25.787 20.8113 25.8811 20.7433 26.0235 20.7319C26.1377 20.7227 26.253 20.7556 26.3563 20.8023C26.535 20.8831 26.6967 21.0081 26.8692 21.1029C27.3488 21.3664 28.0776 21.658 28.4719 22.007C28.5597 22.0847 28.5956 22.2069 28.6016 22.321C28.6358 22.9764 27.2254 24.8362 26.7604 25.3696C24.5649 27.8972 21.4536 29.4468 18.1136 29.6763C14.7737 29.8874 11.4851 28.7734 8.9611 26.576C6.08533 24.0623 4.61664 20.8422 4.36427 17.0634Z" fill="#ffffff"/>' +
		'</svg>';
</script>

<script lang="ts">
	import { Container, Graphics, Text } from 'pixi-svelte';

	import { INFO_BOX_ASPECT } from '../game/constants';
	import { fitTextScale } from '../utils/fitText';

	// Left-rail info plate — MOTHERSHIP design (Figma 9053:27285: FREE SPINS / RESPIN / TOTAL WIN
	// stacked under the logo). Three identical 222x93 plates, radius 8, flat #3A3981 over a 4px
	// #2D2C68 edge — the SAME plate the autospin dialog and the three confirm dialogs wear, so the
	// whole UI now shares one card. The Version2 steel-and-navy bitmap (info_box.webp) is gone: this
	// plate is flat colour, and a drawn rect is sharper at every size than a stretched 781x335 png.
	//
	// Everything below is measured off the design's own child nodes (verified against the 1200x670
	// render, since the child frames report positions outside their parent's box):
	//   plate 222x93 | radius 8 | stroke 4 #2D2C68 inside | label Poppins 700 18/27 ls 0.03em
	//   value Poppins 700 32/48 ls 0.03em | RESPIN glyph 33x33
	// Sizes are fractions of the box WIDTH and offsets fractions of its HEIGHT, so the plate holds
	// its proportions at the desktop, landscape and portrait sizes the four call sites ask for.
	type Props = {
		x: number;
		y: number;
		width: number;
		label: string;
		/** Big value line under the label (FREE SPINS / TOTAL WIN). */
		value?: string;
		/** Draw the circular-arrow glyph above the label instead of a value (RESPIN). */
		icon?: boolean;
	};
	const props: Props = $props();

	const W = $derived(props.width);
	const H = $derived(props.width / INFO_BOX_ASPECT);

	// Plate: 4/222 stroke, 8/222 outer radius. The rect is inset by half the stroke and the radius
	// taken to the stroke's CENTRE LINE (8 - 4/2 = 6) so the painted edge lands exactly on the box.
	const STROKE_F = 4 / 222;
	const RADIUS_F = 6 / 222;
	const PLATE_FILL = 0x3a3981;
	const PLATE_EDGE = 0x2d2c68;

	// Type. The design's two sizes and its 0.03em tracking (0.54 on 18, 0.96 on 32).
	// Audiowide has no bold; 400 IS its only weight.
	const LABEL_F = 18 / 222;
	const VALUE_F = 32 / 222;
	const TRACKING = 0.03;

	// Vertical centres as fractions of the plate height, from the design's text boxes rather than its
	// ink: the FREE SPINS and TOTAL WIN plates each nudge their pair a few px differently (they were
	// placed by hand), so the two are averaged into one rhythm all three plates share.
	//   label box top 16.5 + half of its 27 line box -> 30 of 93   | icon 18 + 16.5 -> 34.5
	//   value box top 33 + half of its 48 line box   -> 57 of 93   | RESPIN label 49 + 13.5 -> 62.5
	const LABEL_CY = 30 / 93 - 0.5;
	const VALUE_CY = 57 / 93 - 0.5;
	const ICON_CY = 34.5 / 93 - 0.5;
	const ICON_LABEL_CY = 62.5 / 93 - 0.5;
	const ICON_F = 33 / 222;

	// The value has to survive a currency string far longer than the design's "100$" — a 13-character
	// amount at the design size overruns the plate. Shrink CONTINUOUSLY rather than in steps, which
	// jumped a visible size the moment a win crossed a character count mid count-up. The advance is
	// MEASURED in the real face instead of assumed: the old 0.58em constant was fitted to Poppins 700,
	// and Audiowide's glyphs are far wider, so keeping it would have let long totals run off the plate.
	const VALUE_MAX_W = 0.86;
	const FAMILY = 'Audiowide, Chakra Petch, Inter, sans-serif';
	const valueSize = $derived(
		!props.value
			? 0
			: W *
					VALUE_F *
					fitTextScale(props.value, {
						fontSizePx: W * VALUE_F,
						availablePx: W * VALUE_MAX_W,
						fontWeight: 400,
						fontFamily: FAMILY,
						letterSpacingEm: TRACKING,
						minScale: 0.35,
					}),
	);
	const labelSize = $derived(W * LABEL_F);
	const labelStyle = $derived({
		fontFamily: FAMILY,
		fontSize: labelSize,
		fill: 0xffffff,
		letterSpacing: labelSize * TRACKING,
		align: 'center' as const,
	});
	const valueStyle = $derived({
		fontFamily: FAMILY,
		fontSize: valueSize,
		fill: 0xa88eff,
		letterSpacing: valueSize * TRACKING,
		align: 'center' as const,
	});

	// Glyph scale + offset: the SVG draws in its own 33x33 space from the origin, so the container it
	// sits in is scaled to the icon size and pulled back by half a glyph box to centre it.
	const iconScale = $derived((W * ICON_F) / RESPIN_GLYPH_BOX);
</script>

<Container x={props.x} y={props.y}>
	<Graphics
		draw={(gr) => {
			const s = W * STROKE_F;
			gr.roundRect(-W * 0.5 + s * 0.5, -H * 0.5 + s * 0.5, W - s, H - s, W * RADIUS_F)
				.fill(PLATE_FILL)
				.stroke({ width: s, color: PLATE_EDGE, alignment: 0.5 });
		}}
	/>
	{#if props.icon}
		<Container
			x={-RESPIN_GLYPH_BOX * 0.5 * iconScale}
			y={ICON_CY * H - RESPIN_GLYPH_BOX * 0.5 * iconScale}
			scale={iconScale}
		>
			<Graphics draw={(gr) => gr.svg(RESPIN_GLYPH_SVG)} />
		</Container>
		<Text anchor={0.5} y={ICON_LABEL_CY * H} text={props.label} style={labelStyle} />
	{:else}
		<Text anchor={0.5} y={LABEL_CY * H} text={props.label} style={labelStyle} />
		<Text anchor={0.5} y={VALUE_CY * H} text={props.value ?? ''} style={valueStyle} />
	{/if}
</Container>
