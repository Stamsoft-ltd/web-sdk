<script lang="ts">
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { Rectangle } from 'pixi-svelte';
	import { OnMount } from 'components-shared';

	import { getContext } from '../game/context';

	type Props = {
		oncomplete: () => void;
	};

	const props: Props = $props();
	const context = getContext();
	const canvas = $derived(context.stateLayoutDerived.canvasSizes());

	// Clean fade wipe (replaces the mining-template rock/dust spine).
	const alpha = new Tween(0, { duration: 220, easing: cubicInOut });
</script>

<Rectangle {...canvas} backgroundColor={0x140a05} alpha={alpha.current} zIndex={100} />
<OnMount
	onmount={async () => {
		await alpha.set(1);
		await alpha.set(0);
		props.oncomplete();
	}}
/>
