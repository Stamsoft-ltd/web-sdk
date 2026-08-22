<script lang="ts">
	import { Container, Sprite } from 'pixi-svelte';
	import { onMount } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';

	import { getContext } from '../game/context';
	import { BALLOON_Z, backgroundCover } from '../game/sceneBackground';

	/**
	 * Balloons that have got away from someone and drift up out of the plaza. It is the one piece of
	 * background motion that is an event rather than a texture: the clouds are always there and stop
	 * being read after a few seconds, where something that happens now and then keeps catching the eye.
	 *
	 * A few fly at once, on independent timers, at slightly different sizes, and spread across both
	 * sides of the board rather than all up the same lane. They leave from plaza level rather than off
	 * the bottom of the screen, so a flight reads as something that got away rather than as a sprite
	 * entering. On desktop the release point is behind the reels, so a flight goes up one of the clear
	 * columns beside them; on portrait the board is full-bleed and the balloon rises out from behind
	 * its top edge into the sky above instead.
	 *
	 * The art is the flat outlined balloon the symbol set is drawn in (2026-08-19) — it used to be a
	 * rendered one carrying a baked depth-of-field blur, which was right when the backdrop behind it
	 * was blurred and is wrong now that the plaza is sharp. Everything it does on screen is motion:
	 * it sways, leans into the swing, bobs, and breathes, because a flat shape that only translates
	 * reads as a sticker sliding up the window.
	 */

	const context = getContext();
	const canvas = $derived(context.stateLayoutDerived.canvasSizes());
	const cover = $derived(backgroundCover(canvas));

	const COLOURS = ['balloonPink', 'balloonOrange', 'balloonYellow', 'balloonGreen', 'balloonBlue'];

	// Geometry of the exported sprite, printed by scripts/build-escaped-balloon.py. Everything below
	// is measured against the painted BODY — the balloon alone, without its knot and its ribbon —
	// rather than against the sprite, so re-cropping the art there cannot resize it on screen.
	const SPRITE_ASPECT = 150 / 273;
	const BODY_ASPECT = 130 / 147;
	/** Body width as a share of the sprite's. */
	const BODY_SHARE = 0.942;
	/**
	 * Where the TOP of the balloon sits down the sprite. It is the pivot: the balloon is pulled up
	 * from there, so that is the point the sprite hangs and turns about, and the ribbon swings under
	 * it. Anchoring at the sprite's middle would put the pivot down in the ribbon and swing the
	 * balloon and its ribbon in opposite directions.
	 */
	const LIFT_SHARE = 0.0199;

	// Sized against the backdrop art like the clouds are, so the balloon keeps its size relative to
	// the ferris wheel rather than to the window. Capped against the canvas because on portrait the
	// art is cover-scaled far wider than the screen and the uncapped fraction reads as a beach ball.
	const WIDTH_FRACTION = 0.029;
	const WIDTH_CANVAS_CAP = 0.075;

	/**
	 * Where a stray balloon comes loose, as fractions of the plaza art. The park it flies over has no
	 * balloon stand painted in it any more — the old backdrop did, and this used to be pinned to it —
	 * so this is simply plaza level, at the mouth of the avenue, low enough that a flight starts from
	 * behind the flower beds rather than in open sky. Fractions of the art rather than of the canvas,
	 * because the art is cover-scaled and the plaza moves under a resize.
	 */
	const RELEASE = { x: 0.33, y: 0.66 };

	/**
	 * How many can be in the air at once. Each keeps its own timer, so they overlap at their own pace
	 * instead of leaving together. Only part of a climb crosses open sky — the rest is over the trees
	 * and the ferris wheel, where a balloon has to compete with painted detail — so it takes several
	 * in flight before the sky stops looking empty.
	 */
	const FLIGHT_COUNT = 5;
	/**
	 * Per-flight size, as a multiple of the shared width. Balloons that all measure the same read as
	 * copies of one sprite; a little spread reads as different distances into the park.
	 */
	const SIZE_RANGE = { min: 0.78, max: 1.14 };

	/**
	 * Seconds to climb a canvas height, at full size. A flight covers only the distance from the
	 * stand to the top of the screen, so the duration is scaled from this — otherwise the balloon
	 * would crawl on a short climb and race on a tall one. Slow either way: this is a thing floating
	 * away, not a rocket.
	 */
	const CLIMB_SECONDS = 19;
	/**
	 * Each slot flies on its own beat of roughly this many seconds, and the slots are dealt evenly
	 * around it at boot — so with a climb of about eleven seconds, one leaves every three and three or
	 * four are up at any moment.
	 *
	 * The rest is what is left of the beat after the climb, rather than a flat random wait, and that
	 * matters: a flat wait lets the slots drift into step with each other, and once they are in step
	 * the sky alternates between five balloons and none. Sizes vary the climb, so this keeps pulling
	 * each slot back onto its own phase.
	 */
	const CYCLE_SECONDS = 14;
	const CYCLE_JITTER = 2.5;
	/** Never launch straight into the last one's wake, however long the climb ran. */
	const MIN_REST_SECONDS = 1.5;
	/** The first flight comes almost at once, so a short session still sees one. */
	const FIRST_REST_SECONDS = { min: 0.5, max: 2.5 };
	/** How far apart two live lanes should sit, in balloon widths, before they read as a pair. */
	const LANE_SEPARATION_WIDTHS = 2.2;

	// Horizontal drift while climbing, as a multiple of the balloon's width.
	const SWAY_WIDTHS = 1.05;
	const SWAY_SECONDS = 5.6;
	/** How far it recedes by the top of the climb. */
	const END_SCALE = 0.74;

	// A balloon on a thermal does not rise at a constant rate, and the eye reads a constant rate as a
	// tween. This adds a slow rise and fall on top of the climb, in balloon heights.
	const BOB_HEIGHTS = 0.22;
	const BOB_SECONDS = 3.9;
	/**
	 * And it is not rigid: it stretches as it swings and settles back when it stops. Driven off the
	 * SWAY, not off a clock of its own, so the balloon squashes at the ends of its swing where a real
	 * one does. Small — at more than a few percent it stops being a balloon and starts being jelly.
	 */
	const BREATH = 0.05;

	const random = (min: number, max: number) => min + Math.random() * (max - min);

	type Flight = {
		colour: string;
		/** Multiple of the shared balloon width this one flies at. */
		size: number;
		/** Centre of the lane, in canvas x. */
		laneX: number;
		/** Half-width the sway is allowed to use, in canvas x. */
		laneSway: number;
		fromY: number;
		phase: number;
		/** Which way its ribbon curls: the sprite is mirrored on -1, so it is not one drawing five times. */
		direction: 1 | -1;
		/** 0 at the bottom of the climb, 1 off the top. Null while resting. */
		progress: number | null;
		/** How long the current climb takes, fixed when it starts — see CYCLE_SECONDS. */
		climbSeconds: number;
		waiting: number;
		/** Its own beat for the bob, so no two rise and fall together. */
		bobPhase: number;
	};

	/** Width of the painted body — the sprite is drawn wider than this, see BODY_SHARE. */
	const balloonWidth = (flight: Flight) =>
		Math.min(cover.width * WIDTH_FRACTION, canvas.width * WIDTH_CANVAS_CAP) * flight.size;

	/**
	 * Not the colour of anything already climbing: with five colours and five slots a repeat is
	 * otherwise common enough to notice, and two of the same in one sky read as one sprite drawn
	 * twice. Re-run when the flight actually starts, not when it is queued — the balloons that were
	 * up when it was queued have usually gone by then, and the ones that matter are not up yet.
	 */
	const chooseColour = (flight: Flight) => {
		const taken = flights
			.filter((other) => other !== flight && other.progress !== null)
			.map((other) => other.colour);
		const free = COLOURS.filter((colour) => !taken.includes(colour));
		const palette = free.length > 0 ? free : COLOURS;
		return palette[Math.floor(Math.random() * palette.length)];
	};

	/** Lanes of the flights currently in the air, so a new one can pick a gap between them. */
	const liveLanes = (except: Flight) =>
		flights.filter((other) => other !== except && other.progress !== null).map((other) => other.laneX);

	/**
	 * The lane is re-chosen at the start of every flight rather than once at boot, because the board
	 * moves under a resize and a lane picked against the old layout would send the balloon up behind
	 * the reels.
	 */
	const chooseLane = (flight: Flight) => {
		const width = balloonWidth(flight);
		const main = context.stateLayoutDerived.mainLayout();
		const board = context.stateGameDerived.boardLayout();
		// boardLayout is measured from the middle of the main layout, not its top-left corner, so the
		// scaled offset goes straight onto the middle of the canvas.
		const toCanvasX = (x: number) => canvas.width * 0.5 + x * main.scale;
		const toCanvasY = (y: number) => canvas.height * 0.5 + y * main.scale;

		const boardLeft = toCanvasX(board.frameCx - board.frameW * 0.5);
		const boardRight = toCanvasX(board.frameCx + board.frameW * 0.5);
		const boardTop = toCanvasY(board.frameCy - board.frameH * 0.5);

		const releaseX = cover.left + cover.width * RELEASE.x;
		const releaseY = cover.top + cover.height * RELEASE.y;

		// A column has to hold the balloon plus its sway plus a margin, else the balloon clips the
		// frame on every pass.
		const needed = width * (1 + SWAY_WIDTHS * 2) * 1.15;
		const columns = [
			{ from: 0, to: boardLeft },
			{ from: boardRight, to: canvas.width },
		].filter((column) => column.to - column.from >= needed);

		const others = liveLanes(flight);

		if (columns.length > 0) {
			// Spread across the clear columns instead of stacking every flight beside the release point:
			// with several balloons up at once, all of them rising on the same side reads as a machine.
			// The column carrying the fewest live flights wins, and the release point's own column
			// breaks the tie — so a lone balloon still leaves from there and the next goes up the far
			// side.
			const gap = (column: { from: number; to: number }) =>
				Math.max(column.from - releaseX, releaseX - column.to, 0);
			const busy = (column: { from: number; to: number }) =>
				others.filter((lane) => lane >= column.from && lane <= column.to).length;
			const column = columns.reduce((best, next) => {
				const difference = busy(next) - busy(best);
				return difference < 0 || (difference === 0 && gap(next) < gap(best)) ? next : best;
			});

			const inset = width * 0.6;
			const from = column.from + inset + width * SWAY_WIDTHS;
			const to = column.to - inset - width * SWAY_WIDTHS;
			const clamp = (x: number) => Math.min(Math.max(x, from), Math.max(from, to));
			// Beside the release point the flight starts near it, with a little jitter so repeat flights
			// are not stamped on the same line. Away from it there is nothing to line up with, so the
			// whole column is fair game.
			const holdsRelease = releaseX >= column.from && releaseX <= column.to;
			const pick = () =>
				clamp(holdsRelease ? releaseX + random(-width * 0.4, width * 0.4) : random(from, to));

			// Keep clear of whatever is already climbing: two balloons on neighbouring lines look like
			// one sprite drawn twice. Widen the search around the release point rather than abandon it.
			const distance = (x: number) =>
				others.length === 0 ? Infinity : Math.min(...others.map((lane) => Math.abs(lane - x)));
			let laneX = pick();
			for (let attempt = 0; attempt < 5 && distance(laneX) < width * LANE_SEPARATION_WIDTHS; attempt += 1) {
				const candidate = clamp(
					holdsRelease ? releaseX + random(-width * 2, width * 2) : random(from, to),
				);
				if (distance(candidate) > distance(laneX)) laneX = candidate;
			}

			return {
				laneX,
				laneSway: Math.max(0, (to - from) * 0.5 + width * SWAY_WIDTHS - width * 0.5),
				// Off to the side there is nothing to leave from, so the start height is jittered
				// around plaza level instead of pinned to the release point.
				fromY: holdsRelease ? releaseY : releaseY + random(-width * 0.6, width * 1.2),
			};
		}

		// Full-bleed board (portrait). Start behind it and let the balloon come out over the top rail,
		// unless the release point is already above the board — then it can leave from there.
		const from = canvas.width * 0.14;
		const to = canvas.width * 0.86;
		const distance = (x: number) =>
			others.length === 0 ? Infinity : Math.min(...others.map((lane) => Math.abs(lane - x)));
		let laneX = random(from, to);
		for (let attempt = 0; attempt < 5 && distance(laneX) < width * LANE_SEPARATION_WIDTHS; attempt += 1) {
			const candidate = random(from, to);
			if (distance(candidate) > distance(laneX)) laneX = candidate;
		}
		return {
			laneX,
			laneSway: width * SWAY_WIDTHS,
			fromY: Math.min(releaseY, boardTop + width * 0.9),
		};
	};

	const launch = (
		flight: Flight,
		{
			rest = Math.max(
				MIN_REST_SECONDS,
				CYCLE_SECONDS + random(-CYCLE_JITTER, CYCLE_JITTER) - flight.climbSeconds,
			),
		} = {},
	) => {
		flight.colour = chooseColour(flight);
		flight.size = random(SIZE_RANGE.min, SIZE_RANGE.max);
		const lane = chooseLane(flight);
		flight.laneX = lane.laneX;
		flight.laneSway = lane.laneSway;
		flight.fromY = lane.fromY;
		flight.phase = Math.random() * Math.PI * 2;
		flight.bobPhase = Math.random() * Math.PI * 2;
		flight.direction = Math.random() < 0.5 ? 1 : -1;
		flight.progress = null;
		flight.waiting = rest;
		return flight;
	};

	/** How far this flight has to travel to take the balloon and its ribbon off the top edge. */
	const climbTravel = (flight: Flight) => {
		const spriteHeight = balloonWidth(flight) / BODY_SHARE / SPRITE_ASPECT;
		return flight.fromY + spriteHeight * (1 - LIFT_SHARE);
	};

	/** Smaller balloons are further into the park, so they cross the sky more slowly. */
	const climbDuration = (flight: Flight) =>
		(CLIMB_SECONDS * (climbTravel(flight) / Math.max(1, canvas.height))) / flight.size;

	// The flights are plain objects mutated in the frame loop; the counter below is the reactive part.
	const flights: Flight[] = [];
	for (let index = 0; index < FLIGHT_COUNT; index += 1) {
		flights.push({
			colour: COLOURS[0],
			size: 1,
			laneX: 0,
			laneSway: 0,
			fromY: 0,
			phase: 0,
			direction: 1,
			progress: null,
			climbSeconds: CYCLE_SECONDS,
			waiting: 0,
			bobPhase: 0,
		});
	}
	// Dealt evenly around the beat rather than each staggered by its own random gap: random gaps
	// collide, and two slots handed the same start are a pair that then flies together for good.
	flights.forEach((flight, index) =>
		launch(flight, {
			rest:
				random(FIRST_REST_SECONDS.min, FIRST_REST_SECONDS.max) +
				(index * CYCLE_SECONDS) / FLIGHT_COUNT,
		}),
	);

	let frame = $state(0);
	let elapsed = $state(0);

	onMount(() => {
		let handle = 0;
		let previous = performance.now();
		const tick = (now: number) => {
			// Clamped so a backgrounded tab does not resume with the balloons teleported up the sky.
			const delta = Math.min((now - previous) / 1000, 0.1);
			previous = now;
			elapsed += delta;

			for (const flight of flights) {
				if (flight.progress === null) {
					flight.waiting -= delta;
					// The lane is chosen at launch, but the canvas may have changed size while it rested —
					// and so may the other flights, which this one has to stay clear of.
					if (flight.waiting <= 0) {
						flight.colour = chooseColour(flight);
						const lane = chooseLane(flight);
						flight.laneX = lane.laneX;
						flight.laneSway = lane.laneSway;
						flight.fromY = lane.fromY;
						flight.progress = 0;
						flight.climbSeconds = climbDuration(flight);
					}
				} else {
					flight.progress += delta / flight.climbSeconds;
					if (flight.progress >= 1) launch(flight);
				}
			}

			frame += 1;
			handle = requestAnimationFrame(tick);
		};
		handle = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(handle);
	});

	const ready = $derived(COLOURS.every((key) => !!context.stateApp.loadedAssets?.[key]));

	// Both bonuses swap the plaza for their own backdrop, and neither has this sky. Faded on the same
	// 600ms curve <Background> crossfades on, so the balloons do not blink out mid-climb.
	const sceneSwapped = $derived(
		!!context.stateGame.duckPicks || context.stateGame.bonusType === 'coaster',
	);
	const sceneFade = new Tween(1, { duration: 600, easing: cubicInOut });
	$effect(() => {
		sceneFade.set(sceneSwapped ? 0 : 1);
	});

	/** Where a balloon's centre sits at `time` seconds — sampled in the past for its string. */
	const swayAt = (flight: Flight, time: number) => {
		const offset = Math.sin((time / SWAY_SECONDS) * Math.PI * 2 + flight.phase);
		return flight.laneX + offset * Math.min(flight.laneSway, balloonWidth(flight) * SWAY_WIDTHS);
	};

	const placed = $derived.by(() => {
		void frame;

		return flights
			.filter((flight) => flight.progress !== null)
			.map((flight) => {
				const width = balloonWidth(flight);
				const height = width / BODY_ASPECT;
				const spriteWidth = width / BODY_SHARE;
				const spriteHeight = spriteWidth / SPRITE_ASPECT;
				const progress = flight.progress as number;
				const scale = 1 + (END_SCALE - 1) * progress;

				// The bob rides on top of the climb, so the rise is uneven the way a real one is.
				const bob =
					Math.sin((elapsed / BOB_SECONDS) * Math.PI * 2 + flight.bobPhase) * height * BOB_HEIGHTS;
				const y = flight.fromY - progress * climbTravel(flight) + bob;
				const x = swayAt(flight, elapsed);
				// Tilt with the drift, so the balloon leans into its own swing instead of hanging rigid.
				const lean = (x - swayAt(flight, elapsed - 0.35)) / Math.max(1, width * 0.35);
				// And stretch with it. `swing` is where it is in its swing, -1 to 1; the balloon is
				// longest as it passes through the middle and squattest at the two ends.
				const swing = Math.sin((elapsed / SWAY_SECONDS) * Math.PI * 2 + flight.phase);
				const breath = BREATH * (1 - 2 * swing * swing);

				return {
					flight,
					colour: flight.colour,
					x,
					y,
					width: spriteWidth * scale * (1 - breath) * flight.direction,
					height: spriteHeight * scale * (1 + breath),
					rotation: Math.max(-0.22, Math.min(0.22, lean * 0.22)),
					// Fades in — it leaves from mid-screen, so it has to arrive rather than appear — and out
					// again as it recedes into the top of the sky.
					alpha:
						Math.min(1, progress / 0.12) *
						(1 - Math.max(0, (progress - 0.78) / 0.22)) *
						sceneFade.current,
				};
			});
	});

</script>

<!-- Above the clouds and below every MainContainer: the balloons are nearer than the sky but still
     behind the board, which is what lets the portrait lanes emerge from behind the frame. -->
<Container zIndex={BALLOON_Z}>
	{#if ready}
		<!-- Keyed by the flight itself, so a sprite is not handed a different balloon's colour when
		     another one finishes and the list shortens. -->
		{#each placed as balloon (balloon.flight)}
			<Sprite
				key={balloon.colour}
				x={balloon.x}
				y={balloon.y}
				anchor={{ x: 0.5, y: LIFT_SHARE }}
				width={balloon.width}
				height={balloon.height}
				rotation={balloon.rotation}
				alpha={balloon.alpha}
			/>
		{/each}
	{/if}
</Container>
