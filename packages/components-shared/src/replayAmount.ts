/** Replay is session-free: optional/invalid stake uses one whole currency unit, never NaN/negative. */
export function replayAmountUnits(raw: unknown) {
	const amount = Number(raw);
	return Number.isSafeInteger(amount) && amount > 0 ? amount : 1_000_000;
}
