// @vitest-environment node
//
// Plan 14 section 3 — atlas validation. Pure filesystem work: no renderer, no network, no clock,
// and (per the docblock above) no jsdom — assets.ts guards its only `window` read.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

import assets from '../src/game/assets';
import {
	SHEET_META_MISMATCH,
	STATIC_SOURCE_FILES,
	UNREFERENCED_ASSET_KEYS,
} from './knownAssetDebt';

const APP = join(import.meta.dirname, '..');
const REPO = join(APP, '../..');
const STATIC = join(APP, 'static');
const SRC = join(APP, 'src');

// Decoded-memory ceiling for everything assets.ts loads, counting each image SOURCE once (shared
// spine/font pages are deduped, as the GPU does). Measured 344.095 MiB at the time of
// writing; the headroom is deliberately thin so a single new full-screen background (a 4K webp is
// ~33 MiB decoded) trips it rather than sliding in unnoticed.
const DECODED_BUDGET_MIB = 360;

// The GPU texture limit this game targets. Anything larger silently fails to upload on devices
// whose MAX_TEXTURE_SIZE is 4096 — which is most mid-range phones.
const MAX_TEXTURE_DIMENSION = 4096;

// ── image headers ────────────────────────────────────────────────────────────
// Dimensions come from the file header rather than a decoder: three formats, ~20 lines, no
// dependency. Returning null (rather than guessing) is what makes the "unreadable image" failure
// below possible — an image silently missing from the budget would defeat the point.
type Size = { w: number; h: number };

const imageSize = (buf: Buffer): Size | null => {
	if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47)
		return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };

	if (buf.length > 30 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
		const kind = buf.toString('ascii', 12, 16);
		// VP8X: extended (24-bit canvas size, minus one). VP8 : lossy (14-bit). VP8L: lossless (14-bit).
		if (kind === 'VP8X') return { w: buf.readUIntLE(24, 3) + 1, h: buf.readUIntLE(27, 3) + 1 };
		if (kind === 'VP8 ') return { w: buf.readUInt16LE(26) & 0x3fff, h: buf.readUInt16LE(28) & 0x3fff };
		if (kind === 'VP8L') {
			const bits = buf.readUInt32LE(21);
			return { w: (bits & 0x3fff) + 1, h: ((bits >> 14) & 0x3fff) + 1 };
		}
	}

	if (buf[0] === 0xff && buf[1] === 0xd8) {
		for (let o = 2; o + 9 < buf.length; ) {
			if (buf[o] !== 0xff) {
				o++;
				continue;
			}
			const marker = buf[o + 1];
			// SOF0..SOF15 carry the frame header; C4/C8/CC are Huffman/JPG-ext/arithmetic tables.
			if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc)
				return { h: buf.readUInt16BE(o + 5), w: buf.readUInt16BE(o + 7) };
			o += 2 + buf.readUInt16BE(o + 2);
		}
	}
	return null;
};

// Headers only, read once per file: the suite asks four different questions about the same images.
const sizeCache = new Map<string, Size | null>();
const sizeOf = (file: string): Size | null => {
	if (!sizeCache.has(file)) sizeCache.set(file, imageSize(readFileSync(file)));
	return sizeCache.get(file)!;
};

const walk = (dir: string): string[] =>
	readdirSync(dir).flatMap((entry) => {
		const p = join(dir, entry);
		return statSync(p).isDirectory() ? walk(p) : [p];
	});

const IMAGE_RE = /\.(png|webp|jpe?g)$/i;
const staticFiles = walk(STATIC);

