import type { BaseBet } from 'utils-bet';
import { stateMeta } from './stateMeta.svelte';
import { stateConfig } from './stateConfig.svelte';

export type Currency = string;
export type BetToResume = BaseBet | null;
export type BetModeKey = string;

export const stateBet = $state({
	currency: 'USD' as Currency,
	balanceAmount: 0,
	betAmount: 1,
	wageredBetAmount: 1,
	betToResume: null as BetToResume,
	activeBetModeKey: 'BASE' as BetModeKey,
	winBookEventAmount: 0,
	autoSpinsLoss: 0,
	autoSpinsCounter: 0,
	autoSpinsLossLimitAmount: Infinity,
	autoSpinsSingleWinLimitAmount: Infinity,
	isSpaceHold: false,
	isTurbo: false,
	isSuperTurbo: false,
});

// The bet must always be one of the levels the RGS returned in `authenticate` — an amount the
// operator never offered gets the game rejected at review. The previous clamp returned
// `balance / costMultiplier` verbatim, so a player with a $999 balance ended up betting exactly
// $999 even though no such level exists. Snap to a real level instead: take the highest level at
// or below the requested amount, then cap that at the highest level the balance can actually
// cover. When nothing is affordable we hold the lowest level — spinning is blocked separately by
// `isBetCostAvailable`, and parking the bet at 0 would strand the +/- steppers.
const correctBetAmount = (value: number) => {
	const levels = [...stateConfig.betAmountOptions].sort((a, b) => a - b);
	// Before `authenticate` resolves (and in replay, where the amount comes from the URL) there are
	// no levels to snap to — leave the value alone rather than inventing one.
	if (levels.length === 0) return Math.max(0, value);

	const requested = levels.reduce((best, level) => (level <= value ? level : best), levels[0]);

	const costMultiplier = betCostMultiplier();
	if (costMultiplier <= 0) return requested;

	const affordable = levels.filter((level) => level * costMultiplier <= stateBet.balanceAmount);
	if (affordable.length === 0) return levels[0];

	return Math.min(requested, affordable[affordable.length - 1]);
};

const setBetAmount = (value: number) => {
	stateBet.betAmount = correctBetAmount(value);
};

const updateBetAmount = (update: (value: number) => number) => {
	stateBet.betAmount = correctBetAmount(update(stateBet.betAmount));
};

let isTurboLocked = false;

const updateIsTurbo = (value: boolean, options: { persistent: boolean }) => {
	const { persistent } = options;

	if (!persistent && isTurboLocked) return;
	if (persistent) isTurboLocked = value;

	stateBet.isTurbo = value;
};

const activeBetMode = () => stateMeta.betModeMeta?.[stateBet.activeBetModeKey.toUpperCase()]
	?? stateMeta.betModeMeta?.[stateBet.activeBetModeKey.toLowerCase()]
	?? null;
const isContinuousBet = () => stateBet.autoSpinsCounter > 1 || stateBet.isSpaceHold;
const timeScale = () => (stateBet.isSuperTurbo ? 1.5 : stateBet.isTurbo ? 1.5 : 1);
const betCostMultiplier = () =>
	['activate', 'buy'].includes(stateBetDerived.activeBetMode()?.type)
		? stateBetDerived.activeBetMode().costMultiplier
		: 1;
const betCost = () => stateBet.betAmount * betCostMultiplier();
const isBetCostAvailable = () => betCost() > 0 && betCost() <= stateBet.balanceAmount;
const hasAutoBetCounter = () => stateBet.autoSpinsCounter !== 0;

export const stateBetDerived = {
	setBetAmount,
	updateBetAmount,
	updateIsTurbo,
	activeBetMode,
	isContinuousBet,
	timeScale,
	betCostMultiplier,
	betCost,
	isBetCostAvailable,
	hasAutoBetCounter,
};
