import files from 'virtual:preload-list';

// Fetches and decodes every image and font the game uses, so nothing pops in mid-round.
// Progress is by bytes. A file that fails still counts as done: a missing picture must
// never trap the player on the loading screen.
const LIMIT = 8;
const FIRST = ['loader/', 'splash/', 'fonts/', 'symbols/'];

function loadOne(path: string): Promise<void> {
	const url = `./${path}`;
	if (/\.(woff2|ttf)$/.test(path)) return fetch(url).then((r) => void r.arrayBuffer(), () => {});
	return new Promise<void>((done) => {
		const img = new Image();
		img.onload = () => img.decode().then(done, done);
		img.onerror = () => done();
		img.src = url;
	});
}

export async function preloadAll(onProgress: (k: number) => void) {
	// The splash, fonts and symbols first: they are what the player sees next.
	const rank = (p: string) => {
		const i = FIRST.findIndex((d) => p.startsWith(d));
		return i < 0 ? FIRST.length : i;
	};
	const queue = [...files].sort((a, b) => rank(a.path) - rank(b.path));
	const total = queue.reduce((t, f) => t + f.size, 0) || 1;
	let done = 0;
	onProgress(0);
	const worker = async () => {
		for (let f = queue.shift(); f; f = queue.shift()) {
			await loadOne(f.path);
			done += f.size;
			onProgress(done / total);
		}
	};
	await Promise.all(Array.from({ length: LIMIT }, worker));
	await document.fonts?.ready;
}
