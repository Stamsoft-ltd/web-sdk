<script lang="ts" module>
	/**
	 * The coaster car, assembled from its parts so the family riding it can wave.
	 *
	 * The design ships this one as a car with both arms DOWN plus two loose arms (Figma 7093:25555
	 * and 7093:24248/24249), rather than as the single drawing it replaces — a car with its arms
	 * already up, frozen mid-cheer. `scripts/coaster/build_coaster.py` works out where each arm's
	 * SHOULDER is and bakes the car on its own, leaving the two arms free to turn about it.
	 *
	 * THEY WAVE AT REST, which is the point of cutting them off in the first place. A fairground
	 * ride that holds perfectly still until it pays is a photograph, and this symbol is the one the
	 * game is named after. It is also the only thing here that moves at rest, so it does not have to
	 * be large to be noticed: a slow wave is movement you catch out of the corner of an eye.
	 *
	 * THE TWO ARMS ARE DELIBERATELY OUT OF STEP. They run off the same sine at different periods and
	 * a half-cycle apart, so they never line up for long. Two people waving in perfect unison is a
	 * mechanism; two people waving at their own speeds is a family — and the board draws this symbol
	 * several times at once, so anything shared between the copies reads as a repeat.
	 */
	import { COASTER_ARMS } from '../game/coasterParts';

	const TAU = Math.PI * 2;

	/** How far an arm swings each way, in radians, and how long its sweep takes. */
	const WAVE = 0.34;
	const WAVE_SECONDS = [2.9, 2.3];
	/** Half a cycle between them, on top of the different periods. */
	const WAVE_OFFSET = [0, 0.5];
	/** And harder while it wins — amplitude and rate, since a win is worth cheering about. */
	const WAVE_WIN = 1.8;
	const WIN_RATE = 2.1;
	/** Eased in rather than switched on, so a win does not start mid-swing. */
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
		/** The car for this layout, with both arms down. */
		carKey: string;
		/** The whole symbol in one piece, for when it cannot be drawn in parts. */
		baseKey: string;
		/** Seconds since this win started. Ignored unless `win`. */
		clock: number;
		win: boolean;
		/** The board's own clock, which never stops: what the arms wave on. */
		idleClock: number;
		/** Seconds of offset, so a grid of these does not wave in lockstep. */
		phase?: number;
		/**
		 * How much of a spin trail this symbol is under. Past a hair it falls back to its baked
		 * still — the parts would be resampled independently at every ghost offset.
		 */
		blur?: number;
		alpha?: number;
		/** The board's idle breath, which the settled symbol rides the same as any other sprite. */
		tint?: number;
		/** Radians about the symbol's centre: the board's idle rock. */
		rotation?: number;
	};

	const props: Props = $props();

	/**
	 * Whether the symbol may be drawn in pieces at all.
	 *
	 * Mid-spin is the obvious no. The other is being DIMMED: pixi applies a container's alpha to
	 * each child in turn, so where the arms overlap the car the two would composite to well over
	 * the alpha asked for and both arms would show as darker patches. One sprite has no overlaps.
	 */
	const assembled = $derived((props.blur ?? 0) <= 0.02 && (props.alpha ?? 1) > 0.99);
	const strength = $derived(props.win ? Math.min(1, props.clock / SPIN_UP) : 0);

	const arms = $derived(
		COASTER_ARMS.map((arm, index) => {
			const seconds = WAVE_SECONDS[index] / (1 + (WIN_RATE - 1) * strength);
			const turns = (props.idleClock + (props.phase ?? 0)) / seconds + WAVE_OFFSET[index];
			const swing = WAVE * (1 + (WAVE_WIN - 1) * strength) * Math.sin(TAU * turns);
			return {
				key: arm.key,
				front: arm.front,
				x: (arm.x - 0.5) * props.width,
				y: (arm.y - 0.5) * props.height,
				width: arm.width * props.width,
				height: arm.height * props.height,
				anchor: { x: arm.anchorX, y: arm.anchorY },
				rotation: arm.rest + swing,
			};
		}),
	);
</script>

<Container
	x={props.x}
	y={props.y}
	rotation={props.rotation ?? 0}
	alpha={props.alpha ?? 1}
>
	{#if assembled}
		<!-- Behind the car: the father's arm ends in a cut edge that belongs inside his own
		     shoulder, and the car is what hides it. -->
		{#each arms.filter((arm) => !arm.front) as arm (arm.key)}
			<Sprite
				key={arm.key}
				anchor={arm.anchor}
				x={arm.x}
				y={arm.y}
				width={arm.width}
				height={arm.height}
				rotation={arm.rotation}
				tint={props.tint}
			/>
		{/each}
		<Sprite
			key={props.carKey}
			anchor={0.5}
			x={0}
			y={0}
			width={props.width}
			height={props.height}
			tint={props.tint}
		/>
		<!-- ...and in front of it: the mother's arm crosses the loop of track arching away behind
		     the car, so under the car plate its spokes cut her hand into pieces. -->
		{#each arms.filter((arm) => arm.front) as arm (arm.key)}
			<Sprite
				key={arm.key}
				anchor={arm.anchor}
				x={arm.x}
				y={arm.y}
				width={arm.width}
				height={arm.height}
				rotation={arm.rotation}
				tint={props.tint}
			/>
		{/each}
	{:else}
		<!-- Mid-spin, or dimmed: the same picture, in one piece. -->
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
