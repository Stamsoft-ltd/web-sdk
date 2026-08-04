<script lang="ts" module>
	export type EmitterEventBoardFrame =
		| { type: 'boardFrameGlowShow' }
		| { type: 'boardFrameGlowHide' };
</script>

<script lang="ts">
	import { Container, Graphics, PIXI, Sprite } from 'pixi-svelte';
	import { onMount } from 'svelte';

	import {
		FRAME_OVER_GRID_X,
		FRAME_OVER_GRID_Y,
		GRID_OFFSET_X,
		GRID_OFFSET_Y,
	} from '../game/boardArt';
	import { borderColour, borderPoint } from '../game/boardBorder';
	import { BOARD_BULBS } from '../game/boardBulbs';
	import { getContext } from '../game/context';

	const context = getContext();
	const board = $derived(context.stateGameDerived.boardLayout());
	let glowVisible = $state(false);

	const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

	context.eventEmitter.subscribeOnMount({
		boardFrameGlowShow: () => (glowVisible = true),
		boardFrameGlowHide: () => (glowVisible = false),
	});

	const frameW = $derived(board.width * board.boardScale * FRAME_OVER_GRID_X);
	const frameH = $derived(board.height * board.boardScale * FRAME_OVER_GRID_Y);

	// ── Marquee ──────────────────────────────────────────────────────────────────────────────────
	//
	// The bulbs are painted into the pad art, so they cannot be animated in the art. Instead an
	// additive glow is drawn over each one in ITS OWN colour (boardBulbs.ts carries the hue sampled
	// from the art) and the two interleaved groups are brought up in turn — every other bulb round
	// the ring, then the ones between them. Additive over the painted bulb reads as that bulb firing
	// rather than as a disc sitting on it.
	// Two moods. Free spins get the fairground chase: fast, and hard enough on and off that a bulb
	// reads as switching. The base game runs the same chase pulled back — still clearly a marquee
	// running, just dimmer and a touch slower, so it does not fight the reels for attention over a
	// whole session.
	const MOOD = {
		basegame: { cycleSeconds: 2, brightness: 0.62, snap: 1.35 },
		// Aggressive on purpose: a bonus chase should read as the fairground going off. Faster than
		// the old 1.25s, and snapped hard enough that a bulb is either on or off.
		freegame: { cycleSeconds: 0.85, brightness: 1, snap: 2.6 },
	};
	// How far past the painted bulb the glow reaches. Three rings — bright core, mid, wide halo —
	// which is enough falloff to read as light rather than as a disc, without a blur filter.
	// Alphas stay under 1: additive at full strength drove every bulb centre to pure white, which
	// threw away the colour the whole thing is about. Kept low enough that a lit bulb still reads as
	// its own hue.
	const RINGS = [
		{ scale: 5.4, alpha: 0.24 },
		{ scale: 2.9, alpha: 0.4 },
		{ scale: 1.7, alpha: 0.62 },
	];
	/** Seconds to cross from one mood to the other, so entering free spins ramps up instead of popping. */
	const MOOD_BLEND_SECONDS = 0.9;

	// ANY bonus counts, not just free spins — the Duck Your Luck pond runs its chase at full tilt too.
	const inBonus = $derived(
		context.stateGame.gameType === 'freegame' || !!context.stateGame.duckPicks,
	);

	// ── Autoplay: the running lights ─────────────────────────────────────────────────────────────
	//
	// Autoplay swaps the bulb pad for board-auto.webp — same rect, same grid, but a single neon
	// outline instead of 76 bulbs — and sends sparks round that outline. One steady thing moving
	// suits a hands-off run better than the whole border blinking at it.
	/** Seconds for a spark to run from the top of the pad to the bottom. A slow drift, not a chase. */
	const RUN_SECONDS = 5.5;
	// A mirrored pair: both leave the middle of the top edge together, one down each side. They meet
	// at the middle of the bottom edge, that run ends, and the next pair sets off from the top again
	// — they never turn round and come back. t is measured clockwise from the top middle, so the run
	// is simply 0 to half a lap in each direction.
	const SPARKS = [{ direction: 1 }, { direction: -1 }];
	// Fractions of a run spent fading in and out. The fade-in is short on purpose: it is what decides
	// where the pair APPEARS, and a long one has them showing up well down the top edge instead of
	// splitting from its middle. The fade-out can be slower — they are merging into one light at the
	// bottom by then, and a hard cut there reads as a glitch.
	const RUN_FADE_IN = 0.015;
	const RUN_FADE_OUT = 0.07;
	// Length of the trail behind a spark, as a fraction of the perimeter, and how many glows make it
	// up. Short and dense: the trail is there to say which way the spark is going, and at a longer
	// span the glows separate and read as a dotted line rather than a streak.
	const TRAIL = 0.016;
	const TRAIL_STEPS = 10;
	/** Size of the head's halo and of its white core, as fractions of the pad width. */
	const SPARK_HALO = 0.032;
	const SPARK_CORE = 0.005;
	/** Seconds to cross-fade the two pads. */
	const AUTO_BLEND_SECONDS = 0.45;

	const autoplaying = $derived(context.stateXstateDerived.isAutoBetting());

	let phase = $state(0);
	/** 0 = fully base-game mood, 1 = fully free-spin mood. */
	let mood = $state(0);
	/** 0 = bulb pad, 1 = autoplay pad. */
	let auto = $state(0);
	/** 0..1 through the current top-to-bottom run. */
	let run = $state(0);

	onMount(() => {
		let handle = 0;
		let previous = performance.now();
		const tick = (now: number) => {
			const delta = Math.min((now - previous) / 1000, 0.1);
			previous = now;

			const target = inBonus ? 1 : 0;
			const step = delta / MOOD_BLEND_SECONDS;
			mood = target > mood ? Math.min(target, mood + step) : Math.max(target, mood - step);

			const autoTarget = autoplaying ? 1 : 0;
			const autoStep = delta / AUTO_BLEND_SECONDS;
			auto =
				autoTarget > auto ? Math.min(autoTarget, auto + autoStep) : Math.max(autoTarget, auto - autoStep);
			if (auto > 0) run = (run + delta / RUN_SECONDS) % 1;

			// Advanced by the current cycle length rather than derived from elapsed time, so a mood
			// change speeds the chase up smoothly instead of teleporting it to a new phase.
			const cycle = lerp(MOOD.basegame.cycleSeconds, MOOD.freegame.cycleSeconds, mood);
			phase = (phase + ((delta / cycle) % 1) * Math.PI * 2) % (Math.PI * 2);
			handle = requestAnimationFrame(tick);
		};
		handle = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(handle);
	});

	// `snap` is what separates the moods: at 2 a group is mostly on or mostly off with a soft edge,
	// the way a marquee bulb behaves; near 0.75 it is a slow swell. The two groups stay half a cycle
	// apart either way, so one is always fading up as the other fades down.
	const level = (offset: number) => {
		const snap = lerp(MOOD.basegame.snap, MOOD.freegame.snap, mood);
		const brightness = lerp(MOOD.basegame.brightness, MOOD.freegame.brightness, mood);
		return Math.min(1, Math.max(0, Math.cos(phase + offset) * snap + 0.55)) * brightness;
	};
	const hotAlpha = $derived(level(0));
	const coolAlpha = $derived(level(Math.PI));

	const painter = (wanted: 0 | 1, w: number, h: number) => (graphics: PIXI.Graphics) => {
		for (const [x, y, radius, group, colour] of BOARD_BULBS) {
			if (group !== wanted) continue;
			const cx = (x - 0.5) * w;
			const cy = (y - 0.5) * h;
			const r = radius * w;
			for (const ring of RINGS) {
				graphics.circle(cx, cy, r * ring.scale).fill({ color: colour, alpha: ring.alpha });
			}
		}
	};

	// Rebuilt only when the board is resized: the draw callback's identity is what re-triggers
	// pixi-svelte's clear-and-redraw, and the per-frame animation only touches alpha.
	const drawHot = $derived(painter(0, frameW, frameH));
	const drawCool = $derived(painter(1, frameW, frameH));

	// One glow sprite per trail step plus a halo and a white core for each head. Rebuilt every frame
	// from `run`, but only as plain numbers — the sprites themselves stay mounted and just move,
	// which is the whole point of doing this with sprites instead of a Graphics.
	const sparkNodes = $derived.by(() => {
		const at = run;
		const w = frameW;
		const h = frameH;
		// Full brightness for the middle of the run, easing in at the top and out at the bottom.
		const life = Math.min(1, at / RUN_FADE_IN, (1 - at) / RUN_FADE_OUT);
		const nodes: {
			id: string;
			x: number;
			y: number;
			size: number;
			alpha: number;
			colour: number;
		}[] = [];
		SPARKS.forEach((spark, index) => {
			// Half a lap per run: 0 at the top middle, 0.5 (the bottom middle) at the end.
			const head = at * 0.5 * spark.direction;
			// Tail first, so the head's own glow lands on top of it.
			for (let i = TRAIL_STEPS; i >= 1; i -= 1) {
				const t = head - (i / TRAIL_STEPS) * TRAIL * spark.direction;
				const point = borderPoint(t, w, h);
				// Square falloff: the trail should be a thin streak that dies quickly, not a comma.
				const fade = (1 - i / TRAIL_STEPS) ** 2;
				nodes.push({
					id: `${index}-${i}`,
					x: point.x,
					y: point.y,
					size: SPARK_HALO * w * (0.2 + fade * 0.5),
					alpha: fade * 0.85 * life,
					colour: borderColour(t),
				});
			}
			// Wide halo, then a tight one at nearly full strength, then a small white centre. Most of
			// the light is the border's own colour — a big white core washes the hue out, and the
			// colour is the point: blue stays blue on the blue run, red on the red.
			const point = borderPoint(head, w, h);
			const colour = borderColour(head);
			nodes.push({
				id: `${index}-halo`,
				x: point.x,
				y: point.y,
				size: SPARK_HALO * w,
				alpha: 0.55 * life,
				colour,
			});
			nodes.push({
				id: `${index}-inner`,
				x: point.x,
				y: point.y,
				size: SPARK_HALO * w * 0.42,
				alpha: 0.95 * life,
				colour,
			});
			nodes.push({
				id: `${index}-core`,
				x: point.x,
				y: point.y,
				size: SPARK_CORE * w,
				alpha: 0.8 * life,
				colour: 0xffffff,
			});
		});
		return nodes;
	});
