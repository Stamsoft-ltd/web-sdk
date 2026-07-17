<script lang="ts">
	import { Container, Graphics, Sprite, Text, type Sizes } from 'pixi-svelte';
	import { Tween } from 'svelte/motion';
	import { cubicIn, backOut } from 'svelte/easing';
	import {
		bookEventAmountToCurrencyString,
		bookEventAmountToBetAmountMultiplier,
	} from 'utils-shared/amount';

	import WinBoardFx from './WinBoardFx.svelte';
	import { WIN_GRADIENT } from '../game/goldGradient';
	import { WIN_BOARD_LOGO_PATHS } from '../game/winBoardLogoPaths';

	// The tiered win board with a zoom-to-centre transition between tiers: when the counting
	// amount crosses into a higher tier, the current board collapses into the centre, then the
	// new tier's board pops back out to full size (with a backOut overshoot). The first board of
	// a win presentation pops in from the centre the same way.
	const {
		amount,
		boardSize,
		screenW,
		screenH,
		maxOffX,
		maxOffY,
	}: {
		amount: number;
		boardSize: number;
		screenW: number;
		screenH: number;
		maxOffX: number;
		maxOffY: number;
	} = $props();

	// Vertical centre of each board art's amount plaque, as a fraction of boardSize measured DOWN
	// from the board centre — measured per art (the plaques sit at slightly different heights).
	const TIER_TEXT_Y: Record<string, number> = {
		sweetWinBoard: 0.318,
		wildWinBoard: 0.318,
		epicWinBoard: 0.353,
		mythicWinBoard: 0.377,
		legendaryWinBoard: 0.37,
	};

	// The 4 hex gems on the medallion ring of each board art (fractions of the sprite box,
	// relative to the sprite centre, +y down) — measured per art; each gets a small pulsing
	// halo from WinBoardFx. The MAX WIN screen art has a different composition, so no entry.
	const MEDALLION_GEMS: Record<string, { x: number; y: number }[]> = {
		sweetWinBoard: [
			{ x: -0.004, y: -0.132 },
			{ x: -0.165, y: 0.033 },
			{ x: 0.156, y: 0.033 },
			{ x: -0.004, y: 0.195 },
		],
		wildWinBoard: [
			{ x: -0.004, y: -0.127 },
			{ x: -0.156, y: 0.022 },
			{ x: 0.148, y: 0.022 },
			{ x: -0.004, y: 0.178 },
		],
		epicWinBoard: [
			{ x: 0, y: -0.051 },
			{ x: -0.161, y: 0.114 },
			{ x: 0.167, y: 0.114 },
			{ x: 0, y: 0.255 },
		],
		mythicWinBoard: [
			{ x: -0.004, y: -0.104 },
			{ x: -0.173, y: 0.062 },
			{ x: 0.167, y: 0.062 },
			{ x: -0.004, y: 0.246 },
		],
		legendaryWinBoard: [
			{ x: 0.001, y: -0.077 },
			{ x: -0.157, y: 0.08 },
			{ x: 0.156, y: 0.08 },
			{ x: 0.001, y: 0.24 },
		],
	};

	// Frame half-extents of each board art (fraction of the sprite box), measured from the solid
	// alpha runs of the PNGs — where the animated frame FX (glow band / edge bars / corner gems /
	// electric runners) should sit. cy = vertical centre offset of the frame within the sprite.
	const FRAME_FX: Record<string, { hx: number; hy: number; cy: number }> = {
		sweetWinBoard: { hx: 0.429, hy: 0.4645, cy: 0 },
		wildWinBoard: { hx: 0.4035, hy: 0.443, cy: 0 },
		epicWinBoard: { hx: 0.421, hy: 0.4585, cy: 0 },
		mythicWinBoard: { hx: 0.433, hy: 0.4645, cy: 0 },
		legendaryWinBoard: { hx: 0.4265, hy: 0.468, cy: 0 },
		maxWinBoard: { hx: 0.419, hy: 0.411, cy: 0.03 },
	};

	// Win multiplier = book amount ÷ 100 (100 book units = 1× bet).
	// Tier thresholds (× bet): <50 SWEET · 50 WILD · 100 EPIC · 200 MYTHIC · 500 LEGENDARY.
	// MAX WIN is reserved for the TRUE 25000x win cap.
	const mult = $derived(bookEventAmountToBetAmountMultiplier(amount));
	const targetKey = $derived(
		mult >= 25000 ? 'maxWinBoard'
		: mult >= 500 ? 'legendaryWinBoard'
		: mult >= 200 ? 'mythicWinBoard'
		: mult >= 100 ? 'epicWinBoard'
		: mult >= 50 ? 'wildWinBoard'
		: 'sweetWinBoard',
	);

	let displayedKey = $state('');
	let animating = $state(false);
	const pop = new Tween(0, { duration: 340, easing: backOut });

	$effect(() => {
		const next = targetKey;
		if (animating || next === displayedKey) return;
		animating = true;
		(async () => {
			// Collapse the current board into the centre (skip on first mount — nothing to collapse).
			if (displayedKey) await pop.set(0, { duration: 180, easing: cubicIn });
			displayedKey = next;
			await pop.set(1, { duration: 340, easing: backOut });
			// Flipping `animating` re-runs this effect, so a tier crossed DURING the animation is
			// caught up immediately (intermediate tiers are skipped, which reads as intentional).
			animating = false;
		})();
	});

	let textSizes = $state<Sizes>({ width: 0, height: 0 });
</script>

