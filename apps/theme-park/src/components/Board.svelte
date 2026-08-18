<script lang="ts" module>
	import type { RawSymbol, Position } from '../game/types';

	export type EmitterEventBoard =
		| { type: 'boardSettle'; board: RawSymbol[][] }
		| { type: 'boardShow' }
		| { type: 'boardHide' }
		| { type: 'boardWithAnimateSymbols'; symbolPositions: Position[] }
		| { type: 'skipToAnticipation' };
</script>

<script lang="ts">
	import { Container, Graphics, PIXI, Sprite } from 'pixi-svelte';
	import { OnPressFullScreen } from 'components-layout';
	import { onMount } from 'svelte';

	import { boardShake } from '../game/boardShake.svelte';
	import { getContext } from '../game/context';
	import {
		CELL_W,
		CELL_H,
		SYMBOL_W,
		SYMBOL_H,
		BOARD_DIMENSIONS,
		BOARD_GRID_OFFSET_Y,
		BOARD_SIDE_CONTENT_INSET,
		getBoardCellCenterX,
	} from '../game/constants';
	import {
		spriteKeyByName,
		bonusSpriteKeyByName,
		winSpriteKeyByName,
		getSpecialSymbolKey,
	} from '../game/utils';
	import { duckLookForPosition, duckVariantForPosition } from '../game/duckVisual';
	import type { RawSymbol, SymbolName } from '../game/types';
	import DuckPondDuck from './DuckPondDuck.svelte';
	import LandingSquish from './LandingSquish.svelte';
	import LoopingAssetSprite from './LoopingAssetSprite.svelte';
	import MegaWildFullReel from './MegaWildFullReel.svelte';

	const LOW_SYMBOLS_SET = new Set<SymbolName>(['L1', 'L2', 'L3', 'L4', 'L5']);
	const DUCK_SYMBOL_SIZE = Math.min(SYMBOL_W, SYMBOL_H) * 1.04;
	// Keep reel pixels off the grid dividers. The one authored grid in BoardFrame then remains visible
	// through these narrow gaps without drawing a second set of lines above the board.
	const GRID_LINE_CLEARANCE = 1.4;
	const WIN_ANIMATION_KEY_BY_NAME: Partial<Record<SymbolName, string>> = {
		H1: 'tpH1WinAnim',
		H2: 'tpH2WinAnim',
		H3: 'tpH3WinAnim',
		H4: 'tpH4WinAnim',
		H5: 'tpH5WinAnim',
		L1: 'tpL1WinAnim',
		L2: 'tpL2WinAnim',
		L3: 'tpL3WinAnim',
		L4: 'tpL4WinAnim',
		L5: 'tpL5WinAnim',
	};

	const context = getContext();
	const board = $derived(context.stateGame.board);
	const layout = $derived(context.stateGameDerived.boardLayout());
	const layoutType = $derived(context.stateLayoutDerived.layoutType());
	const isAnyReelSpinning = $derived(board.some((reel) => reel.reelState.motion !== 'stopped'));
	let show = $state(true);

	const activeMap = $derived(context.stateGame.bonusMode ? bonusSpriteKeyByName : spriteKeyByName);
	const getX = getBoardCellCenterX;
	const drawBoardContentMask = (graphics: PIXI.Graphics) => {
		for (let reel = 0; reel < BOARD_DIMENSIONS.x; reel += 1) {
			const leftInset = reel === 0 ? BOARD_SIDE_CONTENT_INSET : GRID_LINE_CLEARANCE;
			const rightInset =
				reel === BOARD_DIMENSIONS.x - 1 ? BOARD_SIDE_CONTENT_INSET : GRID_LINE_CLEARANCE;
			for (let row = 0; row < BOARD_DIMENSIONS.y; row += 1) {
				graphics.rect(
					CELL_W * reel + leftInset,
					CELL_H * row + GRID_LINE_CLEARANCE,
					CELL_W - leftInset - rightInset,
					CELL_H - GRID_LINE_CLEARANCE * 2,
				);
			}
		}
		graphics.fill(0xffffff);
	};
	const coasterCellSet = $derived(
		new Set(context.stateGame.coasterTiles.map(({ reel, row }) => `${reel},${row}`)),
	);
	const duckCollectPrizeByCell = $derived(
		new Map(
			(context.stateGame.duckCollect?.revealed ?? []).map((prize) => [
				`${prize.position.reel},${prize.position.row}`,
				prize,
			]),
		),
	);
	const duckRevealCellSet = $derived(
		new Set(context.stateGame.duckRevealPositions.map(({ reel, row }) => `${reel},${row}`)),
	);
	const duckTurnedCellSet = $derived(
		new Set(context.stateGame.duckTurnedPositions.map(({ reel, row }) => `${reel},${row}`)),
	);
	const boardPosition = (reel: number, row: number): Position => ({ reel, row });
	const getDuckCollectPrize = (reel: number, row: number) =>
		duckCollectPrizeByCell.get(`${reel},${row}`) ?? null;
	const duckStyleSeed = (rawSymbol: RawSymbol) => rawSymbol.duckStyleSeed ?? 0;
	const duckVariant = (rawSymbol: RawSymbol, position: Position) =>
		rawSymbol.duckVariant ?? duckVariantForPosition(position, duckStyleSeed(rawSymbol));
	const duckLook = (rawSymbol: RawSymbol, position: Position) =>
		rawSymbol.duckLook ?? duckLookForPosition(position, duckStyleSeed(rawSymbol));
	const isDuckCollectRevealing = (reel: number, row: number) =>
		duckRevealCellSet.has(`${reel},${row}`);
	const isDuckCollectTurned = (reel: number, row: number) =>
		duckTurnedCellSet.has(`${reel},${row}`);
	const finishDuckCollectReveal = (position: Position) =>
		context.eventEmitter.broadcast({ type: 'duckCollectRevealComplete', position });
	// Cells the roller-wilds carts have passed. Board hides each old symbol in the same render that
	// the overlay replaces it with that row's multiplier contribution.
	const rollerClearedSet = $derived(new Set(context.stateGame.rollerClearedCells));
	const isInitialRollerTriggerCell = (
		rawSymbol: RawSymbol,
		_reelIndex: number,
		rowIndex: number,
	) => {
		if (rawSymbol.name !== 'W') return false;
		if (rawSymbol.rollerTrigger) return true;
		// Legacy books mark the centre trigger with `multiplier`. The settled reel uses the distinct
		// `reelMultiplier` field so it can remain a plaque while it physically rolls out next spin.
		return (
			rowIndex === Math.floor(BOARD_DIMENSIONS.y / 2) &&
			Boolean(rawSymbol.multiplier) &&
			!rawSymbol.reelMultiplier
		);
	};
	const isRollerMultiplierCell = (rawSymbol: RawSymbol, reelIndex: number, rowIndex: number) =>
		rawSymbol.name === 'W' &&
		Boolean(rawSymbol.reelMultiplier) &&
		rowIndex >= 0 &&
		rowIndex < BOARD_DIMENSIONS.y &&
		!rawSymbol.persistent &&
		!coasterCellSet.has(`${reelIndex},${rowIndex}`);
	const isRollerReelWinning = (reelIndex: number, reelMultiplier: number) =>
		board[reelIndex]?.reelState.symbols.some(
			(symbol) =>
				symbol.symbolState === 'win' && symbol.rawSymbol.reelMultiplier === reelMultiplier,
		) ?? false;
	const reelBounceDurationMs = (reelIndex: number) => {
		const options = board[reelIndex].reelState.spinOptions();
		return (CELL_H * options.reelBounceSizeMulti) / options.reelBounceBackSpeed;
	};
	const getSpriteKey = (
		rawSymbol: RawSymbol,
		state: string | undefined,
		reelIndex: number,
		rowIndex: number,
	) => {
		const { name } = rawSymbol;
		if (name === 'W') {
			if (rawSymbol.persistent || coasterCellSet.has(`${reelIndex},${rowIndex}`))
				return 'tpCoasterWild';
			if (isInitialRollerTriggerCell(rawSymbol, reelIndex, rowIndex))
				return getSpecialSymbolKey('megaWild', layoutType);
			return getSpecialSymbolKey('wild', layoutType);
		}
		if (name === 'DC')
			return `duckPondDuck${duckVariant(rawSymbol, { reel: reelIndex, row: rowIndex })}`;
		if (name === 'S_DUCK') return getSpecialSymbolKey('duckScatter', layoutType);
		if (name === 'S_ROLLER') return getSpecialSymbolKey('rollerScatter', layoutType);
		if (name === 'S_COASTER') return getSpecialSymbolKey('coasterScatter', layoutType);
		if (state === 'win') return winSpriteKeyByName[name] ?? activeMap[name] ?? 'tpH1';
		return activeMap[name] ?? 'tpH1';
	};
	const getAnimationKey = (
		rawSymbol: RawSymbol,
		state: string | undefined,
		reelIndex: number,
		rowIndex: number,
	) => {
		if (rawSymbol.persistent || coasterCellSet.has(`${reelIndex},${rowIndex}`)) return undefined;
		if (rawSymbol.name === 'W') {
			if (isInitialRollerTriggerCell(rawSymbol, reelIndex, rowIndex)) return undefined;
			return 'tpWildAnim';
		}
		if (rawSymbol.name === 'DC' || rawSymbol.name === 'S_DUCK') return undefined;
		if (rawSymbol.name === 'S_ROLLER')
			return state === 'win' ? 'tpRollerScatterWinAnim' : 'tpRollerScatterAnim';
		if (rawSymbol.name === 'S_COASTER')
			return state === 'win' ? 'tpCoasterScatterWinAnim' : 'tpCoasterScatterAnim';
		return state === 'win' ? WIN_ANIMATION_KEY_BY_NAME[rawSymbol.name] : undefined;
	};
	// True while any symbol is in 'win' state — used to dim non-winning symbols
	const hasWinState = $derived(
		context.stateGame.board.some((reel) =>
			reel.reelState.symbols.some((s) => s.symbolState === 'win'),
		),
	);
	let winPulse = $state(1);

	// --- Ambient life ---------------------------------------------------------------------------
	// Between spins the grid used to be completely still: two frames 1.2s apart differed by 0.00% of
	// pixels inside the board, while the park behind it changed on 17% — the scenery was livelier
	// than the game. Every settled symbol now breathes in brightness, each on its own phase so the
	// board reads as a field that is alive rather than as one metronome.
	//
	// It is a TINT and deliberately not any kind of movement. Drifting or scaling the symbols meant
	// pixi resampled them every frame, and these are marquee signs: their rings of small bright bulbs
	// twinkled as the sampling phase shifted, which is what read as flicker along the bottom of the
	// letters. Back-to-back frames differed by a mean of 8.9 with a drift, against 0.37 with none —
	// individual pixels flipping outright, not a gentle change. Rounding the drift to whole device
	// pixels was tried and is a dead end here: the sprite sits under boardScale, <MainContainer>'s
	// responsive scale AND the renderer resolution, and any error in that chain puts it back on a
	// fraction. Tint touches no geometry, so there is nothing to resample.
	const TAU = Math.PI * 2;
	/** How far the dimmest point of the breath drops below full brightness. */
	const IDLE_TINT = 0.09;
	const IDLE_TINT_HZ = 0.17;
	const NO_IDLE = 0xffffff;

	// Spinning symbols are stretched, narrowed and faded rather than blurred with a real filter: a
	// filter costs a render-target pass per reel, which this game cannot afford. The stretch is
	// sized to roughly match how far a symbol travels between two frames, which is what makes the
	// strip read as motion instead of as the slideshow it was (edge energy fell only 18% mid-spin).
	const SPIN_STRETCH = 0.26;
	const SPIN_SQUEEZE = 0.08;
	const SPIN_FADE = 0.15;
	// Stretching alone leaves the symbol razor-sharp — it reads as a squashed symbol, not a fast one.
	// Two faint copies trailing above and below smear it along the direction of travel, which is the
	// actual look of a blurred reel, and costs two extra batched sprites per cell instead of a
	// filter's render target. Drawn before the symbol so it stays the sharpest thing in the cell.
	const SPIN_GHOSTS = [
		{ offset: -0.5, alpha: 0.3 },
		{ offset: 0.5, alpha: 0.3 },
	];

	// Every so often a small clump of symbols rattles, like a sign shaken by a passing ride. This one
	// IS geometric, which the constant breath deliberately is not — and it is safe for the opposite
	// reason: it is several pixels of fast motion over a third of a second, so the resampling that
	// made a sub-pixel drift twinkle is buried under the movement itself. Keep it big and brief; a
	// slow or tiny version brings the shimmer straight back.
	const SHAKE_GAP = { min: 4, max: 9 };
	const SHAKE_SECONDS = 0.5;
	// 0.11 of SYMBOL_H is ~11px on a desktop board and still inside the cell's 17-unit horizontal
	// margin, so nothing clips. The first version at 0.055 was invisible in play.
	const SHAKE_AMPLITUDE = 0.11;
	const SHAKE_HZ = 11;
	const SHAKE_STAGGER = 0.055; // per cell, so the clump ripples instead of moving as a block

	// The reels hitting their stop. Every landing adds an impulse to one shared damped oscillator, so
	// five reels stopping in sequence keep knocking the board rather than each starting a new shake;
	// the last reel hits hardest, which is what gives the round a full stop.
	const LAND_SHAKE = { impulse: 4.2, lastImpulse: 7.5, hz: 15, decay: 9 };

	let idleClock = $state(0);
	let idleAmount = $state(0);
	let spinBlur = $state<number[]>(new Array(BOARD_DIMENSIONS.x).fill(0));
	/** Cell key -> its delay into the current rattle. Empty between events. */
	let shakeCells = $state(new Map<string, number>());
	let shakeStartedAt = $state(-Infinity);
	let nextShakeAt = SHAKE_GAP.min;

	let landShakeEnergy = 0;
	let landShakePhase = 0;
	const seenLandingSequence = new Array<number>(BOARD_DIMENSIONS.x).fill(-1);

	const pickShakeGroup = () => {
		const reel = Math.floor(Math.random() * BOARD_DIMENSIONS.x);
		const row = Math.floor(Math.random() * BOARD_DIMENSIONS.y);
		const wanted = 3 + Math.floor(Math.random() * 3);
		const group = new Map<string, number>();
		// Ordered so the clump grows outward from the chosen cell and stays contiguous.
		for (const [dReel, dRow] of [
			[0, 0],
			[1, 0],
			[0, 1],
			[1, 1],
			[-1, 0],
			[0, -1],
		]) {
			if (group.size >= wanted) break;
			const r = reel + dReel;
			const w = row + dRow;
			if (r < 0 || r >= BOARD_DIMENSIONS.x || w < 0 || w >= BOARD_DIMENSIONS.y) continue;
			group.set(`${r},${w}`, group.size * SHAKE_STAGGER);
		}
		return group;
	};

	/** Eases `value` toward `target`, snapping the tail so a settled reel ends exactly sharp. */
	const approach = (value: number, target: number, rate: number, delta: number) => {
		const next = value + (target - value) * Math.min(1, delta * rate);
		return Math.abs(next - target) < 0.004 ? target : next;
	};

	onMount(() => {
		let frame = 0;
		const started = performance.now();
		let previous = started;
		const tick = (now: number) => {
			// Clamped so a backgrounded tab does not resume with a jump.
			const delta = Math.min((now - previous) / 1000, 0.1);
			previous = now;

			winPulse = hasWinState ? 1.05 + Math.sin((now - started) * 0.012) * 0.06 : 1;

			idleClock += delta;
			// Held at zero while anything is moving and eased back slowly, so the breathing never
			// fights the landing bounce; dropped fast when a spin starts.
			idleAmount = approach(
				idleAmount,
				isAnyReelSpinning ? 0 : 1,
				isAnyReelSpinning ? 16 : 2.4,
				delta,
			);

			for (let reel = 0; reel < spinBlur.length; reel += 1) {
				const spinning = board[reel]?.reelState.motion === 'spinning';
				spinBlur[reel] = approach(spinBlur[reel], spinning ? 1 : 0, spinning ? 12 : 18, delta);

				const sequence = board[reel]?.reelState.landingSequence ?? 0;
				if (sequence !== seenLandingSequence[reel]) {
					const first = seenLandingSequence[reel] === -1;
					seenLandingSequence[reel] = sequence;
					// Skipped on the very first render, where every reel reports its starting sequence.
					if (!first) {
						const last = reel === BOARD_DIMENSIONS.x - 1;
						landShakeEnergy += last ? LAND_SHAKE.lastImpulse : LAND_SHAKE.impulse;
						// Restart the swing on every hit so each impulse begins by driving downward.
						landShakePhase = 0;
					}
				}
			}

			if (landShakeEnergy > 0.05) {
				landShakePhase += delta * LAND_SHAKE.hz * TAU;
				landShakeEnergy *= Math.exp(-LAND_SHAKE.decay * delta);
				boardShake.y = Math.sin(landShakePhase) * landShakeEnergy;
				// A little sideways sway, off the vertical rhythm, so it reads as a knock rather than
				// as a lift.
				boardShake.x = Math.sin(landShakePhase * 0.63) * landShakeEnergy * 0.35;
			} else if (landShakeEnergy !== 0) {
				landShakeEnergy = 0;
				boardShake.x = 0;
				boardShake.y = 0;
			}

			// Only once the board is fully settled, and never over a win — the win presentation owns
			// the symbols then.
			if (idleAmount > 0.99 && !hasWinState && idleClock >= nextShakeAt) {
				shakeCells = pickShakeGroup();
				shakeStartedAt = idleClock;
				nextShakeAt = idleClock + SHAKE_GAP.min + Math.random() * (SHAKE_GAP.max - SHAKE_GAP.min);
			} else if (shakeCells.size > 0 && idleClock - shakeStartedAt > SHAKE_SECONDS + 0.4) {
				shakeCells = new Map();
			}

			frame = requestAnimationFrame(tick);
		};
		frame = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(frame);
	});

	/** Horizontal rattle for this cell, in board units. Zero for everything not in the clump. */
	const shakeOffset = (reel: number, row: number) => {
		if (shakeCells.size === 0) return 0;
		const delay = shakeCells.get(`${reel},${row}`);
		if (delay === undefined) return 0;
		const elapsed = idleClock - shakeStartedAt - delay;
		if (elapsed < 0 || elapsed > SHAKE_SECONDS) return 0;
		const progress = elapsed / SHAKE_SECONDS;
		// Squared decay: a hard first swing that dies away, rather than a even wobble.
		const damping = (1 - progress) ** 2;
		return Math.sin(progress * SHAKE_HZ * TAU) * SHAKE_AMPLITUDE * SYMBOL_H * damping;
	};

	/** Grey tint for this cell's point in the breath. Tint multiplies, so it can only darken. */
	const idleTint = (reel: number, row: number) => {
		if (idleAmount < 0.002) return NO_IDLE;
		// A rattling symbol comes up to full brightness — the bulbs flare as it is jolted.
		if (shakeCells.has(`${reel},${row}`)) return NO_IDLE;
		const phase = reel * 0.83 + row * 1.37;
		const dip = 0.5 + 0.5 * Math.cos(idleClock * IDLE_TINT_HZ * TAU + phase);
		const level = Math.round(255 * (1 - dip * IDLE_TINT * idleAmount));
		return (level << 16) | (level << 8) | level;
	};

	// Reels whose symbols should be hidden behind the low-symbol expanded overlay.
	// Added one-by-one with a small delay so the overlay sprite starts drawing first.
	let hiddenReels = $state(new Set<number>());

	$effect(() => {
		const expanded = context.stateGame.expandedSymbol;
		// Reset when no expansion, non-low symbol, OR reels cleared for next spin
		if (!expanded || !LOW_SYMBOLS_SET.has(expanded.symbol) || expanded.reels.length === 0) {
			if (hiddenReels.size > 0) hiddenReels = new Set<number>();
			return;
		}
		const lastReel = expanded.reels[expanded.reels.length - 1];
		if (hiddenReels.has(lastReel)) return;
		const t = setTimeout(() => {
			hiddenReels = new Set([...hiddenReels, lastReel]);
		}, 80);
		return () => clearTimeout(t);
	});

	const hasActiveAnticipation = () => board.some((reel) => reel.reelState.anticipating);
	const stopReelsForSkip = () => {
		if (hasActiveAnticipation()) {
			context.stateGameDerived.enhancedBoard.forceStop();
			return;
		}
		context.stateGameDerived.enhancedBoard.stop();
	};
	const requestSpinSkip = () => {
		if (context.stateGame.awaitingFirstReveal) {
			context.stateGame.pendingStop = true;
			return;
		}
		if (context.stateGame.hasAnticipationPending && !hasActiveAnticipation()) {
			context.stateGame.hasAnticipationPending = false;
			context.eventEmitter.broadcast({ type: 'skipToAnticipation' });
			return;
		}
		context.eventEmitter.broadcast({ type: 'stopButtonClick' });
	};

	context.eventEmitter.subscribeOnMount({
		stopButtonClick: () => stopReelsForSkip(),
		skipToAnticipation: () => board.forEach((reel) => reel.stop()),
		boardSettle: ({ board }) => context.stateGameDerived.enhancedBoard.settle(board),
		boardShow: () => (show = true),
		boardHide: () => (show = false),
		boardWithAnimateSymbols: async ({ symbolPositions }) => {
			// Event positions use VISIBLE coordinates (row 0-4); the settled reel
			// symbols include 1 padding row on top (contract ROW_OFFSET = 1).
			const ROW_OFFSET = 1;
			for (const position of symbolPositions) {
				const reelSymbol =
					context.stateGame.board[position.reel].reelState.symbols[position.row + ROW_OFFSET];
				if (reelSymbol) reelSymbol.symbolState = 'win';
			}
		},
	});

	context.stateGameDerived.enhancedBoard.readyToSpinEffect();
