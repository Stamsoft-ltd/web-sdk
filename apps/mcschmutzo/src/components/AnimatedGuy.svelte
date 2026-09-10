<script lang="ts">
	import { Sprite } from 'pixi-svelte';

	// A chef that stands still while his eyes move: a base sprite (pupils removed, sclera filled) with
	// the pupils as separate sprites that glance around realistically — mostly held, with occasional
	// quick saccades (no separate eye art, so it's the extracted pupils being nudged within the eye).

	type Pupil = { key: string; nx: number; ny: number; nw: number; nh: number };
	type Props = {
		baseKey: string;
		x: number;
		y: number;
		width: number;
		height: number;
		zIndex?: number;
		pupils: Pupil[];
	};
	const props: Props = $props();

	const PERIOD = 5600; // ms per glance cycle
	let clock = $state(0);
	$effect(() => {
		let raf = 0;
		let start = 0;
		const loop = (ts: number) => {
			if (!start) start = ts;
			clock = ts - start;
			raf = requestAnimationFrame(loop);
		};
		raf = requestAnimationFrame(loop);
		return () => cancelAnimationFrame(raf);
	});

	// Keyframed glance (offset as a fraction of the figure w/h). Long holds, fast transitions =
	// saccades. Small amplitudes so the pupils stay within the sclera.
	const KF = [
		{ t: 0.0, x: 0, y: 0 },
		{ t: 0.4, x: 0, y: 0 },
		{ t: 0.45, x: 0.016, y: -0.006 }, // quick glance right/up
		{ t: 0.66, x: 0.016, y: -0.006 },
		{ t: 0.71, x: 0.007, y: 0.007 }, // glance down a touch
		{ t: 0.9, x: 0.007, y: 0.007 },
		{ t: 0.95, x: 0, y: 0 },
		{ t: 1.0, x: 0, y: 0 },
	];
	const glance = $derived.by(() => {
		const f = (clock % PERIOD) / PERIOD;
		for (let i = 0; i < KF.length - 1; i++) {
			if (f >= KF[i].t && f <= KF[i + 1].t) {
				const u = (f - KF[i].t) / (KF[i + 1].t - KF[i].t);
				const s = u * u * (3 - 2 * u); // smoothstep
				return { x: KF[i].x + (KF[i + 1].x - KF[i].x) * s, y: KF[i].y + (KF[i + 1].y - KF[i].y) * s };
			}
		}
		return { x: 0, y: 0 };
	});

	const left = $derived(props.x - props.width / 2);
	const top = $derived(props.y - props.height / 2);
	const z = $derived(props.zIndex ?? 0);
</script>

<Sprite
	key={props.baseKey}
	x={props.x}
	y={props.y}
	anchor={0.5}
	width={props.width}
	height={props.height}
	zIndex={z}
/>
{#each props.pupils as p (p.key)}
	<Sprite
		key={p.key}
		x={left + (p.nx + glance.x) * props.width}
		y={top + (p.ny + glance.y) * props.height}
		anchor={0.5}
		width={p.nw * props.width}
		height={p.nh * props.height}
		zIndex={z}
	/>
{/each}
