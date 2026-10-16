/** Book-clock progress shared by portal removal and symbol landing. */
export type AshTiming = { startedAt: number; delay: number; duration: number; seed: string };
const clamp = (n: number) => Math.max(0, Math.min(1, n));
export const ashProgress = (now: number, timing: AshTiming) =>
	clamp((now - timing.startedAt - timing.delay) / Math.max(1, timing.duration));
