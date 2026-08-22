<script lang="ts" module>
	/**
	 * The ferris wheel, assembled from its parts so that a win can turn it.
	 *
	 * The design draws this symbol as a rig rather than as a picture (Figma 7052:7879) — a rim, a hub
	 * cap, a pair of legs and its gondolas, each its own drawing — and this is what puts it back
	 * together: the rim spins about the axle, the gondolas ride round with it and stay UPRIGHT, and
	 * the legs stand still in front of the lot, exactly as they are stacked in the design. A wheel
	 * whose gondolas turned with the rim would tip its riders out at the top.
	 *
	 * Where each piece goes is measured off the assembled design by `scripts/wheel/build_wheel.py`
	 * into `wheelParts.ts`. The gondolas are the interesting case twice over: they all mount on ONE
	 * circle and hang a fixed drop below it, which is not what the artist's very different radii look
	 * like until the drop is solved for — and there is one of them per SPOKE rather than the five the
	 * design draws, because five cars cannot be both evenly spaced and bolted to eight spokes.
	 *
	 * IT NEVER STOPS. A settled wheel creeps round at `REST_HZ` — a turn every minute, which is
	 * movement you notice having happened rather than movement you watch — and a win winds it up to
	 * `WIN_HZ` and back down again afterwards.
	 *
	 * That is why the angle here is INTEGRATED from a speed instead of computed from a clock, which
	 * is how every other moving symbol on this board works. Those are pure functions of time and can
	 * afford to be, because they all return to the same pose: a duck's wing is where its phase says
	 * it is. A wheel has no such pose. Its angle is the whole history of how fast it has been going,
	 * so deriving it from the win clock meant the wheel jumped back the better part of a turn at the
	 * moment `winClock` reset — on a symbol the player is looking straight at. Integrating makes any
	 * change in speed continuous in angle by construction, in both directions, for free.
	 */
	import {
		WHEEL_AXLE,
		WHEEL_CARS,
		WHEEL_HUB,
		WHEEL_LEGS,
		WHEEL_MOUNT,
		WHEEL_RIM,
	} from '../game/wheelParts';

	const TAU = Math.PI * 2;

	/** Turns a second while it wins. A fairground wheel is slow; this is about as fast as one reads. */
	const WIN_HZ = 0.4;
	/**
	 * And at rest: a revolution a minute, which is a gondola crossing about one of its own widths in
	 * the time a player spends looking at the symbol.
	 *
	 * Twenty times slower than the win rather than merely slower, because these two numbers are the
	 * whole of the effect. A wheel that is already turning at a fair clip has nowhere to go when it
	 * wins, and what the win is meant to read as is the wheel WINDING UP — so the rest speed is set
	 * as low as it can go while still being movement, and the gap does the rest.
	 */
	const REST_HZ = 0.018;
	/**
	 * Seconds the speed takes to close most of the gap to whichever of those it is heading for.
	 *
	 * An exponential approach rather than a ramp, so the same number does the winding up and the
	 * winding down: a wheel that reached full speed instantly would read as a cut, and one that
	 * stopped dead at the end of a win would read as a brake.
	 */
	const SPIN_UP = 0.45;
	/** Long enough that a resumed tab does not fast-forward the wheel through half a revolution. */
	const MAX_STEP = 0.1;

	/**
	 * How far a gondola swings at FULL speed, and how often. Enough to hang, not enough to spill.
	 * The swing is scaled by how fast the wheel is actually going, so at rest it is all but still.
	 */
	const SWAY = 0.09;
	const SWAY_HZ = 0.7;
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
		/** Seconds since this win started. Ignored unless `win`. */
		clock: number;
		win: boolean;
		/** The board's own clock, which never stops. What the wheel is integrated against. */
		idleClock: number;
		alpha?: number;
		/** The board's idle breath, which the settled symbol rides the same as any other sprite. */
		tint?: number;
		/** Radians about the symbol's centre: the board's idle rock. */
		rotation?: number;
	};

	const props: Props = $props();

	/**
	 * The wheel's angle and its current speed, in radians and radians per second.
	 *
	 * The only state in any of this game's symbols, and the reason for it is in the module comment:
	 * an angle is a history, not a pose.
	 *
	 * The integrator's own variables are plain `let`s and only the two values that RENDER are
	 * `$state`. That split is load-bearing rather than tidiness: an effect that reads a rune it also
	 * writes re-triggers itself, so accumulating straight into `turn` is an infinite loop.
	 */
	let angle = 0;
	let speed = REST_HZ * TAU;
	let previous = 0;

	let turn = $state(0);
	/** 0 while it creeps, 1 at full speed. What the gondolas swing on. */
	let ride = $state(0);

	$effect(() => {
		const step = Math.min(MAX_STEP, Math.max(0, props.idleClock - previous));
		previous = props.idleClock;
		const target = (props.win ? WIN_HZ : REST_HZ) * TAU;
		// Framerate-independent: the same fraction of the remaining gap per SECOND, not per frame.
		speed += (target - speed) * (1 - Math.exp(-step / SPIN_UP));
		angle = (angle + speed * step) % TAU;
		turn = angle;
		ride = Math.max(0, (speed / TAU - REST_HZ) / (WIN_HZ - REST_HZ));
	});

	/** The axle, in draw space. Everything that goes round, goes round this. */
	const axleX = $derived((WHEEL_AXLE.x - 0.5) * props.width);
	const axleY = $derived((WHEEL_AXLE.y - 0.5) * props.height);

	const cars = $derived(
		WHEEL_CARS.map((car, index) => {
			// The mount goes round; the car hangs a fixed distance straight DOWN from it. Not a car
			// riding its own circle — see `WHEEL_MOUNT` for why that is the whole difference between a
			// wheel that turns and five gondolas sliding off their spokes.
			const angle = car.angle + turn;
			return {
				id: index,
				key: car.key,
				x: axleX + WHEEL_MOUNT.radiusX * props.width * Math.cos(angle),
				y:
					axleY +
					WHEEL_MOUNT.radiusY * props.height * Math.sin(angle) +
					WHEEL_MOUNT.hang * props.height,
				width: car.width * props.width,
				height: car.height * props.height,
				// Hung, not bolted: each gondola rocks about its own hanger, out of phase with the rest
				// so they do not swing as one block. Scaled by how fast the wheel is actually going,
				// which is what keeps a creeping wheel's gondolas from swinging like a winning one's —
				// and what makes them settle as it winds down instead of stopping mid-swing.
				rotation: ride * SWAY * Math.sin(TAU * SWAY_HZ * props.idleClock + car.angle),
			};
		}),
	);

	const piece = (part: typeof WHEEL_LEGS) => ({
		x: (part.x - 0.5) * props.width,
		y: (part.y - 0.5) * props.height,
		width: part.width * props.width,
		height: part.height * props.height,
	});
