<script lang="ts">
	import { Sprite } from 'pixi-svelte';

	// A chef built from a base sprite (pupils removed, sclera filled) plus the pupils as separate
	// sprites. The pupils are held STATIC at their neutral position — the glancing/saccade animation
	// was removed (it read as unnatural).

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
		x={left + p.nx * props.width}
		y={top + p.ny * props.height}
		anchor={0.5}
		width={p.nw * props.width}
		height={p.nh * props.height}
		zIndex={z}
	/>
{/each}
