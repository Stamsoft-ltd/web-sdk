// Mama blob is off for the 2026-11 submission (user: "we will try to submit without her"). Flip
// this back to bring her everywhere she was: beside the board (desktop, phone landscape, tall
// portrait with its lifted logo), her spirits to splitting tiles, and the Mystery egg screen.
export const SHOW_MAMA = false;

// Phones and tablets (and any browser reporting ≤4GB): Safari kills a tab that outgrows its
// memory limit, and older iPhones crashed on load (Stake review 2026-11-06, iOS 18.6.2). Measured
// then: ~290MB of decoded preload images plus ~206MB of scene textures (all three bonus worlds
// uploaded at boot), each texture also kept as an ImageBitmap. Here the preloader only fetches
// (no decode) past the first screen, and the scene loads a bonus world's art when that bonus
// starts and frees it after. Desktop keeps the eager path.
export const LOW_MEMORY =
	typeof matchMedia === 'function' &&
	(matchMedia('(pointer: coarse)').matches || ((navigator as { deviceMemory?: number }).deviceMemory ?? 8) <= 4);
