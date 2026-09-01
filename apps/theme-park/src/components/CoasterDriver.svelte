<script lang="ts" module>
	/**
	 * The duck driving a Mega Coaster cart, assembled from its parts so that it can drive.
	 *
	 * `idle` in coaster_vomit.json is ONE held frame — every one of that rig's 128 poses belongs to
	 * the vomit clip — so a happy cart crossing the board was a photograph being slid sideways. The
	 * presenter's ride gave the CART motion; the duck in it still stared ahead with its head welded
	 * on and its wheels frozen, for the whole feature (reported 2026-08-28).
	 *
	 * The design supplies the same bumper car in three pieces (Figma 7269:4432 the car with no head,
	 * 7269:4431 the head, 7269:4429 a wheel), which is exactly the rig that fixes it.
	 * `scripts/coaster-driver/build_coaster_driver.py` places them into the frame the Spine cart is
	 * packed into, so this rig and that clip are the same cart at the same size on the same ground
	 * line, and the switch when a duck turns green does not move it.
	 *
	 * THE WHEELS ARE THE ANIMATION. This started out much busier — the cart hopped over sleepers, it
	 * rocked about the rail, and the head was thrown a full head's width by both. All of that came
	 * out: a car on a rail does not leave the rail, and a duck shaken that hard reads as a toy being
	 * waved about rather than as a passenger (reported 2026-08-31). What is left is a car that
	 * glides, wheels that turn under it, a head that barely moves at all — and a headlamp that is
	 * finally lit, the car having carried an unlit one through every ride until now.
	 *
	 * EVERYTHING HERE RUNS OFF DISTANCE TRAVELLED, not off a clock. That is what makes a wheel a
	 * wheel: it turns through exactly the angle the ground it has covered subtends, so it never
	 * skids, and a cart that has slowed turns slowly. It is also what stops the head: parked, the
	 * duck is still, because a still cart has nothing to pass a joint over.
	 */
	import {
		COASTER_DRIVER_BODY,
		COASTER_DRIVER_HEAD,
		COASTER_DRIVER_LAMP,
		COASTER_DRIVER_WHEEL_RADIUS,
		COASTER_DRIVER_WHEELS,
		type CoasterDriverPart,
	} from '../game/coasterDriverParts';

	const TAU = Math.PI * 2;

	/**
	 * The head, and it is deliberately almost nothing.
	 *
	 * Two beats, neither dividing into the other, both measured in rail joints so they belong to the
	 * track rather than to a timer. The short one is the joints going under the wheels — the only
	 * thing there is to feel on a smooth rail — and the long one is the duck itself, riding out the
	 * springs over several cells of track.
	 *
	 * Both are now a THIRD of what they were. Even at three degrees the fast one read as a shake
	 * (reported 2026-08-31), because it is the only thing on the board keeping that beat and the eye
	 * goes straight to it. What is left is well under a degree of jolt and a fifth of a pixel of
	 * lift: not a motion anyone will catch, which is the point — a passenger on a bench, not a
	 * puppet. The LOOK below carries the life; this only stops the head being welded on.
	 */
	const JOLT_NOD = 0.005;
	const JOLT_LIFT = 0.0012;
	const SWAY_JOINTS = 7.3;
	const SWAY_NOD = 0.018;

	/**
	 * THE LOOK, which is the only thing on this duck anybody can actually see moving.
	 *
	 * A nod is the wrong axis for it. Pitching a head drawn dead-on moves its silhouette by almost
	 * nothing — three degrees of it read as no motion at all on a cart this size (reported
	 * 2026-08-31) — while pitching it far enough to read tears it off the shoulders. What a bored
	 * passenger does anyway is look about, so the head TURNS: it slides a couple of pixels off the
	 * neck and narrows as it goes, because a face turning away foreshortens. Those two together are
	 * a turn; either on its own is a head sliding sideways.
	 *
	 * Slow, and on its own beat — nine and a bit rail joints to look one way and back, against the
	 * nod's seven — so the two never line up into a single rocking-horse motion.
	 */
	const TURN_JOINTS = 9.7;
	const TURN_SHIFT = 0.015;
	const TURN_NARROW = 0.055;
	/** A degree of tilt with the turn: a head that leans into the look, not a compass. */
	const TURN_TILT = 0.017;

	/**
	 * THE HEADLAMP, which the car has always had and has never once been switched on.
	 *
	 * The design draws a gold lens in a black bezel on the nose — `build_coaster_driver.py` finds it
	 * rather than guessing at it — and painted that way it is just another gold shape on a car
	 * covered in gold shapes. The setup dims the whole board behind these carts, which is exactly the
	 * light a working lamp shows up in.
	 *
	 * So: a haze thrown forward out of the glass, and a halo burning on it. The haze is the same
	 * radial spark the plaza's lamps use, stretched along the road — NOT a drawn cone, which is what
	 * this was first. A polygon has edges, and an additive edge over the park's bright blue sky came
	 * out as a white wedge with two ruled lines down it: a scratch on the picture rather than light
	 * off a lamp. A radial has no edge to catch anywhere, in daylight or over the dimmed board.
	 *
	 * It is drawn under the car, so the light leaves the glass instead of lying across the bonnet,
	 * and it is deliberately short — this is a bumper car's lamp on a lit fairground, not a
	 * searchlight.
	 */
	const BEAM_REACH = 0.38;
	const BEAM_SPREAD = 2.6;
	const BEAM_ALPHA = 0.4;
	const BEAM_TINT = 0xffc178;

	/** Halo and hot centre, as multiples of the lens — the glass is tall and narrow, the light is not. */
	const HALO = 4.6;
	const HALO_ALPHA = 0.4;
	const HALO_TINT = 0xffcd86;
	const CORE = 1.35;
	const CORE_ALPHA = 0.62;
	const CORE_TINT = 0xfff6e2;

	/**
	 * How much of the light the track shakes out of it, and it is the TRACK — a filament being
	 * jarred, twice a joint because both axles cross every joint. Like everything else here it is
	 * distance, so a lamp on a parked cart burns steady rather than strobing on the spot.
	 */
	const FLICKER = 0.16;
