import type { Reward } from './contract';

/** Operation is visible before settlement; never infer it from the awarded total. */
export function multiplierRewardText(reward: Reward) {
	if (!('value' in reward)) return null;
	return reward.kind === 'addMultiplier' ? `+${reward.value}×` : `×${reward.value}`;
}

export function rewardVisual(reward: Reward | null | undefined) {
	if (reward?.kind === 'multiplyMultiplier')
		return { fill: 0x96f8ff, accent: 0x39e1ff, background: 0x082e4b, badge: 'diamond' as const };
	if (reward?.kind === 'addMultiplier')
		return { fill: 0xffe698, accent: 0xffc340, background: 0x492505, badge: 'rounded' as const };
	return { fill: 0xfff6ae, accent: 0xffe24a, background: 0x331346, badge: null };
}

/** Both variants share the existing bounded clock and arrival time. */
export function rewardMotion(
	kind: Reward['kind'] | undefined,
	age: number,
	progress = 0,
	reduced = false,
) {
	if (reduced || (kind !== 'addMultiplier' && kind !== 'multiplyMultiplier'))
		return { scale: 1, y: 0, rotation: 0, flightRotation: 0 };
	const t = Math.max(0, Math.min(1, age / 500)),
		p = Math.max(0, Math.min(1, progress));
	return kind === 'addMultiplier'
		? {
				scale: 1 + Math.sin(t * Math.PI) * 0.08,
				y: -12 * Math.sin(t * Math.PI),
				rotation: 0,
				flightRotation: 0,
			}
		: {
				scale: 1 + Math.sin(t * Math.PI * 2) * 0.12,
				y: 0,
				rotation: Math.sin(t * Math.PI * 2) * 0.12,
				flightRotation: Math.sin(p * Math.PI * 2) * 0.28,
			};
}
