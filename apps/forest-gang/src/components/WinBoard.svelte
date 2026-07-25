<script lang="ts">
	import { Tween } from 'svelte/motion';
	import { cubicIn, backOut } from 'svelte/easing';

	import { FillGradient } from 'pixi-svelte';
	import { Graphics, Sprite, Container, Text } from 'pixi-svelte';


	type Props = {
		boardKey: string;
		maxBoardSize: number;
		breatheScale: number;
		mult: number;
		countUpText: string;
		fontSize: number;
	};

	const { boardKey, maxBoardSize, breatheScale, mult, countUpText, fontSize }: Props = $props();

	// Reduced ~20% from the original tuning (two -10% design passes; the second one
	// included the legendary/max-win board as well).
	const TIER_BASE_SCALE: Record<string, number> = {
		sweetWinBoard:     0.59,
		wildWinBoard:      0.65,
		epicWinBoard:      0.70,
		mythicWinBoard:    0.76,
		legendaryWinBoard: 0.90,
	};

	const TIER_RANGES = [
		{ key: 'sweetWinBoard',     min: 0,    max: 50 },
		{ key: 'wildWinBoard',      min: 50,   max: 100 },
		{ key: 'epicWinBoard',      min: 100,  max: 200 },
		{ key: 'mythicWinBoard',    min: 200,  max: 500 },
		{ key: 'legendaryWinBoard', min: 500,  max: 25000 },
	];

	// Tier transition, magnetic-style: the current board collapses INTO the centre, then the new
	// tier's board pops back out with a springy overshoot. First appearance pops in the same way.
	const pop = new Tween(0, { duration: 340, easing: backOut });
	let displayedKey = $state<string | null>(null);
	let animating = $state(false);

	$effect(() => {
		const next = boardKey;
		if (animating || next === displayedKey) return;
		animating = true;
		(async () => {
			if (displayedKey) await pop.set(0, { duration: 180, easing: cubicIn });
			displayedKey = next;
			await pop.set(1, { duration: 340, easing: backOut });
			// Flipping `animating` re-runs the effect, catching up if the tier advanced mid-pop.
			animating = false;
		})();
	});

	const shownKey = $derived(displayedKey ?? boardKey);
	const tierRange = $derived(TIER_RANGES.find((t) => t.key === shownKey) ?? TIER_RANGES[0]);
	const tierIdx = $derived(TIER_RANGES.indexOf(tierRange));
	const nextTierBaseScale = $derived(TIER_BASE_SCALE[TIER_RANGES[Math.min(tierIdx + 1, TIER_RANGES.length - 1)].key]);
	const tierProgress = $derived(Math.min((mult - tierRange.min) / (tierRange.max - tierRange.min), 1));
	// Board grows within tier: from tierBase toward next tier's base (capped at 80% of the gap)
	const accumulationScale = $derived(
		(TIER_BASE_SCALE[shownKey] ?? 1) +
			(nextTierBaseScale - (TIER_BASE_SCALE[shownKey] ?? 1)) * tierProgress * 0.8,
	);
	const boardSize = $derived(maxBoardSize * accumulationScale * breatheScale);

	// Win-amount text style: Cinzel 900 with the gold gradient (Figma spec).
	const goldFill = new FillGradient({
		type: 'linear',
		start: { x: 0, y: 0 },
		end: { x: 0, y: 1 },
		colorStops: [
			{ offset: 0.176, color: '#E2D981' },
			{ offset: 0.6, color: '#FBC503' },
			{ offset: 1, color: '#D98503' },
		],
		textureSpace: 'local',
	});

	// Scale the amount to fit inside the board (keeps long wins readable).
	let amountNatW = $state(0);
	const amountMaxW = $derived(boardSize * 0.62);
	const amountScale = $derived(amountNatW > 0 ? Math.min(1, amountMaxW / amountNatW) : 1);

	// Amount-text centre as a fraction of boardSize DOWN from the board centre — the centre of
	// each Figma board's bottom plaque (plaque sits at 0.8433 of the ART height; arts are
	// width-normalised then centred on the square canvas, so the square fraction differs per
	// art). Do NOT add a fixed px offset here — a non-scaling offset un-centres the text when
	// the popups are enlarged.
	// New win boards (all the same template, fit to width + centred on the square canvas): banner
	// plaque centre measured at 0.373 down from the board centre. Same value for every tier.
	const TIER_TEXT_Y: Record<string, number> = {
		sweetWinBoard: 0.364,
		wildWinBoard: 0.362,
		epicWinBoard: 0.344,
		mythicWinBoard: 0.364,
		legendaryWinBoard: 0.372,
	};
	const textYFrac = $derived(TIER_TEXT_Y[shownKey] ?? 0.343);

	// Golden P emblem on the gem medallion — per-tier centre/size measured from the Figma page
	// (second-row boards with the emblem placed; fractions of the square canvas). Pulses gently.
	// Gem medallion centre measured at ~0.125 down from the board centre on the new boards (same
	// template for every tier). The P mark sits on it.
	const TIER_EMBLEM: Record<string, { y: number; w: number }> = {
		sweetWinBoard: { y: 0.142, w: 0.19 },
		wildWinBoard: { y: 0.142, w: 0.19 },
		epicWinBoard: { y: 0.142, w: 0.19 },
		mythicWinBoard: { y: 0.142, w: 0.19 },
		legendaryWinBoard: { y: 0.142, w: 0.19 },
	};
	const emblem = $derived(TIER_EMBLEM[shownKey] ?? TIER_EMBLEM.sweetWinBoard);
	const EMBLEM_ASPECT = 340 / 292; // win_emblem_p.png

	let emblemT = $state(0);
	$effect(() => {
		let raf = 0;
		const t0 = performance.now();
		const tick = (now: number) => {
			emblemT = (now - t0) / 1000;
			raf = requestAnimationFrame(tick);
		};
		raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
	});
	const emblemPulse = $derived(1 + 0.15 * Math.sin(emblemT * 2.6));

	// Soft ambient glow behind the board, tinted per tier (additive concentric circles).
	const GLOW_COLOR: Record<string, number> = {
		sweetWinBoard: 0x4a9bff,
		wildWinBoard: 0x5fd44a,
		epicWinBoard: 0xff5a3c,
		mythicWinBoard: 0xb45cff,
		legendaryWinBoard: 0xffc242,
	};
	const glowColor = $derived(GLOW_COLOR[shownKey] ?? 0xffc242);
