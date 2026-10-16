import { cellMotion, type Wave } from './motion.ts';
/** One contact per moving reel, at its final incoming tile's contact, using the renderer's wave clock. */
export function reelAudioContacts(
	wave: Wave,
	offsets: number[][],
	sticky: string[],
	reduced = false,
) {
	if (!['spin', 'tumble'].includes(wave.kind)) return [];
	return offsets.flatMap((column, reel) => {
		let at = -1;
		column.forEach((offset, row) => {
			if (!offset || sticky.includes(`${reel}:${row}`)) return;
			const motion = cellMotion(wave, reel, row, offset);
			at = Math.max(at, reduced ? 0 : motion.delay + motion.duration);
		});
		return at < 0 ? [] : [{ reel, at }];
	});
}
export function createReelAudioTracker() {
	let key = '';
	const played = new Set<number>();
	return (
		waveKey: string,
		wave: Wave,
		offsets: number[][],
		sticky: string[],
		elapsed: number,
		reduced = false,
	) => {
		if (key !== waveKey) {
			key = waveKey;
			played.clear();
		}
		return reelAudioContacts(wave, offsets, sticky, reduced)
			.filter((c) => {
				if (played.has(c.reel) || elapsed < c.at) return false;
				played.add(c.reel);
				// Don't burst stale contacts after a stalled/background frame.
				return elapsed - c.at < 120;
			})
			.map((c) => c.reel);
	};
}
