import type { Speed } from './uiPolicy';
/** Presentation-only wisp; no book state or gameplay RNG. Coordinates are renderer pixels. */
export const TUMBLE_FLIGHT_MS = 480;
export const TUMBLE_ARRIVAL_MS = 120;
export function tumbleFlightTiming(speed: Speed = 'normal') {
	return speed === 'turbo'
		? { flight: 110, arrival: 40 }
		: speed === 'fast'
			? { flight: 220, arrival: 65 }
			: { flight: TUMBLE_FLIGHT_MS, arrival: TUMBLE_ARRIVAL_MS };
}
export type Point = { x: number; y: number };
export function tumbleFlightPoint(from: Point, to: Point, progress: number): Point {
	const t = Math.max(0, Math.min(1, progress));
	const bend = Math.min(140, Math.hypot(to.x - from.x, to.y - from.y) * 0.3);
	return {
		x: from.x + (to.x - from.x) * t,
		y: from.y + (to.y - from.y) * t - Math.sin(Math.PI * t) * bend,
	};
}
export function tumbleDestination(previous: number, next: number) {
	return Number.isInteger(next) && next >= 1 && next <= 3 && next > previous ? next : null;
}
