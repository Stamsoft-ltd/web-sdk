import type config from './config';
import type { Tween } from 'svelte/motion';

export type SymbolName = keyof typeof config.symbols | 'MAGNET';
export type PaySymbolName = Exclude<SymbolName, 'SCATTER' | 'WILD' | 'MAGNET'>;
export type BetMode = keyof typeof config.betModes;
export type GameType = 'basegame' | 'freegame' | 'superspin' | 'feature';
export type SeriesKind = 'natural' | 'magnet' | 'super';

export type RawSymbol = {
	name: SymbolName;
	multiplier?: number;
	scatter?: boolean;
	magnet?: boolean;
	wild?: boolean;
};

export const SYMBOL_STATES = ['static', 'spin', 'land', 'win', 'locked', 'magnet'] as const;
export type SymbolState = (typeof SYMBOL_STATES)[number];

export type Position = {
	reel: number;
	row: number;
};

export type ClusterSeriesSnapshot = {
	id: string;
	symbol: PaySymbolName;
	kind: SeriesKind;
	anchorPositions: Position[];
	lockedPositions: Position[];
	multiplier: number;
	persistent: boolean;
};

export type BoardCell = RawSymbol & {
	key: string;
	position: Position;
	symbolState: SymbolState;
	displayX: Tween<number>;
	displayY: Tween<number>;
	displayAlpha: Tween<number>;
	displayScale: Tween<number>;
	/** Landing impact, 1 at contact decaying to 0 — Board turns it into a squash (wide + short,
	 *  seated on the floor) so a symbol hits the grid like a dropped stone instead of stopping dead. */
	displaySquash: Tween<number>;
	/** performance.now() of the last landing; the dust puff is drawn from it in Board's rAF. */
	landAt: number;
	locked: boolean;
	highlighted: boolean;
	anchor: boolean;
	target: boolean;
	persistent: boolean;
	fresh: boolean;
	pulling: boolean;
};
