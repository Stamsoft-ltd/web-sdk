<script lang="ts">
	import { Container, Rectangle } from 'pixi-svelte';

	import type { Reel } from '../game/stateGame.svelte';
	import { getContext } from '../game/context';
	import { SYMBOL_WIDTH, SYMBOL_SIZE, BOARD_DIMENSIONS } from '../game/constants';

	type Props = {
		reel: Reel;
		reelIndex: number;
		oncomplete: () => void;
	};

	const props: Props = $props();
	const context = getContext();
	const board = $derived(context.stateGameDerived.boardLayout());

	// The old per-reel mining/lava SPINE was removed; the anticipation now frames the slowing reel with
	// a 3-layer gold/red border (outer #8F5409 6px → #EAB062 3px → inner #D11213 1px) that pulses while
	// the reel is still spinning toward the bonus wheel. Lifecycle is kept: clear `anticipating` once
	// the reel stops (which also stops the anticipation sound in Anticipations.svelte).
	$effect(() => {
		if (props.reel.reelState.motion === 'stopped') props.oncomplete();
	});

	// Pulse the border (glow in/out) so the slowing reel draws the eye just before the wheel lands.
	let clock = $state(0);
	$effect(() => {
		let raf = 0;
		const loop = (ts: number) => {
			clock = ts;
			raf = requestAnimationFrame(loop);
		};
		raf = requestAnimationFrame(loop);
		return () => cancelAnimationFrame(raf);
	});
	const pulse = $derived((1 - Math.cos(clock / 130)) / 2); // 0 → 1 → 0, ~0.8s period
	const glow = $derived(0.6 + 0.4 * pulse);

	const colX = $derived(props.reelIndex * SYMBOL_WIDTH);
	const colH = SYMBOL_SIZE * BOARD_DIMENSIONS.y;
</script>

<!-- Framed in board-space (mirrors LockedCells): local (0,0) is the top-left of the reel grid. -->
<Container x={board.x} y={board.y} pivot={board.pivot} zIndex={6} alpha={glow}>
	<!-- Outer brown (6px) -->
	<Rectangle
		x={colX - 6.5}
		y={-6.5}
		width={SYMBOL_WIDTH + 13}
		height={colH + 13}
		borderRadius={8}
		backgroundAlpha={0}
		borderColor={0x8f5409}
		borderWidth={6}
	/>
	<!-- Middle gold (3px) -->
	<Rectangle
		x={colX - 2}
		y={-2}
		width={SYMBOL_WIDTH + 4}
		height={colH + 4}
		borderRadius={5}
		backgroundAlpha={0}
		borderColor={0xeab062}
		borderWidth={3}
	/>
	<!-- Inner red (1px) -->
	<Rectangle
		x={colX}
		y={0}
		width={SYMBOL_WIDTH}
		height={colH}
		borderRadius={3}
		backgroundAlpha={0}
		borderColor={0xd11213}
		borderWidth={1}
	/>
</Container>
