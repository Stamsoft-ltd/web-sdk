<script lang="ts">
	import { Container, Graphics, Sprite, Text, type Sizes } from 'pixi-svelte';
	import { Tween } from 'svelte/motion';
	import { backOut } from 'svelte/easing';
	import {
		bookEventAmountToCurrencyString,
		bookEventAmountToBetAmountMultiplier,
	} from 'utils-shared/amount';

	import WinBoardFx from './WinBoardFx.svelte';
	import { WIN_GRADIENT } from '../game/goldGradient';
	import { WIN_BOARD_LOGO_PATHS } from '../game/winBoardLogoPaths';

	// The tiered win board. ONE board is shown for the whole presentation — the tier for the final
	// win — and it pops in from the centre with a backOut overshoot.
	//
	// The tier used to be derived from the LIVE counting amount, so a big win climbed through every
	// intermediate board on its way up (SWEET collapsing into WILD into EPIC...). That read as the
	// game changing its mind about how much the player had won. `tierAmount` is the settled total
	// and is fixed for the presentation; `amount` is the counting value and only drives the text.
	const {
		amount,
		tierAmount,
		boardSize,
		screenW,
		screenH,
		maxOffX,
		maxOffY,
	}: {
		amount: number;
		tierAmount: number;
		boardSize: number;
		screenW: number;
		screenH: number;
		maxOffX: number;
		maxOffY: number;
	} = $props();

	// The amount plaque BAY of each board art — the flat dark region between the plaque's top rail
	// and its bottom ornament — as fractions of the sprite box: `cy` is the bay's vertical centre
	// measured DOWN from the sprite centre, `w`/`h` its extents. All MEASURED off the art (rows and
	// columns whose 95th-percentile luminance stays low between the two bright rails), not hand
	// tuned: the bays sit at different heights AND are different sizes across the boards, so a
	// single shared value leaves the amount off-centre on some and undersized on all of them.
	//
	// The amount is sized FROM the bay rather than from a shared fraction of boardSize. The old
	// shared 0.077 filled barely 60% of the shortest bay and less than half of the tallest, which
	// left every board looking like it had an empty slot under the medallion.
	const TIER_BAY: Record<string, { cy: number; w: number; h: number }> = {
		sweetWinBoard: { cy: 0.324, w: 0.607, h: 0.126 },
		wildWinBoard: { cy: 0.313, w: 0.608, h: 0.13 },
		epicWinBoard: { cy: 0.379, w: 0.674, h: 0.104 },
		mythicWinBoard: { cy: 0.361, w: 0.623, h: 0.108 },
		legendaryWinBoard: { cy: 0.366, w: 0.631, h: 0.106 },
	};
	// Digits of IBM Plex Sans Condensed sit at cap height (~0.70 em), so a font size of ~1.0x the bay
	// height fills roughly 70% of it — enough presence to read as the headline number with clear air
	// above and below. The width cap insets slightly from the bay so the outline never touches the rails.
	const BAY_FONT_K = 1.02;
	const BAY_WIDTH_K = 0.94;
	const DEFAULT_BAY = { cy: 0.37, w: 0.62, h: 0.11 };

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
	const mult = $derived(bookEventAmountToBetAmountMultiplier(tierAmount));
	const targetKey = $derived(
		mult >= 25000 ? 'maxWinBoard'
		: mult >= 500 ? 'legendaryWinBoard'
		: mult >= 200 ? 'mythicWinBoard'
		: mult >= 100 ? 'epicWinBoard'
		: mult >= 50 ? 'wildWinBoard'
		: 'sweetWinBoard',
	);

	// The tier is settled before the board mounts and Win.svelte remounts this per win event, so
	// there is exactly one board per presentation: pick it, pop it in. The previous version also
	// carried a collapse-then-expand path and an `animating` re-entry guard for crossing tiers
	// mid-count; with the tier fixed that path was unreachable.
	let displayedKey = $state('');
	const pop = new Tween(0, { duration: 340, easing: backOut });

	$effect(() => {
		if (targetKey === displayedKey) return;
		displayedKey = targetKey;
		pop.set(1, { duration: 340, easing: backOut });
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
	{@const bay = TIER_BAY[displayedKey] ?? DEFAULT_BAY}
	{@const boardFont = isMax ? boardH * 0.062 : boardSize * bay.h * BAY_FONT_K}
	{@const boardMaxW = isMax ? boardW * 0.4 : boardSize * bay.w * BAY_WIDTH_K}
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
		<!-- Win amount — IBM Plex Sans Condensed 900 gold gradient with a black outline; scales to fit the plaque. -->
		<!-- The MAX art's plaque reads as centred on its compass medallion (its bottom-centre
		     ornament), which sits at +0.015 of boardW — so the amount is aligned to that axis, not
		     the raw sprite centre. Vertically it sits at +0.29 of boardH — the centre of the visible
		     bay between the top rail and the compass (the compass eats the bottom-centre). -->
		<Container
			x={isMax ? boardW * 0.015 : 0}
			y={isMax ? boardH * 0.3005 : boardSize * bay.cy}
			scale={fitScale}
		>
			<Text
				anchor={0.5}
				onresize={(s) => (textSizes = s)}
				text={bookEventAmountToCurrencyString(amount)}
				style={{
					fontFamily: 'IBM Plex Sans Condensed',
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
