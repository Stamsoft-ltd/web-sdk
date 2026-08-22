<script lang="ts" module>
	/**
	 * The ROLLER WILDS scatter, assembled from its parts so that it can be alive.
	 *
	 * The design ships this one as five stacked drawings rather than as a picture (Figma 7063:17922):
	 * a coaster emblem, the banner that covers its bottom half, the two words, and the star between
	 * them. `scripts/roller/build_roller.py` measures where each one sits and bakes the two that never
	 * move into one sign, leaving the star and the words loose — which is what lets the symbol turn
	 * its star while it waits and pop its two words when it pays.
	 *
	 * THE TWO WORDS POP AGAINST EACH OTHER rather than together, and that is the whole effect: one
	 * grows as the other shrinks, off the same sine with the sign flipped. Popping them in step is a
	 * lockup breathing, which every other marquee on this board already does through the win pulse;
	 * popping them in opposition is the sign TALKING, one word at a time, and it reads at symbol size
	 * where a synchronised 14% does not.
	 *
	 * The star turns whether or not anything is happening, because a scatter that is dead until it
	 * wins is dead almost all of the time. It is the only part that moves at rest, and it can afford
	 * to where the marquee signs cannot: a drifting sprite is resampled every frame and their painted
	 * bulbs flickered when it happened, and there is not a bulb anywhere on the star.
	 */
	import { ROLLER_PARTS } from '../game/rollerParts';

	const TAU = Math.PI * 2;

	/**
	 * How far the star turns each way, in radians, and how long a full sweep takes.
	 *
	 * Thirty degrees is a large angle for a part of a lockup and it is deliberate: the star is a
	 * fifth of the symbol's width, so at the size a symbol is actually drawn this is a couple of
	 * pixels of travel at its points. Slow enough that it reads as a turn rather than as a wobble —
	 * a sweep every five seconds is movement you notice having happened.
	 */
	const STAR_SWING = 0.5236;
	const STAR_SECONDS = 5;
	/** And a bit further while it wins. Amplitude only: changing the period would jump the phase. */
	const STAR_WIN_SWING = 1.35;

	/** How much each word grows and shrinks, and how often. */
	const POP = 0.14;
	const POP_HZ = 1.6;
	/** Eased in rather than switched on, so a win does not start mid-pop. */
	const SPIN_UP = 0.2;
</script>

<script lang="ts">
	import { Container, Sprite } from 'pixi-svelte';

	type Props = {
		/** The centre of the SYMBOL — every piece is placed relative to it. */
		x: number;
		y: number;
		/** The size the symbol is being drawn at, board win pulse and spin squeeze included. */
		width: number;
		height: number;
		/** The sign for this layout: every layer except the star and the two words. */
		signKey: string;
		/** The whole symbol in one piece, for when it cannot be drawn in parts. */
		baseKey: string;
		/** Seconds since this win started. Ignored unless `win`. */
		clock: number;
		win: boolean;
		/** The board's own clock, which never stops: what the star turns on. */
		idleClock: number;
		/** Seconds of offset, so a grid of these does not turn its stars in lockstep. */
		phase?: number;
		/**
		 * How much of a spin trail this symbol is under. It falls back to its baked still while it is
		 * streaking past — the parts would be resampled independently at every ghost offset.
		 */
		blur?: number;
		alpha?: number;
		/** The board's idle breath, which the settled symbol rides the same as any other sprite. */
		tint?: number;
		/** Radians about the symbol's centre: the board's idle rock. */
		rotation?: number;
	};

	const props: Props = $props();

	const assembled = $derived((props.blur ?? 0) <= 0.02);
	const strength = $derived(props.win ? Math.min(1, props.clock / SPIN_UP) : 0);

	const spin = $derived(
		STAR_SWING *
			(1 + (STAR_WIN_SWING - 1) * strength) *
			Math.sin((TAU * (props.idleClock + (props.phase ?? 0))) / STAR_SECONDS),
	);
	/** One sine, used twice with the sign flipped. That flip IS the effect — see the module comment. */
	const pop = $derived(POP * Math.sin(TAU * POP_HZ * props.clock) * strength);

	const piece = (part: typeof ROLLER_PARTS.star, scale: number) => ({
		x: (part.x - 0.5) * props.width,
		y: (part.y - 0.5) * props.height,
		width: part.width * props.width * scale,
		height: part.height * props.height * scale,
		anchor: { x: part.anchorX, y: part.anchorY },
	});
</script>

<Container
	x={props.x}
	y={props.y}
	rotation={props.rotation ?? 0}
	alpha={props.alpha ?? 1}
>
	{#if assembled}
		<Sprite
			key={props.signKey}
			anchor={0.5}
			x={0}
			y={0}
			width={props.width}
			height={props.height}
			tint={props.tint}
		/>
		{@const star = piece(ROLLER_PARTS.star, 1)}
		<Sprite
			key="tpRollerStar"
			anchor={star.anchor}
			x={star.x}
			y={star.y}
			width={star.width}
			height={star.height}
			rotation={spin}
			tint={props.tint}
		/>
		{@const roller = piece(ROLLER_PARTS.roller, 1 + pop)}
		<Sprite
			key="tpRollerWordRoller"
			anchor={roller.anchor}
			x={roller.x}
			y={roller.y}
			width={roller.width}
			height={roller.height}
			tint={props.tint}
		/>
		{@const wilds = piece(ROLLER_PARTS.wilds, 1 - pop)}
		<Sprite
			key="tpRollerWordWilds"
			anchor={wilds.anchor}
			x={wilds.x}
			y={wilds.y}
			width={wilds.width}
			height={wilds.height}
			tint={props.tint}
		/>
	{:else}
		<!-- Mid-spin: the same picture, in one piece. -->
		<Sprite
			key={props.baseKey}
			anchor={0.5}
			x={0}
			y={0}
			width={props.width}
			height={props.height}
			tint={props.tint}
		/>
	{/if}
</Container>
