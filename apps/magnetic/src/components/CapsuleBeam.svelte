<script lang="ts">
	import { Container, Graphics, Sprite } from 'pixi-svelte';

	// The NEW in-tube animation for the Version2 empty pillar (replaces the removed CapsuleBolts):
	// a hot central laser plus sparse falling light particles, and — when a symbol is being held —
	// the symbol itself, drawn INSIDE the beam: it bobs gently, the beam visually terminates on it
	// (the lower segment dims as if occluded) and an impact flare burns at the contact point.
	// Everything renders imperatively into captured Graphics from ONE persistent rAF (same pattern
	// as SymbolWinFx / the board's lock borders) with additive blending. Positions are pure
	// functions of time — no per-frame state accumulates, and the loop tears down with the
	// component.
	type Props = {
		x?: number;
		y?: number;
		/** Inner glass width/height in local px — the beam and particles stay inside this box. */
		glassW: number;
		glassH: number;
		/** Held symbol (cluster/magnet target); null/undefined = empty tube. */
		symbolKey?: string | null;
		/** Pop-in scale from the parent's Tween (0..1). */
		symbolScale?: number;
		/** Symbol sprite width in local px (height follows the 328x264 art aspect). */
		symbolW?: number;
		/** Beam ends as fractions of glassH. Defaults are the vertical-tube values (see below); the
		 *  portrait bar passes a symmetric pair because its tube is a barrel with no cap/base. */
		beamTop?: number;
		beamBot?: number;
		/** Counter-rotation for the held symbol, radians. A caller that rotates this whole component
		 *  (the portrait bar runs the tube horizontally) uses it to keep the symbol upright. */
		symbolRotation?: number;
		alpha?: number;
		zIndex?: number;
	};
	const props: Props = $props();

	const SYM_ASPECT = 264 / 328;
	const symW = $derived(props.symbolW ?? 0);
	const symH = $derived(symW * SYM_ASPECT);

	// User-tuned ends: the TOP reaches high, up under the cap (it "starts from higher"); the
	// BOTTOM sits just clear of the base rim (0.3 was called out as too high).
	const BEAM_TOP = $derived(props.beamTop ?? -0.47);
	const BEAM_BOT = $derived(props.beamBot ?? 0.37);

	type G = {
		destroyed: boolean;
		clear: () => void;
		roundRect: (x: number, y: number, w: number, h: number, r: number) => unknown;
		circle: (x: number, y: number, r: number) => unknown;
		ellipse: (x: number, y: number, rx: number, ry: number) => unknown;
		moveTo: (x: number, y: number) => void;
		lineTo: (x: number, y: number) => void;
		stroke: (s: object) => void;
		fill: (s: object) => void;
	};
	let backG = $state<G | null>(null);
	let flareG = $state<G | null>(null);

	// Symbol float, written by the rAF; the sprite container just binds them.
	let bobY = $state(0);
	let bobX = $state(0);
	let bobRot = $state(0);
	let breathe = $state(1);
	// How hard the beam is currently lighting the held symbol. Written by the rAF and consumed by
	// the two additive copies of the sprite below, so the piece BRIGHTENS with the beam instead of
	// just sitting inside it — the flare alone read as a decal floating in front of the art.
	let litAlpha = $state(0);
	let rimAlpha = $state(0);
	// Periodic beam surge (sharp pulse every ~3.5s) — the flare flashes and the symbol reacts,
	// so the two read as physically coupled instead of overlaid.
	let surge = 0;

	// Deterministic per-particle parameters — the field is stable across remounts.
	// User-tuned population (round 3): SPARSE, and mostly the star-cross glints the user singled
	// out as the good ones — a handful of stars falling slowly top → bottom plus a few faint
	// laser-shard streaks. x uses a golden-ratio sequence for an even spread across the glass
	// (the previous hash clustered everything left of the beam).
	const PARTICLES = Array.from({ length: 9 }, (_, i) => {
		const h = (k: number) => (((i + 1) * k) % 997) / 997;
		const glint = i % 2 === 0;
		return {
			glint,
			x: (((i * 0.61803) % 1) * 2 - 1) * 0.42, // fraction of glassW/2, clear of the walls
			fall: glint ? 0.05 + 0.04 * h(40503) : 0.2 + 0.18 * h(40503), // glass-heights per second
			phase: h(9973),
			size: (glint ? 0.009 : 0.004) + 0.005 * h(7919), // fraction of glassW
			len: 0.035 + 0.06 * h(104729), // streak length, fraction of glassH
			twinkle: 1.2 + 3 * h(104729),
			dim: 0.4 + 0.6 * h(15485863), // depth variance
		};
	});

	// One vertical beam pass between yA..yB at the given alpha factor. Drawn as MANY thin additive
	// layers whose widths/alphas follow a smooth power falloff — the previous 4 hard-edged bars
	// read as visible banding ("bad quality", user). 11 stacked pills approximate a gaussian glow
	// with a white-hot core and cost nothing measurable per frame.
	const BEAM_STEPS = 11;
	const drawBeamSegment = (
		gr: G,
		yA: number,
		yB: number,
		aMul: number,
		flick: number,
		shimmer: number,
		fadeBottom = false,
	) => {
		if (yB - yA < 1) return;
		const W = props.glassW;
		// Soft vertical fade at the bottom end — a hard cut of stacked pill-ends read as a bulbous
		// termination (user-flagged).
		const FADE_SLICES = 6;
		const fadeLen = fadeBottom ? Math.min((yB - yA) * 0.35, props.glassH * 0.12) : 0;
		for (let i = 0; i < BEAM_STEPS; i++) {
			const f = i / (BEAM_STEPS - 1); // 0 = outer haze → 1 = core
			const lw = W * (0.36 * (1 - f) ** 1.6 + 0.026);
			// Colour ramps deep blue → pale cyan → white toward the core.
			const m = f ** 1.4;
			const cr = Math.round(47 + (255 - 47) * m);
			const cg = Math.round(155 + (255 - 155) * m);
			const color = (cr << 16) | (cg << 8) | 255;
			const alpha = (0.03 + 0.09 * f ** 2.2) * flick * aMul;
			const x = -lw / 2 + shimmer * f;
			gr.roundRect(x, yA, lw, yB - yA - fadeLen, lw / 2);
			gr.fill({ color, alpha });
			for (let k = 0; k < FADE_SLICES && fadeLen > 0; k++) {
				const sy = yB - fadeLen + (k * fadeLen) / FADE_SLICES;
				gr.roundRect(x, sy, lw, fadeLen / FADE_SLICES + 1, 2);
				gr.fill({ color, alpha: alpha * (1 - (k + 0.5) / FADE_SLICES) });
			}
		}
	};

	const drawBack = (gr: G, t: number) => {
		gr.clear();
		const W = props.glassW;
		const H = props.glassH;
		const flick = 0.82 + 0.13 * Math.sin(t * 6.7) * Math.sin(t * 2.3) + 0.05 * Math.sin(t * 17);
		// A hair of horizontal shimmer on the hot layers — the beam wavers like live energy
		// instead of standing painted-still.
		const shimmer = W * 0.006 * Math.sin(t * 21) * Math.sin(t * 5.1);
		const beamTop = H * BEAM_TOP;
		const beamBot = H * BEAM_BOT;

		const held = !!props.symbolKey && (props.symbolScale ?? 0) > 0.05;
		if (held) {
			const s = props.symbolScale ?? 1;
			const symBot = bobY + symH * 0.38 * s;
			// Upper beam runs INTO the symbol (the sprite, drawn on top, occludes its end — no
			// floating gap above the art); below it the beam continues dimmed, as through a body
			// blocking most of the light. The old wrap-around halo discs read flat and are gone.
			drawBeamSegment(gr, beamTop, bobY + symH * 0.15 * s, 1, flick, shimmer);
			drawBeamSegment(gr, symBot, beamBot, 0.3, flick, shimmer, true);
		} else {
			drawBeamSegment(gr, beamTop, beamBot, 1, flick, shimmer, true);
		}

		// (The travelling energy packets and the end-cap bloom ellipses were removed — the packets
		// read as stacked pills and the blooms as painted discs, both user-flagged.)

		// ── Laser shards raining TOP → BOTTOM (per the reference: the particles are parts of the
		//    laser) + a few slow glints. Streaks wrap seamlessly with an edge fade so nothing pops
		//    at the caps; each keeps its own depth brightness. ──
		for (const p of PARTICLES) {
			const yn = BEAM_TOP + ((t * p.fall + p.phase) % 1) * (BEAM_BOT - BEAM_TOP);
			const xx = p.x * W;
			const yy = yn * H;
			const spanEdge = Math.min((yn - BEAM_TOP) / 0.1, (BEAM_BOT - yn) / 0.1, 1);
			const edge = Math.max(0, spanEdge);
			if (p.glint) {
				// Slow-falling sparkle with a star cross near peak twinkle.
				const tw = (0.5 + 0.5 * Math.sin(t * p.twinkle + p.phase * 25)) ** 3;
				const r = W * p.size * (0.8 + 0.4 * tw);
				if (tw > 0.35) {
					const flare = (tw - 0.35) / 0.65;
					const L = r * (2.5 + 3.5 * flare);
					gr.moveTo(xx - L, yy);
					gr.lineTo(xx + L, yy);
					gr.stroke({ width: r * 0.5, color: 0xdff4ff, alpha: 0.5 * flare * edge, cap: 'round' });
					gr.moveTo(xx, yy - L * 1.3);
					gr.lineTo(xx, yy + L * 1.3);
					gr.stroke({ width: r * 0.5, color: 0xdff4ff, alpha: 0.5 * flare * edge, cap: 'round' });
				}
				gr.circle(xx, yy, r);
				gr.fill({ color: 0xffffff, alpha: (0.35 + 0.6 * tw) * edge });
			} else {
				// Falling streak: cyan tail dying upward, white core, bright head at the leading
				// (bottom) end — a shard of the beam.
				const r = W * p.size;
				const tail = H * p.len;
				gr.moveTo(xx, yy - tail);
				gr.lineTo(xx, yy);
				gr.stroke({ width: r * 2.4, color: 0x54c4ff, alpha: 0.22 * p.dim * edge, cap: 'round' });
				gr.moveTo(xx, yy - tail * 0.7);
				gr.lineTo(xx, yy);
				gr.stroke({ width: r, color: 0xeaf7ff, alpha: 0.55 * p.dim * edge, cap: 'round' });
				gr.circle(xx, yy, r * 0.9);
				gr.fill({ color: 0xffffff, alpha: 0.7 * p.dim * edge });
			}
		}
	};

	// Impact flare ON TOP of the held symbol: a hot point where the beam strikes its upper edge,
	// with a tight lens streak and flickering micro-sparks — this is what sells "the laser is
	// hitting it".
	const drawFlare = (gr: G, t: number) => {
		gr.clear();
		if (!props.symbolKey) return;
		const s = props.symbolScale ?? 1;
		if (s < 0.05) return;
		const W = props.glassW;
		const flick = 0.75 + 0.25 * Math.sin(t * 11) * Math.sin(t * 4.3);
		// On the symbol's upper visual mass (not the bbox top — diagonal art left the flare
		// floating in air above the piece).
		const hy = bobY - symH * 0.25 * s;
		const r = W * 0.045 * s;
		// Horizontal lens streak.
		gr.ellipse(0, hy, r * 4.2, r * 0.75);
		gr.fill({ color: 0x9fe4ff, alpha: 0.35 * flick });
		gr.ellipse(0, hy, r * 2.1, r * 0.55);
		gr.fill({ color: 0xffffff, alpha: 0.5 * flick });
		// Hot core.
		gr.circle(0, hy, r);
		gr.fill({ color: 0xffffff, alpha: 0.85 * flick });
		// Micro-sparks kicked off the contact point, re-jittered each frame.
		for (let i = 0; i < 3; i++) {
			const a = Math.PI * (1.15 + 0.7 * ((i + 1) / 4)) + (Math.random() - 0.5) * 0.5;
			const len = r * (1.8 + Math.random() * 2.2);
			gr.moveTo(0, hy);
			gr.lineTo(Math.cos(a) * len, hy + Math.sin(a) * len * 0.6);
			gr.stroke({ width: r * 0.22, color: 0xdff4ff, alpha: 0.5 * flick, cap: 'round' });
		}
	};

	$effect(() => {
		let raf = 0;
		const t0 = performance.now();
		const tick = (now: number) => {
			raf = requestAnimationFrame(tick);
			const t = (now - t0) / 1000;
			// Suspended-in-the-field float ("too static", user): two stacked sine drifts per axis
			// so the path never repeats visibly, a slow breathing scale, a constant micro-vibration
			// (the energy hum) and a periodic surge shove from the beam.
			surge = Math.max(0, Math.sin(t * 1.8 + 0.6)) ** 12;
			const humX = (Math.random() - 0.5) * props.glassW * 0.004;
			const humY = (Math.random() - 0.5) * props.glassW * 0.003;
			bobY =
				props.glassH * (0.02 * Math.sin(t * 0.9) + 0.007 * Math.sin(t * 2.3 + 1.7)) +
				props.glassH * 0.012 * surge +
				humY;
			bobX = props.glassW * 0.02 * Math.sin(t * 0.62 + 0.5) + humX;
			bobRot = 0.07 * Math.sin(t * 0.55 + 1.3) + 0.022 * Math.sin(t * 1.9);
			breathe = 1 + 0.03 * Math.sin(t * 1.5 + 0.8) + 0.05 * surge;
			// Same flicker the beam body uses, so the symbol pulses in lock-step with the light.
			const beamFlick = 0.5 + 0.5 * Math.sin(t * 6.7) * Math.sin(t * 2.3);
			litAlpha = 0.1 + 0.11 * beamFlick + 0.3 * surge;
			rimAlpha = 0.14 + 0.12 * Math.sin(t * 3.1) ** 2 + 0.34 * surge;
			if (backG?.destroyed) backG = null;
			if (flareG?.destroyed) flareG = null;
			if (backG) drawBack(backG, t);
			if (flareG) drawFlare(flareG, t);
		};
		raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
	});
