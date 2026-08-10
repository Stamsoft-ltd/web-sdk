<script lang="ts">
	import { Graphics, Rectangle, Sprite } from 'pixi-svelte';

	import { getContext } from '../game/context';
	import { BACKGROUND_LIGHTS } from '../game/backgroundLights';

	const context = getContext();
	const DESKTOP_ASPECT = 1920 / 1080;
	const MOBILE_ASPECT = 1440 / 3200; // tall portrait corridor art
	// Portrait uses the mobile (tall) backgrounds; the two special bonuses still swap:
	// SUPER (superspin), BONUS (freegame), else base.
	const isPortrait = $derived(context.stateLayoutDerived.layoutType() === 'portrait');
	const bgKey = $derived(
		context.stateGame.bonusMode === 'superspin'
			? isPortrait
				? 'bgMobileSuper'
				: 'bgSuper'
			: context.stateGame.bonusMode === 'freegame'
				? isPortrait
					? 'bgMobileBonus'
					: 'bgBonus'
				: isPortrait
					? 'bgMobileBase'
					: 'bgBase',
	);
	const aspect = $derived(isPortrait ? MOBILE_ASPECT : DESKTOP_ASPECT);
	// This component mounts before the gating asset pass finishes (it sits outside the loading-screen
	// branch in Game.svelte), and the portrait/landscape backgrounds are additionally deferred on the
	// layout the session did not start in. Drawing a key that isn't in loadedAssets yet logs an error
	// and paints an empty texture, so wait for it — the loading screen covers the stage meanwhile,
	// and after a rotate the previous background simply holds until the deferred one lands.
	const hasBg = $derived(!!context.stateApp.loadedAssets?.[bgKey]);
	const canvas = $derived(context.stateLayoutDerived.canvasSizes());
	const cover = $derived.by(() => {
		const width = canvas.width;
		const height = canvas.height;
		const canvasAspect = width / height;

		if (canvasAspect > aspect) {
			return { width, height: width / aspect };
		}

		return { width: height * aspect, height };
	});

	// ── Room life ──
	// The room art is a still photograph, which is most of why the game reads as dead between spins.
	// Two things move now, both free of new assets:
	//   * a very slow BREATH on the sprite itself (a fraction of a percent of scale over ~24s), which
	//     the eye reads as air/heat rather than as a zoom;
	//   * the machines' own lamps, lit with the recipe the congratulations frame and the win-sign
	//     tubes use — a stacked-falloff halo, an irregular ballast flicker, and a hotspot drifting
	//     inside each lamp. Positions are MEASURED off the art (game/backgroundLights.ts).
	// One persistent rAF drives both, and the lamps are drawn imperatively into a captured Graphics
	// so a 60fps glow never re-renders the scene graph.
	const lights = $derived(BACKGROUND_LIGHTS[bgKey] ?? []);
	let clock = $state(0);
	type G = {
		destroyed: boolean;
		clear: () => void;
		roundRect: (x: number, y: number, w: number, h: number, r: number) => unknown;
		fill: (s: object) => void;
	};
	let lampG: G | null = null;

	const BREATH_S = 24;
	const breath = $derived(1 + 0.006 * Math.sin((clock / BREATH_S) * Math.PI * 2));

	const drawLamps = (g: G, t: number) => {
		g.clear();
		if (!lights.length) return;
		const W = cover.width;
		const H = cover.height;
		const ox = canvas.width * 0.5;
		const oy = canvas.height * 0.5;
		for (let i = 0; i < lights.length; i++) {
			const l = lights[i];
			const x = ox + (l.cx - 0.5) * W;
			const y = oy + (l.cy - 0.5) * H;
			const w = l.w * W;
			const h = l.h * H;
			const p = i * 1.7;
			// Slow breathe with sparse, sharp dips — a lamp stuttering, not a smooth fade.
			const base = 0.82 + 0.18 * Math.sin(t * 0.9 + p);
			const dip =
				0.2 * Math.max(0, Math.sin(t * 17.3 + p * 3)) ** 12 +
				0.12 * Math.max(0, Math.sin(t * 5.1 + p * 1.7)) ** 8;
			const level = Math.max(0.3, base - dip);
			const cr = (l.color >> 16) & 0xff;
			const cg = (l.color >> 8) & 0xff;
			const cb = l.color & 0xff;
			const LAYERS = 5;
			for (let k = 0; k < LAYERS; k++) {
				const f = k / (LAYERS - 1);
				const grow = f ** 1.5;
				const gw = w * (1 + 1.7 * grow);
				const gh = h * (1 + 1.7 * grow);
				const m = 1 - f;
				// Only part-way to white at the core: these sit BEHIND a dim room, and a white core
				// turns every lamp into the same grey blob.
				const mix = (c: number) => Math.round(c + (255 - c) * 0.35 * m ** 1.8);
				g.roundRect(x - gw / 2, y - gh / 2, gw, gh, Math.min(gw, gh) / 2);
				g.fill({
					color: (mix(cr) << 16) | (mix(cg) << 8) | mix(cb),
					alpha: (0.012 + 0.05 * m ** 2.2) * level,
				});
			}
		}
	};

	$effect(() => {
		let raf = 0;
		const t0 = performance.now();
		const tick = (now: number) => {
			raf = requestAnimationFrame(tick);
			const t = (now - t0) / 1000;
			// The breath is reactive (it scales a Sprite); throttle it to ~10fps so the whole scene
			// graph is not diffed 60 times a second for a 0.6% drift nobody can see move.
			if (Math.abs(t - clock) > 0.1) clock = t;
			if (lampG?.destroyed) lampG = null;
			if (lampG) drawLamps(lampG, t);
		};
		raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
	});
</script>

{#if hasBg}
	<Sprite
		key={bgKey}
		x={canvas.width * 0.5}
		y={canvas.height * 0.5}
		anchor={0.5}
		width={cover.width * breath}
		height={cover.height * breath}
		alpha={0.96}
	/>
	<!-- Lamp glow rides ON the room art, under both dim rectangles below. -->
	<Graphics blendMode="add" draw={(gr) => (lampG = gr as unknown as G)} />
{/if}
<Rectangle {...canvas} backgroundColor={0x050407} alpha={0.2} zIndex={-2} />
<Rectangle {...canvas} backgroundColor={0x000000} alpha={0.18} zIndex={-1} />
