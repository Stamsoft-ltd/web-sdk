/** RGS owns levels, wallet, currency and results. Defaults only fill absent jurisdiction flags. */
export const JURISDICTION_DEFAULTS = {
	socialCasino: false,
	disabledFullscreen: false,
	disabledTurbo: false,
	disabledSuperTurbo: false,
	disabledAutoplay: false,
	disabledSlamstop: false,
	disabledSpacebar: false,
	disabledBuyFeature: false,
	displayNetPosition: false,
	displayRTP: false,
	displaySessionTimer: false,
	minimumRoundDuration: 0,
};
export function normalizeGatesJurisdiction(input: unknown, socialURL = false) {
	const source = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
	const result = { ...JURISDICTION_DEFAULTS };
	for (const key of Object.keys(result).filter((k) => k !== 'minimumRoundDuration') as Exclude<
		keyof typeof result,
		'minimumRoundDuration'
	>[])
		result[key] = source[key] === true;
	result.socialCasino ||= socialURL;
	const duration = Number(source.minimumRoundDuration);
	result.minimumRoundDuration = Number.isFinite(duration) && duration >= 0 ? duration : 0;
	return result;
}
export function stepRgsBetLevel(levels: readonly number[], amount: number, direction: number) {
	const ordered = [...new Set(levels.filter((n) => Number.isFinite(n) && n > 0))].sort(
		(a, b) => a - b,
	);
	if (!ordered.length) return amount;
	return direction > 0
		? (ordered.find((n) => n > amount) ?? ordered.at(-1)!)
		: ([...ordered].reverse().find((n) => n < amount) ?? ordered[0]);
}
/** Social terminology is presentation only; never changes wager units or currency codes. */
export function socialEnglish(text: string) {
	return text
		.replace(/\bat the cost of\b/gi, 'for')
		.replace(/\bpaid out\b/gi, 'won')
		.replace(/\bpays out\b/gi, 'won')
		.replace(/\bpay out\b/gi, 'win')
		.replace(/\bcost of\b/gi, 'can be played for')
		.replace(/\bpay\s*table\b/gi, 'win table')
		.replace(/\btotal bet\b/gi, 'total play')
		.replace(/\bpaid spins\b/gi, 'plays')
		.replace(/\bpaid spin\b/gi, 'play')
		.replace(/\bbuy bonus\b/gi, 'get bonus')
		.replace(/\bbought\b/gi, 'instantly triggered')
		.replace(/\bbuy(?:ing)?\b/gi, 'play')
		.replace(/\bpurchases?\b/gi, 'feature play')
		.replace(/\bbase bets?\b/gi, 'base play')
		.replace(/\bbetting\b/gi, 'playing')
		.replace(/\bbets?\b/gi, 'play')
		.replace(/\bpaying\b/gi, 'winning')
		.replace(/\bpays?\b/gi, 'wins')
		.replace(/\bpayouts?\b/gi, 'wins')
		.replace(/\bwagers?\b/gi, 'plays')
		.replace(/\bmoney\b/gi, 'coins')
		.replace(/\bpaid\b/gi, 'won')
		.replace(/\bbonus buy\b/gi, 'feature')
		.replace(/\bgambl(?:e|ing)\b/gi, 'play')
		.replace(/\bcash\b/gi, 'coins')
		.replace(/\bcredits?\b/gi, 'balance')
		.replace(/\bcurrency\b/gi, 'token')
		.replace(/\bdeposits?\b/gi, 'get coins')
		.replace(/\bfunds?\b/gi, 'balance')
		.replace(/\bstakes?\b/gi, 'play amount')
		.replace(/\bwithdraw\b/gi, 'redeem')
		.replace(/\brebet\b/gi, 'respin')
		.replace(/\bpayer\b/gi, 'winner');
}
