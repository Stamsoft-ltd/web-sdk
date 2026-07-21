<script lang="ts">
	import { Container, Sprite } from 'pixi-svelte';
	import { Tween } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';

	import type { Reel } from '../game/stateGame.svelte';
	import { SYMBOL_W, BOARD_SIZES, BOARD_GRID_OFFSET_Y } from '../game/constants';
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

	// Show / hide like the old spine: fade IN on appear, fade OUT when the reel stops → oncomplete.
	const fade = new Tween(0, { duration: 220, easing: cubicOut });
	fade.set(1);

	// Live clock driving the glow flicker + streak shimmer while the reel anticipates.
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
	// Two fast, out-of-phase flickers so the layered glow shimmers like fire rather than pulsing evenly.
	const flickA = $derived(0.7 + 0.5 * Math.abs(Math.sin(clock * 12)));
	const flickB = $derived(0.55 + 0.6 * Math.abs(Math.sin(clock * 17.3 + 1.3)));

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
	y={bl.y + BOARD_GRID_OFFSET_Y}
>
	<!-- Golden light column glow (anticipation_glow.webp) — additive, contained to the reel height so
	     it ends softly at the wooden borders. Two out-of-phase flickering layers for a fire shimmer. -->
	{@const GH = BOARD_SIZES.height * 1.03 * scaleY}
	<Sprite
		key="anticipationGlow"
		anchor={0.5}
		width={SYMBOL_W * scaleX * 1.62}
		height={GH}
		alpha={fade.current * flickA}
		blendMode="add"
	/>
	<Sprite
		key="anticipationGlow"
		anchor={0.5}
		width={SYMBOL_W * scaleX * 1.15}
		height={GH}
		alpha={fade.current * flickB}
		blendMode="add"
	/>
</Container>
