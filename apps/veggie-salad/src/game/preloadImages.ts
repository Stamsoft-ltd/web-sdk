// Fetches AND decodes a list of images so the first time the game shows one it is already a
// bitmap. The pixi manifest warms the HTTP cache for the sprites it owns, but the board, the
// backgrounds and every other HTML/CSS image would otherwise fetch and decode on first paint —
// on a phone that is a bare board for the length of a network round trip on the first spin.
// Concurrency is capped so a slow connection streams the list instead of opening 170 sockets;
// a file that fails still counts, so a missing image can never hold the loader.
const PARALLEL = 8;

// Keeps the decoded bitmaps referenced: Safari drops an unreferenced image's decode under memory
// pressure, and re-decodes it on the next paint.
const retained: HTMLImageElement[] = [];

const loadOne = (url: string) =>
	new Promise<void>((resolve) => {
		const image = new Image();
		image.decoding = 'async';
		const done = () => {
			retained.push(image);
			resolve();
		};
		image.onload = () => image.decode().then(done, done);
		image.onerror = () => {
			console.warn(`[preload] ${url} failed`);
			resolve();
		};
		image.src = url;
	});

export const preloadImages = async (
	urls: readonly string[],
	onProgress: (fraction: number) => void,
) => {
	let next = 0;
	let finished = 0;
	const total = urls.length;
	const worker = async () => {
		while (next < total) {
			const url = urls[next];
			next += 1;
			await loadOne(url);
			finished += 1;
			onProgress(finished / total);
		}
	};
	await Promise.all(Array.from({ length: Math.min(PARALLEL, total) }, worker));
	onProgress(1);
};
