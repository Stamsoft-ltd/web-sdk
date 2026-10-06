<script lang="ts">
	import SymbolSpine from './SymbolSpine.svelte';
	import SymbolSprite from './SymbolSprite.svelte';
	import AnimatedSymbol from './AnimatedSymbol.svelte';
	import { getSymbolInfo } from '../game/utils';
	import { SYMBOL_PARTS } from '../game/symbolParts';
	import type { SymbolState, RawSymbol } from '../game/types';
	import { getContext } from '../game/context';
	import { Container, Graphics } from 'pixi-svelte';
	import { Tween } from 'svelte/motion';
	import { cubicIn } from 'svelte/easing';
	import { HIGH_SYMBOLS, SYMBOL_SIZE } from '../game/constants';
	import { sauceOf } from '../game/sauces';

	type Props = {
		x?: number;
		y?: number;
		state: SymbolState;
		rawSymbol: RawSymbol;
		winning?: boolean;
		oncomplete?: () => void;
		loop?: boolean;
		/** performance.now() when this symbol should land (its reel's stop + a per-row offset). */
		landedAt?: number;
		/** Its reel is running at full speed (drives the speed stretch). */
		spinning?: boolean;
		/** Landing strength for specials (1 = normal): each extra scatter in a spin lands bigger. */
		landBoost?: number;
		/** Land one-shot playback rate (the scatter's, matched to its pitched-up land sound). */
		landRate?: number;
		/** Win pulse offset (ms): a line's symbols punch up one after another, left to right. */
		winDelay?: number;
	};

	const props: Props = $props();
	const context = getContext();
	const symbolInfo = $derived(getSymbolInfo({ rawSymbol: props.rawSymbol, state: props.state }));
	const isSprite = $derived(symbolInfo.type === 'sprite');
	// Some symbols are reassembled from layered parts so they can animate when winning/locked.
	const partsConfig = $derived(isSprite ? SYMBOL_PARTS[props.rawSymbol?.name ?? ''] : undefined);

	// Landing, by symbol weight. The reel strip itself already overshoots and snaps back on its stop,
	// so the symbols only add the settle:
	// - low symbols: a light uniform pop, 100% → 103% → 99% → 100% over 150ms;
	// - premium symbols: a short weighted squash onto their base that springs back, over 240ms;
	// - scatter / soup keep the big squash-and-hop — it is their entrance;
	// - the wild has its own entrance (AnimatedSymbol: splat, letter pop, shake, drip) — nothing here.
	// Timed from the reel's landing stamp (props.landedAt, already offset per row by ReelSymbol) —
	// robust to the reel swapping in fresh symbol objects around the landing.
	type Key = [ms: number, value: number];
	const LOW_POP: Key[] = [[0, 1], [45, 1.03], [100, 0.99], [150, 1]];
	const PREMIUM_SQUASH: Key[] = [[0, 0.9], [70, 1.04], [150, 0.985], [240, 1]];
	const SPECIAL_MS = 680;
	const SPECIALS = ['S', 'M'];

	const tier = $derived(
		props.rawSymbol?.name === 'W'
			? 'own'
			: SPECIALS.includes(props.rawSymbol?.name)
				? 'special'
				: HIGH_SYMBOLS.includes(props.rawSymbol?.name)
					? 'premium'
					: 'low',
	);
	const landMs = $derived(
		tier === 'special' ? SPECIAL_MS : (tier === 'premium' ? PREMIUM_SQUASH : LOW_POP).at(-1)![0],
	);
	const smooth = (x: number) => x * x * (3 - 2 * x);
	// Smoothstep between keyframes (eases into and out of every key — no velocity kinks).
	const keyed = (keys: Key[], ms: number) => {
		for (let i = 1; i < keys.length; i += 1) {
			const [t1, v1] = keys[i];
			const [t0, v0] = keys[i - 1];
			if (ms <= t1) return v0 + (v1 - v0) * smooth((ms - t0) / (t1 - t0));
		}
		return keys.at(-1)![1];
	};

	let now = $state(0);
	const landStart = $derived(props.landedAt ?? -1);
	$effect(() => {
		if (landStart < 0) return;
		const end = landStart + landMs;
		let raf = 0;
		const loop = (ts: number) => {
			now = ts;
			if (ts < end) raf = requestAnimationFrame(loop);
		};
		raf = requestAnimationFrame(loop);
		return () => cancelAnimationFrame(raf);
	});
	const bounce = $derived.by(() => {
		const ms = now - landStart;
		if (landStart < 0 || ms < 0 || ms >= landMs || tier === 'own') return { sx: 1, sy: 1, dy: 0 };
		if (tier === 'low') {
			const k = keyed(LOW_POP, ms);
			return { sx: k, sy: k, dy: 0 };
		}
		if (tier === 'premium') {
			// volume-preserving, bottom-anchored
			const sy = keyed(PREMIUM_SQUASH, ms);
			return { sx: 1 / Math.sqrt(sy), sy, dy: (1 - sy) * SYMBOL_SIZE * 0.4 };
		}
		// special: squash on impact, hop (stretched rising), lighter second landing, damped out —
		// all deeper / higher by landBoost (the 2nd, 3rd … scatter of a spin hits harder)
		const k = props.landBoost ?? 1;
		const u = ms / SPECIAL_MS;
		let sy: number;
		let hop = 0;
		if (u < 0.13) {
			sy = 1 - 0.26 * k + 0.36 * k * smooth(u / 0.13);
		} else if (u < 0.6) {
			const a = (u - 0.13) / 0.47;
			hop = 4 * a * (1 - a) * k;
			sy = 1 + 0.1 * k * Math.cos(Math.PI * a);
		} else {
			const b = (u - 0.6) / 0.4;
			sy = 1 - 0.1 * k * Math.exp(-4 * b) * Math.cos(Math.PI * 2 * b);
		}
		return { sx: 1 / Math.sqrt(sy), sy, dy: (1 - sy) * SYMBOL_SIZE * 0.4 - hop * SYMBOL_SIZE * 0.15 };
	});

	// Speed stretch: while its reel runs at full speed the symbol is drawn a little long and thin (a
	// cheap stand-in for motion blur); it eases in as the reel gets going and is gone the instant the
	// reel hits, so the landing reads sharp.
	const SPIN_STRETCH = 0.07;
	const stretch = new Tween(0);
	$effect(() => {
		stretch.set(props.spinning ? 1 : 0, { duration: props.spinning ? 180 : 0, easing: cubicIn });
	});
	// Win beat: the moment a win line lights this symbol it punches up to 113% and back with a warm
	// flash behind it — the "this one!" cue before any win screen (bookEventHandlerMap winInfo holds
	// the beat for it).
	const WIN_PULSE: Key[] = [[0, 1], [150, 1.13], [420, 1]];
	const WIN_PULSE_MS = 420;
	const FLECK_MS = 620; // the win flecks outlive the pulse a little
	let winStart = $state(-1);
	let winNow = $state(0);
	$effect(() => {
		if (!props.winning) {
			winStart = -1;
			return;
		}
		const start = performance.now() + (props.winDelay ?? 0);
		winStart = start;
		let raf = 0;
		const loop = (ts: number) => {
			winNow = ts;
			if (ts - start < FLECK_MS) raf = requestAnimationFrame(loop);
		};
		raf = requestAnimationFrame(loop);
		return () => cancelAnimationFrame(raf);
	});
	const winMs = $derived(winStart < 0 || winNow < winStart ? -1 : winNow - winStart);
	const pulse = $derived(winMs < 0 || winMs >= WIN_PULSE_MS ? 1 : keyed(WIN_PULSE, winMs));
	// flash: up fast, gone by the end of the pulse. A boosted special landing (2nd+ scatter) flashes
	// too, brighter the later the scatter.
	const LAND_FLASH_MS = 380;
	const landFlash = $derived.by(() => {
		const boost = (props.landBoost ?? 1) - 1;
		const ms = now - landStart;
		if (tier !== 'special' || boost <= 0 || landStart < 0 || ms < 0 || ms >= LAND_FLASH_MS) return 0;
		return Math.min(1, boost / 0.45) * (ms < 60 ? ms / 60 : 1 - (ms - 60) / (LAND_FLASH_MS - 60));
	});
	const flash = $derived(
		Math.max(
			landFlash,
			winMs < 0 || winMs >= WIN_PULSE_MS ? 0 : winMs < 90 ? winMs / 90 : 1 - (winMs - 90) / (WIN_PULSE_MS - 90),
		),
	);
	// Soft warm glow: stacked additive discs, each a little smaller, fake a radial falloff with no
	// hard rim (a shader-free gradient). Drawn once; only the Graphics' alpha animates.
	const FLASH_RINGS = 9;
	const drawFlash = (g: any) => {
		g.clear();
		for (let i = 0; i < FLASH_RINGS; i += 1) {
			const k = 1 - i / FLASH_RINGS;
			g.circle(0, 0, SYMBOL_SIZE * 0.52 * k).fill({ color: i < FLASH_RINGS / 2 ? 0xff9a2e : 0xffe2a0, alpha: 0.06 });
		}
	};

	// Win flecks: as the pulse hits, a few tiny drops of the symbol's own sauce (the colour of its win
	// line) flick up off it and fall away — small, so an ordinary win stays about the symbols.
	const FLECKS = 7;
	const sauce = $derived(sauceOf(props.rawSymbol?.name));
	const drawFlecks = (g: any) => {
		g.clear();
		const t = winMs / 1000;
		if (winMs < 0 || winMs > FLECK_MS) return;
		for (let i = 0; i < FLECKS; i += 1) {
			const ang = -Math.PI * (0.12 + 0.76 * ((i + 0.5) / FLECKS)) + Math.sin(i * 7.31) * 0.15;
			const v = SYMBOL_SIZE * (1.3 + 0.6 * Math.abs(Math.sin(i * 3.7)));
			const r0 = SYMBOL_SIZE * 0.3;
			const x = Math.cos(ang) * (r0 + v * t);
			const y = Math.sin(ang) * (r0 + v * t) + 0.5 * SYMBOL_SIZE * 6 * t * t;
			const r = SYMBOL_SIZE * (0.022 + 0.012 * ((i * 5) % 3)) * (1 - 0.5 * (winMs / FLECK_MS));
			const a = Math.min(1, winMs / 60) * (1 - winMs / FLECK_MS);
			g.circle(x, y, r * 1.25).fill({ color: sauce.rim, alpha: 0.8 * a });
			g.circle(x, y, r).fill({ color: sauce.body, alpha: a });
		}
	};

	// Contact shadow: a soft dark ellipse on the tile under the symbol, so it sits ON the board rather
	// than printed into it. It stays on the floor — it shrinks and fades as the symbol hops up on a
	// landing, and thins out while the reel runs.
	const drawShadow = (g: any) => {
		g.clear();
		for (let i = 0; i < 4; i += 1) {
			const f = 1 - i * 0.18;
			g.ellipse(0, 0, SYMBOL_SIZE * 0.34 * f, SYMBOL_SIZE * 0.07 * f).fill({ color: 0x000000, alpha: 0.09 });
		}
	};
	const shadowLift = $derived(Math.max(0, -bounce.dy) / (SYMBOL_SIZE * 0.15)); // 0 on the floor → 1 at the hop's top
	const shadowScale = $derived(1 - 0.35 * shadowLift);
	const shadowAlpha = $derived((1 - 0.5 * shadowLift) * (1 - 0.6 * stretch.current));

	const scaleX = $derived(bounce.sx * pulse * (1 - SPIN_STRETCH * 0.45 * stretch.current));
	const scaleY = $derived(bounce.sy * pulse * (1 + SPIN_STRETCH * stretch.current));
