import { PIXI } from 'pixi-svelte';

/**
 * The gold every win card types its amount in, straight off the design's CSS:
 * `linear-gradient(182deg, #E2D981 17.62%, #FBC503 60.04%, #D98503 102.47%)`.
 *
 * 182deg is all but vertical — two degrees of lean, kept because it is what makes the highlight run
 * slightly downhill across a long number rather than sitting level on every glyph. The last stop is
 * past the end of the gradient line, so it is resolved to the colour the line actually reaches at
 * 100% and clamped there; pixi has no notion of stops outside 0-1.
 *
 * Built once at module scope: a FillGradient is a rendered texture, and rebuilding it per frame
 * while the number counts up would re-rasterise every glyph.
 */
const LEAN = Math.tan((2 * Math.PI) / 180) / 2;

export const AMOUNT_GOLD = new PIXI.FillGradient({
	type: 'linear',
	start: { x: 0.5 - LEAN, y: 0 },
	end: { x: 0.5 + LEAN, y: 1 },
	textureSpace: 'local',
	colorStops: [
		{ offset: 0, color: 0xe2d981 },
		{ offset: 0.1762, color: 0xe2d981 },
		{ offset: 0.6004, color: 0xfbc503 },
		{ offset: 1, color: 0xdb8903 },
	],
});
