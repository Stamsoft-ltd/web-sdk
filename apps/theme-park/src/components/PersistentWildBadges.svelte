<script lang="ts" module>
	import type { Position } from '../game/types';

	export type EmitterEventWildBadges = { type: 'wildBadgePulse'; position: Position };
</script>

<script lang="ts">
	import { onDestroy } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { BitmapText, Container, Sprite } from 'pixi-svelte';
	import { MainContainer } from 'components-layout';

	import { getContext } from '../game/context';
	import { CELL_W, SYMBOL_W, SYMBOL_H, BOARD_DIMENSIONS, BOARD_GRID_OFFSET_Y } from '../game/constants';
	import CoasterWildBackground from './CoasterWildBackground.svelte';
	import RollerMultiplierText from './RollerMultiplierText.svelte';

	const context = getContext();
	const layout = $derived(context.stateGameDerived.boardLayout());
	const coasterTiles = $derived(context.stateGame.coasterTiles);
	const rollerReels = $derived(context.stateGame.activeRollerReels);

	let pulsingKeys = $state<string[]>([]);
	const pulseTimers = new SvelteSet<ReturnType<typeof setTimeout>>();

	onDestroy(() => {
		pulseTimers.forEach(clearTimeout);
		pulseTimers.clear();
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

	const cellX = (reel: number) => CELL_W * (reel + 0.5);
	const cellY = (row: number) => SYMBOL_H * (row + 0.5);
	const cellPulse = (reel: number, row: number) =>
		pulsingKeys.includes(`${reel},${row}`) ? 1.14 : 1;
</script>

{#if coasterTiles.length > 0 || rollerReels.length > 0}
	<MainContainer>
		<Container
			x={layout.x}
			y={layout.y + BOARD_GRID_OFFSET_Y}
			pivot={layout.pivot}
			scale={layout.boardScale}
		>
			<!-- A roller reel persists as a wild reel with its combined multiplier shown ONCE at the
			     centre — not repeated on every cell (that read as five separate multipliers). -->
			{#each rollerReels as roller (roller.reel)}
				{#each Array.from({ length: BOARD_DIMENSIONS.y }, (_, row) => row) as row (row)}
					<Container x={cellX(roller.reel)} y={cellY(row)}>
						<CoasterWildBackground reel={roller.reel} {row} />
						{#if row === Math.floor(BOARD_DIMENSIONS.y / 2)}
							<RollerMultiplierText text={`${roller.multiplier}X`} />
						{/if}
					</Container>
				{/each}
			{/each}

			<!-- This layer always owns persistent Coaster Wilds. The exact board
			     crop masks the reel below; fixed sizing prevents non-paying pops. -->
			{#each coasterTiles as tile (`${tile.reel}-${tile.row}`)}
				<Container x={cellX(tile.reel)} y={cellY(tile.row)} scale={cellPulse(tile.reel, tile.row)}>
					<CoasterWildBackground reel={tile.reel} row={tile.row} />
					<Sprite
						key="tpCoasterWild"
						anchor={0.5}
						width={SYMBOL_W * 0.82}
						height={SYMBOL_H * 0.82}
					/>
					<Container y={SYMBOL_H * 0.18}>
						<BitmapText
							anchor={{ x: 0.5, y: 0.5 }}
							text={`${tile.multiplier}X`}
							style={{ fontFamily: 'gold', fontSize: SYMBOL_H * 0.22 }}
						/>
					</Container>
				</Container>
			{/each}
		</Container>
	</MainContainer>
{/if}
