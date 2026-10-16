import test from 'node:test';
import assert from 'node:assert/strict';
import { reelAudioContacts, createReelAudioTracker } from '../src/game/reelAudio.ts';
import { cellMotion } from '../src/game/motion.ts';
const wave = { speed: 'normal', kind: 'spin', cut: null, tail: 130 };
const full = Array.from({ length: 6 }, () => Array(5).fill(500));
test('six contacts, not thirty, follow the actual staggered final tile contact', () => {
	const contacts = reelAudioContacts(wave, full, []);
	assert.equal(contacts.length, 6);
	for (const { reel, at } of contacts) {
		assert.equal(
			at,
			Math.max(
				...full[reel].map((offset, row) => {
					const m = cellMotion(wave, reel, row, offset);
					return m.delay + m.duration;
				}),
			),
		);
		if (reel) assert.ok(at > contacts[reel - 1].at);
	}
});
test('only affected non-sticky reels land on cascades; exits/removals are silent', () => {
	const offsets = [
		[0, 100, 0, 0, 0],
		[0, 0, 0, 0, 0],
		[0, 0, 200, 0, 0],
	];
	assert.deepEqual(
		reelAudioContacts({ ...wave, kind: 'tumble' }, offsets, ['2:2']).map((c) => c.reel),
		[0],
	);
	assert.deepEqual(reelAudioContacts({ ...wave, kind: 'exit' }, full, []), []);
	assert.deepEqual(reelAudioContacts({ ...wave, kind: 'remove' }, full, []), []);
});
test('one-shot contacts survive resize, speed change and skip without replay; new wave resets', () => {
	const track = createReelAudioTracker(),
		at = reelAudioContacts(wave, full, [])[0].at;
	assert.deepEqual(track('round:reveal', wave, full, [], at - 1), []);
	assert.deepEqual(track('round:reveal', wave, full, [], at), [0]);
	assert.deepEqual(track('round:reveal', wave, full, [], at), []);
	assert.ok(
		!track('round:reveal', { ...wave, cut: at - 10, speed: 'turbo' }, full, [], at).includes(0),
	);
	assert.deepEqual(track('round:next', wave, full, [], at), [0]);
});
test('reduced motion lands once immediately; stale background contacts never burst', () => {
	const track = createReelAudioTracker();
	assert.deepEqual(track('reduce', wave, full, [], 0, true), [0, 1, 2, 3, 4, 5]);
	assert.deepEqual(track('reduce', wave, full, [], 50, true), []);
	assert.deepEqual(track('late', wave, full, [], 10000), []);
	assert.deepEqual(track('late', wave, full, [], 10001), []);
});
