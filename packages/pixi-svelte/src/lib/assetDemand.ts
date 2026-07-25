// Demand-gated assets — the contract between game code and <AssetsLoader>.
//
// Assets flagged `deferDemand: true` are skipped by the automatic deferred stream and load ONLY
// when the game asks for them via loadDemandAssets(). AssetsLoader's deferred `$effect` has no game
// state and no external input, so gating a wave on a feature needs an explicit hook like this one
// rather than a relocated trigger. Apps that flag nothing keep the historical behaviour exactly:
// nothing is withheld and this module is never reached.
//
// It is a module singleton (one <App> per page). AssetsLoader registers on mount and clears on
// teardown, which also drops the once-only latch so a remounted app reloads rather than reporting
// assets it no longer holds.
//
// Self-check: `node packages/pixi-svelte/assetDemand.check.ts`.

type DemandLoader = () => Promise<void>;

let loader: DemandLoader | undefined;
let inFlight: Promise<void> | undefined;
let releasePending: (() => void) | undefined;

const reportFailure = (latched: Promise<void> | undefined, error: unknown) => {
	// Never latch a failed or partial load: drop it so the next request retries instead of
	// reporting art that never arrived.
	if (inFlight === latched) inFlight = undefined;
	console.error('[pixi-svelte] demand asset load failed', error);
};

/** Internal — called by <AssetsLoader>. Pass `undefined` on teardown. */
export const setDemandLoader = (fn: DemandLoader | undefined) => {
	loader = fn;
	if (!fn) {
		inFlight = undefined;
		releasePending = undefined;
		return;
	}
	if (releasePending) {
		// A request arrived before this loader mounted, and its promise is still unresolved. Service
		// it now rather than resolving it empty, which would let the caller draw missing art.
		const release = releasePending;
		const latched = inFlight;
		releasePending = undefined;
		void fn().then(release, (error) => {
			reportFailure(latched, error);
			release();
		});
	}
};

/**
 * Load every asset flagged `deferDemand`, once. Concurrent and repeat calls share the single load,
 * so awaiting this at each point of first use is free after the first time. Resolves immediately
 * when no asset is flagged (the loader finds an empty list).
 *
 * A load that fails is NOT latched — the next call retries. Callers get a resolved promise either
 * way: they await this before presenting something, and a missing sheet must not abort the
 * presentation (render paths fall back to static art), only be reported and retried.
 */
export const loadDemandAssets = (): Promise<void> => {
	if (inFlight) return inFlight;
	const attempt = loader
		? loader()
		: new Promise<void>((resolve) => {
				releasePending = resolve;
			});
	const guarded: Promise<void> = attempt.catch((error) => reportFailure(guarded, error));
	inFlight = guarded;
	return guarded;
};
