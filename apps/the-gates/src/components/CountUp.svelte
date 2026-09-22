<script lang="ts">
	import { onMount } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';
	import { runtime } from '../game/playback.svelte';
	let { amount, format }: { amount: number; format: (amount: number) => string } = $props();
	const count = new Tween(0);
	let disposed = false;
	onMount(() => {
		runtime.counting = !runtime.reduced;
		count.set(amount, { duration: runtime.reduced ? 0 : 1050, easing: cubicOut }).then(() => {
			if (!disposed) runtime.counting = false;
		});
		return () => {
			disposed = true;
			runtime.counting = false;
			count.set(amount, { duration: 0 });
		};
	});
	$effect(() => {
		if (runtime.finishCount) {
			count.set(amount, { duration: runtime.reduced ? 0 : 120, easing: cubicOut }).then(() => {
				if (!disposed) runtime.counting = false;
			});
		}
	});
</script>

<strong class="win-amount" data-final-amount={amount} aria-label={format(amount)}
	>{format(count.current)}</strong
>
