<script lang="ts">
	import type { Snippet } from 'svelte';
	import { onMount } from 'svelte';
	import { Container, Graphics, PIXI, Sprite } from 'pixi-svelte';
	import { drawPaintedDrip, type PaintedTendril } from '../game/paintedDrip';

	import WinPadArt from './WinPadArt.svelte';
	import { getContext } from '../game/context';

	type Props = {
		/** Sprite key of the tier pad art (plaque + wordmark + sauce + stars + burger). Omit for the
		 *  small-win case: just the red win-box plaque with the value on top (no tier wordmark). */
		padKey?: string;
		/** Amount text, rendered centred in the wooden box. */
		children: Snippet;
	};

	const props: Props = $props();
	const context = getContext();
	const board = $derived(context.stateGameDerived.boardLayout());

	// Pad art is exported ~1302x455 (plaque centred). The big-win amount sits in the win-box-amount
	// plaque (1536x1024; red panel + gold frame + splashes); small wins use the simpler wooden-board
	// value box (winBox, 810x243 — dark-red panel + gold frame).
	const PAD_ASPECT = 1302 / 455;
	const BOX_ASPECT = 1536 / 1024;
	const SMALL_ASPECT = 1241 / 623; // dedicated small-win plaque
	// Portrait: the board fills almost the whole layout, so the desktop banner multiplier makes the
	// pad overflow the phone — use a smaller fraction that still reads big.
	const isPortrait = $derived(context.stateLayoutDerived.layoutType() === 'portrait');
	const boxOnly = $derived(!props.padKey);
	const padW = $derived(board.width * (isPortrait ? 1.15 : 1.5));
	const padH = $derived(padW / PAD_ASPECT);
	// The visible plaque is ~88% of the art width, so scale the box up a touch to keep it prominent.
	// Box-only (small wins) uses the dedicated small-win plaque, centred on the board where the gold
	// number used to sit.
	const boxW = $derived(
		boxOnly ? board.width * (isPortrait ? 0.82 : 0.66) : board.width * (isPortrait ? 0.52 : 0.57),
	);
	const boxH = $derived(boxW / (boxOnly ? SMALL_ASPECT : BOX_ASPECT));
	// Centre the value in the red field. Its ink centre sits a touch low (font ascent/descent) and the
	// red panel sits a hair above the sprite centre, so on the small plaque lift it ~5.3% of the box
	// (no horizontal shift needed — the tiny -0.2% just cancels the 3% letter-spacing's trailing gap).
	// Measured on the rendered plaque → text lands dead-centre in the red field. Big-win amount box
	// (winBoxAmount) keeps its own smaller lift.
	const amountX = $derived(boxOnly ? boxW * -0.002 : 0);
	const amountY = $derived(boxOnly ? boxH * -0.053 : -boxH * 0.008);

	// The amount plaque comes alive: it pops in (elastic, with a little tilt that settles), then breathes
	// gently; a light glint sweeps across its red panel now and then; and on the sauced plaque the
	// ketchup + mustard keep dripping — a bead swells at each painted drip tip, pinches off, drops a
	// short way and fades.
	let now = $state(0);
	let t0 = 0;
	onMount(() => {
		t0 = performance.now();
		let raf = 0;
		const loop = (ts: number) => {
			now = ts - t0;
			raf = requestAnimationFrame(loop);
		};
		raf = requestAnimationFrame(loop);
		return () => cancelAnimationFrame(raf);
	});
	const ENTER_MS = 650;
	const pop = $derived.by(() => {
		const u = Math.min(1, Math.max(0, now / ENTER_MS));
		const settle = Math.exp(-5.2 * u) * Math.cos(u * Math.PI * 3.1); // 1 → overshoot → 0
		const enter = u < 1 ? 1 - 0.42 * settle : 1;
		const breathe = 1 + 0.012 * Math.sin((now / 1000) * 2.3) * Math.min(1, now / 900);
		return { scale: enter * breathe, rotation: -0.055 * settle * (u < 1 ? 1 : 0) };
	});
	// Red panel inside the plaque art (fractions of the box), for the glint mask.
	const panel = $derived(
		boxOnly ? { x0: 0.05, x1: 0.95, y0: 0.08, y1: 0.86 } : { x0: 0.07, x1: 0.93, y0: 0.31, y1: 0.68 },
	);
	const GLINT_MS = 3200;
	const drawGlintMask = (g: any) => {
		g.roundRect(boxW * (panel.x0 - 0.5), boxH * (panel.y0 - 0.5), boxW * (panel.x1 - panel.x0), boxH * (panel.y1 - panel.y0), boxH * 0.04).fill({ color: 0xffffff });
	};
	const drawGlint = (g: any) => {
		const p = ((now - 500) % GLINT_MS) / GLINT_MS;
		if (now < 500 || p > 0.32) return;
		const q = p / 0.32;
		const x = boxW * (-0.62 + 1.24 * q);
		const a = Math.sin(q * Math.PI);
		const H = boxH * 1.2;
		const skew = boxH * 0.35;
		const band = (w: number, alpha: number) =>
			g
				.poly([x - w + skew, -H / 2, x + w + skew, -H / 2, x + w - skew, H / 2, x - w - skew, H / 2])
				.fill({ color: 0xffffff, alpha });
		band(boxW * 0.07, 0.1 * a);
		band(boxW * 0.025, 0.2 * a);
	};
	// Live sauce on the amount plaque: the painted ketchup / mustard drips stretch, pinch and drop
	// exactly like the turn / buy-bonus buttons' (game/paintedDrip.ts). Source = win-box-drips.webp,
	// a 1200×500 crop of the plaque art at (180, 300) holding only the five tendril ends.
	const DRIP_ORIGIN = { x: 180, y: 300 };
	const DRIPS: PaintedTendril[] = [
		{ cx: 45.5, tip: 90, bulb: 20, half: 24, reach: 16, run: 150, period: 4800, phase: 0 },
		{ cx: 119, tip: 93, bulb: 20, half: 26, reach: 18, run: 160, period: 5500, phase: 2100 },
		{ cx: 219, tip: 61, bulb: 20, half: 25, reach: 16, run: 150, period: 6300, phase: 3900 },
		{ cx: 1015.5, tip: 473, bulb: 20, half: 30, reach: 20, run: 190, period: 5200, phase: 1200 },
		{ cx: 1127, tip: 473, bulb: 20, half: 32, reach: 20, run: 190, period: 5900, phase: 3200 },
	];
	const dripTex = $derived(context.stateApp.loadedAssets?.winBoxDrips as InstanceType<typeof PIXI.Texture> | undefined);
	const drawDrips = (g: any) => {
		if (boxOnly || !dripTex) return;
		const k = boxW / 1536;
		// source px → plaque-local: (src + origin − art centre) × k
		const map = { ox: 768 - DRIP_ORIGIN.x, oy: 512 - DRIP_ORIGIN.y, k };
		for (const d of DRIPS) drawPaintedDrip(g, dripTex, d, now, map);
	};
