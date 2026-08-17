<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';

	import { Container } from 'pixi-svelte';

	type Props = {
		trigger: number;
		x: number;
		y: number;
		durationMs: number;
		children: Snippet;
	};

	const props: Props = $props();
	const scaleX = new Tween(1);
	const scaleY = new Tween(1);
	let run = 0;
	let seenTrigger = props.trigger;

	const play = async () => {
		const id = ++run;
		const stretchMs = props.durationMs * 0.46;
		const settleMs = props.durationMs - stretchMs;
		// Reel is already at its lowest physical overshoot when `bouncing` begins. Squash there,
		// then stretch while the reel itself rises. No second Y offset fighting the reel motion.
		scaleX.set(1.075, { duration: 0 });
		scaleY.set(0.9, { duration: 0 });
		await Promise.all([
			scaleX.set(0.985, { duration: stretchMs, easing: cubicOut }),
			scaleY.set(1.045, { duration: stretchMs, easing: cubicOut }),
		]);
		if (id !== run) return;
		await Promise.all([
			scaleX.set(1, { duration: settleMs, easing: cubicOut }),
			scaleY.set(1, { duration: settleMs, easing: cubicOut }),
		]);
	};

	$effect(() => {
		const trigger = props.trigger;
		if (trigger === seenTrigger) return;
		seenTrigger = trigger;
		if (trigger > 0) void play();
	});
</script>

<!-- Counter-translate the absolute-positioned symbol. Scale now pivots on its own cell centre,
     never on the board origin. -->
<Container x={props.x} y={props.y} scale={{ x: scaleX.current, y: scaleY.current }}>
	<Container x={-props.x} y={-props.y}>
		{@render props.children()}
	</Container>
</Container>
