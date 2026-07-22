<script lang="ts">
	import { onMount } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { Rectangle } from 'pixi-svelte';

	import { getContext } from '../game/context';

	type Props = { oncover: () => void; ondone: () => void };
	const props: Props = $props();
	const context = getContext();
	const canvas = $derived(context.stateLayoutDerived.canvasSizes());
	const veil = new Tween(0, { duration: 320, easing: cubicInOut });

	onMount(async () => {
		await veil.set(1, { duration: 320 });
		props.oncover();
		await new Promise((resolve) => setTimeout(resolve, 150));
		await veil.set(0, { duration: 440 });
		props.ondone();
	});
</script>

<Rectangle {...canvas} backgroundColor={0x21043b} alpha={veil.current} />
