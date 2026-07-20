<script lang="ts">
	import { Container, Sprite } from 'pixi-svelte';
	import { Tween } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';

	import type { Reel } from '../game/stateGame.svelte';
	import { SYMBOL_W, SYMBOL_SIZE, BOARD_SIZES, BOARD_GRID_OFFSET_Y } from '../game/constants';
	import { getContext } from '../game/context';

	type Props = {
		reel: Reel;
		oncomplete: () => void;
	};

	const props: Props = $props();
	const context = getContext();

	// Match the reel's per-axis scaling (boardScaleX/Y) so the vine lines up with the reel column
	// width/height — the reels are NOT scaled by the uniform boardScale in landscape/desktop.
	const bl = $derived(context.stateGameDerived.boardLayout());
	const scaleX = $derived(bl.boardScaleX ?? bl.boardScale);
	const scaleY = $derived(bl.boardScaleY ?? bl.boardScale);

	// Stretches the frame's bottom edge down to the board's bottom; the container y compensates by
	// half so the TOP edge stays put.
	const EXTEND_B = SYMBOL_SIZE * 0.17;

	// Show / hide like the old spine: fade IN on appear, fade OUT when the reel stops → oncomplete.
	const fade = new Tween(0, { duration: 220, easing: cubicOut });
	fade.set(1);

	// Gentle pulse while the reel anticipates.
	let clock = $state(0);
	$effect(() => {
		let raf = 0;
		const t0 = performance.now();
		const tick = (now: number) => {
			clock = (now - t0) / 1000;
			raf = requestAnimationFrame(tick);
		};
		raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
	});
	const pulse = $derived(1 + 0.012 * Math.sin(clock * 5));
	const glow = $derived(0.85 + 0.15 * Math.abs(Math.sin(clock * 5)));

	let stopped = $state(false);
	$effect(() => {
		if (props.reel.reelState.motion === 'stopped' && !stopped) {
			stopped = true;
			fade.set(0, { duration: 240 }).then(() => props.oncomplete());
		}
	});

	context.eventEmitter.subscribeOnMount({
		// Press during anticipation: force-stop the reel (works even for noStop/anticipated reels)
		stopButtonClick: () => {
			props.reel.forceStop();
			props.oncomplete();
		},
	});
</script>

<Container
	x={bl.x + ((props.reel.reelIndex + 0.5) * SYMBOL_W - BOARD_SIZES.width * 0.5) * scaleX}
	y={bl.y + BOARD_GRID_OFFSET_Y + (EXTEND_B * 0.5 - SYMBOL_SIZE * 0.12) * scaleY}
>
	<!-- Bamboo/vine column frame (Figma 2145-328) replaces the old spine anticipation glow. -->
	<Sprite
		key="expandedFrame"
		anchor={0.5}
		width={SYMBOL_W * scaleX * 1.2 * pulse}
		height={(BOARD_SIZES.height * 1.12 + EXTEND_B) * scaleY * pulse}
		alpha={fade.current * glow}
	/>
</Container>
