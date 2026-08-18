<script lang="ts">
	/**
	 * A slow band of light that crosses the playfield every few seconds.
	 *
	 * The board is a flat authored image with symbols laid on top, and nothing about it suggested a
	 * surface — the vignette in <BoardFrame> gives it a centre, and this gives it a highlight that
	 * moves across it. Drawn above the symbols so it reads as light falling on the glass rather than
	 * as a pattern printed under them, and masked to the grid so it never spills onto the frame.
	 *
	 * The band is a stack of parallel strips whose alpha peaks in the middle: pixi's gradient fills
	 * are version-sensitive, and a dozen additive quads are both cheaper and predictable.
	 */
	import { Container, Graphics, PIXI } from 'pixi-svelte';

	import { BOARD_CORNER_RADIUS, BOARD_GRID_OFFSET_Y, BOARD_SIZES } from '../game/constants';
	import { boardShake } from '../game/boardShake.svelte';
	import { getContext } from '../game/context';

	const context = getContext();
	const layout = $derived(context.stateGameDerived.boardLayout());
	// PIXI is exported as a value, not a namespace, so `PIXI.Graphics` cannot be used in a type
	// position; the instance type is reachable through the value's type instead.
	type GraphicsTarget = InstanceType<typeof PIXI.Graphics>;

	// One pass, then a long wait — a sheen that never stops reads as a screensaver.
	const SWEEP_SECONDS = 1.9;
	const CYCLE_SECONDS = 11;
	const STRIPS = 26;
	const BAND_WIDTH = BOARD_SIZES.width * 0.26;
	const TILT = 0.34; // radians; the band leans, so it crosses cells at an angle
	const PEAK_ALPHA = 0.09;

	let time = $state(0);

	$effect(() => {
		const app = context.stateApp.pixiApplication;
		if (!app) return;
		const tick = () => {
			time = (time + app.ticker.deltaMS / 1000) % CYCLE_SECONDS;
		};
		app.ticker.add(tick, null, PIXI.UPDATE_PRIORITY.LOW);
		return () => app.ticker.remove(tick, null);
	});

	const progress = $derived(time < SWEEP_SECONDS ? time / SWEEP_SECONDS : null);

	const drawSheen = $derived.by(() => {
		const run = progress;
		return (graphics: GraphicsTarget) => {
			graphics.clear();
			if (run === null) return;

			// Ease so the band accelerates in and drifts out rather than tracking at a constant rate.
			const eased = run * run * (3 - 2 * run);
			// Travel far enough past both edges that the band is fully off-screen at either end.
			const travel = BOARD_SIZES.width + BAND_WIDTH * 2;
			const centreX = -travel * 0.5 + eased * travel;
			// Fade the whole pass in and out so it never pops on at the board edge.
			const life = Math.sin(run * Math.PI);
			const height = BOARD_SIZES.height * 1.6;
			const stripWidth = BAND_WIDTH / STRIPS;

			for (let strip = 0; strip < STRIPS; strip += 1) {
				const offset = (strip / (STRIPS - 1) - 0.5) * BAND_WIDTH;
				const falloff = Math.cos((offset / BAND_WIDTH) * Math.PI) ** 2;
				graphics
					// Each strip is drawn wider than its slot so neighbours overlap and the band has no
					// visible steps.
					.rect(centreX + offset - stripWidth * 1.1, -height * 0.5, stripWidth * 2.2, height)
					.fill({ color: 0xffffff, alpha: PEAK_ALPHA * falloff * life });
			}
		};
	});

	const drawMask = (graphics: GraphicsTarget) => {
		graphics
			.roundRect(
				-BOARD_SIZES.width * 0.5,
				-BOARD_SIZES.height * 0.5,
				BOARD_SIZES.width,
				BOARD_SIZES.height,
				BOARD_CORNER_RADIUS,
			)
			.fill(0xffffff);
	};
</script>

<!-- Kept mounted between passes (the painter simply clears): every node in the scene sorts at
     zIndex 0 and pixi's sort is stable, so a layer that unmounts and comes back is re-appended and
     can change what it draws over. -->
<Container
	x={layout.x + boardShake.x}
	y={layout.y + BOARD_GRID_OFFSET_Y + boardShake.y}
	scale={layout.boardScale}
>
	<Graphics isMask draw={drawMask} />
	<Container rotation={TILT}>
		<Graphics blendMode="add" draw={drawSheen} />
	</Container>
</Container>
