import { GATE_CYCLE } from './gateAnimation.ts';
export const GATE_OPEN_DURATION_MS = Math.round(GATE_CYCLE.openStart * 1000);
export const GATE_REWARD_ENTER_MS = Math.round(
	(GATE_CYCLE.rewardStart - GATE_CYCLE.openStart) * 1000,
);
export const GATE_REWARD_HOLD_MS = 1800;
export const GATE_REWARD_OUTRO_MS = 1300;
export const GATE_REWARD_DURATION_MS =
	GATE_REWARD_ENTER_MS + GATE_REWARD_HOLD_MS + GATE_REWARD_OUTRO_MS;
/** Event-owned clocks: load, resize, speed changes and unrelated events never reset them. */
export function gatePlaybackTime(now: number, openedAt: number, rewardAt: number | null) {
	if (rewardAt !== null) {
		const age = Math.max(0, now - rewardAt);
		if (age < GATE_REWARD_ENTER_MS)
			return (
				GATE_CYCLE.openStart +
				(age / GATE_REWARD_ENTER_MS) * (GATE_CYCLE.rewardStart - GATE_CYCLE.openStart)
			);
		const settledAge = age - GATE_REWARD_ENTER_MS;
		const holdSpan = GATE_CYCLE.rewardHoldEnd - GATE_CYCLE.rewardStart;
		const outroSpan = GATE_CYCLE.finished - GATE_CYCLE.rewardHoldEnd;
		return Math.min(
			GATE_CYCLE.finished,
			GATE_CYCLE.rewardStart +
				Math.min(settledAge / GATE_REWARD_HOLD_MS, 1) * holdSpan +
				(Math.max(0, settledAge - GATE_REWARD_HOLD_MS) / GATE_REWARD_OUTRO_MS) * outroSpan,
		);
	}
	// Wait closed for the authoritative reward; never peek ahead or replay an old award.
	return openedAt < 0
		? GATE_CYCLE.openStart
		: Math.min(GATE_CYCLE.openStart, Math.max(0, now - openedAt) / 1000);
}
export function gatePresentationFrame(
	now: number,
	openedAt: number,
	rewardAt: number | null,
	order: number,
	count: number,
) {
	const time = gatePlaybackTime(now, openedAt, rewardAt);
	const pendingReward = order > 0 && order < count;
	const portalWaiting = pendingReward && time > GATE_CYCLE.rewardHoldEnd;
	const ended = rewardAt !== null && !pendingReward && now - rewardAt >= GATE_REWARD_DURATION_MS;
	return {
		time,
		portalWaiting,
		// Subsequent Hidden awards emerge from the same open portal, without replaying doors.
		doorsHidden: order > 1,
		portalStable: portalWaiting || (order > 1 && time < GATE_CYCLE.rewardStart),
		ended,
		backdrop: ended
			? 0
			: portalWaiting
				? 1
				: rewardAt === null
					? Math.min(1, Math.max(0, now - openedAt) / 200)
					: Math.min(
							1,
							Math.max(0, (GATE_REWARD_DURATION_MS - (now - rewardAt)) / GATE_REWARD_OUTRO_MS),
						),
	};
}
