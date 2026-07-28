// Plan 14 sections 1 + 2 — deterministic clock and sprite-liveness assertions.
//
// Nothing in here reads wall time: the clock is `advanceFrames()`, and the ticker tests never start
// a ticker. A flaky animation test gets deleted, and then the coverage is worse than none.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import * as PIXI from 'pixi.js';
import { flushSync, mount, unmount } from 'svelte';

import AnimatedSprite from '../../../packages/pixi-svelte/src/lib/components/AnimatedSprite.svelte';
import Particles from '../../../packages/pixi-svelte/src/lib/components/Particles.svelte';
import ParticleEmitter from '../../../packages/pixi-svelte/src/lib/components/ParticleEmitter.svelte';
import { anyPulsingWin, type PulseBoard } from '../src/game/boardPulse';
import { blurAlpha, MOTION_BLUR_VELOCITY, SPIN_OPTIONS_DEFAULT, SPIN_OPTIONS_TURBO } from '../src/game/constants';
import type { SymbolName } from '../src/game/types';
import { advanceFrames, fakeTextures, parentContext, reactiveProps } from './helpers.svelte';

const COMPONENTS_DIR = join(import.meta.dirname, '../src/components');

// ─────────────────────────────────────────────────────────────────────────────
// Section 2 — sprite liveness
// ─────────────────────────────────────────────────────────────────────────────

// Mirrors SceneAnimationDriver: pixi-svelte's <AnimatedSprite> is constructed with PIXI's default
// `autoUpdate: true`, so `gotoAndPlay()` registers it on `Ticker.shared` — whose `autoStart` is
// true, and jsdom does provide requestAnimationFrame. Leaving it running would mean a second,
// wall-clock driver racing `advanceFrames()`. Production stops it; so does this suite.
let sharedTickerWasStarted = false;
beforeAll(() => {
	sharedTickerWasStarted = PIXI.Ticker.shared.started;
	PIXI.Ticker.shared.autoStart = false;
	PIXI.Ticker.shared.stop();
});
afterAll(() => {
	PIXI.Ticker.shared.autoStart = sharedTickerWasStarted;
	if (sharedTickerWasStarted) PIXI.Ticker.shared.start();
});

// Unmount every mounted sprite even when an assertion throws — a leaked playing sprite stays
// registered on the shared ticker for the rest of the file.
const mounted: (() => void)[] = [];
afterEach(() => {
	while (mounted.length) mounted.pop()!();
});

const mountSprite = (props: Record<string, unknown>) => {
	const stage = new PIXI.Container();
	const live = reactiveProps(props);
	const component = mount(AnimatedSprite, {
		target: document.createElement('div'),
		context: new Map<string, unknown>([['@@pixi_parent', parentContext(stage)]]),
		props: live,
	});
	flushSync();
	mounted.push(() => unmount(component, { outro: false }));
	const sprite = stage.children[0] as unknown as PIXI.AnimatedSprite;
	return { stage, sprite, props: live };
};

