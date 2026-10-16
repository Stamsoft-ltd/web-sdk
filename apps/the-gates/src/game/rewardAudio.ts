import { playGameSound } from './audio.ts';
import type { RewardDelivery } from './rewardDelivery.ts';
/** Each delivery's first arrival is already guarded by arriveGateReward. Never synthesize sound. */
export function dingRewardArrival(index = 0, kind?: RewardDelivery['reward']['kind']) {
	if (index === 0 && kind) playGameSound(kind);
}