{#if displayedKey}
	{@const isMax = displayedKey === 'maxWinBoard'}
	<!-- MAX WIN dominates the SCREEN like the Figma (4143-16513): ~62% of the screen width
	     (height-capped) — sized so the full art fits without clipping the top edge. -->
	{@const boardW = isMax ? Math.min(screenW * 0.62, screenH * 0.78 * (1535 / 1025)) : boardSize}
	{@const boardH = isMax ? boardW * (1025 / 1535) : boardSize}
	{@const offX = isMax ? maxOffX : 0}
	<!-- MAX WIN board rides a bit high of screen-centre so it clears the HUD comfortably. -->
	{@const offY = isMax ? maxOffY - boardH * 0.05 : 0}
	{@const glowColor =
		displayedKey === 'sweetWinBoard' ? 0x2fb4ff
		: displayedKey === 'wildWinBoard' ? 0x46e04b
		: displayedKey === 'epicWinBoard' ? 0xff4032
		: displayedKey === 'mythicWinBoard' ? 0xa64dff
		: 0xffb428 /* legendary + max win: gold */}
	{@const fx = FRAME_FX[displayedKey] ?? { hx: 0.42, hy: 0.46, cy: 0 }}
	{@const boardFont = isMax ? boardH * 0.062 : boardSize * 0.077}
	{@const boardMaxW = isMax ? boardW * 0.4 : boardSize * 0.62}
	{@const fitScale = textSizes.width > boardMaxW ? boardMaxW / textSizes.width : 1}
	<Container x={offX} y={offY} scale={pop.current}>
		<!-- Soft ambient glow behind the board, tinted to the tier. -->
		<Graphics
			blendMode="add"
			draw={(g) => {
				g.clear();
				const R = boardW * 0.78;
				const steps = 14;
				for (let i = steps; i >= 1; i--) {
					const t = i / steps;
					g.circle(0, 0, R * t);
					g.fill({ color: glowColor, alpha: 0.05 * (1 - t) * (1 - t) + 0.004 });
				}
			}}
		/>
		<Sprite key={displayedKey} anchor={0.5} width={boardW} height={boardH} />
		<!-- Energized frame: breathing glow band, pulsing edge light bars + corner gems and
		     electric runners crawling the frame, tinted to the tier — plus small halos on the
		     medallion ring's 4 hex gems (positions compensated for the overlay's cy offset). -->
		{@const gemPts = (MEDALLION_GEMS[displayedKey] ?? []).map((p) => ({
			x: p.x * boardW,
			y: p.y * boardH - boardH * fx.cy,
		}))}
		{@const logoPts = (WIN_BOARD_LOGO_PATHS[displayedKey] ?? []).map((path) =>
			path.map(([px, py]) => ({ x: px * boardW, y: py * boardH - boardH * fx.cy })),
		)}
		<!-- MAX WIN screen: extra light on the baked lettering — a warm glow over "MAX" and an
		     electric one over "WIN" (regions measured from the art), each with glitter sparks. -->
		{@const textGlows = isMax
			? [
					{ x: 0.021 * boardW, y: -0.139 * boardH - boardH * fx.cy, rx: 0.235 * boardW, ry: 0.093 * boardH, color: 0xffb340 },
					{ x: 0.015 * boardW, y: 0.056 * boardH - boardH * fx.cy, rx: 0.208 * boardW, ry: 0.112 * boardH, color: 0x4fd8ff },
				]
			: []}
		<!-- The two plasma faces crackle with a small contained electric glow (positions/radii
		     measured from the art via its needle/star pivot points): the compass medallion at the
		     plaque's bottom centre, and the blue sphere at the upper left. -->
		{@const plasma = isMax
			? [
					{ x: 0.015 * boardW, y: 0.400 * boardH - boardH * fx.cy, r: boardW * 0.045, color: 0x7fd0ff },
					{ x: -0.408 * boardW, y: -0.188 * boardH - boardH * fx.cy, r: boardW * 0.05, color: 0x7fd0ff },
				]
			: []}
		<WinBoardFx
			y={boardH * fx.cy}
			{boardW}
			{boardH}
			hx={fx.hx}
			hy={fx.hy}
			color={glowColor}
			gems={gemPts}
			logoPaths={logoPts}
			showFrame={!isMax}
			{textGlows}
			{plasma}
		/>
		<!-- Win amount — Cinzel 900 gold gradient with a black outline; scales to fit the plaque. -->
		<!-- The MAX art's plaque reads as centred on its compass medallion (its bottom-centre
		     ornament), which sits at +0.015 of boardW — so the amount is aligned to that axis, not
		     the raw sprite centre. Vertically it sits at +0.29 of boardH — the centre of the visible
		     bay between the top rail and the compass (the compass eats the bottom-centre). -->
		<Container
			x={isMax ? boardW * 0.015 : 0}
			y={isMax ? boardH * 0.29 : boardSize * (TIER_TEXT_Y[displayedKey] ?? 0.37)}
			scale={fitScale}
		>
			<Text
				anchor={0.5}
				onresize={(s) => (textSizes = s)}
				text={bookEventAmountToCurrencyString(amount)}
				style={{
					fontFamily: 'Cinzel',
					fontWeight: '900',
					fontSize: boardFont,
					fill: WIN_GRADIENT,
					align: 'center',
					letterSpacing: boardFont * 0.03,
					stroke: { color: 0x000000, width: Math.max(2, Math.round(boardFont * 0.04)) },
				}}
			/>
		</Container>
	</Container>
{/if}