</script>

<Graphics
	draw={drawShadow}
	x={props.x ?? 0}
	y={(props.y ?? 0) + SYMBOL_SIZE * 0.36}
	scale={{ x: shadowScale * bounce.sx, y: shadowScale }}
	alpha={shadowAlpha}
/>
<Container x={props.x ?? 0} y={(props.y ?? 0) + bounce.dy} scale={{ x: scaleX, y: scaleY }}>
	{#if flash > 0}
		<Graphics draw={drawFlash} alpha={flash * 0.9} blendMode="add" />
	{/if}
	{#if partsConfig}
		<AnimatedSymbol
			config={partsConfig}
			x={0}
			y={0}
			scale={symbolInfo.sizeRatios.width}
			state={props.state}
			winning={props.winning}
			oncomplete={props.oncomplete}
			landRate={props.landRate}
		/>
	{:else if isSprite}
		<SymbolSprite {symbolInfo} x={0} y={0} oncomplete={props.oncomplete} />
	{:else}
		<SymbolSpine
			loop={props.loop}
			{symbolInfo}
			x={0}
			y={0}
			showWinFrame={props.state === 'win' && !['S', 'M'].includes(props.rawSymbol.name)}
			listener={{
				complete: props.oncomplete,
			}}
		/>
	{/if}
	{#if winMs >= 0 && winMs < FLECK_MS}
		<Graphics draw={drawFlecks} />
	{/if}
</Container>

<!-- No per-symbol multiplier label: the template's gold "{N}X" bitmap text sat right across the
     Smutz cup's logo (read as a stray "X"); the running multiplier shows on the printer instead. -->
