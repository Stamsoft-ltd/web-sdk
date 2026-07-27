// HTML-side art (HUD chrome, buy-bonus/autoplay/resume modals, splash, game-info pages) is
// plain <img>/CSS — the pixi AssetsLoader never touches it, so each image used to be fetched
// the first time its element rendered and popped in one by one. Every art path registers here
// (via ap() or registerArtDeep()) and warmArt() — called while the loading screen is up —
// fetches them all into the browser cache.
const IMG_RE = /\.(webp|png|jpe?g|svg)(\?|$)/i;
const queued = new Set<string>();
const backlog: string[] = [];
let warmed = false;
let inflight = 0;
// Drain the warm queue a few at a time, never all at once: ~90 simultaneous fetches saturate
// every socket on a slow connection, and any <img> the user opens meanwhile dedupes into its
// queued low-priority fetch and starves with it. The loading screen now gates on whenArtWarm(),
// so the queue is empty before anything is interactive — the cap only matters for late
// (locale-driven) registrations trickling in behind a live game.
const MAX_INFLIGHT = 6;
const RETRIES = 2;
let waiters: (() => void)[] = [];

const pump = () => {
	while (inflight < MAX_INFLIGHT && backlog.length) {
		const url = backlog.shift()!;
		const attempt = (triesLeft: number) => {
			const img = new Image();
			// Stay behind the pixi atlas downloads in the request queue.
			img.setAttribute('fetchpriority', 'low');
			img.decoding = 'async';
			img.onload = () => {
				inflight--;
				pump();
			};
			img.onerror = () => {
				if (triesLeft > 0) {
					attempt(triesLeft - 1);
				} else {
					console.error(`[preloadArt] failed after retries: ${url}`);
					inflight--;
					pump();
				}
			};
			img.src = url;
		};
		inflight++;
		attempt(RETRIES);
	}
	if (inflight === 0 && backlog.length === 0 && waiters.length) {
		waiters.forEach((resolve) => resolve());
		waiters = [];
	}
};

/** Resolves when everything registered so far has been fetched (or given up after retries). */
export const whenArtWarm = () =>
	inflight === 0 && backlog.length === 0
		? Promise.resolve()
		: new Promise<void>((resolve) => waiters.push(resolve));

export const registerArt = (...urls: string[]) => {
	for (const url of urls) {
		if (!IMG_RE.test(url) || queued.has(url)) continue;
		queued.add(url);
		backlog.push(url);
	}
	// Registered after warm-up (e.g. the locale-driven meta rebuild) → keep draining.
	if (warmed) pump();
};

/** Register every image-path string found anywhere inside a meta object. */
export const registerArtDeep = (value: unknown): void => {
	if (typeof value === 'string') registerArt(value);
	else if (Array.isArray(value)) value.forEach(registerArtDeep);
	else if (value && typeof value === 'object') Object.values(value).forEach(registerArtDeep);
};

/**
 * Converts absolute /path to ./path so it resolves relative to the page URL at any deploy
 * sub-path, and registers the image for loading-screen preload.
 */
export const ap = (p: string) => {
	const url = `./${p.startsWith('/') ? p.slice(1) : p}`;
	registerArt(url);
	return url;
};

/** Start fetching everything registered so far. Browser-only — call it from onMount. */
export const warmArt = () => {
	warmed = true;
	pump();
};
