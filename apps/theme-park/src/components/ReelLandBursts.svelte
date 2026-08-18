<script lang="ts">
	/**
	 * A short spark burst along the foot of each reel as it stops.
	 *
	 * Landing already squashes the symbols (<LandingSquish>), but nothing acknowledged the impact,
	 * so a reel arriving felt weightless. This throws a handful of sparks up off the bottom edge, which
	 * gives the stop a sense of the reel hitting something. Deliberately sparks only: a bright bar
	 * drawn across the reel's foot read as a stray blue line under the bottom row.
	 *
	 * Particles are deterministic: seeded from the reel and particle index rather than Math.random,
	 * so a burst never allocates and never jitters differently between frames.
	 */
	import { Container, Graphics, PIXI } from 'pixi-svelte';

	import {
		BOARD_DIMENSIONS,
		BOARD_GRID_OFFSET_Y,
		BOARD_SIZES,
		CELL_H,
		CELL_W,
		getBoardCellCenterX,
	} from '../game/constants';
	import { boardShake } from '../game/boardShake.svelte';
	import { getContext } from '../game/context';

	const context = getContext();
	const layout = $derived(context.stateGameDerived.boardLayout());
	const board = $derived(context.stateGame.board);
	// PIXI is exported as a value, not a namespace, so `PIXI.Graphics` cannot be used in a type
	// position; the instance type is reachable through the value's type instead.
	type GraphicsTarget = InstanceType<typeof PIXI.Graphics>;

	const LIFE_SECONDS = 0.42;
	const PARTICLES = 11;
	const RISE = BOARD_SIZES.height * 0.24;
	const SPREAD = CELL_W * 0.42;
	// Fired from just inside the grid, not from its edge: the marquee bulbs run along the very
	// bottom of the board and swallowed sparks launched from there.
	const FLOOR_INSET = CELL_H * 0.16;
	const COLOURS = [0x8fe3ff, 0xff7be0, 0xffd45b, 0xffffff];

	/** Stable pseudo-random in [0, 1) from two small integers. */
	const seeded = (a: number, b: number) => {
		const value = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
		return value - Math.floor(value);
	};

	// Seconds since each reel last landed; past LIFE_SECONDS the burst is done and draws nothing.
	let elapsed = $state<number[]>(new Array(BOARD_DIMENSIONS.x).fill(Infinity));
	let seenLanding = new Array<number>(BOARD_DIMENSIONS.x).fill(-1);

	$effect(() => {
		for (let reel = 0; reel < BOARD_DIMENSIONS.x; reel += 1) {
			const sequence = board[reel]?.reelState.landingSequence ?? 0;
			if (sequence === seenLanding[reel]) continue;
			const first = seenLanding[reel] === -1;
			seenLanding[reel] = sequence;
			// Skip the initial render: every reel reports its starting sequence before anything spins.
			if (!first) elapsed[reel] = 0;
		}
	});

	$effect(() => {
		const app = context.stateApp.pixiApplication;
		if (!app) return;
		const tick = () => {
			const delta = app.ticker.deltaMS / 1000;
			for (let reel = 0; reel < elapsed.length; reel += 1) {
				if (elapsed[reel] > LIFE_SECONDS) continue;
				elapsed[reel] = elapsed[reel] + delta;
			}
		};
		app.ticker.add(tick, null, PIXI.UPDATE_PRIORITY.LOW);
		return () => app.ticker.remove(tick, null);
	});

	const anyBurst = $derived(elapsed.some((value) => value <= LIFE_SECONDS));

	const drawBursts = $derived.by(() => {
		const ages = [...elapsed];
		return (graphics: GraphicsTarget) => {
			graphics.clear();
			const floor = BOARD_SIZES.height - FLOOR_INSET;

			for (let reel = 0; reel < ages.length; reel += 1) {
				const age = ages[reel];
				if (age > LIFE_SECONDS) continue;
				const centreX = getBoardCellCenterX(reel);

				for (let index = 0; index < PARTICLES; index += 1) {
					const side = seeded(reel, index) * 2 - 1;
					const speed = 0.55 + seeded(reel, index + 40) * 0.45;
					const size = 1.5 + seeded(reel, index + 80) * 2.1;
					const progress = Math.min(1, age / LIFE_SECONDS / speed);
					if (progress >= 1) continue;
					// Up fast, then fall back — a parabola reads as something thrown, not blown.
					const rise = Math.sin(progress * Math.PI) * RISE * speed;
					graphics
						.circle(centreX + side * SPREAD * progress, floor - rise, size * (1 - progress * 0.5))
						.fill({
							color: COLOURS[index % COLOURS.length],
							alpha: (1 - progress) ** 1.5 * 0.85,
						});
				}
			}
		};
	});
</script>

{#if anyBurst}
	<Container
		x={layout.x + boardShake.x}
		y={layout.y + BOARD_GRID_OFFSET_Y + boardShake.y}
		pivot={layout.pivot}
		scale={layout.boardScale}
	>
		<Graphics blendMode="add" draw={drawBursts} />
	</Container>
{/if}
