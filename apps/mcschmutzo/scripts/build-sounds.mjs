#!/usr/bin/env node
// @ts-nocheck — a Node build script (the app's svelte-check would type-check it against browser types)
/**
 * Rebuilds the Howler audio sprite (static/assets/audio/sounds.{ogg,mp3,json}) from the McSchmutzo
 * source sounds in `audio-src/` (one file per sound, named `<soundName>.mp3`).
 *
 * Every name in `src/game/sound.ts` must have a source here (the build fails otherwise, so the
 * sprite and the code can't drift apart). Most delivered SFX are padded to 2 s with silence: TRIM_MS
 * cuts each to its audible length (+ a short tail) so `soundOnce` doesn't hold the channel for the
 * silence. bgm_main / bgm_freespin loop; the big-win tracks are one-shots (the win count-up is timed
 * to end on their final hit — see winLevelMap).
 *
 *   node scripts/build-sounds.mjs
 *
 * Requires ffmpeg + ffprobe on PATH (the OGG uses ffmpeg's native vorbis encoder: `-strict -2`).
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const appDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = join(appDir, 'audio-src');
const outDir = join(appDir, 'static/assets/audio');
const tmpDir = join(appDir, '.audio-tmp');

const SR = 44100;
const GAP_MS = 300; // silence between sprite segments
const LOOP = new Set(['bgm_main', 'bgm_freespin']);
// Audible length (ms) of the clips delivered with trailing silence (measured with silencedetect
// at −50 dB, plus a small tail). Unlisted clips are used in full.
const TRIM_MS = {
	sfx_btn_spin: 980,
	sfx_reel_stop: 1000,
	sfx_win_normal: 1720,
	sfx_lock_grow: 1800,
	sfx_scatter_land: 1240,
	sfx_wheel_spin: 9250,
	sfx_bonus_screen: 4120,
	sfx_btn_general: 220,
	bgm_bigwin_top: 12950, // (a stray click after the fade-out)
};
// Mix (Howler only attenuates): the music beds are mastered hot (≈ −16 dB mean) — sit them under
// the effects; reel stops fire five times a spin.
// Sprites cut from another source: the reel stop's thud alone (its clip leads in with ~455 ms of
// ticks), for stops that come too soon for the full clip (turbo, skipped spins).
const DERIVED = { sfx_reel_stop_hit: { from: 'sfx_reel_stop', startMs: 430 } };
const VOLUME = { bgm_main: 0.5, bgm_freespin: 0.5, bgm_bigwin: 0.85, bgm_bigwin_top: 0.85, sfx_reel_stop: 0.8, sfx_reel_stop_hit: 0.8 };

const ffmpeg = (args) => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args]);
const durationMs = (file) =>
	Math.round(
		parseFloat(
			execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file])
				.toString()
				.trim(),
		) * 1000,
	);

const names = [...new Set([...readFileSync(join(appDir, 'src/game/sound.ts'), 'utf8').matchAll(/'([a-z][a-z0-9_]+)'/g)].map((m) => m[1]))].filter(
	(n) => n !== 'utils' && n.includes('_'),
);
const srcOf = (n) => join(srcDir, `${DERIVED[n]?.from ?? n}.mp3`);
const missing = names.filter((n) => !existsSync(srcOf(n)));
if (missing.length) throw new Error(`no source in audio-src/ for: ${missing.join(', ')}`);

rmSync(tmpDir, { recursive: true, force: true });
mkdirSync(tmpDir, { recursive: true });
const silence = join(tmpDir, '_gap.wav');
ffmpeg(['-f', 'lavfi', '-i', `anullsrc=r=${SR}:cl=stereo`, '-t', String(GAP_MS / 1000), silence]);

const parts = [silence];
const sprite = {};
const config = {};
let offset = GAP_MS;
for (const name of names) {
	const wav = join(tmpDir, `${name}.wav`);
	const start = DERIVED[name]?.startMs ?? 0;
	const trim = TRIM_MS[DERIVED[name]?.from ?? name];
	const len = trim ? trim - start : undefined;
	// a 30 ms fade-out where a clip is cut, so the trim never clicks
	const af = len ? ['-af', `afade=t=out:st=${(len - 30) / 1000}:d=0.03`, '-t', String(len / 1000)] : [];
	ffmpeg(['-ss', String(start / 1000), '-i', srcOf(name), ...af, '-ar', String(SR), '-ac', '2', wav]);
	const dur = durationMs(wav);
	// loops stop a hair early so they never run into the following gap
	sprite[name] = LOOP.has(name) ? [offset, dur - 20, true] : [offset, dur];
	config[name] = { volume: VOLUME[name] ?? 1 };
	parts.push(wav, silence);
	offset += dur + GAP_MS;
}

const list = join(tmpDir, 'list.txt');
writeFileSync(list, parts.map((p) => `file '${p}'`).join('\n'));
const combined = join(tmpDir, 'combined.wav');
ffmpeg(['-f', 'concat', '-safe', '0', '-i', list, '-ar', String(SR), '-ac', '2', combined]);
mkdirSync(outDir, { recursive: true });
ffmpeg(['-i', combined, '-b:a', '160k', join(outDir, 'sounds.mp3')]);
ffmpeg(['-i', combined, '-c:a', 'vorbis', '-strict', '-2', '-b:a', '160k', join(outDir, 'sounds.ogg')]);
writeFileSync(
	join(outDir, 'sounds.json'),
	JSON.stringify({ sprite, src: ['./assets/audio/sounds.ogg', './assets/audio/sounds.mp3'], config }),
);
rmSync(tmpDir, { recursive: true, force: true });
console.log(`sounds sprite rebuilt: ${names.length} sounds, ${(offset / 1000).toFixed(1)} s`);
