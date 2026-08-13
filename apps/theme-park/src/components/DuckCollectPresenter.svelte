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
		| { type: 'duckCollectRevealComplete'; position: Position }
		| { type: 'duckCollectFinish'; amount: number }
		| { type: 'duckCollectHide' };
</script>

<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { BitmapText, Container } from 'pixi-svelte';
	import { MainContainer } from 'components-layout';
	import { FadeContainer } from 'components-pixi';
	import { waitForResolve, waitForTimeout } from 'utils-shared/wait';
	import { bookEventAmountToCurrencyString } from 'utils-shared/amount';
	import { stateBet } from 'state-shared';

	import NeonPlaque from './NeonPlaque.svelte';
	import { getContext } from '../game/context';
	import { stripEmptyCurrencyDecimals } from '../game/currency';

	type DuckPrize = { kind: DuckKind; value: number };
	type ActiveReveal = DuckPrize & { position: Position; runningTotal: number };

	const context = getContext();
	const layout = $derived(context.stateGameDerived.boardLayout());
	const turnReady = $derived(!!context.stateApp.loadedAssets?.duckPondTurn);

	let show = $state(false);
	let runningTotal = $state(0);
	let finalAmount = $state<number | null>(null);
	let active = $state<ActiveReveal | null>(null);
	let positions = $state<Position[]>([]);
	let batchMode = false;
	let batchStarted = false;
	let completedKeys = new Set<string>();
	let resolveReveal: () => void = () => {};
	let skipAllowedAt = 0;

	const positionKey = ({ reel, row }: Position) => `${reel},${row}`;

	const releaseReveal = () => {
		const resolve = resolveReveal;
		resolveReveal = () => {};
		resolve();
	};
	const addTurnedPosition = (position: Position) => {
		const key = positionKey(position);
		if (context.stateGame.duckTurnedPositions.some((item) => positionKey(item) === key)) return;
		context.stateGame.duckTurnedPositions = [...context.stateGame.duckTurnedPositions, position];
	};

	const finishDuckReveal = (key: string) => {
		if (!active || positionKey(active.position) !== key) return;
		runningTotal = active.runningTotal;
		active = null;
		if (!batchMode) context.stateGame.duckRevealPositions = [];
		releaseReveal();
	};

	const finishTurn = (position: Position) => {
		const key = positionKey(position);
		completedKeys.add(key);
		addTurnedPosition(position);
		if (batchMode && completedKeys.size >= positions.length) {
			context.stateGame.duckRevealPositions = [];
		}
		finishDuckReveal(key);
	};

	const startBatchReveal = () => {
		if (!show || batchStarted || positions.length === 0) return;
		batchMode = true;
		batchStarted = true;
		context.stateGame.duckRevealBatch = true;
		completedKeys = new Set(context.stateGame.duckTurnedPositions.map(positionKey));
		context.stateGame.duckRevealPositions = positions.filter(
			(position) => !completedKeys.has(positionKey(position)),
		);
		context.eventEmitter.broadcast({
			type: 'soundOnce',
			name: 'sfx_scatter_stop_1',
			forcePlay: true,
		});

		if (!turnReady) {
			context.stateGame.duckTurnedPositions = [...positions];
			context.stateGame.duckRevealPositions = [];
			if (active) finishDuckReveal(positionKey(active.position));
		}
	};

	onDestroy(() => {
		releaseReveal();
		context.stateGame.duckRevealPositions = [];
		context.stateGame.duckTurnedPositions = [];
		context.stateGame.duckRevealBatch = false;
	});

	onMount(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.code !== 'Space' || !show || batchStarted) return;
			event.preventDefault();
			event.stopImmediatePropagation();
			startBatchReveal();
		};
		const onClick = (event: MouseEvent) => {
			if (!show || batchStarted) return;
			if (performance.now() < skipAllowedAt) return;
			event.preventDefault();
			event.stopImmediatePropagation();
			startBatchReveal();
		};
		window.addEventListener('keydown', onKeyDown, { capture: true });
		window.addEventListener('click', onClick, { capture: true });
		return () => {
			window.removeEventListener('keydown', onKeyDown, { capture: true });
			window.removeEventListener('click', onClick, { capture: true });
		};
	});

	context.eventEmitter.subscribeOnMount({
		duckCollectShow: (event) => {
			releaseReveal();
			runningTotal = 0;
			finalAmount = null;
			active = null;
			positions = [...event.positions];
			batchMode = false;
			batchStarted = false;
			completedKeys = new Set<string>();
			context.stateGame.duckRevealPositions = [];
			context.stateGame.duckTurnedPositions = [];
			context.stateGame.duckRevealBatch = false;
			skipAllowedAt = performance.now() + 140;
			show = true;
			if (stateBet.isTurbo || stateBet.isSuperTurbo) startBatchReveal();
		},
		// Board owns the DC component for its full front-to-rear lifecycle. This presenter only
		// coordinates book playback and the running-total banner.
		duckCollectReveal: async (event) => {
			if (batchMode) {
				runningTotal = event.runningTotal;
				return;
			}
			active = { ...event };
			skipAllowedAt = performance.now() + 140;
			context.stateGame.duckRevealPositions = [event.position];
			context.eventEmitter.broadcast({
				type: 'soundOnce',
				name: 'sfx_scatter_stop_1',
				forcePlay: true,
			});

			if (!turnReady) {
				await waitForTimeout(400);
				finishTurn(event.position);
				return;
			}
			await waitForResolve((resolve) => (resolveReveal = resolve));
		},
		duckCollectRevealComplete: (event) => finishTurn(event.position),
		duckCollectFinish: async (event) => {
			finalAmount = event.amount;
			runningTotal = event.amount;
			await waitForTimeout(1400);
		},
		duckCollectHide: () => {
			releaseReveal();
			show = false;
			finalAmount = null;
			active = null;
			positions = [];
			batchMode = false;
			batchStarted = false;
			completedKeys = new Set<string>();
			context.stateGame.duckRevealPositions = [];
			context.stateGame.duckTurnedPositions = [];
			context.stateGame.duckRevealBatch = false;
		},
	});

	const bannerY = $derived(layout.y - (layout.height / 2) * layout.boardScale - 46);
</script>

<FadeContainer {show}>
	<MainContainer>
		<Container x={layout.x} y={bannerY}>
			<NeonPlaque key="bonusBannerPlate" width={500} height={96} />
			<BitmapText
				anchor={{ x: 0.5, y: 0.5 }}
				y={-16}
				text={finalAmount !== null ? 'DUCKS COLLECTED!' : 'DUCK COLLECT'}
				style={{ fontFamily: 'gold', fontSize: 24 }}
			/>
			<BitmapText
				anchor={{ x: 0.5, y: 0.5 }}
				y={16}
				text={stripEmptyCurrencyDecimals(bookEventAmountToCurrencyString(runningTotal))}
				style={{ fontFamily: 'silver', fontSize: 28 }}
			/>
		</Container>
	</MainContainer>
</FadeContainer>
