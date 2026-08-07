/**
 * Shrink-to-fit factor for a single-line label.
 *
 * The Version2 dialogs lay their headings out as ONE nowrap line at the design's font size. Our
 * strings are longer than the design's placeholders (mode names, currency, translations), so they
 * need to shrink rather than spill past the plate.
 *
 * Character counting is not good enough here: the copy is uppercase Latin, where "MAGNETIC MEGA
 * CHAIN" is far wider per character than "ALL IN FOR 400.00". So measure the real glyph advance
 * with canvas `measureText` instead — one pass, no layout thrash and no two-frame flicker from
 * measuring a already-scaled element.
 */
let ctx: CanvasRenderingContext2D | null | undefined;

const measureCtx = () => {
	if (ctx === undefined) ctx = document.createElement('canvas').getContext('2d');
	return ctx;
};

type Options = {
	/** Rendered font size at scale 1, in px. */
	fontSizePx: number;
	/** Width the line has to fit into, in px. */
	availablePx: number;
	fontWeight?: number | string;
	fontFamily?: string;
	/** Tracking as a fraction of the font size (CSS `letter-spacing` in em). */
	letterSpacingEm?: number;
	/** Never shrink past this, so a pathological string degrades instead of vanishing. */
	minScale?: number;
};

export const fitTextScale = (text: string, options: Options): number => {
	const { fontSizePx, availablePx, fontWeight = 700, fontFamily = 'Inter, sans-serif' } = options;
	const letterSpacingEm = options.letterSpacingEm ?? 0;
	const minScale = options.minScale ?? 0.55;
	if (!text || fontSizePx <= 0 || availablePx <= 0) return 1;
	const c = measureCtx();
	// No canvas (SSR): leave the line at its design size rather than guessing.
	if (!c) return 1;
	c.font = `${fontWeight} ${fontSizePx}px ${fontFamily}`;
	// measureText ignores letter-spacing, which CSS applies after every glyph including the last.
	const width = c.measureText(text).width + text.length * fontSizePx * letterSpacingEm;
	if (width <= availablePx) return 1;
	return Math.max(minScale, availablePx / width);
};
