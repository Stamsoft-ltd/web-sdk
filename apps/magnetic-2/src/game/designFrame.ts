/**
 * The MOTHERSHIP celebration screens are all drawn on ONE 1200x670 Figma frame:
 *
 *   9185:13916  free spins won        ("YOU WON / 10 FREE SPINS")
 *   9185:13975  bonus total           ("YOU WON / $1,234.00")
 *   9185:14033  mystery congratulations ("YOU WON / Core Overload + 10 FREE SPINS")
 *   9185:18451  the mystery orb draw
 *
 * They share the same pad, the same headings and the same value box, so they share this mapping
 * too: every placement in those components is written as the design node's OWN frame coordinate and
 * converted here. That is what lets the numbers in the components be read straight off the Figma
 * node list instead of being re-derived per screen.
 *
 * The frame is FITTED into the visible canvas, never stretched — there is no portrait mock for
 * these screens, and a stretch would squash the pad's bevel and the alien with it.
 */
export const DESIGN_W = 1200;
export const DESIGN_H = 670;

export type DesignFrame = {
	/** Design-frame x -> main-container x (the frame's centre is the screen's centre). */
	px: (x: number) => number;
	/** Design-frame y -> main-container y. */
	py: (y: number) => number;
	/** A design length in main-container units. */
	s: (v: number) => number;
	/** The uniform fit factor itself. */
	scale: number;
	/** Visible canvas in main-container units, for anything that has to reach a screen edge. */
	viewW: number;
	viewH: number;
};

export const designFrame = (
	main: { width: number; height: number; scale: number },
	canvas: { width: number; height: number },
): DesignFrame => {
	const viewW = canvas.width / (main.scale || 1);
	const viewH = canvas.height / (main.scale || 1);
	const scale = Math.min(viewW / DESIGN_W, viewH / DESIGN_H) * 0.98;
	return {
		px: (x: number) => main.width * 0.5 + (x - DESIGN_W / 2) * scale,
		py: (y: number) => main.height * 0.5 + (y - DESIGN_H / 2) * scale,
		s: (v: number) => v * scale,
		scale,
		viewW,
		viewH,
	};
};
