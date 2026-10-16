/** End an existing round only. Never places a wager or discards pending state on failure. */
export async function finishUnfinishedRound(request: () => Promise<unknown>) {
	const data = (await request()) as { error?: unknown; balance?: { amount?: unknown } } | undefined;
	if (data?.error)
		throw new Error(typeof data.error === 'string' ? data.error : 'Unable to finish round');
	if (typeof data?.balance?.amount !== 'number' || !Number.isFinite(data.balance.amount))
		throw new Error('Invalid end-round response');
	return data;
}
