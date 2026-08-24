import { BOARD_DIMENSIONS } from './constants';
import type { Position } from './types';

// Eight solid floatie hues, each authored with and without the star badge. No stripes.
export const DUCK_SOLID_VARIANTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16] as const;
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

export const seededEventChoice = (
	eventId: number,
	duckIndex: number,
	salt: number,
	count: number,
) => seededDuckValue(eventId, duckIndex, salt) % count;

/**
 * Party hats and sunglasses are shelved. Look 0 is the bare duck in every view the rig plays —
 * front idle, turn, back idle — so the accessory slots stay empty without touching the rig, its
 * atlas or the accessory build scripts. Flip this back to true to restore the authored looks.
 *
 * It lives here, and not on the pond, because the SAME duck shows up in three places: the pond
 * picks, the Duck Collect cell on the base board, and the look baked onto the raw symbol by
 * `bookEventHandlerMap`. Gating only the pond left the board's ducks in hats and shades next to a
 * pond full of bare ones.
 */
export const DUCK_ACCESSORIES_ENABLED = false;

/**
 * 0 standard; 1-4 glasses; 5-8 party hat; 9-24 both. Hat/glasses colors are
 * independently random for the combined look.
 */

export const duckLookForIndex = (eventId: number, duckIndex: number) => {
	if (!DUCK_ACCESSORIES_ENABLED) return 0;
	const style = seededEventChoice(eventId, duckIndex, 1, 4);
	const firstColor = seededEventChoice(eventId, duckIndex, 2, DUCK_ACCESSORY_COLOR_COUNT);
	const secondColor = seededEventChoice(eventId, duckIndex, 3, DUCK_ACCESSORY_COLOR_COUNT);
	if (style === 0) return 0;
	if (style === 1) return 1 + firstColor;
	if (style === 2) return 1 + DUCK_ACCESSORY_COLOR_COUNT + firstColor;
	return 1 + DUCK_ACCESSORY_COLOR_COUNT * 2 + firstColor * DUCK_ACCESSORY_COLOR_COUNT + secondColor;
};

export const duckVariantForIndex = (eventId: number, duckIndex: number) =>
	DUCK_SOLID_VARIANTS[seededEventChoice(eventId, duckIndex, 4, DUCK_SOLID_VARIANTS.length)]!;

const positionIndex = ({ reel, row }: Position) => reel * BOARD_DIMENSIONS.y + Math.max(0, row);

/** Stable reel-cell variant for one reveal-event lifecycle, including the following roll-out. */
export const duckVariantForPosition = (position: Position, eventId = 0) =>
	duckVariantForIndex(eventId, positionIndex(position));

/** Stable look for reel-owned ducks, seeded by the reveal event rather than render timing. */
export const duckLookForPosition = (position: Position, eventId = 0) =>
	duckLookForIndex(eventId, positionIndex(position));
