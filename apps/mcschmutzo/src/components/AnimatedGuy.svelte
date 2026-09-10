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

	const PERIOD = 6500; // ms per glance cycle
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
	// saccades. Kept SMALL and mostly horizontal (never up, so the dot never hides under the brow) so
	// only the dark dot shifts a little — the face isn't disturbed.
	const KF = [
		{ t: 0.0, x: 0, y: 0 },
		{ t: 0.48, x: 0, y: 0 },
		{ t: 0.53, x: 0.0035, y: 0.001 }, // tiny glance right
		{ t: 0.73, x: 0.0035, y: 0.001 },
		{ t: 0.78, x: -0.0015, y: 0.0012 }, // tiny glance left
		{ t: 0.93, x: -0.0015, y: 0.0012 },
		{ t: 0.98, x: 0, y: 0 },
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