</script>

<Container x={board.x + frameW * GRID_OFFSET_X} y={board.y + frameH * GRID_OFFSET_Y}>
	<Sprite
		key="themeBoard"
		anchor={0.5}
		width={frameW}
		height={frameH}
		tint={glowVisible ? 0xffc4ff : 0xffffff}
	/>
	<Graphics blendMode="add" alpha={hotAlpha * (1 - auto)} draw={drawHot} />
	<Graphics blendMode="add" alpha={coolAlpha * (1 - auto)} draw={drawCool} />
	<!-- The autoplay pad fades in ON TOP of the bulb one rather than the two cross-fading: both are
	     opaque, so cross-fading them would let the park show through the board at the midpoint. -->
	{#if auto > 0}
		<Sprite
			key="themeBoardAuto"
			anchor={0.5}
			width={frameW}
			height={frameH}
			alpha={auto}
			tint={glowVisible ? 0xffc4ff : 0xffffff}
		/>
		{#each sparkNodes as node (node.id)}
			<Sprite
				key="spark"
				anchor={0.5}
				blendMode="add"
				x={node.x}
				y={node.y}
				width={node.size}
				height={node.size}
				alpha={node.alpha * auto}
				tint={node.colour}
			/>
		{/each}
	{/if}
</Container>