</script>

<Container x={props.x ?? 0} y={props.y ?? 0} alpha={props.alpha ?? 1} zIndex={props.zIndex}>
	<Graphics blendMode="add" draw={(gr) => (backG = gr as unknown as G)} />
	{#if props.symbolKey}
		<Container
			x={bobX}
			y={bobY}
			rotation={bobRot + (props.symbolRotation ?? 0)}
			scale={(props.symbolScale ?? 1) * breathe}
		>
			<!-- Rim: the same art a touch larger and additive, so the beam wraps the silhouette in a
			     cyan edge instead of stopping dead at it. -->
			<Sprite
				key={props.symbolKey}
				anchor={0.5}
				width={symW * 1.07}
				height={symH * 1.07}
				blendMode="add"
				tint={0x4fc8ff}
				alpha={rimAlpha}
			/>
			<Sprite key={props.symbolKey} anchor={0.5} width={symW} height={symH} />
			<!-- Lit pass: an additive copy of the piece itself, so only ITS pixels brighten as the
			     beam pulses — a glow quad would have lit the empty glass around it too. -->
			<Sprite
				key={props.symbolKey}
				anchor={0.5}
				width={symW}
				height={symH}
				blendMode="add"
				tint={0xaee6ff}
				alpha={litAlpha}
			/>
		</Container>
	{/if}
	<Graphics blendMode="add" draw={(gr) => (flareG = gr as unknown as G)} />
</Container>
