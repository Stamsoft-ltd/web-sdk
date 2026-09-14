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
	const {
		fontSizePx,
		availablePx,
		fontWeight = 700,
		fontFamily = 'Chakra Petch, Inter, sans-serif',
	} = options;
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

type WrapOptions = Omit<Options, 'availablePx'> & {
	/** Width each line wraps at, in px — the same value the renderer gets as its wrap width. */
	wrapWidthPx: number;
	/** How many lines the text is allowed to run to before it has to shrink. */
	maxLines: number;
};

/**
 * Shrink-to-fit factor for a WRAPPED paragraph — how much a block of copy has to come down to stay
 * inside a fixed number of lines.
 *
 * `fitTextScale` above is single-line: it compares one measured advance against one width. A
 * paragraph is a different problem, because shrinking the font also re-flows it — a string that
 * needs three lines at 100% may need only two at 92%, so the answer is the largest scale whose
 * greedy wrap still fits. The design's boxes are sized for their English copy (the free-spins-won
 * rule is exactly two lines), and a longer translation has to fit that box rather than run out
 * under the aliens standing in front of its bottom edge.
 *
 * The wrap here is the same greedy break-on-spaces pixi does, measured with the real glyph
 * advances, so the line count matches what actually renders.
 */
export const fitWrappedTextScale = (text: string, options: WrapOptions): number => {
	const { fontSizePx, wrapWidthPx, maxLines } = options;
	const fontWeight = options.fontWeight ?? 400;
	const fontFamily = options.fontFamily ?? 'Chakra Petch, Inter, sans-serif';
	const letterSpacingEm = options.letterSpacingEm ?? 0;
	const minScale = options.minScale ?? 0.55;
	if (!text || fontSizePx <= 0 || wrapWidthPx <= 0 || maxLines < 1) return 1;
	const c = measureCtx();
	if (!c) return 1;

	const words = text.split(/\s+/).filter(Boolean);
	const lineCount = (size: number) => {
		c.font = `${fontWeight} ${size}px ${fontFamily}`;
		const advance = (s: string) => c.measureText(s).width + s.length * size * letterSpacingEm;
		let lines = 1;
		let current = '';
		for (const word of words) {
			const candidate = current ? `${current} ${word}` : word;
			if (current && advance(candidate) > wrapWidthPx) {
				lines += 1;
				current = word;
			} else {
				current = candidate;
			}
		}
		return lines;
	};

	// Coarse-to-fine: 2% steps are finer than the eye can tell at 16px and cost ~20 measurements.
	for (let scale = 1; scale >= minScale; scale -= 0.02) {
		if (lineCount(fontSizePx * scale) <= maxLines) return scale;
	}
	return minScale;
};
