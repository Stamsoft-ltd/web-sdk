<script lang="ts" module>
	/**
	 * The W on the wild's plate, and how it arrives when the wild wins.
	 *
	 * The redesigned wild (Figma 7052:7925) is a gold oval plate with nothing on it; the tri-colour
	 * letter (7052:7927) is a second drawing, and the two ship apart on purpose, because the letter is
	 * what moves. On a win it pops up from nothing to full size with a little overshoot, which is the
	 * whole win presentation for this symbol — the plate carries no marquee bulbs to chase, unlike
	 * every other sign on this board.
	 *
	 * Drawn on top of the plate rather than baked into it, so it stays a separate sprite the pop can
	 * scale on its own. Where and how big it goes is measured off the plate's purple field by
	 * `scripts/wild/build_wild.py` into `WILD_LETTER`, so re-drawing the plate moves the letter with
	 * it instead of leaving it floating.
	 *
	 * Off a win the letter simply sits at full size: the wild spends most of its life as a settled
	 * board symbol, and a plate with no letter on it does not read as a wild.
	 */

	/** How long the pop takes. Long enough to see it land, short enough to be over before the win is. */
	const POP = 0.42;
	/**
	 * How hard it overshoots on the way out — the classic ease-out-back, with its constant tuned up
	 * from the textbook 1.7 so the letter visibly springs past full size rather than easing into it.
	 */
	const OVERSHOOT = 1.9;

	/** 0 at rest, 1 at full size, briefly past 1 in between. */
	const pop = (t: number) => {
		if (t >= 1) return 1;
		const back = t - 1;
		return 1 + (OVERSHOOT + 1) * back * back * back + OVERSHOOT * back * back;
	};
</script>

<script lang="ts">
	import { Sprite } from 'pixi-svelte';

	import { WILD_LETTER } from '../game/wildParts';

	type Props = {
		/** The centre of the SYMBOL, not of the letter — the letter is placed relative to it. */
		x: number;
		y: number;
		/** The size the plate is being drawn at, including the board's win pulse and spin squeeze. */
		width: number;
		height: number;
		/** Seconds since this win started. Ignored unless `win`. */
		clock: number;
		win: boolean;
		alpha?: number;
		/** Radians about the symbol's centre: whatever rock the plate under it is riding. */
		rotation?: number;
	};

	const props: Props = $props();

	const scale = $derived(props.win ? pop(props.clock / POP) : 1);
	// Offset from the symbol's centre, turned with the plate so the letter stays on it while the
	// board rattles. Same rotation, same centre, so the two never come apart.
	const offsetX = $derived((WILD_LETTER.x - 0.5) * props.width);
	const offsetY = $derived((WILD_LETTER.y - 0.5) * props.height);
	const turn = $derived(props.rotation ?? 0);
</script>

<Sprite
	key="tpWildW"
	anchor={0.5}
	x={props.x + offsetX * Math.cos(turn) - offsetY * Math.sin(turn)}
	y={props.y + offsetX * Math.sin(turn) + offsetY * Math.cos(turn)}
	rotation={turn}
	width={WILD_LETTER.width * props.width * scale}
	height={WILD_LETTER.height * props.height * scale}
	alpha={props.alpha ?? 1}
/>
