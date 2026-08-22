<script lang="ts" module>
	/**
	 * The MEGA COASTER scatter, assembled from its parts so that its sign can be alive.
	 *
	 * The design ships this one as four loose drawings rather than as a picture (Figma 7057:7953 is
	 * the flat one it replaces): the pavilion, the red bulb marquee bolted to its face, and the two
	 * words written on that. `scripts/coaster-sign/build_coaster_sign.py` works out where each goes
	 * and bakes the pavilion on its own, leaving the sign and the words loose.
	 *
	 * THE SIGN AND ITS WORDS MOVE AS ONE BOARD. They are nested in a single container that turns
	 * about the sign's own centre, so the type stays bolted to the marquee it is painted on — rocking
	 * them separately would read as three loose stickers rather than as one sign on a wall. What the
	 * rock is for is that a building cannot do anything else: the pavilion has no moving part, and a
	 * scatter that holds perfectly still until it pays reads as a sticker.
	 *
	 * It is a small angle on purpose. The sign is nearly as wide as the building, so a couple of
	 * degrees swings its corners several pixels at the size a symbol is actually drawn — this is a
	 * sign settling on its mountings, not a sign swinging from a hook.
	 */
	import { COASTER_SIGN_PARTS } from '../game/coasterSignParts';

	const TAU = Math.PI * 2;

	/** How far the whole sign rocks, in radians, and how long a full sweep takes. */
	const ROCK = 0.038;
	const ROCK_SECONDS = 4.4;
	/** And a little further while it wins. Amplitude only: a new period would jump the phase. */
	const ROCK_WIN = 1.6;

	/** How much the two words grow and shrink on a win, and how often. */
	const POP = 0.13;
	const POP_HZ = 1.7;
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
		/** The pavilion for this layout, with no sign on it. */
		houseKey: string;
		/** The whole symbol in one piece, for when it cannot be drawn in parts. */
		baseKey: string;
		/** Seconds since this win started. Ignored unless `win`. */
		clock: number;
		win: boolean;
		/** The board's own clock, which never stops: what the sign rocks on. */
		idleClock: number;
		/** Seconds of offset, so a grid of these does not rock in lockstep. */
		phase?: number;
		/** How much of a spin trail this symbol is under. Past a hair it falls back to its still. */
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

	const rock = $derived(
		ROCK *
			(1 + (ROCK_WIN - 1) * strength) *
			Math.sin((TAU * (props.idleClock + (props.phase ?? 0))) / ROCK_SECONDS),
	);
	const pop = $derived(1 + POP * Math.sin(TAU * POP_HZ * props.clock) * strength);

	/** The point the whole board turns about, in draw space. */
	const pivotX = $derived((COASTER_SIGN_PARTS.sign.x - 0.5) * props.width);
	const pivotY = $derived((COASTER_SIGN_PARTS.sign.y - 0.5) * props.height);

	/** A part, positioned relative to that pivot rather than to the symbol's centre. */
	const piece = (part: typeof COASTER_SIGN_PARTS.sign, scale: number) => ({
		x: (part.x - COASTER_SIGN_PARTS.sign.x) * props.width,
		y: (part.y - COASTER_SIGN_PARTS.sign.y) * props.height,
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
			key={props.houseKey}
			anchor={0.5}
			x={0}
			y={0}
			width={props.width}
			height={props.height}
			tint={props.tint}
		/>
		<Container x={pivotX} y={pivotY} rotation={rock}>
			{@const sign = piece(COASTER_SIGN_PARTS.sign, 1)}
			<Sprite
				key="tpCoasterSign"
				anchor={sign.anchor}
				x={sign.x}
				y={sign.y}
				width={sign.width}
				height={sign.height}
				tint={props.tint}
			/>
			{@const mega = piece(COASTER_SIGN_PARTS.mega, pop)}
			<Sprite
				key="tpCoasterWordMega"
				anchor={mega.anchor}
				x={mega.x}
				y={mega.y}
				width={mega.width}
				height={mega.height}
				tint={props.tint}
			/>
			{@const coaster = piece(COASTER_SIGN_PARTS.coaster, pop)}
			<Sprite
				key="tpCoasterWordCoaster"
				anchor={coaster.anchor}
				x={coaster.x}
				y={coaster.y}
				width={coaster.width}
				height={coaster.height}
				tint={props.tint}
			/>
		</Container>
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
