import { API_AMOUNT_MULTIPLIER, MOST_USED_BET_INDEXES } from 'constants-shared/bet';

export type RgsBetConfig = {
	minBet?: unknown;
	maxBet?: unknown;
	stepBet?: unknown;
	defaultBetLevel?: unknown;
	betLevels?: unknown;
};

type NormalizedBetConfig = {
	betAmountOptions: number[];
	betMenuOptions: number[];
	minBetAmount: number;
	maxBetAmount: number;
	stepBetAmount: number;
	defaultBetAmount: number;
};

const positiveAmount = (value: unknown) => {
	const amount = Number(value);
	return Number.isFinite(amount) && amount > 0 ? Math.round(amount) : 0;
};

const uniqueSorted = (values: number[]) =>
	[...new Set(values.filter((value) => Number.isFinite(value) && value > 0))].sort(
		(left, right) => left - right,
	);

const generatedLevels = ({ min, max, step }: { min: number; max: number; step: number }) => {
	if (!min || !max || min > max) return [];
	if (!step) return min === max ? [min] : [min, max];

	const levels: number[] = [];
	for (let amount = min; amount <= max; amount += step) levels.push(amount);
	return levels;
};

const closestLevel = (levels: number[], target: number) =>
	levels.reduce((closest, level) =>
		Math.abs(level - target) < Math.abs(closest - target) ? level : closest,
	);

const menuLevels = (levels: number[]) => {
	if (levels.length <= MOST_USED_BET_INDEXES.length) return levels;
	return uniqueSorted([
		...levels.filter((_, index) => MOST_USED_BET_INDEXES.includes(index)),
		levels[0],
		levels[levels.length - 1],
	]);
};

export const normalizeRgsBetConfig = (
	config: RgsBetConfig,
	fallbackLevels: number[],
): NormalizedBetConfig => {
	const min = positiveAmount(config.minBet);
	const max = positiveAmount(config.maxBet);
	const step = positiveAmount(config.stepBet);
	const returnedLevels = Array.isArray(config.betLevels)
		? uniqueSorted(config.betLevels.map(positiveAmount))
		: [];
	const boundedLevels = returnedLevels.filter(
		(level) => (!min || level >= min) && (!max || level <= max),
	);
	const rangeLevels = generatedLevels({ min, max, step });
	const rawLevels =
		boundedLevels.length > 0
			? boundedLevels
			: rangeLevels.length > 0
				? rangeLevels
				: returnedLevels.length > 0
					? returnedLevels
					: [];
	const safeFallbackLevels = uniqueSorted(fallbackLevels);
	const displayLevels = uniqueSorted(
		rawLevels.length > 0
			? rawLevels.map((level) => level / API_AMOUNT_MULTIPLIER)
			: safeFallbackLevels.length > 0
				? safeFallbackLevels
				: [1],
	);
	const defaultRaw = positiveAmount(config.defaultBetLevel);
	const requestedDefault = defaultRaw / API_AMOUNT_MULTIPLIER;
	const defaultBetAmount = requestedDefault
		? closestLevel(displayLevels, requestedDefault)
		: displayLevels[0];

	return {
		betAmountOptions: displayLevels,
		betMenuOptions: menuLevels(displayLevels),
		minBetAmount: min ? min / API_AMOUNT_MULTIPLIER : displayLevels[0],
		maxBetAmount: max ? max / API_AMOUNT_MULTIPLIER : displayLevels[displayLevels.length - 1],
		stepBetAmount: step / API_AMOUNT_MULTIPLIER,
		defaultBetAmount,
	};
};
