<script lang="ts" module>
	/**
	 * The W on the wild's plate, and how it arrives when the wild wins.
	 *
	 * The redesigned wild (Figma 7052:7925) is a gold oval plate with nothing on it; the tri-colour
	 * letter (7052:7927) is a second drawing, and the two ship apart on purpose, because the letter is
	 * what moves. On a win it zooms in and out inside the frame, over and over for as long as the win
	 * is on screen — that is the whole win presentation for this symbol, which carries no marquee
	 * bulbs to chase unlike every other sign on this board.
	 *
	 * IT IS THE ONLY THING ON THE SIGN THAT MOVES, and that is the point. <Board> holds the plate out
	 * of the board-wide win pulse for this symbol alone, so the gold oval stands still while the W
	 * breathes in it. Swelling both together was the version this replaces, and with the letter
	 * locked at a fixed fraction of a growing frame there was nothing to measure the zoom against: it
	 * read as the whole picture being scaled rather than as the letter doing anything.
	 *
	 * Drawn on top of the plate rather than baked into it, so it stays a separate sprite the zoom can
	 * scale on its own. Where and how big it goes is measured off the plate's purple field by
	 * `scripts/wild/build_wild.py` into `WILD_LETTER`, so re-drawing the plate moves the letter with
	 * it instead of leaving it floating.
	 *
	 * Off a win the letter simply sits at full size: the wild spends most of its life as a settled
	 * board symbol, and a plate with no letter on it does not read as a wild.
	 */

	/** One in-and-out, in seconds. Slow enough to read as breathing rather than as a flicker. */
	const ZOOM_SECONDS = 0.78;
	/**
	 * How far it swings either side of full size. The letter has to stay clear of the oval's inner
	 * gold at its widest, and the plate is standing still now, so this is bounded by the art rather
	 * than by taste — `WILD_LETTER` is measured into the purple field with little room over.
	 */
	const ZOOM = 0.11;

	/** 1 at the start of a win, then in and out about it forever. Starts at 1, so nothing jumps. */
	const zoom = (seconds: number) => 1 + ZOOM * Math.sin((seconds / ZOOM_SECONDS) * Math.PI * 2);
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

	const scale = $derived(props.win ? zoom(props.clock) : 1);
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
