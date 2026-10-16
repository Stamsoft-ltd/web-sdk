import { COSTS, type Mode } from './contract.ts';

/** Display only. Wagers and win multipliers always retain their base-bet units. */
export const hudBetAmount = (baseBet: number, mode: Mode) =>
	baseBet * (mode === 'FEATURE' || mode === 'CHANCE' ? COSTS[mode] : 1);
