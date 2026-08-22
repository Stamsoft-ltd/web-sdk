<script lang="ts" module>
	/**
	 * The duck symbol, assembled from its parts so that it can be alive.
	 *
	 * The design ships this one in pieces rather than as a picture (Figma 7063:17957 and friends): a
	 * body with EMPTY EYE SOCKETS, an iris to drop into each, and the loose left wing that tucks at
	 * its near flank. That is what lets it do the two things the flat art cannot — glance about while it is just sitting on the board,
	 * and beat a wing when it wins. Where every piece goes is measured off the artist's own assembled
	 * duck by `scripts/duck/build_duck.py` into `duckParts.ts`.
	 *
	 * The duck's RIGHT wing is drawn into the body, raised and fanned, and does not come apart. So one
	 * wing beats and the other rides the hop, which is why the hop is here at all: it is what keeps the
	 * far side of the bird from looking nailed down.
	 *
	 * A SETTLED DUCK IS STILL DOING BOTH, quietly: the eyes glance about and the wing breathes. It can
	 * afford to where the marquee signs cannot — they hold still because a drifting sprite is
	 * resampled every frame and their painted bulbs flickered when it happened, and there is not a
	 * bulb anywhere on this bird.
	 *
	 * The glance is nonetheless built to HOLD rather than to drift: it picks a spot, DARTS to it, and
	 * then sits there for the best part of a second. That is how an eye actually moves, and it means
	 * the iris is stationary for the large majority of frames rather than crawling across the socket.
	 */
	import { DUCK_BODY, DUCK_EYES, DUCK_WING } from '../game/duckParts';

	const TAU = Math.PI * 2;

	/** Seconds an eye rests on one spot before looking somewhere else, and the dart between spots. */
	const GLANCE_HOLD = 1.15;
	const DART = 0.11;
	/** A winning duck is an excited duck: it looks about half again as often. */
	const WIN_GLANCE = 0.62;

	/**
	 * Wingbeats a second, and how far the wing swings, in radians — about 45 degrees each way.
	 *
	 * A WIN IS THE ONE MOMENT THIS BIRD IS ALLOWED TO BE LOUD, and the first pass was not: twenty
	 * degrees at a symbol drawn 128 pixels across is three pixels at the wingtip, which is the same
	 * order as the idle breath below and so read as the same thing slightly faster. It is now more
	 * than double the throw and a beat quicker, which is a different motion rather than a bigger one.
	 */
	const FLAP_HZ = 4.2;
	const FLAP = 0.8;

	/**
	 * How far the BODY rolls on the beat, in radians. NEGATIVE, and that is the whole trick.
	 *
	 * The duck's other wing is painted into its body and does not come apart, so it cannot be beaten
	 * on its own — but it can be rolled with the body it is drawn on. That wing is raised out to the
	 * viewer's right, so turning the body anticlockwise lifts its tip, which is the same instant the
	 * loose wing on the near side is lifting. Both wings go up together, and the bird reads as
	 * flapping rather than as one wing waving next to a passenger.
	 *
	 * Small on purpose: the painted wing is long, so a tenth of a radian is already several pixels
	 * at its tip, and much past that stops being a bird putting its shoulders into a flap and starts
	 * being a bird falling over.
	 */
	const BODY_ROLL = -0.1;
	/** Eased in rather than switched on, so a win does not start mid-beat. */
	const SPIN_UP = 0.2;

	/**
	 * And the resting wing, which lifts and settles instead of hanging: radians, and seconds a breath.
	 *
	 * A fifth of `FLAP` and six hundred times slower, so the two never read as the same motion. What
	 * fixes the size is the wingtip rather than the angle: a symbol is drawn about 128 pixels across
	 * and the wing reaches roughly a fifth of that from its shoulder, so this is a pixel and a half
	 * of travel at the tip — the least that is still motion. It wants re-checking whenever the wing
	 * art changes size, since the same angle on a shorter wing is less travel: this went back up by
	 * a third when the duck stopped wearing the raised wing mirrored and got its own tucked one.
	 */
	const SETTLE = 0.08;
	const SETTLE_SECONDS = 3.6;

	/** The hop, as a fraction of the symbol's height, and how much of a beat it lags behind the wing. */
	const HOP = 0.09;
	const HOP_LAG = 0.18;

	/**
	 * Deterministic per-eye, per-step variation in -1..1. A hashed sine rather than a random number,
	 * because there is nowhere to keep state: everything here is re-derived from the clock each frame,
	 * so the same step has to produce the same target every time it is asked.
	 */
	const wobble = (step: number, salt: number) => {
		const value = Math.sin(step * 127.1 + salt * 311.7) * 43758.5453;
		return (value - Math.floor(value)) * 2 - 1;
	};

	/** Ease-out: an eye arrives at where it is looking, it does not coast in. */
	const dart = (t: number) => 1 - (1 - t) * (1 - t) * (1 - t);
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
		/** The assembled still, which is what the board's spin trail ghosts. */
		baseKey: string;
		/** Seconds since this win started. Ignored unless `win`. */
		clock: number;
		win: boolean;
		/** The board's own clock, which never stops: what the idle glance runs on. */
		idleClock: number;
		/**
		 * How much of a spin trail this symbol is under. The duck falls back to its baked still while
		 * it is streaking past — the pieces would be resampled independently at every ghost offset,
		 * and a bird coming apart mid-spin is not the effect anyone wants.
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
	const beat = $derived(props.win ? Math.sin(TAU * FLAP_HZ * props.clock) * strength : 0);
	/** Handed over rather than added to the beat, so a winning wing does not breathe as well. */
	const settle = $derived(
		SETTLE * Math.sin((TAU * props.idleClock) / SETTLE_SECONDS) * (1 - strength),
	);
	/** The body's share of the beat, which is what moves the wing painted onto it. */
	const roll = $derived(BODY_ROLL * beat);

	/** Where each eye is looking, in its own -1..1 range, and how far along the dart it is. */
	const eyes = $derived(
		DUCK_EYES.map((eye, index) => {
			const hold = props.win ? WIN_GLANCE : GLANCE_HOLD;
			// The win clock restarts at zero on every win, so running the glance off it would snap
			// both eyes back to the same spot each time. It stays on the board's clock either way.
			const step = Math.floor(props.idleClock / hold);
			// Only the first `DART` of a step is spent moving; the rest of it the eye holds still.
			const eased = dart(Math.min(1, (props.idleClock - step * hold) / DART));
			// The two eyes look at the SAME thing — a bird whose pupils disagree is a bird with a
			// problem — but the near one is drawn bigger, so it swings further in pixels for free.
			const fromX = wobble(step - 1, 1);
			const fromY = wobble(step - 1, 2);
			const toX = wobble(step, 1);
			const toY = wobble(step, 2);
			return {
				id: index,
				key: eye.key,
				x: (eye.x - 0.5) * props.width + (fromX + (toX - fromX) * eased) * eye.roamX * props.width,
				y: (eye.y - 0.5) * props.height + (fromY + (toY - fromY) * eased) * eye.roamY * props.height,
				width: eye.width * props.width,
				height: eye.height * props.height,
			};
		}),
	);

	// The hop trails the wing rather than matching it: the bird goes up because it just beat down.
	const hop = $derived(-HOP * props.height * Math.max(0, Math.sin(TAU * FLAP_HZ * props.clock - HOP_LAG * TAU)) * strength);

	/** The body's centre in draw space: what the whole bird turns about, wing included. */
	const pivotX = $derived((DUCK_BODY.x - 0.5) * props.width);
	const pivotY = $derived((DUCK_BODY.y - 0.5) * props.height);
	/** A part placed relative to that pivot rather than to the symbol's centre. */
	const about = (x: number, y: number) => ({ x: x - pivotX, y: y - pivotY });
