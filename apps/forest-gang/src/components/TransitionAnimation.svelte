<script lang="ts">
	import { onMount } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';

	import { Rectangle } from 'pixi-svelte';
	import { getContext } from '../game/context';

	type Props = {
		oncover: () => void;
		ondone: () => void;
	};

	const props: Props = $props();
	const context = getContext();
	const canvas = $derived(context.stateLayoutDerived.canvasSizes());

	// Alpha transition: fade a full-screen dark-forest veil IN to cover the scene, swap the
	// background/state while hidden, then fade it back OUT to reveal. Rendered last in the scene
	// graph (see Game.svelte) so it sits above the reels, board and win panels.
	const veil = new Tween(0, { duration: 320, easing: cubicInOut });

	onMount(async () => {
		await veil.set(1, { duration: 320 }); // cover
		props.oncover(); // swap bg / bonus state while fully covered
		await new Promise((resolve) => setTimeout(resolve, 140)); // brief hold
		await veil.set(0, { duration: 440 }); // reveal
		props.ondone();
	});
</script>

<Rectangle {...canvas} backgroundColor={0x08120a} alpha={veil.current} />
