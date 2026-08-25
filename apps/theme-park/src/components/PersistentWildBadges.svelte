<script lang="ts" module>
	import type { Position } from '../game/types';

	export type EmitterEventWildBadges = { type: 'wildBadgePulse'; position: Position };
</script>

<script lang="ts">
	import { onDestroy } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { Container, Graphics, PIXI } from 'pixi-svelte';
	import { MainContainer } from 'components-layout';

	import { getContext } from '../game/context';
	import { BOARD_GRID_OFFSET_Y, CELL_H, getBoardCellCenterX } from '../game/constants';
	import { getCoasterWildRect, toCoasterCellKeys } from '../game/coasterWildCells';
	import CoasterWildTile from './CoasterWildTile.svelte';

	const context = getContext();
	const layout = $derived(context.stateGameDerived.boardLayout());
	const coasterTiles = $derived(context.stateGame.coasterTiles);
	const hasWinState = $derived(
		context.stateGame.board.some((reel) =>
			reel.reelState.symbols.some((symbol) => symbol.symbolState === 'win'),
		),
	);
	const isCellWinning = (reel: number, row: number) =>
		context.stateGame.board[reel]?.reelState.symbols[row + 1]?.symbolState === 'win';
	const hasWinningCoasterTile = $derived(
		coasterTiles.some(({ reel, row }) => isCellWinning(reel, row)),
	);
	let winPulse = $state(1);

	let pulsingKeys = $state<string[]>([]);
	const pulseTimers = new SvelteSet<ReturnType<typeof setTimeout>>();

	onDestroy(() => {
		pulseTimers.forEach(clearTimeout);
		pulseTimers.clear();
	});

	$effect(() => {
		if (!hasWinningCoasterTile) {
			winPulse = 1;
			return;
		}

		const started = performance.now();
		let frame = 0;
		const tick = (now: number) => {
			winPulse = 1.05 + Math.sin((now - started) * 0.012) * 0.06;
			frame = requestAnimationFrame(tick);
		};
		frame = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(frame);
	});

	context.eventEmitter.subscribeOnMount({
		wildBadgePulse: ({ position }) => {
			const key = `${position.reel},${position.row}`;
			pulsingKeys = [...new Set([...pulsingKeys, key])];
			const timer = setTimeout(() => {
				pulsingKeys = pulsingKeys.filter((value) => value !== key);
				pulseTimers.delete(timer);
			}, 520);
			pulseTimers.add(timer);
		},
	});

	const cellX = getBoardCellCenterX;
	const cellY = (row: number) => CELL_H * (row + 0.5);
	const cellPulse = (reel: number, row: number) =>
		(pulsingKeys.includes(`${reel},${row}`) ? 1.14 : 1) * (isCellWinning(reel, row) ? winPulse : 1);
	const occupiedCells = $derived(toCoasterCellKeys(coasterTiles));
	// Same cell-cut pattern as Mega Wilds: the existing BoardFrame remains visible through every
	// divider and side rail while this later overlay supplies only Wild content. The cut follows the
	// Wilds actually on the board, so two neighbours share one opening and no reel scrolls between
	// them; the mask reads coasterTiles inside the draw call, so it is rebuilt as tiles land.
	const drawWildContentMask = (graphics: PIXI.Graphics) => {
		for (const { reel, row } of coasterTiles) {
			const { x, y, width, height } = getCoasterWildRect(reel, row, occupiedCells);
			graphics.rect(x, y, width, height);
		}
		graphics.fill(0xffffff);
	};
</script>

{#if coasterTiles.length > 0}
	<MainContainer>
		<Container
			x={layout.x}
			y={layout.y + BOARD_GRID_OFFSET_Y}
			pivot={layout.pivot}
			scale={layout.boardScale}
		>
			<Graphics isMask draw={drawWildContentMask} />
			<!-- This layer always owns persistent Coaster Wilds. The exact board
			     crop masks the reel below; fixed sizing prevents non-paying pops. -->
			{#each coasterTiles as tile (`${tile.reel}-${tile.row}`)}
				<Container
					x={cellX(tile.reel)}
					y={cellY(tile.row)}
					alpha={hasWinState && !isCellWinning(tile.reel, tile.row) ? 0.35 : 1}
				>
					<CoasterWildTile
						reel={tile.reel}
						row={tile.row}
						occupied={occupiedCells}
						multiplier={tile.multiplier}
						contentScale={cellPulse(tile.reel, tile.row)}
					/>
				</Container>
			{/each}
		</Container>
	</MainContainer>
{/if}
