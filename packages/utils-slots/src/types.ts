import type { FirstArgOf } from 'utils-shared/types';

import type { createReelForSpinning } from './createReelForSpinning.svelte';
import type { createReelForCascading } from './createReelForCascading.svelte';

export type SpinType = 'normal' | 'fast' | 'anticipated';

export type SpinningReelSpinOptions = {
	// speed (pixel / ms)
	reelPreSpinSpeed: number;
	reelBounceBackSpeed: number;
	reelSpinSpeed: number;
	// Legacy hand-tuned stop leg, used only when `reelStopEasingPower` is unset. Because slideY
	// derives duration from speed, an eased leg actually *starts* at `easing'(0) × this`, so this
	// number cannot be continuous with `reelSpinSpeed` for more than one options object at a time.
	reelSpinSpeedBeforeBounce: number;
	// Easing for the final approach into the bounce point (normal/anticipated spins). Without it the
	// landing segment runs at constant speed, which reads as a hard cut rather than a weighted settle.
	reelStopEasing?: (t: number) => number;
	// Preferred over the two above: exponent p of the stop easing `1 − (1 − t)^p`. Setting it makes
	// createReelForSpinning derive the stop leg from the spin speed actually in force, so the leg
	// begins at exactly `reelSpinSpeed` — velocity-continuous on every path that reaches it.
	// p = 1 linear, p = 2 constant deceleration, p = 3 cubicOut; duration scales with p.
	reelStopEasingPower?: number;
	// size
	reelBounceSizeMulti: number;
	// extra padding
	reelPaddingMultiplierNormal: number;
	reelPaddingMultiplierAnticipated: number;
	reelSpinDelay: number;
};

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
