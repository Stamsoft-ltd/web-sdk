/** Never echo backend text/JSON to players: it may contain money, secrets or non-social copy. */
export function playerErrorKey(error: unknown): string {
	const data = error && typeof error === 'object' ? (error as Record<string, unknown>) : {};
	const code = String(data.error ?? data.code ?? '');
	if (code === 'ERR_IPB') return 'ERROR BALANCE';
	if (code === 'ERR_GLE') return 'ERROR LIMIT';
	if (code === 'ERR_ACT') return 'ERROR BUSY';
	if (code === 'ERR_VAL') return 'ERROR SESSION';
	if (code === 'ERR_REPLAY_AMOUNT') return 'ERROR REPLAY AMOUNT';
	return 'ERROR CONNECTION';
}

/** Actor reasons are internal enums, never player-facing text or translation keys themselves. */
export function autoplayMessageKey(reason: unknown): string {
	if (reason === 'insufficientFunds') return 'ERROR BALANCE';
	if (reason === 'lossLimitReached') return 'AUTO LOSS LIMIT';
	if (reason === 'singleWinLimitReached') return 'AUTO WIN LIMIT';
	return 'ERROR CONNECTION';
}
