#!/usr/bin/env node
/**
 * Rebuilds the Howler audio sprite (static/assets/audio/sounds.{mp3,ogg,json}) from individual
 * source files in `audio-src/`.
 *
 * Workflow: drop a file named `<soundName>.<ext>` (e.g. `sfx_btn_spin.wav`) into `audio-src/`,
 * then run `node scripts/build-sounds.mjs`. Every sound name referenced in `src/game/sound.ts`
 * is included in the sprite; names without a source file map to a short silent segment (so the
 * app stays silent for them, no console warnings). `bgm_*` names are marked looping.
 *
 * Requires ffmpeg + ffprobe on PATH.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const appDir = join(__dirname, '..');
const srcDir = join(appDir, 'audio-src');
const outDir = join(appDir, 'static/assets/audio');
const soundTs = join(appDir, 'src/game/sound.ts');
const tmpDir = join(appDir, '.audio-tmp');

const SR = 44100; // sample rate
const CH = 2; // channels
const GAP_MS = 300; // silence padding between segments
const ffmpeg = (args) => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args]);
const durationMs = (file) =>
	Math.round(
		parseFloat(
			execFileSync('ffprobe', [
				'-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file,
			]).toString().trim(),
		) * 1000,
	);

// 1. Every sound name declared in sound.ts (quoted snake_case literals in the type unions).
const tsContent = readFileSync(soundTs, 'utf8');
const names = [...new Set([...tsContent.matchAll(/'([a-z][a-z0-9_]+)'/g)].map((m) => m[1]))];
// bgm_* tracks loop, plus these SFX that are played through the looping player (soundLoop) and must
// have the sprite loop flag set — Howler only loops a sprite whose [offset,duration,loop] flag is true.
const LOOP_SFX = new Set(['sfx_scatter_anticipation_loop', 'sfx_win_coins_loop', 'sfx_deer_reveal']);
const isLoop = (n) => n.startsWith('bgm_') || LOOP_SFX.has(n);

// 2. Locate an optional source file per name.
const EXTS = ['wav', 'flac', 'aiff', 'mp3', 'ogg', 'm4a', 'aac'];
const findSrc = (name) => {
	for (const e of EXTS) {
		const p = join(srcDir, `${name}.${e}`);
		if (existsSync(p)) return p;
	}
	return null;
};

rmSync(tmpDir, { recursive: true, force: true });
mkdirSync(tmpDir, { recursive: true });
mkdirSync(outDir, { recursive: true });

// A single reusable silence clip used for gaps and for all un-provided names.
const silenceWav = join(tmpDir, '_silence.wav');
ffmpeg(['-f', 'lavfi', '-i', `anullsrc=r=${SR}:cl=stereo`, '-t', String(GAP_MS / 1000), silenceWav]);

const parts = [silenceWav]; // leading silence — index 0..GAP_MS is the "silent" region
const sprite = {};
const config = {};
let offset = GAP_MS;
let provided = 0;

for (const name of names) {
	config[name] = { volume: 1 };
	const src = findSrc(name);
	if (!src) {
		// Map to the leading silence so the name resolves but plays nothing.
		sprite[name] = [0, Math.max(10, GAP_MS - 40), isLoop(name)];
		continue;
	}
	const wav = join(tmpDir, `${name}.wav`);
	ffmpeg(['-i', src, '-ar', String(SR), '-ac', String(CH), wav]);
	const dur = durationMs(wav);
	sprite[name] = [offset, dur, isLoop(name)];
	parts.push(wav, silenceWav);
	offset += dur + GAP_MS;
	provided += 1;
}

// 3. Concatenate all parts into one track, then encode mp3 + ogg.
const listFile = join(tmpDir, 'list.txt');
writeFileSync(listFile, parts.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join('\n'));
const combined = join(tmpDir, 'combined.wav');
ffmpeg(['-f', 'concat', '-safe', '0', '-i', listFile, '-ar', String(SR), '-ac', String(CH), combined]);
ffmpeg(['-i', combined, '-b:a', '160k', join(outDir, 'sounds.mp3')]);
ffmpeg(['-i', combined, '-c:a', 'libvorbis', '-q:a', '5', join(outDir, 'sounds.ogg')]);

// 4. Write the Howler sprite manifest.
const json = {
	sprite,
	src: ['./assets/audio/sounds.ogg', './assets/audio/sounds.mp3'],
	config,
};
writeFileSync(join(outDir, 'sounds.json'), JSON.stringify(json));

rmSync(tmpDir, { recursive: true, force: true });

const missing = names.filter((n) => !findSrc(n));
console.log(`sounds sprite rebuilt: ${provided}/${names.length} provided, ${missing.length} silent.`);
if (missing.length) console.log('silent:', missing.join(', '));