</script>

{#if shownKey}
	<!-- The whole unit (glow + board + amount) collapses/pops as one via the transition scale. -->
	<Container scale={pop.current}>
		<!-- The 14 glow circles are tessellated once, at the layout's reference radius, and animated
		     by scaling this wrapper — `boardSize / maxBoardSize` is exactly the live part of the
		     size (accumulation × breathe), so the rendered radius is unchanged. The scale MUST stay
		     on a glow-only wrapper: putting it on the outer Container would also scale the board
		     Sprite, which already sizes itself from `boardSize`, and it would grow quadratically.
		     The draw callback now reads only layout-rate values, so it stops re-tessellating on
		     every breathe frame and every count-up tick. -->
		<Container scale={accumulationScale * breatheScale}>
			<Graphics
				blendMode="add"
				draw={(g) => {
					const R = maxBoardSize * 0.85;
					const steps = 14;
					for (let i = steps; i >= 1; i--) {
						const t = i / steps;
						g.circle(0, 0, R * t);
						g.fill({ color: glowColor, alpha: 0.055 * (1 - t) * (1 - t) + 0.005 });
					}
				}}
			/>
		</Container>
		<Sprite key={shownKey} anchor={0.5} width={boardSize} height={boardSize} />

		<!-- Golden P mark breathing on the gem medallion -->
		<Container y={boardSize * emblem.y} scale={emblemPulse}>
			<Sprite
				key="winEmblemP"
				anchor={0.5}
				width={boardSize * emblem.w}
				height={boardSize * emblem.w * EMBLEM_ASPECT}
			/>
		</Container>

<Container y={boardSize * textYFrac} scale={amountScale}>
			<Text
				anchor={0.5}
				text={countUpText}
				style={{
					fontFamily: 'Cinzel',
					fontWeight: '900',
					fontSize,
					align: 'center',
					letterSpacing: fontSize * 0.03,
					fill: goldFill,
					// The amount sits on the glow (no plaque on the acorn boards) — outline for contrast.
					stroke: { color: 0x2a1505, width: Math.max(2, Math.round(fontSize * 0.07)) },
				}}
				onresize={({ width }) => (amountNatW = width)}
			/>
		</Container>
	</Container>
{/if}
