<script lang="ts" module>
	import type { DuckKind } from '../game/types';

	export type DuckPondPrize = { kind: DuckKind; value: number };

	export type EmitterEventDuckPond =
		| { type: 'duckPondShow'; totalPicks: number; pool: DuckPondPrize[] }
		| {
				type: 'duckPondPick';
				pickIndex: number;
				kind: DuckKind;
				value: number;
				runningTotal: number;
		  }
		| { type: 'duckPondFinish'; amount: number }
		| { type: 'duckPondHide' };
</script>

<script lang="ts">
	import { onDestroy } from 'svelte';
	import { cubicOut } from 'svelte/easing';
	import { Tween } from 'svelte/motion';
	import { BitmapText, Container, Sprite } from 'pixi-svelte';
	import { Button, FadeContainer } from 'components-pixi';
	import { MainContainer } from 'components-layout';
	import { waitForResolve, waitForTimeout } from 'utils-shared/wait';
	import { bookEventAmountToCurrencyString } from 'utils-shared/amount';
	import { stateI18nDerived } from 'state-shared';

	import { getContext } from '../game/context';
	import { i18nDerived } from '../i18n/i18nDerived';
	import type { DuckKind } from '../game/types';
	import {
		BOARD_DIMENSIONS,
		BOARD_GRID_OFFSET_Y,
		BOARD_SIZES,
		SYMBOL_H,
		CELL_W,
		SYMBOL_W,
	} from '../game/constants';

	type PendingPick = { pickIndex: number; kind: DuckKind; value: number; runningTotal: number };
	type PondDuck = {
		prize: DuckPondPrize | null;
		selected: boolean;
		revealed: boolean;
		pickIndex: number | null;
	};

	const POND_SIZE = 25;
	const context = getContext();
	const layout = $derived(context.stateGameDerived.boardLayout());
	let show = $state(false);
	let totalPicks = $state(10);
	let pool = $state<DuckPondPrize[]>([]);
	let ducks = $state<PondDuck[]>([]);
	let pendingPick = $state<PendingPick | null>(null);
	let revealingIndex = $state<number | null>(null);
	let revealingAll = $state(false);
	let runningTotal = $state(0);
	let finalAmount = $state<number | null>(null);
	let resolveSelection: () => void = () => {};
	const pickScale = new Tween(1);

	const emptyPond = () =>
		Array.from(
			{ length: POND_SIZE },
			(): PondDuck => ({
				prize: null,
				selected: false,
				revealed: false,
				pickIndex: null,
			}),
		);

	const releasePending = () => {
		const resolve = resolveSelection;
		resolveSelection = () => {};
		resolve();
	};

	const prizeLabel = (prize: DuckPondPrize) =>
		prize.kind === 'multmult'
			? `×${prize.value}`
			: bookEventAmountToCurrencyString(prize.value * 100);

	const revealUnselected = async () => {
		const remaining = pool.slice(totalPicks);
		let poolIndex = 0;
		revealingAll = true;
		ducks = ducks.map((duck) => {
			if (duck.selected) return duck;
			const prize = remaining[poolIndex++];
			return { ...duck, prize, revealed: true };
		});
		context.eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_scatter_stop_2' });
		await waitForTimeout(850);
		revealingAll = false;
	};

	onDestroy(releasePending);

	context.eventEmitter.subscribeOnMount({
		duckPondShow: (event) => {
			releasePending();
			totalPicks = event.totalPicks;
			pool = event.pool;
			ducks = emptyPond();
			pendingPick = null;
			revealingIndex = null;
			revealingAll = false;
			runningTotal = 0;
			finalAmount = null;
			pickScale.set(1, { duration: 0 });
			show = true;
		},
		// Book playback remains blocked until the user picks an actual reel cell.
		duckPondPick: async (event) => {
			pendingPick = { ...event };
			await waitForResolve((resolve) => (resolveSelection = resolve));
		},
		duckPondFinish: async (event) => {
			await revealUnselected();
			finalAmount = event.amount;
			runningTotal = event.amount;
			context.eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_scatter_win' });
			await waitForTimeout(1800);
		},
		duckPondHide: () => {
			releasePending();
			show = false;
			pool = [];
			ducks = [];
			pendingPick = null;
			revealingIndex = null;
			revealingAll = false;
			finalAmount = null;
		},
	});

	const chooseDuck = async (pondIndex: number) => {
		if (!pendingPick || ducks[pondIndex]?.selected || revealingIndex !== null || revealingAll)
			return;
		const result = pendingPick;
		pendingPick = null;
		revealingIndex = pondIndex;
		pickScale.set(0.72, { duration: 0 });
		ducks = ducks.map((duck, index) =>
			index === pondIndex
				? {
						...duck,
						prize: { kind: result.kind, value: result.value },
						selected: true,
						revealed: true,
						pickIndex: result.pickIndex,
					}
				: duck,
		);
		context.eventEmitter.broadcast({
			type: 'soundOnce',
			name: 'sfx_scatter_stop_2',
			forcePlay: true,
		});
		await pickScale.set(1.14, { duration: 180, easing: cubicOut });
		await pickScale.set(1, { duration: 140, easing: cubicOut });
		runningTotal = result.runningTotal;
		revealingIndex = null;
		releasePending();
	};

	const pickedCount = $derived(ducks.filter((duck) => duck.selected).length);
	const cellX = (index: number) => CELL_W * ((index % BOARD_DIMENSIONS.x) + 0.5);
	const cellY = (index: number) => SYMBOL_H * (Math.floor(index / BOARD_DIMENSIONS.x) + 0.5);