</script>

{#if isAnyReelSpinning}
	<OnPressFullScreen onpress={requestSpinSkip} />
{/if}

{#if show}
	<Container
		x={layout.x + boardShake.x}
		y={layout.y + BOARD_GRID_OFFSET_Y + boardShake.y}
		pivot={layout.pivot}
		scale={layout.boardScale}
	>
		<Graphics isMask draw={drawBoardContentMask} />
		<!-- The 5x5 grid exists only in board-lines.webp. The cell mask above leaves its exact dividers
		     and outer edges unobstructed instead of repainting a second grid at a higher layer. -->
		{#each board as reel, reelIndex (reelIndex)}
			{#if !hiddenReels.has(reelIndex)}
				{#each reel.reelState.symbols as reelSymbol, symbolIndex (symbolIndex)}
					{@const y = reelSymbol.symbolY()}
					{@const isWin = reelSymbol.symbolState === 'win'}
					{#if !rollerClearedSet.has(`${reelIndex},${symbolIndex - 1}`) && !coasterCellSet.has(`${reelIndex},${symbolIndex - 1}`)}
						{@const position = boardPosition(reelIndex, symbolIndex - 1)}
						{@const duckPrize = getDuckCollectPrize(reelIndex, symbolIndex - 1)}
						{@const idle = isWin ? NO_IDLE : idleTint(reelIndex, symbolIndex - 1)}
						{@const blur = spinBlur[reelIndex] ?? 0}
						{@const shake = isWin ? 0 : shakeOffset(reelIndex, symbolIndex - 1)}
						{@const fallbackKey = getSpriteKey(
							reelSymbol.rawSymbol,
							reelSymbol.symbolState,
							reelIndex,
							symbolIndex - 1,
						)}
						{@const animationKey = getAnimationKey(
							reelSymbol.rawSymbol,
							reelSymbol.symbolState,
							reelIndex,
							symbolIndex - 1,
						)}
						<!-- Keep one DC component mounted for front idle -> turn -> rear idle. No
						     Board/presenter swap, so variant, scale and timeline stay continuous. -->
						<!-- Settled Roller cells are the multiplier itself, not a Mega Wild symbol with a
						     badge over it. This lives inside the moving reel symbol loop, so the unchanged
						     plaques roll out naturally on the following spin. -->
						<LandingSquish
							trigger={reel.reelState.landingSequence}
							x={getX(reelIndex)}
							{y}
							durationMs={reelBounceDurationMs(reelIndex)}
						>
							{#if isRollerMultiplierCell(reelSymbol.rawSymbol, reelIndex, symbolIndex - 1)}
								{#if symbolIndex - 1 === Math.floor(BOARD_DIMENSIONS.y / 2)}
									<MegaWildFullReel
										x={getX(reelIndex)}
										{y}
										fakeMultiplier={reelSymbol.rawSymbol.reelMultiplier ?? 1}
										multiplier={reelSymbol.rawSymbol.reelMultiplier ?? 1}
										animationName={!reelSymbol.rawSymbol.rollerExpanded
											? 'intro'
											: isRollerReelWinning(reelIndex, reelSymbol.rawSymbol.reelMultiplier ?? 1)
												? 'win'
												: 'idle'}
										alpha={hasWinState &&
										!isRollerReelWinning(reelIndex, reelSymbol.rawSymbol.reelMultiplier ?? 1)
											? 0.35
											: 1}
									/>
								{/if}
							{:else if reelSymbol.rawSymbol.name === 'DC'}
								<DuckPondDuck
									x={getX(reelIndex)}
									{y}
									size={DUCK_SYMBOL_SIZE}
									variant={duckVariant(reelSymbol.rawSymbol, position)}
									look={duckLook(reelSymbol.rawSymbol, position)}
									prize={duckPrize ? { kind: duckPrize.kind, value: duckPrize.value } : null}
									revealing={isDuckCollectRevealing(reelIndex, symbolIndex - 1)}
									turned={isDuckCollectTurned(reelIndex, symbolIndex - 1)}
									batch={context.stateGame.duckRevealBatch}
									alpha={hasWinState && !isWin ? 0.35 : 1}
									onrevealcomplete={() => finishDuckCollectReveal(position)}
								/>
							{:else if animationKey}
								<LoopingAssetSprite
									{animationKey}
									{fallbackKey}
									restartKey={`${reelSymbol.rawSymbol.name}:${reelSymbol.symbolState}`}
									x={getX(reelIndex)}
									{y}
									anchor={{ x: 0.5, y: 0.5 }}
									width={SYMBOL_W * (isWin ? winPulse : 1) * (1 - SPIN_SQUEEZE * blur)}
									height={SYMBOL_H * (isWin ? winPulse : 1) * (1 + SPIN_STRETCH * blur)}
									alpha={(hasWinState && !isWin ? 0.35 : 1) * (1 - SPIN_FADE * blur)}
								/>
							{:else}
								<!-- The static base symbols: the ones that were dead on the board, so these carry
								     the idle breath, the rattle and the spin trail. -->
								{#if blur > 0.02}
									{#each SPIN_GHOSTS as ghost, ghostIndex (ghostIndex)}
										<Sprite
											key={fallbackKey}
											x={getX(reelIndex)}
											y={y + ghost.offset * SYMBOL_H * blur}
											anchor={{ x: 0.5, y: 0.5 }}
											width={SYMBOL_W * (1 - SPIN_SQUEEZE * blur)}
											height={SYMBOL_H * (1 + SPIN_STRETCH * blur)}
											alpha={ghost.alpha * blur}
										/>
									{/each}
								{/if}
								<Sprite
									key={fallbackKey}
									x={getX(reelIndex) + shake}
									{y}
									anchor={{ x: 0.5, y: 0.5 }}
									tint={idle}
									width={SYMBOL_W * (isWin ? winPulse : 1) * (1 - SPIN_SQUEEZE * blur)}
									height={SYMBOL_H * (isWin ? winPulse : 1) * (1 + SPIN_STRETCH * blur)}
									alpha={(hasWinState && !isWin ? 0.35 : 1) * (1 - SPIN_FADE * blur)}
								/>
							{/if}
						</LandingSquish>
					{/if}
				{/each}
			{/if}
		{/each}
	</Container>
{/if}
