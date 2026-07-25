// Demand-gated assets — the contract between game code and <AssetsLoader>.
//
// Assets flagged `deferDemand: true` are skipped by the automatic deferred stream and load ONLY
// when the game asks for them via loadDemandAssets(). AssetsLoader's deferred `$effect` has no game
// state and no external input, so gating a wave on a feature needs an explicit hook like this one
// rather than a relocated trigger. Apps that flag nothing keep the historical behaviour exactly:
// nothing is withheld and this module is never reached.
//
// It is a module singleton (one <App> per page). AssetsLoader registers on mount and clears on
// teardown, which also resets the once-only latch so a remounted app reloads rather than reporting
// assets it no longer holds.

type DemandLoader = () => Promise<void>;

let loader: DemandLoader | undefined;
let inFlight: Promise<void> | undefined;
let releasePending: (() => void) | undefined;

/** Internal — called by <AssetsLoader>. Pass `undefined` on teardown. */
export const setDemandLoader = (fn: DemandLoader | undefined) => {
	loader = fn;
	if (!fn) {
		inFlight = undefined;
		releasePending = undefined;
		return;
	}
	if (releasePending) {
		// A request arrived before this loader mounted; its promise is still unresolved. Service it
		// now instead of resolving it empty, which would let the caller draw missing art.
		const release = releasePending;
		releasePending = undefined;
		void fn().then(release, release);
	}
};

/**
 * Load every asset flagged `deferDemand`, once. Concurrent and repeat calls share the single load,
 * so awaiting this at each point of first use is free after the first time. Resolves immediately
 * when no asset is flagged (the loader finds an empty list).
 */
export const loadDemandAssets = (): Promise<void> => {
	if (!inFlight) {
		inFlight = loader
			? loader()
			: new Promise<void>((resolve) => {
					releasePending = resolve;
				});
	}
	return inFlight;
};
