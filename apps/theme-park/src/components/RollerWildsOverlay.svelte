<script lang="ts" module>
	import type { RollerReel } from '../game/types';

	export type EmitterEventRollerWilds =
		| { type: 'rollerWildsShow'; reels: RollerReel[] }
		| { type: 'rollerWildsHide' };
</script>

<script lang="ts">
	import { Tween } from 'svelte/motion';
	import { cubicIn, cubicOut } from 'svelte/easing';
	import { BitmapText, Container, Sprite, SpriteSheet } from 'pixi-svelte';
	import { MainContainer } from 'components-layout';
	import { waitForTimeout } from 'utils-shared/wait';

	import { getContext } from '../game/context';
	import { SYMBOL_W, SYMBOL_H, BOARD_DIMENSIONS, BOARD_GRID_OFFSET_Y } from '../game/constants';

	const context = getContext();
	const layout = $derived(context.stateGameDerived.boardLayout());

	let transformed = $state<RollerReel[]>([]);
	let current = $state<RollerReel | null>(null);
	const carY = new Tween(-SYMBOL_H * 1.4);
	const impactScale = new Tween(0.35);

	context.eventEmitter.subscribeOnMount({
		rollerWildsShow: async (event) => {
			transformed = [];
			current = null;
			for (const reel of event.reels) {
				current = reel;
				carY.set(-SYMBOL_H * 1.4, { duration: 0 });
				impactScale.set(0.35, { duration: 0 });
				await carY.set(SYMBOL_H * 2.5, { duration: 330, easing: cubicIn });
				context.eventEmitter.broadcast({
					type: 'soundOnce',
					name: 'sfx_reel_stop_2',
					forcePlay: true,
				});
				transformed = [...transformed, reel];
				await impactScale.set(1.16, { duration: 230, easing: cubicOut });
				await impactScale.set(1, { duration: 150, easing: cubicOut });
			}
			current = null;
			await waitForTimeout(350);
			transformed = [];
		},
		rollerWildsHide: () => {
			transformed = [];
			current = null;
		},
	});

	const cellX = (reel: number) => SYMBOL_W * (reel + 0.5);
	const cellY = (row: number) => SYMBOL_H * (row + 0.5);
	const rowMultiplier = (roller: RollerReel, row: number) =>
		roller.multipliers.find((entry) => entry.row === row)?.multiplier;
</script>

{#if current || transformed.length}
	<MainContainer>
		<Container
			x={layout.x}
			y={layout.y + BOARD_GRID_OFFSET_Y}
			pivot={layout.pivot}
			scale={layout.boardScale}
		>
			{#if current}
				<!-- Temporary Forest-style travelling presenter; final coaster art can replace H1. -->
				<Container x={cellX(current.reel)} y={carY.current}>
					<Sprite key="tp_h1.png" anchor={0.5} width={SYMBOL_W * 1.05} height={SYMBOL_H * 0.82} />
					{#if current.multipliers.length > 0}
						<BitmapText
							anchor={{ x: 0.5, y: 0.5 }}
							y={SYMBOL_H * 0.42}
							text={`x${current.multiplier}`}
							style={{ fontFamily: 'gold', fontSize: SYMBOL_H * 0.22 }}
						/>
					{/if}
				</Container>
			{/if}

			{#each transformed as roller (roller.reel)}
				{#each Array.from({ length: BOARD_DIMENSIONS.y }, (_, row) => row) as row (row)}
					<Container
						x={cellX(roller.reel)}
						y={cellY(row)}
						scale={current?.reel === roller.reel ? impactScale.current : 1}
					>
						<!-- The board still shows only the trigger Wild while this animation
						     runs. This asset-backed layer presents the full transformation. -->
						<Sprite
							key="lockedCellWin"
							anchor={0.5}
							width={SYMBOL_W * 0.98}
							height={SYMBOL_H * 0.98}
						/>
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
						{@const multiplier = rowMultiplier(roller, row)}
						{#if multiplier}
							<Container x={SYMBOL_W * 0.25} y={-SYMBOL_H * 0.29}>
								<Sprite
									key="forestBonusBadge"
									anchor={0.5}
									width={SYMBOL_W * 0.46}
									height={SYMBOL_H * 0.3}
								/>
								<BitmapText
									anchor={{ x: 0.5, y: 0.5 }}
									text={`x${multiplier}`}
									style={{ fontFamily: 'gold', fontSize: SYMBOL_H * 0.16 }}
								/>
							</Container>
						{/if}
					</Container>
				{/each}
			{/each}
		</Container>
	</MainContainer>
{/if}
