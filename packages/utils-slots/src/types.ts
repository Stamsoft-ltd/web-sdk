import type { FirstArgOf } from 'utils-shared/types';

import type { createReelForSpinning } from './createReelForSpinning.svelte';
import type { createReelForCascading } from './createReelForCascading.svelte';

export type SpinType = 'normal' | 'fast' | 'anticipated';

// How the eased leg into the bounce point is configured. The two routes are mutually exclusive so
// a game cannot end up carrying one live and one dead stop configuration.
type SpinningReelStopOptions =
	| {
			// Preferred. Exponent p of the stop easing `1 − (1 − t)^p`, from which createReelForSpinning
			// derives the leg's duration (`p × distance / reelSpinSpeed`). The leg therefore begins at
			// exactly the speed the reel was already travelling — velocity-continuous on every path
			// that reaches it, whichever options object supplied that speed.
			// p = 1 is linear (continuous but no deceleration); p = 2 is constant deceleration. Raising
			// p brakes harder at the junction and trails off longer, over a proportionally longer leg —
			// duration and curve are one knob, not two. Values below 1 would accelerate and non-finite
			// values would stall the reel; both fall back to p = 1.
			reelStopEasingPower: number;
			reelSpinSpeedBeforeBounce?: never;
			reelStopEasing?: never;
	  }
	| {
			reelStopEasingPower?: never;
			// Legacy. Because slideY derives duration from speed, an eased leg actually *starts* at
			// `reelStopEasing'(0) × this` — so one value cannot be continuous with `reelSpinSpeed` for
			// more than one options object at a time. Prefer `reelStopEasingPower`.
			reelSpinSpeedBeforeBounce: number;
			// Easing for the final approach into the bounce point (normal/anticipated spins). Without it
			// the landing segment runs at constant speed, which reads as a hard cut rather than a
			// weighted settle.
			reelStopEasing?: (t: number) => number;
	  };

export type SpinningReelSpinOptions = {
	// speed (pixel / ms)
	reelPreSpinSpeed: number;
	reelBounceBackSpeed: number;
	reelSpinSpeed: number;
	// size
	reelBounceSizeMulti: number;
	// extra padding
	reelPaddingMultiplierNormal: number;
	reelPaddingMultiplierAnticipated: number;
	reelSpinDelay: number;
} & SpinningReelStopOptions;

export type CascadingReelSpinOptions = {
	// speed (pixel / ms) and intervals(ms) between reels/symbols
	symbolFallInSpeed: number;
	symbolFallInInterval: number;
	symbolFallInBounceSpeed: number;
	symbolFallInBounceSizeMulti: number;
	symbolFallOutSpeed: number;
	symbolFallOutInterval: number;
	// reel
	reelFallInDelay: number;
	// extra padding
	reelPaddingMultiplierNormal: number;
	reelPaddingMultiplierAnticipated: number;
	reelFallOutDelay: number;
};

type ReelCreateOptions<TRawSymbol extends object, TSymbolState extends string> = {
	initialSymbols: TRawSymbol[];
	initialSymbolState: TSymbolState;
	reelIndex: number;
	symbolHeight: number;
	onReelStopping: () => void;
	onSymbolLand: (args: { rawSymbol: TRawSymbol }) => void;
};

export type SpinningReelCreateOptions<
	TRawSymbol extends object,
	TSymbolState extends string,
> = ReelCreateOptions<TRawSymbol, TSymbolState>;

export type CascadingReelCreateOptions<
	TRawSymbol extends object,
	TSymbolState extends string,
> = ReelCreateOptions<TRawSymbol, TSymbolState>;

export type SpinningReel<TRawSymbol extends object, TSymbolState extends string> = ReturnType<
	typeof createReelForSpinning<TRawSymbol, TSymbolState>
>;
export type CascadingReel<TRawSymbol extends object, TSymbolState extends string> = ReturnType<
	typeof createReelForCascading<TRawSymbol, TSymbolState>
>;

export type Reel<TRawSymbol extends object, TSymbolState extends string> =
	| SpinningReel<TRawSymbol, TSymbolState>
	| CascadingReel<TRawSymbol, TSymbolState>;

export type FallOptionsTurbo = {
	fallInSpeedTurbo: number;
	fallInIntervalTurbo: number;
	fallInBounceTurbo: number;
	fallInBounceDistanceTurbo: number;

	fallOutSpeedTurbo: number;
	fallOutIntervalTurbo: number;
};

export type GetRawSymbolFromReel<TReel extends Reel<any, any>> = NonNullable<
	FirstArgOf<TReel['setSymbolsWithRawSymbols']>
>[number];
