<script lang="ts">
	import { onMount } from 'svelte';
	import { Container, Sprite, PIXI } from 'pixi-svelte';

	import type { Reel } from '../game/stateGame.svelte';
	import { CELL_W, BOARD_SIZES, BOARD_GRID_OFFSET_Y } from '../game/constants';
	import { getContext } from '../game/context';

	type Props = { reel: Reel; oncomplete: () => void };
	const props: Props = $props();
	const context = getContext();
	const board = $derived(context.stateGameDerived.boardLayout());

	// ── Marquee strips ───────────────────────────────────────────────────────────────────────────
	//
	// The anticipating reel is framed by a pair of vertical bulb strips sitting on its column
	// borders, pulsing between warm amber and full white — the park's marquee lights picking out
	// the reel everyone is waiting on. This replaced the Forest Gang leaf-and-beam Spine, so the
	// intro/loop/out lifecycle survives as a plain alpha envelope: fade in, blink while the reel
	// spins, fade out once it stops.

	/** The strip art is 29x488 (12 bulbs cut from the board pad's rail — see assets.ts); stretched
	 * to the grid's height it keeps its own aspect for width, which lands the rendered bulb size
	 * and spacing on the frame's own. */
	const STRIP_ASPECT = 29 / 488;
	const stripHeight = BOARD_SIZES.height;
	const stripWidth = stripHeight * STRIP_ASPECT;
	/** Whole-strip pulse rate. Fast enough to read as blinking, slow enough not to strobe. */
	const BLINK_HZ = 3.1;
	const FADE_IN_S = 0.2;
	const FADE_OUT_S = 0.25;
	/** The dim half of the pulse. NEUTRAL, because the strip's bulbs are multicoloured — a tinted
	 * dim (the old amber) multiplies into the art and turns the blue and green bulbs muddy. */
	const DIM = { r: 0x82, g: 0x82, b: 0x82 };

	let completed = false;
	const complete = () => {
		if (completed) return;
		completed = true;
		props.oncomplete();
	};

	let fading = $state<'in' | 'out'>('in');
	let alpha = $state(0);
	let time = $state(0);

	onMount(() => {
		if (context.stateGame.anticipationSkipped) {
			props.reel.forceStop();
			complete();
		}
	});

	$effect(() => {
		if (props.reel.reelState.motion === 'stopped') fading = 'out';
	});

	context.eventEmitter.subscribeOnMount({
		stopButtonClick: () => {
			context.stateGame.anticipationSkipped = true;
			props.reel.forceStop();
			complete();
		},
	});

	// Driven off the application ticker for the same reason as <PaylineRibbon>: a private rAF would
	// run at panel rate, out of phase with the frames <SceneAnimationDriver> actually renders.
	$effect(() => {
		const app = context.stateApp.pixiApplication;
		if (!app) return;

		const tick = () => {
			const dt = app.ticker.deltaMS / 1000;
			time += dt;
			if (fading === 'in') {
				alpha = Math.min(1, alpha + dt / FADE_IN_S);
			} else {
				alpha = Math.max(0, alpha - dt / FADE_OUT_S);
				if (alpha === 0) complete();
			}
		};

		app.ticker.add(tick, null, PIXI.UPDATE_PRIORITY.HIGH);
		return () => app.ticker.remove(tick, null);
	});

	// The blink is a tint, not an alpha: the bars stay solid while their light swells from dimmed to
	// full, which is how a real marquee reads (the bulb never vanishes, its glow does the work).
	const tint = $derived.by(() => {
		const t = 0.5 + 0.5 * Math.sin(time * Math.PI * 2 * BLINK_HZ);
		const r = Math.round(DIM.r + (0xff - DIM.r) * t);
		const g = Math.round(DIM.g + (0xff - DIM.g) * t);
		const b = Math.round(DIM.b + (0xff - DIM.b) * t);
		return (r << 16) | (g << 8) | b;
	});
</script>

<Container
	x={board.x + ((props.reel.reelIndex + 0.5) * CELL_W - BOARD_SIZES.width * 0.5) * board.boardScale}
	y={board.y + BOARD_GRID_OFFSET_Y}
	{alpha}
>
	<!-- One strip either side of the column, INSIDE its borders — the bars frame the symbols with a
	     small gap to the grid line, per the design mocks, rather than straddling the line itself.
	     The SAME inset on every reel: the edge reels used to sink theirs 18px deep so the old thin
	     strip cleared the frame's rounded rail, which read as the strips hugging the symbols on
	     reels 1 and 5 while sitting on the grid lines elsewhere. The rail-matched strip art can
	     sit beside the frame rail, so the special case is gone. -->
	{#each [-1, 1] as side (side)}
		{@const offset = CELL_W * 0.5 - stripWidth * 0.5 - 6}
		<Sprite
			key="anticipationStrip"
			anchor={0.5}
			x={side * offset * board.boardScale}
			width={stripWidth * board.boardScale}
			height={stripHeight * board.boardScale}
			{tint}
		/>
	{/each}
</Container>
