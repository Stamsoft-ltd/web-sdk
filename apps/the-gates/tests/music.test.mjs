import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import {
	createMusicBus,
	MUSIC_FILES,
	MUSIC_LOOP_SECONDS,
	musicForScene,
} from '../src/game/music.ts';
function rig() {
	const sources = [],
		gains = [];
	let volume = 75,
		visible = true;
	const context = {
		state: 'running',
		currentTime: 3,
		createGain() {
			const gain = {
				gain: {
					value: 0,
					cancelScheduledValues() {},
					setValueAtTime(v) {
						this.value = v;
					},
					linearRampToValueAtTime(v) {
						this.value = v;
					},
				},
				connect() {},
				disconnect() {},
			};
			gains.push(gain);
			return gain;
		},
		createBufferSource() {
			const s = {
				loop: false,
				started: 0,
				stopped: 0,
				connect() {},
				disconnect() {},
				start() {
					this.started++;
				},
				stop() {
					this.stopped++;
				},
			};
			sources.push(s);
			return s;
		},
	};
	const music = createMusicBus(
		context,
		{},
		() => volume,
		() => visible,
	);
	return {
		music,
		context,
		sources,
		gains,
		volume(v) {
			volume = v;
		},
		visible(v) {
			visible = v;
		},
	};
}
test('approved music assets and exact musical loop lengths', () => {
	assert.deepEqual(MUSIC_LOOP_SECONDS, { base: 20, bonus: 16, super: 15, hidden: 19.2 });
	for (const file of Object.values(MUSIC_FILES))
		assert.ok(existsSync(new URL(`../static/assets/the-gates/audio/${file}.mp3`, import.meta.url)));
});
test('base/bonus crossfade; resize/repeated scene does not create duplicate loops', () => {
	const r = rig();
	r.music.load('base', { duration: 20 });
	r.music.load('bonus', { duration: 16 });
	assert.equal(r.sources.length, 0, 'landing is silent');
	r.music.scene('base');
	assert.equal(r.sources.length, 1);
	assert.equal(r.sources[0].loop, true);
	assert.equal(r.sources[0].loopEnd, 20);
	assert.equal(r.gains[0].gain.value, 0.75);
	r.music.scene('bonus');
	assert.equal(r.sources.length, 2);
	assert.equal(r.sources[1].loopEnd, 16);
	assert.equal(r.gains[0].gain.value, 0);
	assert.equal(r.gains[1].gain.value, 0.75);
	for (let i = 0; i < 20; i++) {
		r.music.scene('bonus');
		r.music.sync();
	}
	assert.equal(r.sources.length, 2);
	r.music.scene('base');
	assert.equal(r.sources.length, 2);
	assert.equal(r.gains[1].gain.value, 0);
	r.music.destroy();
	assert.ok(r.sources.every((s) => s.stopped === 1));
});
test('music volume and ducking operate independently, hidden-tab silence preserves phase', () => {
	const r = rig();
	r.music.load('base', { duration: 20 });
	r.music.scene('base');
	r.music.duck(true);
	assert.ok(Math.abs(r.gains[0].gain.value - 0.21) < 1e-9);
	r.music.duck(false);
	assert.equal(r.gains[0].gain.value, 0.75);
	r.volume(0);
	r.music.sync();
	assert.equal(r.gains[0].gain.value, 0);
	r.volume(75);
	r.music.sync();
	assert.equal(r.gains[0].gain.value, 0.75);
	assert.equal(r.sources.length, 1);
	r.visible(false);
	r.music.sync();
	assert.equal(r.gains[0].gain.value, 0);
	r.visible(true);
	r.music.sync();
	assert.equal(r.gains[0].gain.value, 0.75);
	r.music.destroy();
	r.music.load('bonus', { duration: 16 });
	r.music.scene('bonus');
	assert.equal(r.sources.length, 1);
});
test('late load starts only current scene after unlock; mute prevents initial source creation', () => {
	const r = rig();
	r.volume(0);
	r.music.scene('base');
	r.music.load('base', { duration: 20 });
	assert.equal(r.sources.length, 0);
	r.music.scene('bonus');
	r.volume(75);
	r.music.sync();
	assert.equal(r.sources.length, 0);
	r.music.load('bonus', { duration: 16 });
	assert.equal(r.sources.length, 1);
	assert.equal(r.sources[0].loopEnd, 16);
	r.music.destroy();
});

test('each bonus tier has its own loop; entry follows visible scene, not buy selection', () => {
	assert.equal(musicForScene(false, 'hidden'), null);
	assert.equal(musicForScene(true, null), 'base');
	assert.equal(musicForScene(true, 'normal'), 'bonus');
	assert.equal(musicForScene(true, 'super'), 'super');
	assert.equal(musicForScene(true, 'hidden'), 'hidden');
	assert.equal(new Set(Object.values(MUSIC_FILES)).size, 4);
});
test('all four scenes reuse bounded loops and crossfade old tiers to zero', () => {
	const r = rig();
	for (const [key, duration] of Object.entries(MUSIC_LOOP_SECONDS)) r.music.load(key, { duration });
	for (let i = 0; i < 8; i++) {
		for (const [index, key] of Object.keys(MUSIC_FILES).entries()) {
			r.music.scene(key);
			assert.equal(r.sources[index].loopEnd, MUSIC_LOOP_SECONDS[key]);
			assert.equal(r.gains[index].gain.value, 0.75);
			for (let j = 0; j < r.gains.length; j++)
				if (j !== index) assert.equal(r.gains[j].gain.value, 0);
		}
	}
	assert.equal(r.sources.length, 4);
	r.music.destroy();
	assert.ok(r.sources.every((s) => s.stopped === 1));
});