</script>

<FadeContainer {show}>
	<MainContainer>
		<Container
			x={layout.x}
			y={layout.y + BOARD_GRID_OFFSET_Y}
			pivot={layout.pivot}
			scale={layout.boardScale}
		>
			<!-- 25 interactive ducks occupy the exact 5×5 reel cells. -->
			{#each ducks as duck, index (index)}
				<Button
					x={cellX(index)}
					y={cellY(index)}
					anchor={0.5}
					sizes={{ width: SYMBOL_W, height: SYMBOL_H }}
					disabled={!pendingPick || duck.selected || revealingIndex !== null || revealingAll}
					onpress={() => chooseDuck(index)}
					alpha={duck.revealed && !duck.selected ? 0.62 : 1}
					scale={revealingIndex === index ? pickScale.current : 1}
				>
					{#snippet children({ center, hovered, pressed })}
						<Sprite
							key={duck.selected ? 'lockedCellWin' : 'lockedCell'}
							x={center.x}
							y={center.y}
							anchor={0.5}
							width={SYMBOL_W * 0.98}
							height={SYMBOL_H * 0.98}
							tint={hovered && !duck.selected ? 0xc8f6ff : 0xffffff}
						/>
						<Sprite
							key={duck.selected ? 'tpH2Win' : 'tpH2'}
							x={center.x}
							y={center.y - SYMBOL_H * 0.13}
							anchor={0.5}
							width={SYMBOL_W * (pressed ? 0.72 : hovered ? 0.82 : 0.77)}
							height={SYMBOL_H * (pressed ? 0.72 : hovered ? 0.82 : 0.77)}
						/>
						{#if duck.revealed && duck.prize}
							<Sprite
								key="forestBonusBadge"
								x={center.x}
								y={center.y + SYMBOL_H * 0.28}
								anchor={0.5}
								width={SYMBOL_W * 0.8}
								height={SYMBOL_H * 0.35}
							/>
							<BitmapText
								anchor={0.5}
								x={center.x}
								y={center.y + SYMBOL_H * 0.28}
								text={prizeLabel(duck.prize)}
								style={{ fontFamily: 'gold', fontSize: SYMBOL_H * 0.13 }}
							/>
						{/if}
					{/snippet}
				</Button>
			{/each}

			<!-- Status stays attached to the reel frame; no modal/backdrop. -->
			<Container x={BOARD_SIZES.width * 0.5} y={-SYMBOL_H * 0.46}>
				<Sprite
					key="forestBonusBadge"
					anchor={0.5}
					width={CELL_W * 3.8}
					height={SYMBOL_H * 0.68}
				/>
				<BitmapText
					anchor={0.5}
					y={-SYMBOL_H * 0.08}
					text={stateI18nDerived.translate('DUCK YOUR LUCK')}
					style={{ fontFamily: 'gold', fontSize: SYMBOL_H * 0.2 }}
				/>
				<BitmapText
					anchor={0.5}
					y={SYMBOL_H * 0.12}
					text={`${pickedCount} / ${totalPicks} ${stateI18nDerived.translate('SELECTED')}`}
					style={{ fontFamily: 'silver', fontSize: SYMBOL_H * 0.11 }}
				/>
			</Container>

			<Container x={BOARD_SIZES.width * 0.5} y={BOARD_SIZES.height + SYMBOL_H * 0.42}>
				<Sprite
					key="forestBonusBadge"
					anchor={0.5}
					width={CELL_W * 3.6}
					height={SYMBOL_H * 0.64}
				/>
				<BitmapText
					anchor={0.5}
					y={-SYMBOL_H * 0.08}
					text={finalAmount !== null
						? stateI18nDerived.translate('BONUS COMPLETE')
						: revealingAll
							? stateI18nDerived.translate('REVEALING ALL DUCKS')
							: pendingPick
								? i18nDerived.translateVars('PICK MORE', {
										count: totalPicks - pickedCount,
									})
								: stateI18nDerived.translate('REVEALING')}
					style={{ fontFamily: 'silver', fontSize: SYMBOL_H * 0.1 }}
				/>
				<BitmapText
					anchor={0.5}
					y={SYMBOL_H * 0.12}
					text={bookEventAmountToCurrencyString(runningTotal)}
					style={{ fontFamily: 'gold', fontSize: SYMBOL_H * 0.17 }}
				/>
			</Container>
		</Container>
	</MainContainer>
</FadeContainer>
