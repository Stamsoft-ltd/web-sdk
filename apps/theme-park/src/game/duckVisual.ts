import { BOARD_DIMENSIONS } from './constants';
import type { Position } from './types';

export const DUCK_VARIANT_COUNT = 8;
export const DUCK_ACCESSORY_COLOR_COUNT = 4;
export const DUCK_LOOK_COUNT = 1 + DUCK_ACCESSORY_COLOR_COUNT * 2 + DUCK_ACCESSORY_COLOR_COUNT ** 2;

/** Deterministic 32-bit mixer. Book-event index is the seed; cell/pond index is the stream. */
const seededDuckValue = (eventId: number, duckIndex: number, salt: number) => {
	let value =
		(eventId | 0) ^ Math.imul((duckIndex | 0) + 1, 0x9e3779b1) ^ Math.imul(salt, 0x85ebca6b);
	value = Math.imul(value ^ (value >>> 16), 0x7feb352d);
	value = Math.imul(value ^ (value >>> 15), 0x846ca68b);
	return (value ^ (value >>> 16)) >>> 0;
};

const seededChoice = (eventId: number, duckIndex: number, salt: number, count: number) =>
	seededDuckValue(eventId, duckIndex, salt) % count;

/**
 * 0 standard; 1-4 glasses; 5-8 party hat; 9-24 both. Hat/glasses colors are
 * independently random for the combined look.
 */
export const duckLookForIndex = (eventId: number, duckIndex: number) => {
	const style = seededChoice(eventId, duckIndex, 1, 4);
	const firstColor = seededChoice(eventId, duckIndex, 2, DUCK_ACCESSORY_COLOR_COUNT);
	const secondColor = seededChoice(eventId, duckIndex, 3, DUCK_ACCESSORY_COLOR_COUNT);
	if (style === 0) return 0;
	if (style === 1) return 1 + firstColor;
	if (style === 2) return 1 + DUCK_ACCESSORY_COLOR_COUNT + firstColor;
	return (
		1 +
		DUCK_ACCESSORY_COLOR_COUNT * 2 +
		firstColor * DUCK_ACCESSORY_COLOR_COUNT +
		secondColor
	);
};

export const duckVariantForIndex = (eventId: number, duckIndex: number) =>
	1 + seededChoice(eventId, duckIndex, 4, DUCK_VARIANT_COUNT);

const positionIndex = ({ reel, row }: Position) =>
	reel * BOARD_DIMENSIONS.y + Math.max(0, row);

/** Stable reel-cell variant for one reveal-event lifecycle, including the following roll-out. */
export const duckVariantForPosition = (position: Position, eventId = 0) =>
	duckVariantForIndex(eventId, positionIndex(position));

/** Stable look for reel-owned ducks, seeded by the reveal event rather than render timing. */
export const duckLookForPosition = (position: Position, eventId = 0) =>
	duckLookForIndex(eventId, positionIndex(position));

export const duckFrontAssetKeyForPosition = (position: Position, eventId = 0) =>
	`duckPondDuck${duckVariantForPosition(position, eventId)}`;
