<script lang="ts">
	import { untrack } from 'svelte';
	import { Container, Graphics } from 'pixi-svelte';
	import { stateBet } from 'state-shared';

	import { boardShake } from '../game/boardShake.svelte';
	import { getContext } from '../game/context';
	import {
		BOARD_DIMENSIONS,
		BOARD_GRID_OFFSET_Y,
		BOARD_SIZES,
		CELL_W,
		SPIN_OPTIONS_DEFAULT,
	} from '../game/constants';
	import Anticipation from './Anticipation.svelte';

	const context = getContext();
	const MAX_SCATTERS = 3;
	const layout = $derived(context.stateGameDerived.boardLayout());
	const hasAnticipation = $derived(
		context.stateGame.scatterCounter < MAX_SCATTERS &&
			context.stateGame.board.some((reel) => reel.reelState.anticipating),
	);
	const anticipatingReels = $derived(
		new Set(
			context.stateGame.board
				.filter((reel) => reel.reelState.anticipating)
				.map((reel) => reel.reelIndex),
		),
	);
	const DIM_ALPHA = 0.34;
	const GRID_CLEARANCE = 1.5;
	const NORMAL_POST_CAP_SPIN_MS = 420;

	// Three scatters are the maximum. Once all three have landed, convert every remaining no-stop
	// reel back to a short normal landing, staggered by the regular reel-stop gap. Merely clearing
	// `anticipating` leaves the already-prepared 16x padding running and caused the final reels to
	// spin for several extra seconds.
	$effect(() => {
		if (context.stateGame.scatterCounter < MAX_SCATTERS) return;
		return untrack(() => {
			context.stateGame.hasAnticipationPending = false;
			const postCapSpinMs = stateBet.isTurbo || stateBet.isSuperTurbo ? 0 : NORMAL_POST_CAP_SPIN_MS;

			const remaining = context.stateGame.board.filter(
				(reel) => reel.reelState.motion === 'spinning',
			);
			const timers = remaining.map((reel, index) =>
				setTimeout(
					() => reel.releaseAnticipation(),
					postCapSpinMs + SPIN_OPTIONS_DEFAULT.reelSpinDelay * index,
				),
			);
			for (const reel of context.stateGame.board) {
				reel.reelState.anticipating = false;
			}

			return () => timers.forEach(clearTimeout);
		});
	});
</script>

{#if hasAnticipation}
	<!-- Hold focus on the active reel. Straight cell-interior scrims preserve the authored grid and
	     disappear beneath its real top/bottom border; rounded fake panels caused visible end gaps. -->
	<Container
		x={layout.x + boardShake.x}
		y={layout.y + BOARD_GRID_OFFSET_Y + boardShake.y}
		pivot={layout.pivot}
		scale={layout.boardScale}
	>
		{#key [...anticipatingReels].join(',')}
			<Graphics
				alpha={DIM_ALPHA}
				draw={(graphics) => {
					graphics.clear();
					for (let reel = 0; reel < BOARD_DIMENSIONS.x; reel += 1) {
						if (anticipatingReels.has(reel)) continue;
						graphics
							.rect(
								reel * CELL_W + GRID_CLEARANCE,
								GRID_CLEARANCE,
								CELL_W - GRID_CLEARANCE * 2,
								BOARD_SIZES.height - GRID_CLEARANCE * 2,
							)
							.fill(0x05000f);
					}
				}}
			/>
		{/key}
	</Container>
{/if}

{#each context.stateGame.board as reel (reel.reelIndex)}
	{#if reel.reelState.anticipating}
		<Anticipation {reel} oncomplete={() => (reel.reelState.anticipating = false)} />
	{/if}
{/each}
