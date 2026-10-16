/** Local, opt-in diagnostics. No URLs, session IDs or outbound telemetry. */
export const emptyAssetAudit = () => ({
	resources: 0,
	transferredBytes: 0,
	cachedResources: 0,
	unknownResources: 0,
	imageSrcChanges: 0,
	symbolAdds: 0,
	symbolRemoves: 0,
});
export function recordAssetResource(
	totals: ReturnType<typeof emptyAssetAudit>,
	entry: Pick<PerformanceResourceTiming, 'name' | 'transferSize' | 'decodedBodySize'>,
) {
	const path = new URL(entry.name).pathname;
	if (!path.includes('/assets/the-gates/') && !path.includes('/fonts/')) return;
	totals.resources++;
	totals.transferredBytes += entry.transferSize;
	if (!entry.transferSize) {
		if (entry.decodedBodySize) totals.cachedResources++;
		else totals.unknownResources++;
	}
}
