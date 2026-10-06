<script lang="ts" module>
	import type { RawSymbol, Position } from '../game/types';

	export type EmitterEventBoard =
		| { type: 'boardSettle'; board: RawSymbol[][] }
		| { type: 'boardShow' }
		| { type: 'boardHide' }
		| {
				type: 'boardWithAnimateSymbols';
				symbolPositions: Position[];
		  };
</script>

<script lang="ts">
	import { waitForResolve } from 'utils-shared/wait';
	import { BoardContext } from 'components-shared';

	import { getContext } from '../game/context';
	import { reelLanded } from '../game/stateGame.svelte';
	import { winFocus } from '../game/winFocus.svelte';
	import BoardContainer from './BoardContainer.svelte';
	import BoardMask from './BoardMask.svelte';
	import BoardBase from './BoardBase.svelte';

	const context = getContext();

	let show = $state(true);

	context.eventEmitter.subscribeOnMount({
		// Skip only the reels still to land in the current spin (moving, or waiting to start). A reel's
		// stop LATCHES when it isn't spinning (utils-shared interruptible: pendingInterrupt, cleared only
		// at the end of that reel's next spin) — so a skip pressed after reels 1–2 had already landed
		// made them snap to a stop on the NEXT spin (free spins / respins), and that spin looked as if it
		// started from reel 3. During the pre-spin (before the first reveal) every reel is stopped.
		stopButtonClick: () => {
			if (context.stateGame.awaitingFirstReveal) {
				context.stateGameDerived.enhancedBoard.stop();
				return;
			}
			context.stateGame.board.forEach((reel, i) => {
				if (reel.reelState.motion !== 'stopped' || !reelLanded[i]) reel.stop();
			});
		},
		boardSettle: ({ board }) => context.stateGameDerived.enhancedBoard.settle(board),
		boardShow: () => (show = true),
		boardHide: () => (show = false),
		boardWithAnimateSymbols: async ({ symbolPositions }) => {
			const getPromises = () =>
				symbolPositions.map(async (position) => {
					const reelSymbol = context.stateGame.board[position.reel].reelState.symbols[position.row];
					reelSymbol.symbolState = 'win';
					await waitForResolve((resolve) => (reelSymbol.oncomplete = resolve));
					reelSymbol.symbolState = 'postWinStatic';
				});

			await Promise.all(getPromises());
		},
	});

	context.stateGameDerived.enhancedBoard.readyToSpinEffect();

	// Win focus: dim the non-winning cells while win lines are on show (game/winFocus).
	$effect(() => {
		const on = context.stateGame.paylineWins.length > 0;
		winFocus.set(on ? 1 : 0, { duration: on ? 220 : 120 });
	});
</script>

{#if show}
	<BoardContext animate={false}>
		<BoardContainer>
			<BoardMask />
			<BoardBase />
		</BoardContainer>
	</BoardContext>

	<BoardContext animate={true}>
		<BoardContainer>
			<BoardBase />
		</BoardContainer>
	</BoardContext>
{/if}
