<script lang="ts">
	import { Container, Graphics } from 'pixi-svelte';

	import type { Reel } from '../game/stateGame.svelte';
	import { getContext } from '../game/context';
	import { SYMBOL_WIDTH, SYMBOL_SIZE, BOARD_DIMENSIONS } from '../game/constants';

	type Props = {
		reel: Reel;
		reelIndex: number;
		oncomplete: () => void;
	};

	const props: Props = $props();
	const context = getContext();
	const board = $derived(context.stateGameDerived.boardLayout());

	// Bonus tease on a reel that may still bring the scatter that matters: the reel (already spinning
	// faster — reelAnticipationSpeedMulti) is wrapped in a hot, lit frame — a soft orange glow, a gold
	// core line, two bright sparks chasing round it — while embers rise up the column off the grill.
	// It builds the longer the reel keeps spinning (glow, chase speed, ember count). The lifecycle is
	// kept: `anticipating` clears once the reel stops.
	$effect(() => {
		if (props.reel.reelState.motion === 'stopped') props.oncomplete();
	});

	let start = -1;
	let clock = $state(0);
	$effect(() => {
		let raf = 0;
		const loop = (ts: number) => {
			if (start < 0) start = ts;
			clock = ts - start;
			raf = requestAnimationFrame(loop);
		};
		raf = requestAnimationFrame(loop);
		return () => cancelAnimationFrame(raf);
	});

	const FADE_IN_MS = 260;
	const BUILD_MS = 2200; // reaches full intensity after this long
	const fadeIn = $derived(Math.min(1, clock / FADE_IN_MS));
	const build = $derived(Math.min(1, clock / BUILD_MS));

	const colX = $derived(props.reelIndex * SYMBOL_WIDTH);
	const colH = SYMBOL_SIZE * BOARD_DIMENSIONS.y;
	const PAD = 5; // the frame sits just outside the column
	const RADIUS = 10;

	// A point at distance s (px) along the frame's perimeter, clockwise from the top-left corner.
	const perimeterPoint = (s: number) => {
		const x0 = colX - PAD;
		const y0 = -PAD;
		const w = SYMBOL_WIDTH + PAD * 2;
		const h = colH + PAD * 2;
		const total = 2 * (w + h);
		let d = ((s % total) + total) % total;
		if (d < w) return { x: x0 + d, y: y0 };
		d -= w;
		if (d < h) return { x: x0 + w, y: y0 + d };
		d -= h;
		if (d < w) return { x: x0 + w - d, y: y0 + h };
		d -= w;
		return { x: x0, y: y0 + h - d };
	};

	const drawGlow = (g: any) => {
		g.clear();
		const flicker = 0.85 + 0.15 * Math.sin(clock / 47) * Math.sin(clock / 113);
		const pulse = 0.75 + 0.25 * Math.sin(clock / (150 - 60 * build));
		const k = fadeIn * (0.55 + 0.45 * build) * flicker * pulse;
		// soft outer glow: stacked rounded outlines, widest + faintest first
		for (let i = 0; i < 6; i += 1) {
			const grow = PAD + 3 + i * 4;
			g.roundRect(colX - grow, -grow, SYMBOL_WIDTH + grow * 2, colH + grow * 2, RADIUS + i * 3).stroke({
				color: 0xff6a12,
				width: 8,
				alpha: 0.2 * k * (1 - i / 6),
			});
		}
		// warm haze rising inside the column, strongest at the bottom
		for (let i = 0; i < 5; i += 1) {
			const hh = colH * (0.18 + i * 0.12);
			g.roundRect(colX + 2, colH - hh, SYMBOL_WIDTH - 4, hh, RADIUS).fill({ color: 0xff7a1a, alpha: 0.05 * k });
		}
		// the lit frame: deep orange, then a gold core line
		g.roundRect(colX - PAD, -PAD, SYMBOL_WIDTH + PAD * 2, colH + PAD * 2, RADIUS).stroke({ color: 0xd8420e, width: 5, alpha: 0.9 * fadeIn });
		g.roundRect(colX - PAD, -PAD, SYMBOL_WIDTH + PAD * 2, colH + PAD * 2, RADIUS).stroke({ color: 0xffd36b, width: 2, alpha: (0.7 + 0.3 * pulse) * fadeIn });
		// two sparks chasing round the frame, each with a fading tail
		const total = 2 * (SYMBOL_WIDTH + colH + PAD * 4);
		const speed = 0.55 + 0.6 * build; // px per ms
		for (const offset of [0, total / 2]) {
			const head = clock * speed + offset;
			for (let j = 0; j < 14; j += 1) {
				const p = perimeterPoint(head - j * 7);
				const a = (1 - j / 14) ** 2 * fadeIn;
				g.circle(p.x, p.y, 7 - j * 0.35).fill({ color: 0xff9a2e, alpha: 0.18 * a });
				g.circle(p.x, p.y, 3.2 - j * 0.15).fill({ color: 0xfff1c4, alpha: 0.9 * a });
			}
		}
	};

	// Embers: deterministic off the clock — each one rises from the bottom on its own lane, sways,
	// shrinks and fades; more of them as the tease builds.
	const EMBERS = 26;
	const drawEmbers = (g: any) => {
		g.clear();
		const live = Math.round(EMBERS * (0.45 + 0.55 * build));
		for (let i = 0; i < live; i += 1) {
			const period = 1100 + ((i * 397) % 700);
			const f = ((clock + i * 263) % period) / period;
			const lane = ((i * 0.618) % 1) * (SYMBOL_WIDTH - 16) + 8;
			const x = colX + lane + Math.sin(f * Math.PI * 3 + i) * 6;
			const y = colH - f * colH * (0.75 + ((i * 0.37) % 0.25));
			const r = (2.6 + ((i * 1.7) % 1.6)) * (1 - f * 0.6);
			const a = Math.sin(Math.PI * f) * fadeIn * (0.7 + 0.3 * Math.sin(clock / 60 + i));
			g.circle(x, y, r * 2.4).fill({ color: 0xff6a12, alpha: 0.16 * a });
			g.circle(x, y, r).fill({ color: i % 3 ? 0xffb347 : 0xfff1c4, alpha: 0.85 * a });
		}
	};
</script>

<!-- Board-space (mirrors LockedCells): local (0,0) is the top-left of the reel grid. -->
<Container x={board.x} y={board.y} pivot={board.pivot} zIndex={6}>
	<Graphics draw={drawGlow} blendMode="add" />
	<Graphics draw={drawEmbers} blendMode="add" />
</Container>
