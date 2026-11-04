// The resolution of a Pixi canvas (BoardView, MamaView, LogoView): device px per CSS px at its
// on-screen scale, capped at 3. A pinch zoom (visualViewport.scale) draws it bigger on screen,
// so it renders to match, up to 5, or it stretched soft (2026-11-03). But only within a budget of
// canvas pixels: each one is antialiased GPU memory (~20 bytes with MSAA), and on a 5K window the
// board alone took ~400MB at 5x; Chrome then ran short of tile memory and showed the zoomed DOM
// (HUD text, menu, splash copy) as stretched low-res tiles. Zooming never drops below the
// unzoomed resolution; it only grows while the canvas stays under ZOOM_BUDGET.
const ZOOM_BUDGET = 3e6;

export function canvasRes(dprScale: number, cssW: number, cssH: number) {
	const base = Math.min(3, Math.max(1, dprScale));
	const zoom = window.visualViewport?.scale ?? 1;
	if (zoom <= 1.05) return base;
	const fits = Math.sqrt(ZOOM_BUDGET / Math.max(1, cssW * cssH));
	return Math.max(base, Math.min(5, dprScale * zoom, fits));
}
