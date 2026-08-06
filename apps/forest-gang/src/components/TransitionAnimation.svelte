<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';

	import { Rectangle, SpineProvider, SpineTrack } from 'pixi-svelte';
	import { getContext } from '../game/context';

	type Props = {
		oncover: () => void;
		ondone: () => void;
	};

	const props: Props = $props();
	const context = getContext();
	const canvas = $derived(context.stateLayoutDerived.canvasSizes());

	// Themed transition: the forest-leaves spine wipe (~1.7s one-shot) plays over a dark veil. The
	// veil is what guarantees full coverage for the background/state swap at its midpoint — the spine
	// is decoration on top, so a not-yet-loaded spine (it's in the deferred pass) degrades gracefully
	// to the previous plain fade. Rendered last in the scene graph (see Game.svelte) so it sits above
	// the reels, board and win panels.
	const hasSpine = !!context.stateApp.loadedAssets?.transition;
	const veil = new Tween(0, { duration: 320, easing: cubicInOut });

	let spineDone = $state(!hasSpine);
	let veilDone = $state(false);

	// ondone once BOTH the veil reveal and the spine wipe have finished (either can end last).
	$effect(() => {
		if (spineDone && veilDone) props.ondone();
	});

	// Failsafe: the wipe is ~1.7s — if its complete listener never fires, don't leave the overlay
	// mounted (and the game stuck in `transitioning`) forever. It is deliberately NOT cleared when
	// the veil finishes — the veil ends before the spine, so the failsafe must outlive it; a late
	// fire after normal completion is a harmless duplicate state write. Unmount does clear it.
	let failsafe: ReturnType<typeof setTimeout>;
	onDestroy(() => clearTimeout(failsafe));

	onMount(async () => {
		failsafe = setTimeout(() => (spineDone = true), 2500);
		await veil.set(1, { duration: 550 }); // cover under the wipe's build-up
		props.oncover(); // swap bg / bonus state while fully covered
		await new Promise((resolve) => setTimeout(resolve, 140)); // brief hold
		await veil.set(0, { duration: 640 }); // reveal
		veilDone = true;
	});
</script>

<Rectangle {...canvas} backgroundColor={0x08120a} alpha={veil.current} />
{#if hasSpine}
	<SpineProvider
		key="transition"
		x={canvas.width * 0.5}
		y={canvas.height * 0.5}
		height={canvas.height * 1.7}
	>
		<SpineTrack
			trackIndex={0}
			animationName={'animation'}
			listener={{
				complete: () => (spineDone = true),
			}}
		/>
	</SpineProvider>
{/if}
