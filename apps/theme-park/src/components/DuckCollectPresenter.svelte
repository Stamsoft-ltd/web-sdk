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
	import { waitForResolve, waitForTimeout } from 'utils-shared/wait';
	import { stateBet } from 'state-shared';

	import { getContext } from '../game/context';

	type DuckPrize = { kind: DuckKind; value: number };
	type ActiveReveal = DuckPrize & { position: Position; runningTotal: number };

	const context = getContext();
	const turnReady = $derived(!!context.stateApp.loadedAssets?.duckPondTurn);

	let show = $state(false);
	let active = $state<ActiveReveal | null>(null);
	let positions = $state<Position[]>([]);
	let batchMode = false;
	let batchStarted = false;
	let completedKeys = new Set<string>();
	let resolveReveal: () => void = () => {};
	let skipAllowedAt = 0;

	/**
	 * How long the turned ducks are held before the board moves on.
	 *
	 * Scaled by the speed setting, because Duck Collect keeps turbo now (it is a base-game symbol
	 * feature, not a bonus — see shouldForceNormalSpeed in game/utils). Floored at 750ms on purpose:
	 * the HUD's WIN count-up runs a fixed 650ms tween, and a hold shorter than that would cut the
	 * collected total off mid-count and show a number that was never the real one.
	 */
	const FINISH_HOLD_MS = 1400;
	const FINISH_HOLD_FLOOR_MS = 750;
	const finishHoldMs = () => {
		const factor = stateBet.isSuperTurbo ? 0.4 : stateBet.isTurbo ? 0.6 : 1;
		return Math.max(FINISH_HOLD_FLOOR_MS, FINISH_HOLD_MS * factor);
	};

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
			name: 'sfx_duck_land',
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
		// coordinates book playback; the collected total is read off the HUD's WIN field.
		duckCollectReveal: async (event) => {
			if (batchMode) return;
			active = { ...event };
			skipAllowedAt = performance.now() + 140;
			context.stateGame.duckRevealPositions = [event.position];
			context.eventEmitter.broadcast({
				type: 'soundOnce',
				name: 'sfx_duck_land',
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
		duckCollectFinish: async () => {
			await waitForTimeout(finishHoldMs());
		},
		duckCollectHide: () => {
			releaseReveal();
			show = false;
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

</script>

<!--
	NOTHING IS DRAWN HERE.

	This used to raise a neon plaque above the board reading DUCK COLLECT with the running total under
	it, which was a Forest Gang leftover: the plate was the HUD's own bar art and the heading was set
	in the `gold` bitmap font, which in this font set renders GREEN. On a Theme Park board it landed
	on top of the THEME PARK sign as a green-on-dark slab (design ask, 2026-08-24 -- remove it).
	Nothing was lost with it: the collected total is the WIN field in the HUD, which counts up as each
	duck turns.

	The component stays because it owns the REVEAL: it drives duckRevealPositions / duckTurnedPositions
	on the board, holds book playback open while a duck turns, and handles the click-to-skip.
-->