</script>

<Container
	x={props.x}
	y={props.y}
	rotation={props.rotation ?? 0}
	alpha={props.alpha ?? 1}
>
	<!-- The rim is concentric with its own box, and the axle IS that centre, so it turns in place. -->
	<Sprite
		key={WHEEL_RIM.key}
		anchor={0.5}
		x={axleX}
		y={axleY}
		rotation={turn}
		width={WHEEL_RIM.width * props.width}
		height={WHEEL_RIM.height * props.height}
		tint={props.tint}
	/>

	{#each cars as car (car.id)}
		<Sprite
			key={car.key}
			anchor={0.5}
			x={car.x}
			y={car.y}
			width={car.width}
			height={car.height}
			rotation={car.rotation}
			tint={props.tint}
		/>
	{/each}

	<!-- In front of the wheel, as the design stacks them: a gondola coming down the near side goes
	     BEHIND the tower, which is what the frame passing in front of it makes it read as. -->
	{@const legs = piece(WHEEL_LEGS)}
	<Sprite
		key={WHEEL_LEGS.key}
		anchor={0.5}
		x={legs.x}
		y={legs.y}
		width={legs.width}
		height={legs.height}
		tint={props.tint}
	/>
	{@const hub = piece(WHEEL_HUB)}
	<!-- The axle cap. It does not turn — it is what the wheel turns ON. -->
	<Sprite
		key={WHEEL_HUB.key}
		anchor={0.5}
		x={hub.x}
		y={hub.y}
		width={hub.width}
		height={hub.height}
		tint={props.tint}
	/>
</Container>
