/** Local renderer diagnostics only. Bounded memory; no network/analytics. */
const samples: { interval: number; work: number }[] = [];
export function recordMotionFrame(interval: number, work: number) {
	if (interval > 0 && interval < 250) {
		samples.push({ interval, work });
		if (samples.length > 180) samples.shift();
	}
}
export function motionMetrics(subscribers: number) {
	const percentile = (values: number[], p: number) =>
		values.length
			? [...values].sort((a, b) => a - b)[
					Math.min(values.length - 1, Math.floor(values.length * p))
				]
			: 0;
	const average = samples.length
		? samples.reduce((sum, s) => sum + s.interval, 0) / samples.length
		: 0;
	return {
		samples: samples.length,
		fps: average ? 1000 / average : 0,
		intervalP95: percentile(
			samples.map((s) => s.interval),
			0.95,
		),
		workP95: percentile(
			samples.map((s) => s.work),
			0.95,
		),
		subscribers,
	};
}
export function resetMotionMetrics() {
	samples.length = 0;
}
