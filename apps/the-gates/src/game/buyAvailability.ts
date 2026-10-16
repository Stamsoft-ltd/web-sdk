import { COSTS, type Mode } from './contract.ts';

/** Compare at the RGS wallet's 6-decimal precision, not binary floating-point prices. */
export function canAffordMode(mode: Mode, baseBet: number, balance: number) {
	if (!Number.isFinite(baseBet) || baseBet <= 0 || !Number.isFinite(balance) || balance < 0)
		return false;
	const cost = Math.round(baseBet * COSTS[mode] * 1_000_000);
	const funds = Math.round(balance * 1_000_000);
	return Number.isSafeInteger(cost) && cost > 0 && Number.isSafeInteger(funds) && cost <= funds;
}
/** Only active per-spin toggles can be switched OFF without funds. Buys never bypass cost. */
export function modeOptionAvailable(mode: Mode, active: Mode, baseBet: number, balance: number) {
	return (
		((mode === 'CHANCE' || mode === 'FEATURE') && mode === active) ||
		canAffordMode(mode, baseBet, balance)
	);
}
