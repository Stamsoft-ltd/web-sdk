<script lang="ts" module>
	import type { RollerReel } from '../game/types';

	export type EmitterEventRollerWilds =
		| { type: 'rollerWildsShow'; reels: RollerReel[] }
		| { type: 'rollerWildsHandoff' }
		| { type: 'rollerWildsRollOut' }
		| { type: 'rollerWildsHide' };
</script>

<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { Container, Graphics, PIXI } from 'pixi-svelte';
	import { MainContainer } from 'components-layout';
	import { stateBet } from 'state-shared';
	import { waitForTimeout } from 'utils-shared/wait';

	import { getContext } from '../game/context';
	import {
		CELL_W,
		CELL_H,
		BOARD_DIMENSIONS,
		BOARD_CORNER_RADIUS,
		BOARD_GRID_OFFSET_Y,
		getBoardCellCenterX,
	} from '../game/constants';
	import MegaWildFullReel from './MegaWildFullReel.svelte';

	type RollerPhase = 'hidden' | 'ready' | 'revealing' | 'settled' | 'rollingOut';

	const context = getContext();
	const layout = $derived(context.stateGameDerived.boardLayout());

	let triggerReels = $state<RollerReel[]>([]);
	let revealedReelCount = $state(0);
	type RollOutAnchor = { symbolY: () => number; lastY: number };
	let rollOutAnchors = $state(new Map<number, RollOutAnchor>());
	let rollOutOffsets = $state(new Map<number, number>());
	let phase = $state<RollerPhase>('hidden');
	let presentationOwner = $state<'overlay' | 'board'>('overlay');

	const ROWS = Array.from({ length: BOARD_DIMENSIONS.y }, (_, row) => row);
	const INTRO_MS = 1990;
	const SUPER_TURBO_INTRO_FACTOR = 0.2;
	const introWaitMs = () =>
		stateBet.isSuperTurbo ? INTRO_MS * SUPER_TURBO_INTRO_FACTOR : INTRO_MS;
	// Normal mode completes the entire expand/cart/plaque timeline before mounting the next reel.
	// Fast/turbo bypass this sequence and mount every affected reel in one batch.
	const REEL_STAGGER_MS = INTRO_MS;
	const REEL_CENTER_Y = (CELL_H * BOARD_DIMENSIONS.y) / 2;

	let sequenceActive = $state(false);
	let skipRequested = false;
	let resolveSkip: () => void = () => {};
	let skipSignal: Promise<void> = Promise.resolve();

	const resetSkip = () => {
		skipRequested = false;
		skipSignal = new Promise<void>((resolve) => (resolveSkip = resolve));
	};

	const requestSkip = () => {
		if (!sequenceActive || skipRequested) return;
		skipRequested = true;
		resolveSkip();
	};

	const runOrSkip = async (task: Promise<unknown>) => {
		const completed = await Promise.race([task.then(() => true), skipSignal.then(() => false)]);
		return completed && !skipRequested;
	};

	const setClearedReels = (reels: RollerReel[]) => {
		context.stateGame.rollerClearedCells = reels.flatMap(({ reel }) =>
			ROWS.map((row) => `${reel},${row}`),
		);
	};

	// Each reel expands on its own beat, so the sting fires per reel — force-replay because a plain
	// soundOnce is a no-op while the previous ~2.3s expand sound is still playing, which is exactly why
	// only the first of several expands used to make a sound.
	const playExpandSound = () =>
		context.eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_megawild_expand', forcePlay: true });

	const revealTriggeredReels = async () => {
		if (stateBet.isTurbo || stateBet.isSuperTurbo) {
			setClearedReels(triggerReels);
			revealedReelCount = triggerReels.length;
			playExpandSound();
			await tick();
			return true;
		}
		for (let index = 0; index < triggerReels.length; index += 1) {
			// Keep later reels untouched until their own reveal starts. The mounted full-reel symbol and
			// cell clearing enter in one render, so expansion visibly originates at its landed trigger.
			setClearedReels(triggerReels.slice(0, index + 1));
			revealedReelCount = index + 1;
			playExpandSound();
			await tick();
			if (index < triggerReels.length - 1 && !(await runOrSkip(waitForTimeout(REEL_STAGGER_MS)))) {
				return false;
			}
		}
		return true;
	};

	const showFinalPresentation = () => {
		revealedReelCount = triggerReels.length;
		setClearedReels(triggerReels);
		phase = 'settled';
		presentationOwner = 'overlay';
		sequenceActive = false;
	};

	const rollOutOffsetY = (roller: RollerReel) => {
		if (phase !== 'rollingOut') return 0;
		return rollOutOffsets.get(roller.reel) ?? 0;
	};

	const sampleRollOutOffsets = () => {
		const nextOffsets = new Map(rollOutOffsets);
		for (const roller of triggerReels) {
			const anchor = rollOutAnchors.get(roller.reel);
			if (!anchor) continue;
			const currentY = anchor.symbolY();
			const deltaY = currentY - anchor.lastY;
			anchor.lastY = currentY;
			// Reels recycle their symbol strip by snapping it back above the board. Ignore that negative
			// reset and accumulate only physical downward travel, otherwise the full-reel overlay jumps
			// back onscreen and appears again as a padding symbol on the following spin.
			if (deltaY > 0) {
				nextOffsets.set(
					roller.reel,
					Math.min(
						CELL_H * BOARD_DIMENSIONS.y,
						(nextOffsets.get(roller.reel) ?? 0) + deltaY,
					),
				);
			}
		}
		rollOutOffsets = nextOffsets;
	};

	const waitForRollOut = () =>
		new Promise<void>((resolve) => {
			const deadline = performance.now() + 3000;
			const check = (now: number) => {
				sampleRollOutOffsets();
				const allOutside = triggerReels.every(
					(roller) => rollOutOffsetY(roller) >= CELL_H * BOARD_DIMENSIONS.y,
				);
				if (phase !== 'rollingOut' || allOutside || now >= deadline) {
					resolve();
					return;
				}
				requestAnimationFrame(check);
			};
			requestAnimationFrame(check);
		});

	const reelIsWinning = (reel: number) =>
		context.stateGame.board[reel]?.reelState.symbols
			.slice(1, BOARD_DIMENSIONS.y + 1)
			.some((symbol) => symbol.symbolState === 'win') ?? false;

	onMount(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.code !== 'Space' || !sequenceActive) return;
			event.preventDefault();
			event.stopImmediatePropagation();
			requestSkip();
		};
		const onClick = (event: MouseEvent) => {
			if (!sequenceActive) return;
			event.preventDefault();
			event.stopImmediatePropagation();
			requestSkip();
		};
		window.addEventListener('keydown', onKeyDown, { capture: true });
		window.addEventListener('click', onClick, { capture: true });
		return () => {
			window.removeEventListener('keydown', onKeyDown, { capture: true });
			window.removeEventListener('click', onClick, { capture: true });
		};
	});

	context.eventEmitter.subscribeOnMount({
		rollerWildsShow: async (event) => {
			resetSkip();
			sequenceActive = true;
			triggerReels = [...event.reels].sort((left, right) => left.reel - right.reel);
			revealedReelCount = 0;
			rollOutAnchors = new Map();
			rollOutOffsets = new Map();
			presentationOwner = 'overlay';
			phase = 'ready';

			// Keep every trigger reel intact until that reel's own reveal begins. This prevents later
			// normal-speed reels from sitting empty while earlier reels finish their animation.
			context.stateGame.rollerClearedCells = [];
			await tick();
			phase = 'revealing';
			if (!(await revealTriggeredReels())) {
				showFinalPresentation();
				return;
			}
			if (!(await runOrSkip(waitForTimeout(introWaitMs())))) {
				showFinalPresentation();
				return;
			}
			showFinalPresentation();
		},
		rollerWildsHide: () => {
			sequenceActive = false;
			resolveSkip();
			triggerReels = [];
			revealedReelCount = 0;
			rollOutAnchors = new Map();
			rollOutOffsets = new Map();
			presentationOwner = 'overlay';
			phase = 'hidden';
			context.stateGame.rollerClearedCells = [];
		},
		rollerWildsRollOut: async () => {
			if (triggerReels.length === 0) return;
			// Anchor each overlay to one unchanged symbol from its own reel. The symbol object survives
			// padding insertion, so symbolY follows the reel's real delay, acceleration, and ordering.
			rollOutAnchors = new Map(
				triggerReels.flatMap((roller) => {
					const symbol =
						context.stateGame.board[roller.reel]?.reelState.symbols[roller.triggerRow + 1];
					if (!symbol) return [];
					return [[roller.reel, { symbolY: symbol.symbolY, lastY: symbol.symbolY() }] as const];
				}),
			);
			rollOutOffsets = new Map(triggerReels.map((roller) => [roller.reel, 0]));
			sequenceActive = false;
			phase = 'rollingOut';
			// Reveal the live reel below the departing feature. Accumulated downward reel travel keeps the
			// overlay synced while filtering out the padding strip's instantaneous wrap back to the top.
			context.stateGame.rollerClearedCells = [];
			await waitForRollOut();
			triggerReels = [];
			revealedReelCount = 0;
			rollOutAnchors = new Map();
			rollOutOffsets = new Map();
			presentationOwner = 'overlay';
			phase = 'hidden';
		},
		rollerWildsHandoff: async () => {
			// The overlay remains the sole owner through paylines/result display. Keeping the original
			// board masked avoids a five-Wild replacement flash and keeps the reel above authored grid art.
			phase = 'settled';
			revealedReelCount = triggerReels.length;
			presentationOwner = 'overlay';
			await tick();
		},
	});

	const cellX = getBoardCellCenterX;
	// Keep straight edges at the exact grid bounds. Only the four corners curve inward, matching the
	// authored rail, so full-reel art cannot leak outside it without narrowing any reel.
	const drawBoardMask = (graphics: PIXI.Graphics) =>
		graphics
			.roundRect(
				0,
				0,
				CELL_W * BOARD_DIMENSIONS.x,
				CELL_H * BOARD_DIMENSIONS.y,
				BOARD_CORNER_RADIUS,
			)
			.fill(0xffffff);
