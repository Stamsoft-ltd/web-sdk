<script lang="ts">
	import { Graphics, Sprite } from 'pixi-svelte';

	type Props = {
		/** The portrait background sprite's cover rect (canvas px): its centre + size. */
		cx: number;
		cy: number;
		width: number;
		height: number;
	};
	const props: Props = $props();

	// The pendant lamp painted into background-portrait.webp (941×1672), lit for real: a hot halo
	// round the bulb, a soft glow under the shade, the beam (lamp-beam.webp, scripts/build-lamp-beam.py)
	// laid ADDITIVELY over the painted one, and dust drifting in it. The light breathes faintly and the
	// filament stutters now and then (a quick dip-and-catch), so the whole wall reads as lit by it.
	const IMG = { w: 941, h: 1672 };
	const BULB = { x: 133, y: 122, r: 24 };
	const RIM = { x: 135, y: 142, w: 205 };
	const BEAM = { x: -40, y: 136, w: 640, h: 520 }; // = build-lamp-beam.py's rect

	const k = $derived(props.width / IMG.w);
	const X = (v: number) => props.cx + (v - IMG.w / 2) * k;
	const Y = (v: number) => props.cy + (v - IMG.h / 2) * k;

	let clock = $state(0);
	$effect(() => {
		let raf = 0;
		const loop = (ts: number) => {
			clock = ts;
			raf = requestAnimationFrame(loop);
		};
		raf = requestAnimationFrame(loop);
		return () => cancelAnimationFrame(raf);
	});

	// Filament: steady with a slow breath; every ~8.5s a short stutter (dip, catch, smaller dip).
	const STUTTER = [
		[0, 1],
		[60, 0.55],
		[110, 0.95],
		[170, 0.7],
		[260, 1],
	] as const;
	const level = $derived.by(() => {
		const breath = 0.95 + 0.05 * Math.sin(clock / 1300) * Math.sin(clock / 2900 + 1);
		const t = clock % 8500;
		let dip = 1;
		for (let i = 1; i < STUTTER.length; i++) {
			const [t0, v0] = STUTTER[i - 1];
			const [t1, v1] = STUTTER[i];
			if (t >= t0 && t < t1) dip = v0 + ((t - t0) / (t1 - t0)) * (v1 - v0);
		}
		return breath * dip;
	});

	// Dust in the beam: slow drift down-right with a lazy sway, brightest near the lamp.
	const MOTES = Array.from({ length: 16 }, (_, i) => {
		const h = (n: number) => {
			const s = Math.sin(i * 127.1 + n * 311.7) * 43758.5453;
			return s - Math.floor(s);
		};
		return { u: h(1), v: h(2), sp: 0.006 + 0.008 * h(3), ph: h(4) * 6.28, r: 0.9 + 1.4 * h(5) };
	});
	const drawMotes = (g: any) => {
		g.clear();
		for (const m of MOTES) {
			const v = (m.v + (clock / 1000) * m.sp) % 1; // down the beam
			const t = 0.08 + 0.8 * v;
			// across the cone (same edges as the baked beam), swaying
			const left = 40 - 60 * t;
			const right = 232 + 360 * t;
			const ix = left + (right - left) * (0.15 + 0.7 * m.u) + 14 * Math.sin(clock / 2400 + m.ph);
			const iy = BEAM.y + BEAM.h * t;
			const fade = Math.sin(Math.PI * v) * (1 - t) * level;
			g.circle(X(ix), Y(iy), m.r * k * 2.2).fill({ color: 0xfff1d0, alpha: 0.5 * fade });
		}
	};
</script>

<!-- the beam over the painted one -->
<Sprite
	key="lampBeam"
	x={X(BEAM.x)}
	y={Y(BEAM.y)}
	width={BEAM.w * k}
	height={BEAM.h * k}
	alpha={0.26 * level}
	blendMode="add"
	zIndex={-1.9}
/>
<Graphics draw={drawMotes} blendMode="add" zIndex={-1.89} />
<!-- the glow under the shade (lights its inside + the wall right below) -->
<Sprite key="lampGlow" x={X(RIM.x)} y={Y(RIM.y + 18)} anchor={0.5} width={RIM.w * 1.5 * k} height={RIM.w * 0.75 * k} alpha={0.42 * level} blendMode="add" zIndex={-1.88} />
<!-- the bulb itself: a hot halo -->
<Sprite key="lampGlow" x={X(BULB.x)} y={Y(BULB.y)} anchor={0.5} width={BULB.r * 5 * k} height={BULB.r * 5 * k} alpha={0.75 * level} blendMode="add" zIndex={-1.87} />
