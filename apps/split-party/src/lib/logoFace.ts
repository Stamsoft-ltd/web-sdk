// The logo "O"'s added face (LogoView.ts and Logo.svelte draw it the same): a smile and blush
// under the painted eyes, in the logo's 100x50 unit box, placed in a frame tilted like the
// eyes (their centres slope -12.2deg; -9 reads straighter on the round body) and centred
// under them. Tuned offline on logo-base.webp.
export const FACE = {
	x: 57.3,
	y: 24.7,
	deg: -9,
	ink: '#29113d',
	/** Resting smile: a bowed stroke, half-width w, bowing down by `bow`. */
	smile: { w: 1.7, bow: 1.15, width: 0.55 },
	/** The win grin: an open D mouth with a tongue, half-width w, `depth` deep. */
	grin: { w: 1.9, depth: 2.8, fill: '#7a1f45', tongue: '#ff6b8b' },
	/** Blush: one each side, a little below the eye line. */
	blush: { dx: 4.7, dy: -0.6, rx: 1.15, ry: 0.62, color: '#ff7aa8', alpha: 0.55 },
} as const;

/** SVG path of the resting smile, in the face frame. */
export const smilePath = () => {
	const { w, bow } = FACE.smile;
	return `M${-w} 0Q0 ${bow * 2} ${w} 0`;
};
/** SVG path of the open grin (top edge straight, bottom bowed), in the face frame. */
export const grinPath = () => {
	const { w, depth } = FACE.grin;
	return `M${-w} -0.2L${w} -0.2Q${w * 0.9} ${depth} 0 ${depth}Q${-w * 0.9} ${depth} ${-w} -0.2Z`;
};
