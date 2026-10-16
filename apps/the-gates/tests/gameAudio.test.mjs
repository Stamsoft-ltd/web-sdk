import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import {
	AUDIO_FILES,
	installGameAudio,
	playGameSound,
	stopGameSounds,
	syncGameAudio,
} from '../src/game/audio.ts';
test('all 26 approved cues have deployable audio files', () => {
	assert.equal(Object.keys(AUDIO_FILES).length, 26);
	for (const file of Object.values(AUDIO_FILES))
		assert.ok(
			existsSync(new URL(`../static/assets/the-gates/audio/${file}.mp3`, import.meta.url)),
			file,
		);
});
test('gesture unlock, decoding, mute, overlap cap, hidden tab and cleanup', async () => {
	const old = {
		document: globalThis.document,
		AudioContext: globalThis.AudioContext,
		fetch: globalThis.fetch,
	};
	const handlers = new Map(),
		sources = [],
		contexts = [];
	let volume = 75;
	const document = {
		visibilityState: 'visible',
		addEventListener(n, f) {
			handlers.set(n, f);
		},
		removeEventListener(n) {
			handlers.delete(n);
		},
	};
	const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {} });
	class Context {
		state = 'suspended';
		currentTime = 0;
		destination = {};
		closed = false;
		constructor() {
			contexts.push(this);
		}
		createGain() {
			return { gain: param(), connect() {}, disconnect() {} };
		}
		createDynamicsCompressor() {
			return {
				threshold: param(),
				knee: param(),
				ratio: param(),
				attack: param(),
				release: param(),
				connect() {},
			};
		}
		createBufferSource() {
			const s = {
				buffer: null,
				stopped: false,
				args: null,
				connect() {},
				disconnect() {},
				start(...args) {
					this.args = args;
				},
				stop() {
					this.stopped = true;
				},
			};
			sources.push(s);
			return s;
		}
		async decodeAudioData() {
			return { duration: 0.7 };
		}
		async resume() {
			this.state = 'running';
		}
		async suspend() {
			this.state = 'suspended';
		}
		async close() {
			this.closed = true;
		}
	}
	globalThis.document = document;
	globalThis.AudioContext = Context;
	globalThis.fetch = async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(1) });
	let destroy;
	try {
		destroy = installGameAudio(() => volume);
		playGameSound('spin');
		assert.equal(contexts.length, 0);
		handlers.get('pointerdown')({ isTrusted: false });
		assert.equal(contexts.length, 0);
		handlers.get('pointerdown')({ isTrusted: true });
		await new Promise((r) => setImmediate(r));
		playGameSound('reel-1', { group: 'reel', speed: 'turbo' });
		assert.equal(sources.at(-1).args[2], 0.16);
		for (let i = 0; i < 20; i++) playGameSound('cascade');
		assert.ok(sources.filter((s) => !s.stopped).length <= 10);
		volume = 0;
		syncGameAudio();
		assert.ok(sources.every((s) => s.stopped));
		const count = sources.length;
		playGameSound('spin');
		assert.equal(sources.length, count);
		volume = 75;
		syncGameAudio();
		assert.equal(sources.length, count, 'no queued sound on unmute');
		playGameSound('spin');
		document.visibilityState = 'hidden';
		handlers.get('visibilitychange')();
		assert.ok(sources.every((s) => s.stopped));
		assert.equal(contexts[0].state, 'suspended');
		stopGameSounds();
		destroy();
		assert.equal(handlers.size, 0);
		assert.ok(contexts[0].closed);
	} finally {
		destroy?.();
		Object.assign(globalThis, old);
	}
});