describe('AnimatedSprite liveness (plan 14 §2)', () => {
	// If this ever fails, every exact-frame assertion below is racing a wall clock and the numbers
	// mean nothing.
	it('runs with the shared ticker stopped, so advanceFrames is the only clock', () => {
		const { stage, sprite } = mountSprite({
			textures: fakeTextures(8),
			play: true,
			loop: true,
			animationSpeed: 1,
		});
		expect(PIXI.Ticker.shared.started).toBe(false);
		// The sprite IS registered on the shared ticker (autoUpdate defaults to true) — that is
		// exactly why the ticker has to be stopped rather than merely ignored.
		expect(PIXI.Ticker.shared.count).toBeGreaterThan(0);
		expect(sprite.currentFrame).toBe(0);
		advanceFrames(stage, 2);
		expect(sprite.currentFrame).toBe(2);
	});

	it('advances currentFrame under the deterministic clock', () => {
		const { stage, sprite } = mountSprite({
			textures: fakeTextures(8),
			play: true,
			loop: true,
			animationSpeed: 1,
		});
		expect(sprite.playing).toBe(true);
		expect(sprite.currentFrame).toBe(0);

		advanceFrames(stage, 4);

		expect(sprite.currentFrame).toBe(4);
	});

	// R1, directly. `set textures` calls gotoAndStop(0) internally, so when propsSyncEffect owned
	// `textures` EVERY unrelated prop change (width/height during a win pop, a y write, an alpha
	// fade) froze the sprite on frame 0. The whole board did this and it shipped.
	it.each(['y', 'alpha', 'width'] as const)(
		'keeps advancing after an unrelated `%s` write',
		(prop) => {
			const { stage, sprite, props } = mountSprite({
				textures: fakeTextures(8),
				play: true,
				loop: true,
				animationSpeed: 1,
			});
			advanceFrames(stage, 3);
			expect(sprite.currentFrame).toBe(3);

			(props as Record<string, unknown>)[prop] = 40;
			flushSync();

			// Neither stopped nor rewound to 0 by the prop write...
			expect(sprite.playing).toBe(true);
			expect(sprite.currentFrame).toBe(3);
			// ...and still ticking afterwards.
			advanceFrames(stage, 2);
			expect(sprite.currentFrame).toBe(5);
		},
	);

	// The other half of R1: a genuine textures swap (deferred assets merging into loadedAssets hands
	// the parent a brand-new array) used to leave the sprite stopped with nothing to restart it.
	it('restarts after a textures swap', () => {
		const { stage, sprite, props } = mountSprite({
			textures: fakeTextures(8),
			play: true,
			loop: true,
			animationSpeed: 1,
		});
		advanceFrames(stage, 3);
		expect(sprite.currentFrame).toBe(3);

		(props as Record<string, unknown>).textures = fakeTextures(6);
		flushSync();

		expect(sprite.playing).toBe(true);
		advanceFrames(stage, 2);
		expect(sprite.currentFrame).toBe(2);
	});

	it('stays parked on its start frame when play is false', () => {
		const { stage, sprite } = mountSprite({
			textures: fakeTextures(8),
			play: false,
			loop: true,
			animationSpeed: 1,
			startFrame: 2,
		});
		expect(sprite.playing).toBe(false);
		advanceFrames(stage, 10);
		// The walk must skip non-playing sprites — otherwise `play={false}` means nothing.
		expect(sprite.currentFrame).toBe(2);
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// Section 2 — R3: ticker listener count is flat across repeated presentations
// ─────────────────────────────────────────────────────────────────────────────

describe('app ticker listener count (plan 14 §2, R3)', () => {
	const appContext = (ticker: PIXI.Ticker, loadedAssets: Record<string, unknown>) => ({
		stateApp: { pixiApplication: { ticker }, loadedAssets },
	});

	// The coin fountain remounts once per win. Both components used to register an ANONYMOUS
	// callback on the app ticker and never remove it, so the listener list grew for the session.
	// `Ticker.count` is a public readonly getter in PIXI v8 that walks `_head`, so no
	// instrumentation is needed here.
	it('returns to baseline after 10 Particles mount/unmount cycles', () => {
		const ticker = new PIXI.Ticker();
		const baseline = ticker.count;
		const container = new PIXI.ParticleContainer();
		const context = new Map<string, unknown>([
			['@@pixi_svelte', appContext(ticker, { coins: fakeTextures(1)[0] })],
			['@@pixi_particle_parent', container],
		]);

		for (let i = 0; i < 10; i++) {
			const component = mount(Particles, {
				target: document.createElement('div'),
				context,
				props: { key: 'coins', size: 2, init: () => {}, update: () => {} },
			});
			flushSync();
			expect(ticker.count).toBe(baseline + 1);
			unmount(component, { outro: false });
			flushSync();
		}

		expect(ticker.count).toBe(baseline);
	});

	it('returns to baseline after 10 ParticleEmitter mount/unmount cycles', () => {
		const ticker = new PIXI.Ticker();
		const baseline = ticker.count;
		const stage = new PIXI.Container();
		const context = new Map<string, unknown>([
			['@@pixi_svelte', appContext(ticker, { coins: fakeTextures(2) })],
			['@@pixi_parent', parentContext(stage)],
		]);
		const config = {
			lifetime: { min: 0.5, max: 0.5 },
			frequency: 0.1,
			emitterLifetime: -1,
			maxParticles: 4,
			pos: { x: 0, y: 0 },
			behaviors: [{ type: 'textureRandom', config: { textures: [] } }],
		};

		for (let i = 0; i < 10; i++) {
			const component = mount(ParticleEmitter, {
				target: document.createElement('div'),
				context,
				props: { key: 'coins', config, emit: false },
			});
			flushSync();
			expect(ticker.count).toBe(baseline + 1);
			unmount(component, { outro: false });
			flushSync();
		}

		expect(ticker.count).toBe(baseline);
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// Section 2 — N4: the pulse predicate includes wild and scatter
// ─────────────────────────────────────────────────────────────────────────────

const boardOf = (...rows: [SymbolName, string | undefined][][]): PulseBoard =>
	rows.map((symbols) => ({
		reelState: {
			symbols: symbols.map(([name, symbolState]) => ({ rawSymbol: { name }, symbolState })),
		},
	}));

describe('blurAlpha (R7 follow-up — the smear cross-fades instead of hard-cutting)', () => {
	// Board.svelte measures reel velocity in board-px per 60 Hz tick, so the spin speeds convert the
	// same way. The ordering that actually matters is FLOOR < MOTION_BLUR_VELOCITY < cruise: pick a
	// fade band that reaches up past the cruise and the body of every spin under-blurs.
	const perTick = (pxPerMs: number) => pxPerMs * (1000 / 60);

	it('is fully opaque through the whole cruise, at every spin speed', () => {
		expect(blurAlpha(perTick(SPIN_OPTIONS_DEFAULT.reelSpinSpeed))).toBe(1);
		expect(blurAlpha(perTick(SPIN_OPTIONS_TURBO.reelSpinSpeed))).toBe(1);
		expect(blurAlpha(MOTION_BLUR_VELOCITY)).toBe(1);
	});

	it('is fully transparent at rest', () => {
		expect(blurAlpha(0)).toBe(0);
	});

	it('fades, rather than cuts, below the full-blur point', () => {
		const mid = blurAlpha(MOTION_BLUR_VELOCITY * 0.65);
		expect(mid).toBeGreaterThan(0);
		expect(mid).toBeLessThan(1);
	});

	it('never increases as the reel slows, on either direction of travel', () => {
		let previous = 1;
		for (let v = MOTION_BLUR_VELOCITY; v >= 0; v -= 0.5) {
			const alpha = blurAlpha(v);
			expect(alpha).toBeLessThanOrEqual(previous);
			expect(blurAlpha(-v)).toBe(alpha); // the bounce-back travels the other way
			previous = alpha;
		}
		expect(previous).toBe(0);
	});
});

describe('anyPulsingWin (plan 14 §2, N4)', () => {
	// The defect was two explicit exclusions — 'WILD' and 'SCATTER' — in the predicate, so a scatter
	// bonus trigger or a wild-only line never started the clock and the emblem rendered at whatever
	// frozen scale the previous letter win left behind. Tested as a predicate rather than through
	// the clock on purpose: §1's scene clock does not drive Board's rAF, so asserting that
	// `letterPulseT` advances would need faked rAF that sections 1-3 do not provide.
	it('is true for a scatter-only win', () => {
		expect(anyPulsingWin(boardOf([['SCATTER', 'win']], [['FOX', 'static']]))).toBe(true);
	});

	it('is true for a wild-only win', () => {
		expect(anyPulsingWin(boardOf([['WILD', 'win']], [['BEAR', 'static']]))).toBe(true);
	});

	it('is true for a letter win', () => {
		expect(anyPulsingWin(boardOf([['Q', 'win']], [['FOX', 'static']]))).toBe(true);
	});

	it('is true through the postWinStatic presentation', () => {
		expect(anyPulsingWin(boardOf([['SCATTER', 'postWinStatic']]))).toBe(true);
	});

	it('is false with no win', () => {
		expect(
			anyPulsingWin(
				boardOf(
					[
						['SCATTER', 'static'],
						['WILD', 'static'],
					],
					[
						['Q', 'land'],
						['T', 'spin'],
					],
				),
			),
		).toBe(false);
	});

	// The complement rule: premiums animate from their own win sheets and must NOT start the pulse
	// clock, or every animal win would drive a clock nothing reads.
	it('is false for a premium-only win', () => {
		expect(
			anyPulsingWin(
				boardOf([
					['FOX', 'win'],
					['WOLF', 'win'],
				]),
			),
		).toBe(false);
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// Section 2 — R13 (second half): no rAF loop runs while the game is idle
// ─────────────────────────────────────────────────────────────────────────────

/** Body of every `$effect(...)` in `source` that mentions requestAnimationFrame, brace-matched. */
const rafEffects = (source: string) => {
	const bodies: string[] = [];
	const marker = '$effect(';
	for (let i = source.indexOf(marker); i !== -1; i = source.indexOf(marker, i + 1)) {
		let depth = 0;
		let end = i + marker.length - 1;
		for (; end < source.length; end++) {
			if (source[end] === '(') depth++;
			else if (source[end] === ')' && --depth === 0) break;
		}
		const body = source.slice(i, end + 1);
		if (body.includes('requestAnimationFrame')) bodies.push(body);
	}
	return bodies;
};

/**
 * Every reason `source`'s rAF effects could run on a cold load, as human-readable strings.
 * Three rules, all the shape R13 had:
 *   1. the effect must early-return before it schedules anything;
 *   2. the guard must return on the CLOSED side — `if (!gate) return`, never `if (gate) return`,
 *      which runs the loop precisely when the gate is shut;
 *   3. any component-local `$state` the guard reads must initialise falsy.
 */
const rafGateViolations = (source: string): string[] => {
	const violations: string[] = [];
	for (const body of rafEffects(source)) {
		// `if (!gate) return;` / `if (!a || !b?.c) { ...; return; }`
		const guard = /if\s*\(([^)]*)\)\s*(?:\{[^}]*)?return/.exec(body);
		if (!guard) {
			violations.push('rAF effect runs unconditionally');
			continue;
		}
		if (guard.index > body.indexOf('requestAnimationFrame')) {
			violations.push('rAF is scheduled before the guard');
			continue;
		}
		for (const ident of guard[1].match(/[A-Za-z_$][\w$]*/g) ?? []) {
			const decl = new RegExp(`let\\s+${ident}\\s*=\\s*\\$state\\(([^)]*)\\)`).exec(source);
			if (!decl) continue; // a $derived or a prop — gated by game state, which starts idle
			if (!new RegExp(`!\\s*${ident}\\b`).test(guard[1])) {
				violations.push(`rAF gate \`${ident}\` is not negated — the loop runs while it is closed`);
				continue;
			}
			if (!['', 'false', '0', 'null', 'undefined'].includes(decl[1].trim()))
				violations.push(`rAF gate \`${ident}\` initialises truthy ($state(${decl[1]}))`);
		}
	}
	return violations;
};

// Every component that mentions requestAnimationFrame, classified. The map is asserted to be
// EXHAUSTIVE below, so a new rAF owner fails this suite until someone classifies it — otherwise a
// fresh ungated loop in a fresh always-mounted popup would slip past unexamined.
const RAF_COMPONENTS: Record<string, 'self-gated' | 'mount-gated' | 'not-a-loop'> = {
	// Mounted for the whole session — a popup whose visibility is an internal `$state`, or a board
	// that is always on screen. Mounting is NOT a gate here: the effect must gate itself, and the
	// gate must start closed. R13 was exactly this — `show` shipped as `$state(true)` in
	// FreeSpinOutro, so its clock ran from cold load and the first bonus outro hard-popped.
	'Board.svelte': 'self-gated',
	'BonusSymbolPanel.svelte': 'self-gated',
	'ExpandedSymbolOverlay.svelte': 'self-gated',
	'FreeSpinIntro.svelte': 'self-gated',
	'FreeSpinOutro.svelte': 'self-gated',
	'Win.svelte': 'self-gated',
	// Rendered behind an {#if} that is false at idle, so the mount itself is the gate and the
	// effect body is legitimately unconditional.
	'Anticipation.svelte': 'mount-gated',
	'WinBoard.svelte': 'mount-gated',
	// requestAnimationFrame outside any $effect: one-shot layout work (measure/fit), or a loop
	// started explicitly by a call site rather than by mounting. Not an idle animation clock.
	'HudHtml.svelte': 'not-a-loop',
	'PaylineVine.svelte': 'not-a-loop',
	'SceneAnimationDriver.svelte': 'not-a-loop', // mentions it only in a comment
};

const SELF_GATED = Object.keys(RAF_COMPONENTS).filter((f) => RAF_COMPONENTS[f] === 'self-gated');

describe('idle rAF loops (plan 14 §2, R13 partial guard)', () => {
	// Honest scope: this is a SOURCE-level guard, not a runtime one. Proving "no rAF is scheduled"
	// at runtime needs the whole game tree mounted against a GPU, which is deferred section 4. What
	// it does prove is that every always-mounted rAF owner still has a gate, that the gate is on the
	// closed side, and that it still starts closed — which is the shape both R13 and N5 had.
	const sources = new Map(
		readdirSync(COMPONENTS_DIR)
			.filter((f) => f.endsWith('.svelte'))
			.map((f) => [f, readFileSync(join(COMPONENTS_DIR, f), 'utf8')] as const),
	);

	it('classifies every component that touches requestAnimationFrame', () => {
		// Exhaustive, not `arrayContaining`: a NEW rAF owner must be triaged, not ignored.
		const withRaf = [...sources]
			.filter(([, src]) => src.includes('requestAnimationFrame'))
			.map(([file]) => file)
			.sort();
		expect(withRaf).toEqual(Object.keys(RAF_COMPONENTS).sort());
	});

	it.each(SELF_GATED)('%s gates its rAF effect and starts closed', (file) => {
		const source = sources.get(file);
		expect(source, `${file} is listed as an rAF owner but does not exist`).toBeDefined();
		expect(
			rafEffects(source!).length,
			`${file} no longer owns an rAF effect inside an $effect — reclassify it in RAF_COMPONENTS`,
		).toBeGreaterThan(0);
		expect(rafGateViolations(source!), file).toEqual([]);
	});

	// The scanner is a heuristic over source text, so it gets its own teeth checked: a refactor that
	// stopped it matching would otherwise turn the six assertions above into six green no-ops.
	it('flags an ungated rAF effect', () => {
		expect(rafGateViolations('$effect(() => { raf = requestAnimationFrame(tick); });')).toEqual([
			'rAF effect runs unconditionally',
		]);
	});

	it('flags a gate that initialises truthy (R13 verbatim)', () => {
		const source = `let show = $state(true);
			$effect(() => {
				if (!show) return;
				let raf = requestAnimationFrame(tick);
			});`;
		expect(rafGateViolations(source)).toEqual([
			'rAF gate `show` initialises truthy ($state(true))',
		]);
	});

	it('flags a gate returning on the OPEN side (loop runs while the gate is shut)', () => {
		const source = `let show = $state(false);
			$effect(() => {
				if (show) return;
				let raf = requestAnimationFrame(tick);
			});`;
		expect(rafGateViolations(source)).toEqual([
			'rAF gate `show` is not negated — the loop runs while it is closed',
		]);
	});

	it('accepts a gate that initialises falsy', () => {
		const source = `let show = $state(false);
			$effect(() => {
				if (!show) return;
				let raf = requestAnimationFrame(tick);
			});`;
		expect(rafGateViolations(source)).toEqual([]);
	});
});
