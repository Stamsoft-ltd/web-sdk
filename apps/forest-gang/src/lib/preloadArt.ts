// HTML-side art (HUD chrome, buy-bonus/autoplay/resume modals, splash, game-info pages) is
// plain <img>/CSS — the pixi AssetsLoader never touches it, so each image used to be fetched
// the first time its element rendered and popped in one by one. Every art path registers here
// (via ap() or registerArtDeep()) and warmArt() — called while the loading screen is up —
// fetches them all into the browser cache.
const IMG_RE = /\.(webp|png|jpe?g|svg)(\?|$)/i;
const queued = new Set<string>();
let warmed = false;

const fetchOne = (src: string) => {
	const img = new Image();
	// Stay behind the pixi atlas downloads in the request queue.
	img.setAttribute('fetchpriority', 'low');
	img.decoding = 'async';
	img.src = src;
};

export const registerArt = (...urls: string[]) => {
	for (const url of urls) {
		if (!IMG_RE.test(url) || queued.has(url)) continue;
		queued.add(url);
		// Registered after warm-up (e.g. the locale-driven meta rebuild) → fetch right away.
		if (warmed) fetchOne(url);
	}
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

/** Fetch everything registered so far. Browser-only — call it from onMount. */
export const warmArt = () => {
	warmed = true;
	queued.forEach(fetchOne);
};