</script>

<Container
	x={props.x}
	y={props.y + hop}
	rotation={props.rotation ?? 0}
	alpha={props.alpha ?? 1}
>
	{#if assembled}
		<!--
			THE WHOLE BIRD ROLLS AS ONE, which is why everything below sits in a container turning
			about the body's centre rather than being placed against the symbol's.

			The wing has to be in here or it comes off: its shoulder is a point ON the body, so a body
			that rolls and a wing that does not leaves the two meeting nowhere. The eyes have to be in
			here for the same reason at the other end — pupils that stay put while the head turns are
			a duck rolling its eyes, not a duck flapping. What is left outside is the hop, which is a
			translation and does not care.
		-->
		<Container x={pivotX} y={pivotY} rotation={roll}>
			{@const wing = about((DUCK_WING.x - 0.5) * props.width, (DUCK_WING.y - 0.5) * props.height)}
			<!-- Behind the body, which is where the artist drew it: only the span of the wing shows. -->
			<Sprite
				key="tpDuckWing"
				anchor={{ x: DUCK_WING.anchorX, y: DUCK_WING.anchorY }}
				x={wing.x}
				y={wing.y}
				width={DUCK_WING.width * props.width}
				height={DUCK_WING.height * props.height}
				rotation={DUCK_WING.rest + FLAP * beat + settle}
				tint={props.tint}
			/>
			<Sprite
				key="tpDuckBody"
				anchor={0.5}
				x={0}
				y={0}
				width={DUCK_BODY.width * props.width}
				height={DUCK_BODY.height * props.height}
				tint={props.tint}
			/>
			{#each eyes as eye (eye.id)}
				{@const at = about(eye.x, eye.y)}
				<Sprite
					key={eye.key}
					anchor={0.5}
					x={at.x}
					y={at.y}
					width={eye.width}
					height={eye.height}
					tint={props.tint}
				/>
			{/each}
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
