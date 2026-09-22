/** Same exclusive speed flags as Veggie Salad: NORMAL -> FAST -> TURBO -> NORMAL. */
export type Speed = 'normal' | 'fast' | 'turbo';
export function selectedSpeed(
	flags: { isTurbo: boolean; isSuperTurbo: boolean },
	limits: { disabledTurbo?: boolean; disabledSuperTurbo?: boolean },
): Speed {
	if (limits.disabledTurbo) return 'normal';
	if (flags.isSuperTurbo && !limits.disabledSuperTurbo) return 'turbo';
	return flags.isTurbo ? 'fast' : 'normal';
}
export function nextSpeed(
	speed: Speed,
	limits: { disabledTurbo?: boolean; disabledSuperTurbo?: boolean },
): Speed {
	if (limits.disabledTurbo || speed === 'turbo') return 'normal';
	if (speed === 'fast') return limits.disabledSuperTurbo ? 'normal' : 'turbo';
	return 'fast';
}
export const speedFactor = (speed: Speed) => (speed === 'turbo' ? 3 : speed === 'fast' ? 2 : 1);
/** Full win screens start at 20x; 10x..<20x is text only over the board. */
export const showsWinPanel = (amount: number) => amount >= 2000;
