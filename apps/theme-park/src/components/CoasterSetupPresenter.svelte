<script lang="ts" module>
	export type EmitterEventCoasterSetup =
		| {
				type: 'coasterSetupShow';
				pukes: { reel: number; row: number; multiplier: number }[];
				tiles: { reel: number; row: number; multiplier: number }[];
		  }
		| { type: 'coasterSetupHide' };
</script>

<script lang="ts">
	import { Tween } from 'svelte/motion';
	import { cubicInOut, cubicOut } from 'svelte/easing';
	import { BitmapText, Container, Sprite, SpriteSheet } from 'pixi-svelte';
	import { CanvasSizeRectangle, MainContainer } from 'components-layout';
	import { FadeContainer } from 'components-pixi';
	import { waitForTimeout } from 'utils-shared/wait';

	import { getContext } from '../game/context';
	import { SYMBOL_W, SYMBOL_H, BOARD_SIZES, BOARD_GRID_OFFSET_Y } from '../game/constants';

	const context = getContext();
	const layout = $derived(context.stateGameDerived.boardLayout());
	let show = $state(false);
	let tilesMap = $state<Record<string, number>>({});
	let activeKey = $state<string | null>(null);
	let carVisible = $state(false);
	const carX = new Tween(BOARD_SIZES.width * 0.5);
	const carY = new Tween(-SYMBOL_H);
	const impactScale = new Tween(1);

	context.eventEmitter.subscribeOnMount({
		coasterSetupShow: async (event) => {
			show = true;
			tilesMap = {};
			activeKey = null;
			carVisible = true;
			carX.set(BOARD_SIZES.width * 0.5, { duration: 0 });
			carY.set(-SYMBOL_H, { duration: 0 });
			await waitForTimeout(450);

			for (const impact of event.pukes) {
				const targetX = SYMBOL_W * (impact.reel + 0.5);
				const targetY = SYMBOL_H * (impact.row + 0.5);
				await Promise.all([
					carX.set(targetX, { duration: 260, easing: cubicInOut }),
					carY.set(targetY, { duration: 260, easing: cubicInOut }),
				]);

				const key = `${impact.reel},${impact.row}`;
				activeKey = key;
				tilesMap = { ...tilesMap, [key]: impact.multiplier };
				impactScale.set(0.72, { duration: 0 });
				context.eventEmitter.broadcast({
					type: 'soundOnce',
					name: 'sfx_reel_stop_3',
					forcePlay: true,
				});
				await impactScale.set(1.24, { duration: 180, easing: cubicOut });
				await impactScale.set(1, { duration: 130, easing: cubicOut });
				activeKey = null;
			}

			carVisible = false;
			await waitForTimeout(700);
		},
		coasterSetupHide: () => {
			show = false;
			tilesMap = {};
			activeKey = null;
			carVisible = false;
		},
	});

	const cellX = (reel: number) => SYMBOL_W * (reel + 0.5);
	const cellY = (row: number) => SYMBOL_H * (row + 0.5);
	const parseKey = (key: string) => {
		const [reel, row] = key.split(',').map(Number);
		return { reel, row };
	};
	const titleY = $derived(layout.y - (layout.height / 2) * layout.boardScale - 48);
</script>

<FadeContainer {show}>
	<CanvasSizeRectangle backgroundColor={0x11021b} backgroundAlpha={0.72} />
	<MainContainer>
		<Container x={layout.x} y={titleY}>
			<Sprite
				key="forestBonusBadge"
				anchor={0.5}
				width={630}
				height={116}
			/>
			<BitmapText
				anchor={{ x: 0.5, y: 0.5 }}
				y={-15}
				text="MEGA COASTER SETUP"
				style={{ fontFamily: 'gold', fontSize: 28 }}
			/>
			<BitmapText
				anchor={{ x: 0.5, y: 0.5 }}
				y={18}
				text="LANDINGS LOCK MULTIPLIER WILDS"
				style={{ fontFamily: 'silver', fontSize: 17 }}
			/>
		</Container>

		<Container
			x={layout.x}
			y={layout.y + BOARD_GRID_OFFSET_Y}
			pivot={layout.pivot}
			scale={layout.boardScale}
		>
			{#each Object.entries(tilesMap) as [key, multiplier] (key)}
				{@const position = parseKey(key)}
				<Container
					x={cellX(position.reel)}
					y={cellY(position.row)}
					scale={activeKey === key ? impactScale.current : 1}
				>
					<Sprite
						key="lockedCellWin"
						anchor={0.5}
						width={SYMBOL_W * 0.98}
						height={SYMBOL_H * 0.98}
					/>
					<Sprite key="tp_wild.png" anchor={0.5} width={SYMBOL_W * 0.82} height={SYMBOL_H * 0.82} />
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
						<Sprite
							key="forestBonusBadge"
							anchor={0.5}
							width={SYMBOL_W * 0.46}
							height={SYMBOL_H * 0.3}
						/>
						<BitmapText
							anchor={{ x: 0.5, y: 0.5 }}
							text={`x${multiplier}`}
							style={{ fontFamily: 'gold', fontSize: SYMBOL_H * 0.17 }}
						/>
					</Container>
				</Container>
			{/each}

			{#if carVisible}
				<Container x={carX.current} y={carY.current}>
					<SpriteSheet
						key="magneticWildLightning"
						play
						loop
						animationSpeed={0.3}
						blendMode="add"
						anchor={0.5}
						width={SYMBOL_W * 1.35}
						height={SYMBOL_H * 1.35}
					/>
					<Sprite key="tp_h1.png" anchor={0.5} width={SYMBOL_W * 1.2} height={SYMBOL_H * 0.9} />
				</Container>
			{/if}
		</Container>
	</MainContainer>
</FadeContainer>
