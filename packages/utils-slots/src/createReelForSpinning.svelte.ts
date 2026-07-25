import _ from 'lodash';
import { Tween } from 'svelte/motion';
import { sineOut, backIn, linear } from 'svelte/easing';

import { stateBet } from 'state-shared';
import { waitForTimeout } from 'utils-shared/wait';
import { createInterruptible } from 'utils-shared/interruptible';

import type { SpinningReelCreateOptions, SpinningReelSpinOptions, SpinType } from './types';

export type SpinningReelMotion = 'spinning' | 'bouncing' | 'stopped';
export type SpinningReelSymbolState = 'static' | 'land' | 'spin';

export function createReelForSpinning<TRawSymbol extends object, TSymbolState extends string>(
	reelOptions: SpinningReelCreateOptions<TRawSymbol, TSymbolState>,
) {
	// reelSymbols
	const createReelSymbol = (reelSymbolOptions: { rawSymbol: TRawSymbol; symbolIndex: number }) => {
		const rawSymbol = reelSymbolOptions.rawSymbol;
		const symbolIndex = reelSymbolOptions.symbolIndex;
		const symbolState = reelOptions.initialSymbolState;
		const symbolY = () => reelY.current + (reelSymbol.symbolIndex + 0.5) * reelOptions.symbolHeight;
		const oncomplete = () => {};

		const reelSymbol = $state({
			id: {},
			rawSymbol,
			symbolIndex,
			symbolState,
			symbolY,
			oncomplete,
		});

		return reelSymbol;
	};

	type ReelSymbol = ReturnType<typeof createReelSymbol>;

	const createReelSymbols: (value: TRawSymbol[]) => ReelSymbol[] = (rawSymbols) => {
		const reelSymbols = rawSymbols.map((rawSymbol, symbolIndex) =>
			createReelSymbol({ rawSymbol, symbolIndex }),
		);

		return reelSymbols;
	};

	const updateAllReelSymbolState = (value: SpinningReelSymbolState) => {
		reelState.symbols.forEach((reelSymbol) => {
			reelSymbol.symbolState = value as TSymbolState;
			if (value === 'land') {
				reelOptions.onSymbolLand({ rawSymbol: reelSymbol.rawSymbol });
			}
		});
	};

	// constants
	const defaultY = -reelOptions.symbolHeight;
	const reelLength = reelOptions.initialSymbols.length;

	// interruptible
	const interruptible = createInterruptible();
	// Separate escape hatch for noStop reels (anticipated spins) — resolved by forceStop().
	let forceStopResolve: (() => void) | null = null;

	// reactive states
	const reelY = new Tween(defaultY);
	const reelState = $state({
		symbols: createReelSymbols(reelOptions.initialSymbols),
		motion: 'stopped' as SpinningReelMotion,
		spinType: 'normal' as SpinType,
		anticipating: false,
		readyToSpin: () => {},
		spinOptions: () => ({}) as SpinningReelSpinOptions,
	});
	const basePaddingSize = () => reelLength * reelState.spinOptions().reelPaddingMultiplierNormal;
	const anticipatedPaddingSize = () =>
		reelLength * reelState.spinOptions().reelPaddingMultiplierAnticipated;

	// internal states
	let isPreSpinning = false;
	let targetPaddingPosition = reelLength - 1;
	let prevSymbols: ReelSymbol[] = createReelSymbols(reelOptions.initialSymbols);
	let targetSymbols: ReelSymbol[] = createReelSymbols(reelOptions.initialSymbols);
	let paddingRawReel: TRawSymbol[] = reelOptions.initialSymbols;
	let onSpinFinishing: () => void = () => {};
	let noStop = false;
	let paddingSize = 0;

	const getPaddingRawSymbol = ({
		paddingRawReel,
		index,
	}: {
		paddingRawReel: TRawSymbol[];
		index: number;
	}) => {
		const length = paddingRawReel.length;
		if (index >= length) return paddingRawReel[index % length];
		if (index <= -1) return paddingRawReel[length + index];
		return paddingRawReel[index];
	};

	const getPaddingRawSymbols = ({
		paddingRawReel,
		start,
		length,
	}: {
		paddingRawReel: TRawSymbol[];
		start: number;
		length: number;
	}) =>
		_.range(length).map((index) => {
			const targetIndex = start + index;
			return getPaddingRawSymbol({ paddingRawReel, index: targetIndex });
		});

	const addPadding = async (paddingSizeValue: number) => {
		const paddingRawSymbols = getPaddingRawSymbols({
			paddingRawReel,
			start: targetPaddingPosition,
			length: paddingSizeValue,
		});
		const paddingSymbols = createReelSymbols(paddingRawSymbols);
		const symbolsForSpin: ReelSymbol[] = [...targetSymbols, ...paddingSymbols, ...prevSymbols];
		symbolsForSpin.forEach((symbol, newSymbolIndex) => (symbol.symbolIndex = newSymbolIndex));
		reelState.symbols = [...symbolsForSpin];

		const topY =
			defaultY -
			symbolsForSpin.length * reelOptions.symbolHeight +
			reelLength * reelOptions.symbolHeight;
		return topY;
	};

	const slideY = async ({
		reelY: targetY,
		speed,
		easing = undefined,
	}: {
		reelY: number;
		speed: number;
		easing?: (value: number) => number;
	}) => {
		const currentY = reelY.current;
		const distance = Math.abs(targetY - currentY);
		const duration = distance / speed; // (speed unit: pixel / ms)

		await reelY.set(targetY, { duration, easing });
	};

	const placeY = (targetY: number) => reelY.set(targetY, { duration: 0 });

	const removePaddingAndBounceBack = async () => {
		reelState.symbols = [...targetSymbols];
		placeY(defaultY + reelOptions.symbolHeight * reelState.spinOptions().reelBounceSizeMulti);
		await slideY({
			reelY: defaultY,
			speed: reelState.spinOptions().reelBounceBackSpeed,
			easing: sineOut,
		});
		setSymbolsWithReelSymbols(targetSymbols);
	};

	const preSpinPadding = async ({
		preSpinPaddingRawReel,
	}: {
		preSpinPaddingRawReel: TRawSymbol[];
	}) => {
		const randomStart = Math.floor(Math.random() * preSpinPaddingRawReel.length);
		prevSymbols = targetSymbols;
		const targetRawSymbols = getPaddingRawSymbols({
			paddingRawReel: preSpinPaddingRawReel,
			start: randomStart,
			length: reelLength,
		});
		targetSymbols = createReelSymbols(targetRawSymbols);
		const topY = await addPadding(0);
		await placeY(topY);
	};

	const preSpinSlideDownLoop = async ({
		isTurboBeforeAll,
		preSpinPaddingRawReel,
	}: {
		isTurboBeforeAll: boolean;
		preSpinPaddingRawReel: TRawSymbol[];
	}) => {
		let started = false;
		while (isPreSpinning) {
			const speed = started
				? reelState.spinOptions().reelSpinSpeed
				: reelState.spinOptions().reelPreSpinSpeed;
			const easing = started || isTurboBeforeAll ? linear : backIn;
			await slideY({ reelY: defaultY, speed, easing });
			await preSpinPadding({ preSpinPaddingRawReel });
			if (!started) {
				reelState.motion = 'spinning';
				updateAllReelSymbolState('spin');
				started = true;
			}
		}
	};

	const delaySpinByReelIndex = async () => {
		await waitForTimeout(reelState.spinOptions().reelSpinDelay * reelOptions.reelIndex);
	};

	const preSpin = async ({
		isTurboBeforeAll,
		preSpinPaddingReel,
	}: {
		isTurboBeforeAll: boolean; // To avoid previous spinType has effect on "getSpinOption" in "preSpinSlideDownLoop"
		preSpinPaddingReel: TRawSymbol[];
	}) => {
		const preSpinPaddingRawReel = preSpinPaddingReel;

		isPreSpinning = true;
		reelState.spinType = isTurboBeforeAll ? 'fast' : 'normal';
		await preSpinPadding({ preSpinPaddingRawReel });
		if (!isTurboBeforeAll) await delaySpinByReelIndex();
		preSpinSlideDownLoop({ isTurboBeforeAll, preSpinPaddingRawReel });
	};

	const generalSpinWith = async ({ slideDown }: { slideDown: () => Promise<void> }) => {
		const isSpinning = reelState.motion === 'spinning';

		const topY = await addPadding(paddingSize);
		await placeY(topY);

		if (!isSpinning) {
			reelState.motion = 'spinning';
			updateAllReelSymbolState('spin');
		}

		// Q: When to skip the slideDown?
		// A: When it's preSpinning(isSpinning) and stop button is clicked(isTurbo) and is noStop is false
		let wasForced = false;
		if (stateBet.isSuperTurbo) {
			await slideDown();
		} else if (noStop) {
			// noStop reels are normally un-interruptible but can be force-stopped via forceStop().
			const forcePromise = new Promise<void>((resolve) => {
				forceStopResolve = () => { wasForced = true; resolve(); };
			});
			await Promise.race([slideDown(), forcePromise]);
			forceStopResolve = null;
		} else if ((stateBet.isTurbo || stateBet.isSuperTurbo) && isSpinning) {
			// skip
		} else {
			await interruptible.add(slideDown);
		}

		if (wasForced) {
			// Snapped by forceStop — settle symbols immediately without bounce.
			reelState.symbols = [...targetSymbols];
			placeY(defaultY);
			reelState.motion = 'stopped';
			updateAllReelSymbolState('land');
			return;
		}

		reelState.motion = 'bouncing';
		onSpinFinishing();
		await removePaddingAndBounceBack();
		reelState.motion = 'stopped';
		updateAllReelSymbolState('land');
	};

	const fastSpin = () =>
		generalSpinWith({
			slideDown: async () => {
				const bounceSize = reelOptions.symbolHeight * reelState.spinOptions().reelBounceSizeMulti;

				await slideY({
					reelY: defaultY + bounceSize,
					speed: reelState.spinOptions().reelSpinSpeed,
				});
			},
		});

	// A linear leg down to the padding position, then an eased leg into the bounce point.
	//
	// `slideY` derives duration from speed (`duration = distance / speed`), so for an easing `f` the
	// leg's *initial* velocity is `f'(0) × speed`, not `speed`. Feeding it a hand-picked
	// `reelSpinSpeedBeforeBounce` therefore steps the velocity by `f'(0) × reelSpinSpeedBeforeBounce
	// / reelSpinSpeed` at the junction — and since the incoming speed varies per options object
	// (default / anticipated / fast / turbo, all of which can reach this leg), one constant cannot
	// match them all.
	//
	// `reelStopEasingPower` (p) fixes that by deriving the leg instead: `f(t) = 1 − (1 − t)^p` has
	// `f'(0) = p`, so passing `speed = spinSpeed / p` yields `duration = p × distance / spinSpeed`
	// and an initial velocity of exactly `spinSpeed` — whatever speed the active path supplied.
	// Duration and curve are one knob, not two: p sets the junction deceleration
	// (`spinSpeed² × (p − 1) / (p × distance)`, rising with p) and the leg length together. Note that
	// any velocity-continuous decelerating leg is necessarily longer than `distance / spinSpeed`,
	// because a curve that decelerates from `f'(0)` to 0 averages less than `f'(0)`.
	//
	// The whole stop config is read once, before leg 1, so the speed carried into the junction and
	// the strategy used to match it can never come from different options objects (turbo can be
	// toggled mid-spin).
	const slideDownToBounce = async () => {
		const spinOptions = reelState.spinOptions();
		const spinSpeed = spinOptions.reelSpinSpeed;
		const bounceSize = reelOptions.symbolHeight * spinOptions.reelBounceSizeMulti;

		await slideY({
			reelY: defaultY * basePaddingSize(),
			speed: spinSpeed,
		});

		const bounceY = defaultY + bounceSize;
		const configuredPower = spinOptions.reelStopEasingPower;

		if (configuredPower === undefined) {
			await slideY({
				reelY: bounceY,
				speed: spinOptions.reelSpinSpeedBeforeBounce,
				easing: spinOptions.reelStopEasing,
			});
			return;
		}

		// p < 1 would accelerate into the stop and a non-finite p would stall the reel on an infinite
		// duration. Both are config errors; degrade to p = 1 — linear, still velocity-continuous.
		const power = Number.isFinite(configuredPower) && configuredPower >= 1 ? configuredPower : 1;

		await slideY({
			reelY: bounceY,
			speed: spinSpeed / power,
			easing: (t: number) => 1 - (1 - t) ** power,
		});
	};

	const normalSpin = () => generalSpinWith({ slideDown: slideDownToBounce });

	const anticipatedSpin = () => generalSpinWith({ slideDown: slideDownToBounce });

	const SPIN_MAP = {
		fast: fastSpin,
		normal: normalSpin,
		anticipated: anticipatedSpin,
	};

	const prepareToSpin = (prepareToSpinOptions: {
		noStop: boolean;
		spinType: SpinType;
		symbols: TRawSymbol[];
		paddingPosition: number;
		paddingReel: TRawSymbol[];
		onSpinFinishing: () => void;
		previousPaddingSize: number;
	}) => {
		reelState.spinType = prepareToSpinOptions.spinType;

		noStop = prepareToSpinOptions.noStop;
		prevSymbols = targetSymbols;
		targetPaddingPosition = prepareToSpinOptions.paddingPosition;
		targetSymbols = createReelSymbols(prepareToSpinOptions.symbols);
		paddingRawReel = prepareToSpinOptions.paddingReel;
		onSpinFinishing = prepareToSpinOptions.onSpinFinishing;

		const GET_PADDING_SIZE_MAP = {
			fast: prepareToSpinOptions.previousPaddingSize + 0,
			normal: prepareToSpinOptions.previousPaddingSize + basePaddingSize(),
			anticipated: prepareToSpinOptions.previousPaddingSize + anticipatedPaddingSize(),
		};

		paddingSize = GET_PADDING_SIZE_MAP[prepareToSpinOptions.spinType];

		return paddingSize;
	};

	const spin = async () => {
		isPreSpinning = false;

		await SPIN_MAP[reelState.spinType]();

		interruptible.clear();
	};

	const setSymbolsWithReelSymbols = (reelSymbols?: ReelSymbol[]) => {
		reelState.motion = 'stopped';
		placeY(defaultY);
		if (reelSymbols) {
			prevSymbols = [...reelSymbols];
			targetSymbols = [...reelSymbols];
			paddingRawReel = reelOptions.initialSymbols;
			reelState.symbols = [...reelSymbols];
		}
	};

	const setSymbolsWithRawSymbols = (rawSymbols?: TRawSymbol[]) => {
		const newSymbols = rawSymbols ? createReelSymbols(rawSymbols) : undefined;
		setSymbolsWithReelSymbols(newSymbols);
	};

	const stop = () => {
		interruptible.interrupt();
		// Snap to defaultY during pre-spin so readyToSpin fires immediately instead of
		// waiting for the current slideY loop to complete naturally.
		if (isPreSpinning) placeY(defaultY);
	};

	// Interrupts even noStop (anticipated) reels. Use when the player explicitly skips.
	const forceStop = () => {
		interruptible.interrupt();
		forceStopResolve?.();
		if (isPreSpinning) placeY(defaultY);
	};

	const readyToSpinEffect = () => {
		$effect(() => {
			if (reelY.current === defaultY) {
				reelState.readyToSpin();
			}
		});
	};

	return {
		// from options
		reelIndex: reelOptions.reelIndex,
		symbolHeight: reelOptions.symbolHeight,
		onReelStopping: reelOptions.onReelStopping,
		reelLength,
		// reactive states
		reelState,
		// methods
		preSpin,
		prepareToSpin,
		spin,
		stop,
		forceStop,
		setSymbolsWithRawSymbols,
		readyToSpinEffect,
	};
}
