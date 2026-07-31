<script lang="ts" module>
	import type { Position, DuckKind } from '../game/types';

	export type EmitterEventDuckCollect =
		| { type: 'duckCollectShow'; positions: Position[] }
		| {
				type: 'duckCollectReveal';
				position: Position;
				kind: DuckKind;
				value: number;
				runningTotal: number;
		  }
		| { type: 'duckCollectFinish'; amount: number }
		| { type: 'duckCollectHide' };
</script>

<script lang="ts">
	import { Tween } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';
	import { BitmapText, Container, Sprite } from 'pixi-svelte';
	import { MainContainer } from 'components-layout';
	import { FadeContainer } from 'components-pixi';
	import { waitForTimeout } from 'utils-shared/wait';
	import { bookEventAmountToCurrencyString } from 'utils-shared/amount';
	import { stateI18nDerived } from 'state-shared';

	import { getContext } from '../game/context';
	import { CELL_W, SYMBOL_W, SYMBOL_H, BOARD_GRID_OFFSET_Y } from '../game/constants';

	type RevealChip = { position: Position; kind: DuckKind; value: number };

	const context = getContext();
	const layout = $derived(context.stateGameDerived.boardLayout());

	let show = $state(false);
	let chips = $state<RevealChip[]>([]);
	let runningTotal = $state(0);
	let finalAmount = $state<number | null>(null);
	let activeKey = $state<string | null>(null);
	const flipScale = new Tween(1);
	const popScale = new Tween(1);

	context.eventEmitter.subscribeOnMount({
		duckCollectShow: () => {
			chips = [];
			runningTotal = 0;
			finalAmount = null;
			activeKey = null;
			show = true;
		},
		// Sequential physical flip + prize pop. Playback waits for each animation.
		duckCollectReveal: async (emitterEvent) => {
			activeKey = `${emitterEvent.position.reel}-${emitterEvent.position.row}`;
			flipScale.set(0.05, { duration: 0 });
			popScale.set(0.7, { duration: 0 });
			chips = [
				...chips,
				{ position: emitterEvent.position, kind: emitterEvent.kind, value: emitterEvent.value },
			];
			context.eventEmitter.broadcast({
				type: 'soundOnce',
				name: 'sfx_scatter_stop_1',
				forcePlay: true,
			});
			await flipScale.set(1, { duration: 260, easing: cubicOut });
			await popScale.set(1.18, { duration: 170, easing: cubicOut });
			await popScale.set(1, { duration: 120, easing: cubicOut });
			runningTotal = emitterEvent.runningTotal;
			activeKey = null;
			await waitForTimeout(120);
		},
		duckCollectFinish: async (emitterEvent) => {
			finalAmount = emitterEvent.amount;
			runningTotal = emitterEvent.amount;
			await waitForTimeout(1400);
		},
		duckCollectHide: () => {
			show = false;
			chips = [];
			finalAmount = null;
			activeKey = null;
		},
	});

	const cellX = (reel: number) => CELL_W * (reel + 0.5);
	const cellY = (row: number) => SYMBOL_H * (row + 0.5);

	const bannerY = $derived(layout.y - (layout.height / 2) * layout.boardScale - 46);
	const chipW = SYMBOL_W * 0.86;
	const chipH = SYMBOL_H * 0.44;
</script>

<FadeContainer {show}>
	<MainContainer>
		<!-- Board owns each DC symbol. Asset-backed frame + plaque reveal above it. -->
		<Container
			x={layout.x}
			y={layout.y + BOARD_GRID_OFFSET_Y}
			pivot={layout.pivot}
			scale={layout.boardScale}
		>
			{#each chips as chip (`${chip.position.reel}-${chip.position.row}`)}
				{@const key = `${chip.position.reel}-${chip.position.row}`}
				<Container
					x={cellX(chip.position.reel)}
					y={cellY(chip.position.row)}
					scale={{
						x: activeKey === key ? flipScale.current : 1,
						y: activeKey === key ? popScale.current : 1,
					}}
				>
					<Sprite
						key="forestBonusBadge"
						anchor={0.5}
						width={chipW}
						height={chipH}
					/>
					<BitmapText
						anchor={{ x: 0.5, y: 0.5 }}
						text={chip.kind === 'multmult'
							? `×${chip.value} ${stateI18nDerived.translate('ALL')}`
							: `+${chip.value}x`}
						style={{ fontFamily: 'gold', fontSize: chipH * 0.52 }}
					/>
				</Container>
			{/each}
		</Container>

		<!-- Running total banner above the board -->
		<Container x={layout.x} y={bannerY}>
			<Sprite
				key="forestBonusBadge"
				anchor={0.5}
				width={500}
				height={96}
			/>
			<BitmapText
				anchor={{ x: 0.5, y: 0.5 }}
				y={-16}
				text={finalAmount !== null ? 'DUCKS COLLECTED!' : 'DUCK COLLECT'}
				style={{ fontFamily: 'gold', fontSize: 24 }}
			/>
			<BitmapText
				anchor={{ x: 0.5, y: 0.5 }}
				y={16}
				text={bookEventAmountToCurrencyString(runningTotal)}
				style={{ fontFamily: 'silver', fontSize: 28 }}
			/>
		</Container>
	</MainContainer>
</FadeContainer>