</script>

<script lang="ts">
	import { Container, Sprite } from 'pixi-svelte';

	type Props = {
		/** The frame this rig is drawn into, centred on the container's own origin. */
		width: number;
		height: number;
		/**
		 * How far this cart has come, in the same units as `width`. The only input the rig has:
		 * every part here is a function of it.
		 */
		travel: number;
		/** One rail joint, in those units — the presenter owns the track, so it passes the spacing. */
		joint: number;
		/** This cart's own offset into the joints, so a rail of them never nods in step. */
		phase?: number;
	};

	const props: Props = $props();

	const joints = $derived(props.travel / props.joint + (props.phase ?? 0));
	const nod = $derived(
		JOLT_NOD * Math.sin(TAU * joints) + SWAY_NOD * Math.sin((TAU * joints) / SWAY_JOINTS),
	);
	/** -1 looking back over its shoulder, +1 looking down the track. */
	const turn = $derived(Math.sin((TAU * joints) / TURN_JOINTS));

	/** A wheel that rolls: the angle a circle of this radius turns through over this distance. */
	const roll = $derived(props.travel / (COASTER_DRIVER_WHEEL_RADIUS * props.width));

	const place = (part: CoasterDriverPart) => ({
		key: part.key,
		x: (part.x - 0.5) * props.width,
		y: (part.y - 0.5) * props.height,
		width: part.width * props.width,
		height: part.height * props.height,
	});

	const body = $derived(place(COASTER_DRIVER_BODY));
	const head = $derived(place(COASTER_DRIVER_HEAD));
	const wheels = $derived(COASTER_DRIVER_WHEELS.map(place));

	const lamp = $derived({
		x: (COASTER_DRIVER_LAMP.x - 0.5) * props.width,
		y: (COASTER_DRIVER_LAMP.y - 0.5) * props.height,
		height: COASTER_DRIVER_LAMP.height * props.height,
	});
	const flicker = $derived(1 - FLICKER * (0.5 - 0.5 * Math.cos(2 * TAU * joints)));
</script>

<Container>
	<!-- Under the car: light comes out of the lens, it does not lie on the bonnet. Anchored on its
	     left edge, so the haze starts at the glass and lies along the road ahead of it. -->
	<Sprite
		key="spark"
		anchor={{ x: 0, y: 0.5 }}
		x={lamp.x}
		y={lamp.y}
		width={BEAM_REACH * props.width}
		height={lamp.height * BEAM_SPREAD}
		alpha={BEAM_ALPHA * flicker}
		tint={BEAM_TINT}
		blendMode="add"
	/>
	<Sprite
		key={COASTER_DRIVER_BODY.key}
		anchor={0.5}
		x={body.x}
		y={body.y}
		width={body.width}
		height={body.height}
	/>
	<!-- Over the body, not under it: the tyre is black and the bumper skirt it crosses is black, so
	     the tyre is lost in it either way, and this is what keeps the gold hub — the one part of a
	     wheel anybody can watch turning — in front of the skirt rather than behind it. -->
	{#each wheels as wheel, index (index)}
		<Sprite
			key={wheel.key}
			anchor={0.5}
			x={wheel.x}
			y={wheel.y}
			width={wheel.width}
			height={wheel.height}
			rotation={roll}
		/>
	{/each}
	<!-- Turned about the base of the NECK, so the head leans on its neck rather than sliding. The
	     narrowing is anchored there too, which is what keeps a turning head ON its shoulders. -->
	<Sprite
		key={COASTER_DRIVER_HEAD.key}
		anchor={{ x: COASTER_DRIVER_HEAD.anchorX, y: COASTER_DRIVER_HEAD.anchorY }}
		x={head.x + TURN_SHIFT * props.width * turn}
		y={head.y + JOLT_LIFT * props.height * Math.sin(TAU * joints)}
		width={head.width * (1 - TURN_NARROW * Math.abs(turn))}
		height={head.height}
		rotation={nod + TURN_TILT * turn}
	/>
	<!-- Over everything, including the head that leans past it: this is the glass burning. -->
	<Sprite
		key="spark"
		anchor={0.5}
		x={lamp.x}
		y={lamp.y}
		width={lamp.height * HALO}
		height={lamp.height * HALO}
		alpha={HALO_ALPHA * flicker}
		tint={HALO_TINT}
		blendMode="add"
	/>
	<Sprite
		key="spark"
		anchor={0.5}
		x={lamp.x}
		y={lamp.y}
		width={lamp.height * CORE}
		height={lamp.height * CORE}
		alpha={CORE_ALPHA * flicker}
		tint={CORE_TINT}
		blendMode="add"
	/>
</Container>
