/** Presentation-only doors/portal. Never emits/reorders authoritative events. */
export type BonusTransition = {
	kind: 'entry' | 'exit';
	startedAt: number;
	reduced: boolean;
	speedFactor?: number;
};
export const BONUS_TRANSITION_MS = { entry: 2180, exit: 2880, reduced: 240 } as const;
export const BONUS_SCENE_SWITCH_MS = { entry: 400, exit: 1100, reduced: 120 } as const;
const clamp = (x: number) => Math.max(0, Math.min(1, x));
export function bonusTransitionDuration(kind: 'entry' | 'exit', reduced: boolean) {
	return reduced ? BONUS_TRANSITION_MS.reduced : BONUS_TRANSITION_MS[kind];
}
export function bonusTransitionFrame(transition: BonusTransition | null, now: number) {
	if (!transition)
		return {
			gateTime: 2.18,
			gateVisible: false,
			portalVisible: false,
			artScale: 1,
			artAlpha: 1,
			rotation: 0,
			done: true,
		};
	const elapsed = Math.max(0, (now - transition.startedAt) * (transition.speedFactor ?? 1));
	const duration = bonusTransitionDuration(transition.kind, transition.reduced);
	if (transition.reduced)
		return {
			gateTime: 2.18,
			gateVisible: false,
			portalVisible: false,
			artScale: 1,
			artAlpha:
				transition.kind === 'entry' ? clamp(elapsed / duration) : 1 - clamp(elapsed / duration),
			rotation: 0,
			done: elapsed >= duration,
		};
	const entry = transition.kind === 'entry';
	const progress = entry ? clamp((elapsed - 580) / 640) : clamp(elapsed / 700);
	const artScale = entry ? 1 - (1 - progress) ** 3 : (1 - progress) ** 3;
	return {
		gateTime: entry
			? Math.min(2.18, elapsed / 1000)
			: elapsed < 700
				? 1.1 + (elapsed / 700) * 1.08
				: Math.min(2.18, (elapsed - 700) / 1000),
		gateVisible: elapsed < duration,
		// After summary retraction, reopening reveals base directly—no second portal.
		portalVisible: entry || elapsed < 700,
		artScale,
		artAlpha: entry ? clamp(progress * 3) : 1 - progress,
		rotation: (entry ? -1 : 1) * (entry ? 1 - progress : progress) * Math.PI * 4,
		done: elapsed >= duration,
	};
}
/** A trigger may precede bookkeeping; do not show intro until entry spin is finished. */
export function bonusEntryBoundary(event: { type: string; gameType?: string }) {
	return (
		event.type === 'updateFreeSpin' ||
		(event.type === 'spinStart' && event.gameType === 'freegame') ||
		event.type === 'freeSpinEnd' ||
		event.type === 'finalWin'
	);
}
