#!/usr/bin/env node
/**
 * Rebuilds the Howler audio sprite (static/assets/audio/sounds.{mp3,ogg,json}) from individual
 * source files in `audio-src/`.
 *
 * Workflow: drop a file named `<soundName>.<ext>` (e.g. `sfx_reel_stop.wav`) into `audio-src/`,
 * then run `node scripts/build-sounds.mjs`. Every sound name referenced in `src/game/sound.ts`
 * is included in the sprite; names without a source file map to a short silent segment (so the
 * app stays silent for them, no console warnings). Names in LOOPING below are marked looping.
 *
 * Requires ffmpeg + ffprobe on PATH.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const appDir = join(__dirname, '..');
const srcDir = join(appDir, 'audio-src');
const outDir = join(appDir, 'static/assets/audio');
const soundTs = join(appDir, 'src/game/sound.ts');
const tmpDir = join(appDir, '.audio-tmp');

// Resolve ffmpeg/ffprobe: prefer bundled npm packages, fall back to system PATH.
const _require = createRequire(import.meta.url);
let FFMPEG_BIN = 'ffmpeg';
let FFPROBE_BIN = 'ffprobe';
try {
	FFMPEG_BIN = _require('ffmpeg-static');
} catch { /* not installed — use system ffmpeg */ }
try {
	FFPROBE_BIN = _require('ffprobe-static').path;
} catch { /* not installed — use system ffprobe */ }

const SR = 44100; // sample rate
const CH = 2; // channels
const GAP_MS = 300; // silence padding between segments
const ffmpeg = (args) => execFileSync(FFMPEG_BIN, ['-hide_banner', '-loglevel', 'error', '-y', ...args]);
const durationMs = (file) =>
	Math.round(
		parseFloat(
			execFileSync(FFPROBE_BIN, [
				'-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file,
			]).toString().trim(),
		) * 1000,
	);

// 1. Every sound name declared in sound.ts (quoted snake_case literals in the type unions).
const tsContent = readFileSync(soundTs, 'utf8');
const names = [...new Set([...tsContent.matchAll(/'([a-z][a-z0-9_]+)'/g)].map((m) => m[1]))];
// Sprite entries that must carry Howler's loop flag: the music layers, plus every SFX played
// through the looping player (soundLoop / sound.players.loop). Howler only loops a sprite whose
// [offset, duration, loop] flag is true, so a name missing here plays once and stops dead.
// This list is EXPLICIT rather than prefix-matched: the old `bgm_*` test matched nothing at all
// under either naming scheme, so a rebuild would have silently unlooped all nine of these.
const LOOPING = new Set([
	'music_base',
	'music_bonus',
	'music_super',
	'music_scatter_tease',
	'music_bigwin',
	'sfx_magnet_roulette_loop',
	'sfx_scatter_tease_loop',
	'sfx_megachain_idle_loop',
	'sfx_bigwin_sweet',
	'sfx_bigwin_wild',
	'sfx_bigwin_legendary',
	'sfx_bigwin_mythic',
	'sfx_bigwin_epic',
	'sfx_win_countup_loop',
]);
const isLoop = (n) => LOOPING.has(n);

// 2. Locate an optional source file per name.
const EXTS = ['wav', 'flac', 'aiff', 'mp3', 'ogg', 'm4a', 'aac'];
const findSrc = (name) => {
	for (const e of EXTS) {
		const p = join(srcDir, `${name}.${e}`);
		if (existsSync(p)) return p;
	}
	return null;
};

// Per-cue mix volumes are hand-tuned and live ONLY in the generated manifest — nothing in the
// source wavs encodes them. Carry them across a rebuild; this used to reset all 62 to 1.0, which
// would have made every UI blip and win sting play at roughly 2.5–4x its intended level.
const prevJson = join(outDir, 'sounds.json');
const prevConfig = existsSync(prevJson) ? (JSON.parse(readFileSync(prevJson, 'utf8')).config ?? {}) : {};

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
	config[name] = prevConfig[name] ?? { volume: 1 };
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
// Bitrates chosen to match the ORIGINALLY shipped sprite (~131k mp3 / ~97k vorbis) rather than
// the script's old 160k/q5, which inflated the download by ~1MB on the first real rebuild. The
// source wavs were themselves decoded from that sprite, so extra bitrate re-encodes existing
// artefacts instead of recovering detail.
ffmpeg(['-i', combined, '-b:a', '128k', join(outDir, 'sounds.mp3')]);
ffmpeg(['-i', combined, '-c:a', 'libvorbis', '-q:a', '3', join(outDir, 'sounds.ogg')]);

// 4. Write the Howler sprite manifest.
// The src URLs carry a CONTENT HASH of the audio they point at. Without it the manifest could be
// cache-busted (via assets.ts) while the browser kept a stale sounds.ogg — so fresh offsets got
// applied to old audio and cues played the wrong region, or silence. Every rebuild shifts every
// offset, so that failure is the default, not an edge case.
const audioHash = createHash('sha1')
	.update(readFileSync(join(outDir, 'sounds.ogg')))
	.update(readFileSync(join(outDir, 'sounds.mp3')))
	.digest('hex')
	.slice(0, 8);
const json = {
	sprite,
	src: [`./assets/audio/sounds.ogg?v=${audioHash}`, `./assets/audio/sounds.mp3?v=${audioHash}`],
	config,
};
writeFileSync(join(outDir, 'sounds.json'), JSON.stringify(json));

rmSync(tmpDir, { recursive: true, force: true });

const missing = names.filter((n) => !findSrc(n));
console.log(`sounds sprite rebuilt: ${provided}/${names.length} provided, ${missing.length} silent.`);
if (missing.length) console.log('silent:', missing.join(', '));
