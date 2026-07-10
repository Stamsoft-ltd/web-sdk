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
	<!-- MAX WIN dominates the SCREEN like the Figma (4143-16513): ~72% of the screen width
	     (height-capped), centred on the screen rather than sized like a tier board. -->
	{@const boardW = isMax ? Math.min(screenW * 0.72, screenH * 0.88 * (1535 / 1025)) : boardSize}
	{@const boardH = isMax ? boardW * (1025 / 1535) : boardSize}
	{@const offX = isMax ? maxOffX : 0}
	{@const offY = isMax ? maxOffY : 0}
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
		     electric runners crawling the frame, tinted to the tier. -->
		<WinBoardFx y={boardH * fx.cy} {boardW} {boardH} hx={fx.hx} hy={fx.hy} color={glowColor} />
		<!-- Win amount — Cinzel 900 gold gradient with a black outline; scales to fit the plaque. -->
		<Container
			y={isMax ? boardH * 0.31 : boardSize * (TIER_TEXT_Y[displayedKey] ?? 0.37)}
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
