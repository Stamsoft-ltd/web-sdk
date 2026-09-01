<script lang="ts" module>
	/**
	 * The DUCK YOUR LUCK scatter, and what it does when it lands in a win.
	 *
	 * The symbol is a duck in a top hat holding a DUCK YOUR LUCK sign, with a wing out either side.
	 * Every other symbol on this board wins by standing still and lighting up — it is a marquee, and
	 * marquees do not move. This one is a bird, and a bird that holds perfectly still while it pays out
	 * three scatters reads as a sticker. So it beats its wings and rocks the sign it is holding.
	 *
	 * The wings are separate sprites, drawn BEHIND the rest of the symbol at coordinates measured off
	 * the design (`duckSignParts.ts`), and each turns about its own root — the point where it goes
	 * behind the duck's body — so what moves is the span of the wing and not the whole shape sliding.
	 * Beating them in opposite phase would look like a bird trying to take off; they beat TOGETHER,
	 * which is the duck flapping in place.
	 *
	 * `baseKey` MUST BE A LOCKUP WITH NO WINGS IN IT. That is not a preference, it is what makes the
	 * flap read at all: the art that shipped until 2026-08-28 was one painted picture with the wings
	 * already in it, so a win swung these two out from behind a pair that never moved, and the whole
	 * thing read as a mistake rather than as a bird. `scripts/duck-sign/build_duck_sign.py` composes
	 * the base from the design's loose layers now and deliberately leaves the wings out of it.
	 *
	 * Nothing here runs while the symbol is idle. The board's settled symbols carry a tint breath and
	 * deliberately no movement — a drifting sprite is resampled every frame, which is what made the
	 * marquee bulbs flicker — and this component is mounted for every DUCK YOUR LUCK on the grid, not
	 * just a winning one. At rest it is the design's own still.
	 */
	const TAU = Math.PI * 2;

	/** Beats a second. Fast enough to read as a flap rather than as a sway. */
	const FLAP_HZ = 3.1;
	/**
	 * How far a wing swings, in radians — 13 degrees each way, which is the `FLAP` the build script
	 * checks the frame against: at this much a wing at full beat still lands inside the symbol.
	 *
	 * Turn only. Stretching the wing along its span as it beats was tried and taken out: the sprite is
	 * pinned by its ROOT, so growing it moves the tip toward the pivot on one side and away on the
	 * other, and the two wings stopped being mirror images at the extremes of the beat.
	 */
	const FLAP = 0.227;

	/** The sign rocks with the beat and half as fast, so the two are never quite in step. */
	const ROCK = 0.035;
	const ROCK_HZ = 1.55;
	/** And rides up on the downbeat, as a fraction of the symbol's height. */
	const LIFT = 0.022;

	/** How long the whole thing takes to come up to full beat, so a win does not start mid-flap. */
	const SPIN_UP = 0.22;
</script>

<script lang="ts">
	import { Container, Sprite } from 'pixi-svelte';

	import { DUCK_SIGN_WINGS } from '../game/duckSignParts';

	type Props = {
		x: number;
		y: number;
		/** The size the symbol is being drawn at, so the whole lockup rides the board's win pulse. */
		width: number;
		height: number;
		/** The base art for this layout — the duck, the sign, and the wingtips gripping it. */
		baseKey: string;
		/** Seconds since this win started. Ignored unless `win`. */
		clock: number;
		win: boolean;
		alpha?: number;
		/** Radians about the symbol's centre: the board's idle rock, which the still symbol rides. */
		rotation?: number;
	};

	const props: Props = $props();

	const beat = $derived(props.win ? Math.sin(TAU * FLAP_HZ * props.clock) : 0);
	/** Eased in over the first fifth of a second rather than switched on. */
	const strength = $derived(props.win ? Math.min(1, props.clock / SPIN_UP) : 0);

	const wings = $derived(
		(['left', 'right'] as const).map((side) => {
			const wing = DUCK_SIGN_WINGS[side];
			// Mirrored, so both wings rise and fall together rather than sweeping the same way across
			// the symbol — which is a bird banking, not a bird flapping.
			const swing = FLAP * beat * strength * (side === 'left' ? -1 : 1);
			return {
				key: side === 'left' ? 'tpDuckSignWingLeft' : 'tpDuckSignWingRight',
				// Positioned by its pivot and offset back to its own top-left, so `rotation` turns the
				// wing about its root rather than about the corner of its box.
				pivotX: (wing.pivotX - 0.5) * props.width,
				pivotY: (wing.pivotY - 0.5) * props.height,
				offsetX: (wing.x - wing.pivotX) * props.width,
				offsetY: (wing.y - wing.pivotY) * props.height,
				width: wing.width * props.width,
				height: wing.height * props.height,
				rotation: swing,
			};
		}),
	);

	// The lockup itself: a slow rock and a lift, both driven off the same beat as the wings so the
	// sign moves because the bird under it is flapping.
	const rock = $derived(ROCK * Math.sin(TAU * ROCK_HZ * props.clock) * strength);
	const lift = $derived(-LIFT * props.height * Math.abs(beat) * strength);
</script>

<Container
	x={props.x}
	y={props.y + lift}
	rotation={(props.rotation ?? 0) + rock}
	alpha={props.alpha ?? 1}
>
	<!-- Behind the base, which is the same lockup with these two cut out of it. -->
	{#each wings as wing (wing.key)}
		<Container x={wing.pivotX} y={wing.pivotY} rotation={wing.rotation}>
			<Sprite
				key={wing.key}
				x={wing.offsetX}
				y={wing.offsetY}
				width={wing.width}
				height={wing.height}
			/>
		</Container>
	{/each}
	<Sprite key={props.baseKey} anchor={0.5} x={0} y={0} width={props.width} height={props.height} />
</Container>
