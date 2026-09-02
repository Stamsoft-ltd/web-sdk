import { fractionDigitsForAmount } from 'utils-shared/currency';

type ReplayCostSnapshot = { costMultiplier?: unknown } | null | undefined;

export const fallbackModeCostMultiplier = (mode: string) =>
	mode === 'CHANCE'
		? 2
		: mode === 'FEATURE'
			? 50
			: mode === 'BONUS'
				? 100
				: mode === 'SUPER'
					? 500
					: 1;

export const resolveReplayCostMultiplier = (snapshot: ReplayCostSnapshot, mode: string) => {
	const reported = Number(snapshot?.costMultiplier);
	return Number.isFinite(reported) && reported > 0 ? reported : fallbackModeCostMultiplier(mode);
};

export const formatReplayMultiplier = (value: unknown) => {
	const amount = Number(value);
	const safe = Number.isFinite(amount) ? amount : 0;
	return safe.toFixed(fractionDigitsForAmount(safe, 0));
};
