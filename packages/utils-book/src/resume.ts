/** Keep an active book replayable when the RGS has not recorded a usable checkpoint. */
export function getResumeEventIndex(event: unknown, eventCount: number): number {
	const index = typeof event === 'string' || typeof event === 'number' ? Number(event) : 0;
	return Number.isInteger(index) && index >= 0 && index < eventCount ? index : 0;
}
