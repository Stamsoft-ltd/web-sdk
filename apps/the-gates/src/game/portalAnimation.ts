/** Cartoon portal behind the full-size symbol; slow, continuous suction. Cosmetic seed only. */
import { visualRandom } from './visualRandom.ts';
export const PORTAL_SECONDS = 1;
export const SYMBOL_GONE_SECONDS = 0.86;
export const SYMBOL_FULL_SIZE_SECONDS = 0.12;
export function portalRemovalTracks(eventId: string) {
	const random = visualRandom(`${eventId}:mini-portal`),
		direction = random() < 0.5 ? -1 : 1;
	// One-plus turns; adjacent rotation keys stay below 180° to preserve spin direction.
	const twist = direction * (500 + random() * 60),
		swirl = direction * (130 + random() * 25);
	const scale = (frames: number[][]) => frames.map(([time, x, y = x]) => ({ time, x, y }));
	const translate = (frames: number[][]) => frames.map(([time, x, y]) => ({ time, x, y }));
	const rotate = (frames: number[][]) => frames.map(([time, value]) => ({ time, value }));
	const alpha = (frames: number[][]) => frames.map(([time, value]) => ({ time, value }));
	return {
		bones: {
			body: {
				// No anticipation squash/pop: begin at the symbol's neutral full size.
				scale: scale([
					[0, 1],
					[SYMBOL_FULL_SIZE_SECONDS, 1],
					[0.18, 0.99],
					[0.25, 0.96],
					[0.33, 0.91],
					[0.41, 0.84],
					[0.49, 0.74],
					[0.57, 0.62],
					[0.64, 0.49],
					[0.7, 0.37],
					[0.75, 0.26],
					[0.79, 0.17],
					[0.82, 0.1],
					[0.845, 0.045],
					[SYMBOL_GONE_SECONDS, 0.001],
				]),
				translate: translate([
					[0, 0, 0],
					[SYMBOL_FULL_SIZE_SECONDS, 0, 0],
					[0.25, direction * 2, -1],
					[0.41, direction * 3, -3],
					[0.57, direction * 2, -6],
					[0.7, direction, -10],
					[SYMBOL_GONE_SECONDS, 0, -14],
				]),
				rotate: rotate([
					[0, 0],
					[SYMBOL_FULL_SIZE_SECONDS, 0],
					[0.28, twist * 0.12],
					[0.49, twist * 0.35],
					[0.595, twist * 0.525],
					[0.7, twist * 0.7],
					[SYMBOL_GONE_SECONDS, twist],
				]),
			},
			'portal-root': {
				scale: scale([
					[0, 0.001],
					[0.09, 1.08, 0.94],
					[0.18, 1],
					[0.5, 0.98, 1.03],
					[0.82, 1.02, 0.98],
					// Keep the hole open until the tiny symbol has vanished.
					[0.87, 1],
					[0.9, 0.35],
					[0.93, 0.001],
					[PORTAL_SECONDS, 0.001],
				]),
				translate: translate([
					[0, 0, 0],
					[PORTAL_SECONDS, 0, 0],
				]),
			},
			'portal-vortex': {
				rotate: rotate([
					[0, 0],
					[0.3, swirl * 0.3],
					[0.7, swirl],
					[PORTAL_SECONDS, swirl * 1.45],
				]),
			},
			'portal-rim': {
				rotate: rotate([
					[0, 0],
					[0.18, -direction * 4],
					[0.5, direction * 3],
					[0.87, 0],
					[PORTAL_SECONDS, 0],
				]),
			},
		},
		slots: {
			body: {
				alpha: alpha([
					[0, 1],
					[0.845, 1],
					[SYMBOL_GONE_SECONDS, 0],
					[PORTAL_SECONDS, 0],
				]),
			},
			'portal-vortex': {
				alpha: alpha([
					[0, 0],
					[0.04, 1],
					[0.92, 1],
					[PORTAL_SECONDS, 0],
				]),
			},
			'portal-rim': {
				alpha: alpha([
					[0, 0],
					[0.04, 1],
					[0.92, 1],
					[PORTAL_SECONDS, 0],
				]),
			},
		},
	};
}
