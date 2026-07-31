/**
 * Walking a rounded rectangle by arc length, plus reading a colour ramp laid round it.
 *
 * Both the reel pad and the popup panels are art with a neon edge painted on, and both want lights
 * running along that edge. All either one has to supply is where its edge sits — as fractions of
 * the art, so the same numbers hold at any drawn size — and the colours sampled round it.
 */

export type BorderGeometry = {
	/** Edges of the painted line, as fractions of the art's width/height. */
	left: number;
	top: number;
	right: number;
	bottom: number;
	/** Corner radii, rx as a fraction of the width and ry of the height. */
	rx: number;
	ry: number;
};

/**
 * A point on the border, `t` running 0..1 clockwise from the middle of the top edge. `originX` and
 * `originY` are added to every coordinate — pass 0 for a top-left origin (canvas) or minus half the
 * size for a centred one (a pixi sprite anchored at 0.5).
 *
 * Spacing is by arc length, so a light moving at a constant `t` rate keeps a constant speed the
 * whole way round instead of racing through the corners.
 */
export const roundedRectPoint = (
	geometry: BorderGeometry,
	t: number,
	width: number,
	height: number,
	originX = 0,
	originY = 0,
) => {
	const left = geometry.left * width + originX;
	const right = geometry.right * width + originX;
	const top = geometry.top * height + originY;
	const bottom = geometry.bottom * height + originY;
	const rx = geometry.rx * width;
	const ry = geometry.ry * height;

	const runX = right - left - 2 * rx;
	const runY = bottom - top - 2 * ry;
	const arc = (Math.PI * (rx + ry)) / 4;
	const segments = [runX / 2, arc, runY, arc, runX, arc, runY, arc, runX / 2];
	const total = segments.reduce((sum, s) => sum + s, 0);

	let distance = (((t % 1) + 1) % 1) * total;
	for (let i = 0; i < segments.length; i += 1) {
		const span = segments[i];
		if (distance <= span) {
			const f = distance / span;
			switch (i) {
				case 0:
					return { x: left + rx + runX / 2 + (runX / 2) * f, y: top };
				case 1: {
					const a = -Math.PI / 2 + (f * Math.PI) / 2;
					return { x: right - rx + rx * Math.cos(a), y: top + ry + ry * Math.sin(a) };
				}
				case 2:
					return { x: right, y: top + ry + runY * f };
				case 3: {
					const a = (f * Math.PI) / 2;
					return { x: right - rx + rx * Math.cos(a), y: bottom - ry + ry * Math.sin(a) };
				}
				case 4:
					return { x: right - rx - runX * f, y: bottom };
				case 5: {
					const a = Math.PI / 2 + (f * Math.PI) / 2;
					return { x: left + rx + rx * Math.cos(a), y: bottom - ry + ry * Math.sin(a) };
				}
				case 6:
					return { x: left, y: bottom - ry - runY * f };
				case 7: {
					const a = Math.PI + (f * Math.PI) / 2;
					return { x: left + rx + rx * Math.cos(a), y: top + ry + ry * Math.sin(a) };
				}
				default:
					// The ring is cut at the middle of the top edge, so this last segment is only HALF
					// the top run — from the top-left corner back to that middle. Advancing it by the
					// whole runX sent anything travelling anticlockwise to the top-RIGHT corner as t
					// approached 1, instead of home to the middle.
					return { x: left + rx + (runX / 2) * f, y: top };
			}
		}
		distance -= span;
	}
	return { x: left + rx, y: top };
};

/** The ramp's colour at `t`, interpolated between entries so a light never steps hue. */
export const rampColour = (ramp: readonly number[], t: number) => {
	const scaled = (((t % 1) + 1) % 1) * ramp.length;
	const index = Math.floor(scaled);
	const f = scaled - index;
	const from = ramp[index % ramp.length];
	const to = ramp[(index + 1) % ramp.length];
	const mix = (shift: number) => {
		const a = (from >> shift) & 255;
		const b = (to >> shift) & 255;
		return Math.round(a + (b - a) * f);
	};
	return (mix(16) << 16) | (mix(8) << 8) | mix(0);
};

/** Same value as `rampColour`, as a CSS colour for canvas gradients. */
export const rampCss = (ramp: readonly number[], t: number, alpha: number) => {
	const c = rampColour(ramp, t);
	return `rgba(${(c >> 16) & 255}, ${(c >> 8) & 255}, ${c & 255}, ${alpha})`;
};
