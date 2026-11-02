// The premium blobs' cells (Figma 11300:28009 "SYmbols"): a rim in the blob's colour with an
// inset glow of it. Shared by the Pixi board (BoardView) and the DOM board's cells (App).
// Each blob's body colour: split-tile tints, and the cluster win pill and its confetti.
export const BLOB_TINT: Record<string, string> = {
	WATERMELON: '#5ee357',
	CHERRIES: '#f62d30',
	GRAPES: '#c457f5',
	STRAWBERRY: '#f96db2',
	BLUEBERRY: '#2ca6f8',
	ORANGE: '#fb9e24',
	LEMON: '#faca36',
	KIWI: '#24d8cc',
	PLUM: '#a9a6e6',
	APPLE: '#f2d58c',
};
/** c mixed toward white (k > 0) or black (k < 0), as #rrggbb. */
export function shade(c: string, k: number) {
	const n = parseInt(c.slice(1), 16);
	const to = k > 0 ? 255 : 0;
	const ch = (v: number) => Math.round(v + (to - v) * Math.abs(k)).toString(16).padStart(2, '0');
	return `#${ch(n >> 16)}${ch((n >> 8) & 255)}${ch(n & 255)}`;
}
export const PREMIUM_RIM: Record<string, string> = {
	WATERMELON: '#6cef5b',
	CHERRIES: '#f9272b',
	GRAPES: '#d06bfc',
	STRAWBERRY: '#fe7abb',
};
