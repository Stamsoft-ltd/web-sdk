// Self-check for assetDemand.ts — run it, no framework:
//
//     node packages/pixi-svelte/assetDemand.check.ts
//
// It lives at the package root, not in src/lib, because svelte-package copies src/lib into dist.
//
// Covers the four behaviours the demand contract is relied on for: load once, share the promise
// across concurrent callers, service a request that arrived before the loader mounted, and DON'T
// latch a failure (a partial bonus-art load must be retried, not remembered as success).
import assert from 'node:assert/strict';

import { loadDemandAssets, setDemandLoader } from './src/lib/assetDemand.ts';

const silenced = console.error;
console.error = () => {};

const run = async () => {
	// 1. loads once, and concurrent callers share the single load
	let calls = 0;
	setDemandLoader(async () => {
		calls += 1;
	});
	const [a, b] = [loadDemandAssets(), loadDemandAssets()];
	assert.equal(a, b, 'concurrent callers must share one promise');
	await Promise.all([a, b, loadDemandAssets()]);
	await loadDemandAssets();
	assert.equal(calls, 1, `expected one load, got ${calls}`);

	// 2. a request made before the loader mounts is serviced, not resolved empty
	setDemandLoader(undefined);
	let serviced = false;
	const early = loadDemandAssets();
	let settled = false;
	void early.then(() => (settled = true));
	await Promise.resolve();
	assert.equal(settled, false, 'a pre-mount request must stay pending until a loader arrives');
	setDemandLoader(async () => {
		serviced = true;
	});
	await early;
	assert.equal(serviced, true, 'the pre-mount request must run once a loader registers');

	// 3. a failed load is not latched — the next call retries, and the caller still resolves
	setDemandLoader(undefined);
	let attempts = 0;
	setDemandLoader(async () => {
		attempts += 1;
		if (attempts === 1) throw new Error('simulated partial load');
	});
	await loadDemandAssets();
	await loadDemandAssets();
	assert.equal(attempts, 2, `a failed load must be retried, got ${attempts} attempt(s)`);
	await loadDemandAssets();
	assert.equal(attempts, 2, 'the successful retry must latch');

	// 4. a failure that arrives on the pre-mount path is also not latched
	setDemandLoader(undefined);
	let lateAttempts = 0;
	const pending = loadDemandAssets();
	setDemandLoader(async () => {
		lateAttempts += 1;
		throw new Error('simulated pre-mount failure');
	});
	await pending;
	await loadDemandAssets();
	assert.equal(lateAttempts, 2, `pre-mount failure must be retried, got ${lateAttempts}`);

	setDemandLoader(undefined);
	console.error = silenced;
	console.log('assetDemand.check.ts: ALL PASS');
};

void run();
