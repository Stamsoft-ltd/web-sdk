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
// Drain the warm queue a trickle at a time, never all at once: ~90 simultaneous fetches
// saturate every socket on a slow connection for minutes after the loading screen, and any
// <img> the user opens meanwhile (info/paytable pages) dedupes into its queued low-priority
// fetch and starves with it. With a trickle, an opened modal's images are fresh high-priority
// requests that jump straight past the backlog.
const MAX_INFLIGHT = 2;

const pump = () => {
	while (inflight < MAX_INFLIGHT && backlog.length) {
		const img = new Image();
		// Stay behind the pixi atlas downloads in the request queue.
		img.setAttribute('fetchpriority', 'low');
		img.decoding = 'async';
		inflight++;
		img.onload = img.onerror = () => {
			inflight--;
			pump();
		};
		img.src = backlog.shift()!;
	}
};

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
