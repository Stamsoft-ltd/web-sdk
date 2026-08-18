<script lang="ts">
	import { Container, Graphics, PIXI, Sprite } from 'pixi-svelte';
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
	 * sides of the board rather than all up the same lane. They come off the balloon stand painted into
	 * the backdrop, so they start mid-height rather than off the bottom of the screen, and they are
	 * blurred to the backdrop's depth of field (that is baked into the sprite — see
	 * scripts/build-escaped-balloon.py). On desktop the stand is behind the reels, so a flight goes up
	 * one of the clear columns beside them; on portrait the board is full-bleed and the balloon rises
	 * out from behind its top edge into the sky above instead.
	 */

	const context = getContext();
	const canvas = $derived(context.stateLayoutDerived.canvasSizes());
	const cover = $derived(backgroundCover(canvas));

	const COLOURS = ['balloonPink', 'balloonOrange', 'balloonYellow', 'balloonGreen', 'balloonBlue'];

	// Geometry of the exported sprite, printed by scripts/build-escaped-balloon.py. Everything below
	// is measured against the painted BODY rather than the sprite, whose transparent margin exists
	// only to give the baked blur room — so re-cropping the art there cannot resize it on screen.
	const SPRITE_ASPECT = 170 / 194;
	const BODY_ASPECT = 148 / 152;
	/** Body width as a share of the sprite's. */
	const BODY_SHARE = 0.7475;
	/** Where the knot sits down the sprite, as a share of its height. The string starts there. */
	const KNOT_SHARE = 0.885;

	// Sized against the backdrop art like the clouds are, so the balloon keeps its size relative to
	// the ferris wheel rather than to the window. Capped against the canvas because on portrait the
	// art is cover-scaled far wider than the screen and the uncapped fraction reads as a beach ball.
	const WIDTH_FRACTION = 0.029;
	const WIDTH_CANVAS_CAP = 0.075;

	/**
	 * The plaza's painted balloon stand, as fractions of background-blur.webp: the top of the bunch,
	 * which is where a stray one comes loose from. Fractions of the art rather than of the canvas,
	 * because the art is cover-scaled and the stand moves under a resize.
	 */
	const BUNCH = { x: 0.762, y: 0.478 };

	/**
	 * How many can be in the air at once. Each keeps its own timer, so they overlap at their own pace
	 * instead of leaving together. Only part of a climb crosses open sky — the rest of it is over the
	 * trees and the ferris wheel, where a blurred balloon barely reads — so it takes about four in
	 * flight before the sky stops looking empty.
	 */
	const FLIGHT_COUNT = 4;
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
	const CLIMB_SECONDS = 24;
	/**
	 * Each slot flies on its own beat of roughly this many seconds, and the slots are dealt evenly
	 * around it at boot — so with a climb of about fourteen seconds, one leaves every five and two or
	 * three are up at any moment.
	 *
	 * The rest is what is left of the beat after the climb, rather than a flat random wait, and that
	 * matters: a flat wait lets the slots drift into step with each other, and once they are in step
	 * the sky alternates between four balloons and none. Sizes vary the climb, so this keeps pulling
	 * each slot back onto its own phase.
	 */
	const CYCLE_SECONDS = 19;
	const CYCLE_JITTER = 2.5;
	/** Never launch straight into the last one's wake, however long the climb ran. */
	const MIN_REST_SECONDS = 1.5;
	/** The first flight comes almost at once, so a short session still sees one. */
	const FIRST_REST_SECONDS = { min: 0.5, max: 2.5 };
	/** How far apart two live lanes should sit, in balloon widths, before they read as a pair. */
	const LANE_SEPARATION_WIDTHS = 2.2;

	// Horizontal drift while climbing, as a multiple of the balloon's width.
	const SWAY_WIDTHS = 0.85;
	const SWAY_SECONDS = 7.5;
	/** How far it recedes by the top of the climb. */
	const END_SCALE = 0.74;

	// The string hangs a little longer than the balloon is tall, and each point down it repeats the
	// balloon's own sway from slightly earlier — which is exactly how a trailing string behaves, and
	// costs nothing to compute because the sway is an analytic curve we can sample in the past.
	const STRING_LENGTH = 1.25;
	const STRING_POINTS = 9;
	const STRING_LAG_SECONDS = 1.1;
	const STRING_CURL_WIDTHS = 0.1;

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
		direction: 1 | -1;
		/** 0 at the bottom of the climb, 1 off the top. Null while resting. */
		progress: number | null;
		/** How long the current climb takes, fixed when it starts — see CYCLE_SECONDS. */
		climbSeconds: number;
		waiting: number;
	};

	/** Width of the painted body — the sprite is drawn wider than this, see BODY_SHARE. */
	const balloonWidth = (flight: Flight) =>
		Math.min(cover.width * WIDTH_FRACTION, canvas.width * WIDTH_CANVAS_CAP) * flight.size;

	/**
	 * Not the colour of anything already climbing: with five colours and four slots a repeat is
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

		const bunchX = cover.left + cover.width * BUNCH.x;
		const bunchY = cover.top + cover.height * BUNCH.y;

		// A column has to hold the balloon plus its sway plus a margin, else the balloon clips the
		// frame on every pass.
		const needed = width * (1 + SWAY_WIDTHS * 2) * 1.15;
		const columns = [
			{ from: 0, to: boardLeft },
			{ from: boardRight, to: canvas.width },
		].filter((column) => column.to - column.from >= needed);

		const others = liveLanes(flight);

		if (columns.length > 0) {
			// Spread across the clear columns instead of stacking every flight beside the stand: with
			// several balloons up at once, all of them rising on the same side reads as a machine. The
			// column carrying the fewest live flights wins, and the stand's own column breaks the tie —
			// so a lone balloon still comes off the painted bunch and the next one goes up the far side.
			const gap = (column: { from: number; to: number }) =>
				Math.max(column.from - bunchX, bunchX - column.to, 0);
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
			// Beside the stand the flight starts near it, with a little jitter so repeat flights are not
			// stamped on the same line. Away from it there is nothing to line up with, so the whole
			// column is fair game.
			const holdsBunch = bunchX >= column.from && bunchX <= column.to;
			const pick = () =>
				clamp(holdsBunch ? bunchX + random(-width * 0.4, width * 0.4) : random(from, to));

			// Keep clear of whatever is already climbing: two balloons on neighbouring lines look like
			// one sprite drawn twice. Widen the search around the stand rather than abandon it.
			const distance = (x: number) =>
				others.length === 0 ? Infinity : Math.min(...others.map((lane) => Math.abs(lane - x)));
			let laneX = pick();
			for (let attempt = 0; attempt < 5 && distance(laneX) < width * LANE_SEPARATION_WIDTHS; attempt += 1) {
				const candidate = clamp(
					holdsBunch ? bunchX + random(-width * 2, width * 2) : random(from, to),
				);
				if (distance(candidate) > distance(laneX)) laneX = candidate;
			}

			return {
				laneX,
				laneSway: Math.max(0, (to - from) * 0.5 + width * SWAY_WIDTHS - width * 0.5),
				// Off to the side of the stand there is no painted bunch to leave from, so the start
				// height is jittered around plaza level instead of pinned to it.
				fromY: holdsBunch ? bunchY : bunchY + random(-width * 0.6, width * 1.2),
			};
		}

		// Full-bleed board (portrait). Start behind it and let the balloon come out over the top rail,
		// unless the stand is already above the board — then it can leave from the stand itself.
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
			fromY: Math.min(bunchY, boardTop + width * 0.9),
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
		flight.direction = Math.random() < 0.5 ? 1 : -1;
		flight.progress = null;
		flight.waiting = rest;
		return flight;
	};

	/** How far this flight has to travel to take the balloon and its string off the top edge. */
	const climbTravel = (flight: Flight) => {
		const width = balloonWidth(flight);
		const spriteHeight = width / BODY_SHARE / SPRITE_ASPECT;
		return flight.fromY + spriteHeight * 0.5 + (width / BODY_ASPECT) * STRING_LENGTH;
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

				const y = flight.fromY - progress * climbTravel(flight);
				const x = swayAt(flight, elapsed);
				// Tilt with the drift, so the balloon leans into its own swing instead of hanging rigid.
				const lean = (x - swayAt(flight, elapsed - 0.35)) / Math.max(1, width * 0.35);

				return {
					flight,
					colour: flight.colour,
					x,
					y,
					width: spriteWidth * scale,
					height: spriteHeight * scale,
					rotation: Math.max(-0.22, Math.min(0.22, lean * 0.22)),
					// Fades in — it leaves from mid-screen, so it has to arrive rather than appear — and out
					// again as it recedes into the top of the sky.
					alpha:
						Math.min(1, progress / 0.12) *
						(1 - Math.max(0, (progress - 0.78) / 0.22)) *
						sceneFade.current,
					knotY: y + spriteHeight * scale * (KNOT_SHARE - 0.5),
					stringLength: height * scale * STRING_LENGTH,
					// Wider and fainter than a real thread: the balloon carries a baked blur, and a crisp
					// one-pixel filament under a soft balloon reads as a scratch on the screen.
					stringWidth: Math.max(1.6, width * 0.05),
				};
			});
	});

	const drawStrings = (graphics: InstanceType<typeof PIXI.Graphics>) => {
		for (const balloon of placed) {
			if (balloon.alpha <= 0.01) continue;
			const flight = balloon.flight;
			const width = balloonWidth(flight);

			const points = Array.from({ length: STRING_POINTS }, (_, index) => {
				const fraction = index / (STRING_POINTS - 1);
				// Each point repeats the balloon's sway from a moment ago, so the string lags behind the
				// turn instead of moving as one rigid piece with it.
				const swayed = swayAt(flight, elapsed - fraction * STRING_LAG_SECONDS);
				const curl =
					Math.sin(fraction * Math.PI * 2.4 + elapsed * 1.4) *
					width *
					STRING_CURL_WIDTHS *
					fraction *
					flight.direction;
				return { x: swayed + curl, y: balloon.knotY + balloon.stringLength * fraction };
			});

			// Two passes rather than one: a stroke cannot taper, and a string that keeps full weight all
			// the way down reads as wire. The lower half is thinner and fainter, which is enough.
			const half = Math.floor(STRING_POINTS / 2);
			const passes = [
				{ from: 0, to: half + 1, width: balloon.stringWidth, alpha: 0.36 },
				{ from: half, to: STRING_POINTS, width: balloon.stringWidth * 0.65, alpha: 0.2 },
			];

			for (const pass of passes) {
				graphics.moveTo(points[pass.from].x, points[pass.from].y);
				for (let index = pass.from + 1; index < pass.to; index += 1) {
					graphics.lineTo(points[index].x, points[index].y);
				}
				graphics.stroke({
					width: pass.width,
					color: 0xfff4dc,
					alpha: pass.alpha * balloon.alpha,
					cap: 'round',
					join: 'round',
				});
			}
		}
	};
</script>

<!-- Above the clouds and below every MainContainer: the balloons are nearer than the sky but still
     behind the board, which is what lets the portrait lanes emerge from behind the frame. -->
<Container zIndex={BALLOON_Z}>
	{#if ready}
		<Graphics draw={drawStrings} />
		<!-- Keyed by the flight itself, so a sprite is not handed a different balloon's colour when
		     another one finishes and the list shortens. -->
		{#each placed as balloon (balloon.flight)}
			<Sprite
				key={balloon.colour}
				x={balloon.x}
				y={balloon.y}
				anchor={0.5}
				width={balloon.width}
				height={balloon.height}
				rotation={balloon.rotation}
				alpha={balloon.alpha}
			/>
		{/each}
	{/if}
</Container>