/** `./assets/x/y.webp?v=1` (as written in assets.ts) → absolute path under static/. */
const resolveSrc = (src: string) => join(STATIC, src.replace(/^\.\//, '').split('?')[0]);

// ── assets.ts, flattened ─────────────────────────────────────────────────────
// assets.ts is IMPORTED, not regexed, so the test can never disagree with what the game loads.
type AssetEntry = { type?: string; src?: string | { atlas?: string; skeleton?: string } };
const assetEntries = Object.entries(assets as Record<string, AssetEntry>).map(([key, entry]) => ({
	key,
	type: entry.type,
	srcs: (typeof entry.src === 'string'
		? [entry.src]
		: [entry.src?.atlas, entry.src?.skeleton]
	).filter((s): s is string => typeof s === 'string'),
}));

/** Every image file a loaded asset pulls in: direct sprites, sheet pages, spine atlas pages, font pages. */
const imagesBehind = (src: string): string[] => {
	const p = resolveSrc(src);
	if (!existsSync(p)) return [];
	if (IMAGE_RE.test(p)) return [p];

	if (p.endsWith('.json')) {
		// THROWS rather than skipping. A sheet that stops parsing, or whose page image goes missing,
		// used to drop silently out of every downstream check (memory, dimensions, frame bounds) — a
		// corrupt atlas would have made the suite quieter, not louder.
		const sheet = JSON.parse(readFileSync(p, 'utf8')) as { meta?: { image?: string } };
		if (!sheet?.meta?.image) return []; // sounds.json and spine skeletons have no page image
		const img = join(dirname(p), sheet.meta.image.split('?')[0]);
		if (!existsSync(img)) throw new Error(`${relative(STATIC, p)} references a missing page image: ${sheet.meta.image}`);
		return [img];
	}
	if (p.endsWith('.atlas')) {
		return readFileSync(p, 'utf8')
			.split('\n')
			.map((line) => join(dirname(p), line.trim()))
			.filter((f) => IMAGE_RE.test(f) && existsSync(f));
	}
	if (p.endsWith('.xml')) {
		return [...readFileSync(p, 'utf8').matchAll(/file="([^"]+)"/g)]
			.map((match) => join(dirname(p), match[1]))
			.filter((f) => existsSync(f));
	}
	return [];
};

const loadedImages = [...new Set(assetEntries.flatMap((e) => e.srcs.flatMap(imagesBehind)))];

// Load-bearing keys the game cannot run without, one per asset TYPE, so the anti-vacuity check
// below proves the import worked without pinning a head-count that plan 03's deletions would break.
const REQUIRED_KEYS = ['sound', 'wildAnim', 'fsIntro', 'goldFont', 'baseBackground'];

describe('assets.ts (plan 14 §3)', () => {
	it('resolves a real asset set of every type', () => {
		// Without this, every assertion below passes vacuously if the import ever yields {}.
		const keys = new Set(assetEntries.map((e) => e.key));
		expect(REQUIRED_KEYS.filter((k) => !keys.has(k))).toEqual([]);
		expect(new Set(assetEntries.map((e) => e.type))).toEqual(
			new Set(['sprite', 'sprites', 'spriteSheet', 'spine', 'font', 'audio']),
		);
		expect(loadedImages.length).toBeGreaterThan(0);
	});

	it('every src path exists on disk', () => {
		const missing = assetEntries.flatMap((e) =>
			e.srcs.filter((s) => !existsSync(resolveSrc(s))).map((s) => `${e.key}: ${s}`),
		);
		expect(missing).toEqual([]);
	});

	it('every loaded image has a readable header', () => {
		const unreadable = loadedImages.filter((f) => sizeOf(f) === null);
		expect(unreadable.map((f) => relative(STATIC, f))).toEqual([]);
	});

	it(`no loaded texture exceeds ${MAX_TEXTURE_DIMENSION}px in either dimension`, () => {
		// Scoped to images assets.ts loads INTO PIXI. static/assets/components/navbar/bar.webp and
		// frames/hud_frame.webp are 4600x500 but are <img>/CSS backgrounds in HudHtml.svelte, where
		// the GPU limit does not apply.
		const oversize = loadedImages
			.map((f) => ({ f, size: sizeOf(f)! }))
			.filter(({ size }) => size.w > MAX_TEXTURE_DIMENSION || size.h > MAX_TEXTURE_DIMENSION)
			.map(({ f, size }) => `${relative(STATIC, f)} ${size.w}x${size.h}`);
		expect(oversize).toEqual([]);
	});

	it(`decoded memory stays under ${DECODED_BUDGET_MIB} MiB`, () => {
		const bytes = loadedImages.reduce((total, f) => {
			const size = sizeOf(f)!;
			return total + size.w * size.h * 4;
		}, 0);
		const mib = bytes / 1024 / 1024;
		// Reported on every run so a move is visible in the log even below the ceiling.
		console.log(`decoded texture memory: ${mib.toFixed(3)} MiB / ${DECODED_BUDGET_MIB} MiB`);
		expect(mib).toBeLessThan(DECODED_BUDGET_MIB);
	});
});

describe('sprite sheets (plan 14 §3)', () => {
	const sheets = staticFiles
		.filter((f) => f.endsWith('.json'))
		.map((f) => {
			try {
				return { f, data: JSON.parse(readFileSync(f, 'utf8')) };
			} catch {
				return null;
			}
		})
		.filter(
			(s): s is { f: string; data: { meta: { image: string; size: { w: number; h: number } }; frames: Record<string, { frame: { x: number; y: number; w: number; h: number } }> } } =>
				!!s?.data?.meta?.image && !!s.data.meta.size,
		);

	it('finds the sheets it claims to check', () => {
		expect(sheets.length).toBeGreaterThanOrEqual(30);
	});

	it('adds no new meta.size mismatch beyond the recorded baseline', () => {
		const mismatched: Record<string, string> = {};
		for (const { f, data } of sheets) {
			const img = join(dirname(f), data.meta.image.split('?')[0]);
			const size = sizeOf(img);
			if (!size) throw new Error(`unreadable sheet image ${img}`);
			if (size.w !== data.meta.size.w || size.h !== data.meta.size.h)
				mismatched[relative(STATIC, f)] =
					`declared ${data.meta.size.w}x${data.meta.size.h}, actual ${size.w}x${size.h}`;
		}
		const known = Object.fromEntries(
			Object.entries(SHEET_META_MISMATCH).map(([k, v]) => [
				k,
				`declared ${v.declared[0]}x${v.declared[1]}, actual ${v.actual[0]}x${v.actual[1]}`,
			]),
		);
		// Equality, not a subset check: a NEW mismatch fails, and a FIXED one fails too so the
		// baseline in knownAssetDebt.ts cannot rot.
		expect(mismatched).toEqual(known);
	});

	it('adds no new out-of-bounds frame rect beyond the recorded baseline', () => {
		// The assertion that makes editing meta.size the WRONG fix for the three known sheets: their
		// frames genuinely sample past the image edge, so only a re-pack clears both checks.
		const outOfBounds: string[] = [];
		for (const { f, data } of sheets) {
			const img = join(dirname(f), data.meta.image.split('?')[0]);
			const size = sizeOf(img)!;
			for (const [name, frame] of Object.entries(data.frames ?? {})) {
				const r = frame.frame;
				if (r.x + r.w > size.w || r.y + r.h > size.h)
					outOfBounds.push(`${relative(STATIC, f)}#${name}`);
			}
		}
		const knownSheets = new Set(Object.keys(SHEET_META_MISMATCH));
		expect(outOfBounds.filter((s) => !knownSheets.has(s.split('#')[0]))).toEqual([]);
		// ...and every known-bad sheet must still be bad, or its baseline entry is stale.
		for (const sheet of knownSheets)
			expect(outOfBounds.some((s) => s.startsWith(`${sheet}#`)), `${sheet} no longer has out-of-bounds frames — drop it from SHEET_META_MISMATCH`).toBe(true);
	});
});

describe('unreferenced asset keys (plan 14 §3)', () => {
	// What this buys, precisely — and the plan is explicit that it must not be oversold:
	//
	//  * it catches a key NO source file names (`coins`, `progressBar`, the landscape tiles);
	//  * it does NOT catch a key that is named but whose textures never reach a rendered branch. The
	//    five letter win sheets are mapped in Board.svelte and ExpandedSymbolOverlay.svelte, so they
	//    pass while being just as dead — a control-flow property needing the render-usage assertion
	//    section 3 describes and this plan defers;
	//  * it does NOT catch a key whose name collides with an unrelated identifier. `freeSpins` is
	//    the live example: `i18nDerived.freeSpins()` is a translation helper, nothing to do with the
	//    atlas, yet it keeps the key looking referenced. Narrowing further (excluding `.`-prefixed
	//    matches) would break real `loadedAssets?.someKey` reads, so this stays a known false
	//    negative rather than a false positive.
	//
	// Comments are stripped and path-ish matches (`icon-coins.png`, `/sprites/coins/`) are excluded,
	// because both used to keep genuinely dead keys alive.
	// Block, line and Svelte-template comments. `[^:]` before `//` keeps `https://` intact.
	const stripComments = (src: string) =>
		src
			.replace(/<!--[\s\S]*?-->/g, ' ')
			.replace(/\/\*[\s\S]*?\*\//g, ' ')
			.replace(/(^|[^:])\/\/[^\n]*/g, '$1');

	const sourceBlob = walk(SRC)
		.filter((f) => /\.(svelte|ts)$/.test(f) && !f.endsWith(join('game', 'assets.ts')))
		.map((f) => stripComments(readFileSync(f, 'utf8')))
		.join('\n');

	const unreferenced = assetEntries
		.filter((e) => !new RegExp(`(?<![\\w$\\-/])${e.key}(?![\\w$\\-])`).test(sourceBlob))
		.map((e) => e.key)
		.sort();

	it('scans a source tree that actually has content', () => {
		expect(sourceBlob.length).toBeGreaterThan(100_000);
		// The stripper must not eat the code: a key that IS referenced has to survive it.
		expect(new RegExp(`(?<![\\w$\\-/])pCoins(?![\\w$\\-])`).test(sourceBlob)).toBe(true);
	});

	it('adds no new unreferenced key beyond the recorded baseline', () => {
		// Equality in both directions: adding a key nothing references fails; deleting one of the
		// recorded dead keys (what plan 03 does) also fails until the baseline is updated.
		expect(unreferenced).toEqual([...UNREFERENCED_ASSET_KEYS].sort());
	});
});

describe('static trees (plan 14 §3, repo-wide)', () => {
	// Deliberately not scoped to forest-gang: these generator scripts are shipped verbatim by four
	// apps' static/ trees.
	const SOURCE_RE = /\.(py|sh|psd|ai|blend)$/i;

	it('no non-asset source file appears outside the recorded baseline', () => {
		const found = readdirSync(join(REPO, 'apps'))
			.map((app) => join(REPO, 'apps', app, 'static'))
			.filter((dir) => existsSync(dir))
			.flatMap(walk)
			.filter((f) => SOURCE_RE.test(f))
			.map((f) => relative(REPO, f))
			.sort();
		expect(found).toEqual([...STATIC_SOURCE_FILES].sort());
	});
});
