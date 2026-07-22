<script lang="ts" module>
	import type { Position } from '../game/types';

	export type EmitterEventWildBadges = { type: 'wildBadgePulse'; position: Position };
</script>

<script lang="ts">
	import { onDestroy } from 'svelte';
	import { BitmapText, Container, Sprite, SpriteSheet } from 'pixi-svelte';
	import { MainContainer } from 'components-layout';

	import { getContext } from '../game/context';
	import { SYMBOL_W, SYMBOL_H, BOARD_DIMENSIONS, BOARD_GRID_OFFSET_Y } from '../game/constants';

	const context = getContext();
	const layout = $derived(context.stateGameDerived.boardLayout());
	const coasterTiles = $derived(context.stateGame.coasterTiles);
	const rollerReels = $derived(context.stateGame.activeRollerReels);

	let pulsingKeys = $state<string[]>([]);
	const pulseTimers = new Set<ReturnType<typeof setTimeout>>();

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

	const cellX = (reel: number) => SYMBOL_W * (reel + 0.5);
	const cellY = (row: number) => SYMBOL_H * (row + 0.5);
	const cellPulse = (reel: number, row: number) =>
		pulsingKeys.includes(`${reel},${row}`) ? 1.14 : 1;
	const boardShowsWild = (reel: number, row: number) =>
		context.stateGame.board[reel]?.reelState.symbols[row + 1]?.rawSymbol.name === 'W';
	const isAnyReelSpinning = $derived(
		context.stateGame.board.some((reel) => reel.reelState.motion !== 'stopped'),
	);

	const badgeW = SYMBOL_W * 0.46;
	const badgeH = SYMBOL_H * 0.3;
	const rollerRowMultiplier = (reel: number, row: number) =>
		rollerReels
			.find((roller) => roller.reel === reel)
			?.multipliers.find((entry) => entry.row === row)?.multiplier;
</script>

{#if coasterTiles.length > 0 || rollerReels.length > 0}
	<MainContainer>
		<Container
			x={layout.x}
			y={layout.y + BOARD_GRID_OFFSET_Y}
			pivot={layout.pivot}
			scale={layout.boardScale}
		>
			<!-- Roller: Board.svelte owns the five Wild symbols. This layer adds only
			     Magnetic lightning + Forest multiplier plaques, so nothing is drawn twice. -->
			{#each rollerReels as roller (roller.reel)}
				{#each Array.from({ length: BOARD_DIMENSIONS.y }, (_, row) => row) as row (row)}
					<Container x={cellX(roller.reel)} y={cellY(row)}>
						<SpriteSheet
							key="magneticWildLightning"
							play
							loop
							animationSpeed={0.23}
							blendMode="add"
							anchor={0.5}
							width={SYMBOL_W * 1.24}
							height={SYMBOL_H * 1.24}
						/>
						{@const multiplier = rollerRowMultiplier(roller.reel, row)}
						{#if multiplier}
							<Container x={SYMBOL_W * 0.26} y={-SYMBOL_H * 0.29}>
								<Sprite key="forestBonusBadge" anchor={0.5} width={badgeW} height={badgeH} />
								<BitmapText
									anchor={{ x: 0.5, y: 0.5 }}
									text={`x${multiplier}`}
									style={{ fontFamily: 'gold', fontSize: badgeH * 0.66 }}
								/>
							</Container>
						{/if}
					</Container>
				{/each}
			{/each}

			<!-- Coaster: Magnetic-style opaque asset covers exist only while the board
			     does not already show that Wild (setup / spinning). Settled Wilds remain
			     owned by the board, avoiding duplicate static symbols. -->
			{#each coasterTiles as tile (`${tile.reel}-${tile.row}`)}
				<Container x={cellX(tile.reel)} y={cellY(tile.row)} scale={cellPulse(tile.reel, tile.row)}>
					{#if isAnyReelSpinning || !boardShowsWild(tile.reel, tile.row)}
						<Sprite
							key="lockedCellWin"
							anchor={0.5}
							width={SYMBOL_W * 0.98}
							height={SYMBOL_H * 0.98}
						/>
						<Sprite
							key="tp_wild.png"
							anchor={0.5}
							width={SYMBOL_W * 0.82}
							height={SYMBOL_H * 0.82}
						/>
					{/if}
					<SpriteSheet
						key="magneticWildLightning"
						play
						loop
						animationSpeed={0.23}
						blendMode="add"
						anchor={0.5}
						width={SYMBOL_W * 1.24}
						height={SYMBOL_H * 1.24}
					/>
					<Container x={SYMBOL_W * 0.27} y={-SYMBOL_H * 0.3}>
						<Sprite key="forestBonusBadge" anchor={0.5} width={badgeW} height={badgeH} />
						<BitmapText
							anchor={{ x: 0.5, y: 0.5 }}
							text={`x${tile.multiplier}`}
							style={{ fontFamily: 'gold', fontSize: badgeH * 0.66 }}
						/>
					</Container>
				</Container>
			{/each}
		</Container>
	</MainContainer>
{/if}