</script>

{#if boxOnly}
	<!-- Small-win case: the dedicated red plaque with the value on top (replaces the old gold bitmap
	     number, which came from a different game's font). -->
	<Container scale={pop.scale} rotation={pop.rotation}>
		<Sprite key="winBoxSmall" anchor={{ x: 0.5, y: 0.5 }} width={boxW} height={boxH} />
		<Container>
			<Graphics isMask draw={drawGlintMask} />
			<Graphics draw={drawGlint} />
		</Container>
		<Container x={amountX} y={amountY}>
			{@render props.children()}
		</Container>
	</Container>
{:else}
	<Container>
		<!-- Pad (plaque + wordmark + sauce + stars + burger) re-assembled from layers so it animates in:
		     the win pops first, then the splashes swoosh in behind. Centred above the amount box. -->
		<Container y={-padH * 0.2}>
			<WinPadArt padKey={props.padKey ?? 'winPadSweet'} width={padW} compact={isPortrait} />
		</Container>

		<!-- Win-amount plaque with the count-up amount centred inside its red panel. -->
		<Container y={padH * 0.44} scale={pop.scale} rotation={pop.rotation}>
			<Sprite key="winBoxAmountCut" anchor={{ x: 0.5, y: 0.5 }} width={boxW} height={boxH} />
			<Container>
				<Graphics isMask draw={drawGlintMask} />
				<Graphics draw={drawGlint} />
			</Container>
			<Graphics draw={drawDrips} />
			<Container y={amountY}>
				{@render props.children()}
			</Container>
		</Container>
	</Container>
{/if}