</script>

{#if triggerReels.length > 0}
	<!-- Explicit stage layer. MainContainer applies zIndex only to its inner node, so without this
	     wrapper the already-mounted BoardFrame can sort above the reveal and expose its grid lines. -->
	<Container zIndex={phase === 'settled' ? 0 : 5}>
		<MainContainer>
			<Container
				x={layout.x}
				y={layout.y + BOARD_GRID_OFFSET_Y}
				pivot={layout.pivot}
				scale={layout.boardScale}
				sortableChildren
			>
				<Graphics isMask draw={drawBoardMask} />

				{#if presentationOwner === 'overlay'}
					{#each triggerReels.slice(0, revealedReelCount) as roller (roller.reel)}
						<Container zIndex={18} y={rollOutOffsetY(roller)}>
							<MegaWildFullReel
								x={cellX(roller.reel)}
								fakeMultiplier={roller.fakeMultiplier}
								multiplier={roller.multiplier}
								initialReal={roller.initialReal}
								animationName={phase === 'revealing' ? 'intro' : 'idle'}
								winning={phase === 'settled' && reelIsWinning(roller.reel)}
								originY={CELL_H * (roller.triggerRow + 0.5) - REEL_CENTER_Y}
							/>
						</Container>
					{/each}
				{/if}
			</Container>
		</MainContainer>
	</Container>
{/if}
