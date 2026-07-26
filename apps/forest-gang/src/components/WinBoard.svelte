<script lang="ts" module>
	// Win-tier thresholds (× bet): 20 SWEET · 50 WILD · 100 EPIC · 200 MYTHIC · 500 LEGENDARY.
	// (25000× MAX WIN is a separate screen — see Win.svelte.) A board only shows from 20× via the
	// winLevel gate, so <50× maps to SWEET. Exported so Win.svelte derives the live board and the
	// final board from one place.
	export const boardKeyForMult = (mult: number) =>
		mult >= 500
			? 'legendaryWinBoard'
			: mult >= 200
				? 'mythicWinBoard'
				: mult >= 100
					? 'epicWinBoard'
					: mult >= 50
						? 'wildWinBoard'
						: 'sweetWinBoard';
</script>

<script lang="ts">
	import { Tween } from 'svelte/motion';
	import { backOut, cubicInOut } from 'svelte/easing';

	import { FillGradient } from 'pixi-svelte';
	import { Graphics, Sprite, Container, Text } from 'pixi-svelte';


	type Props = {
		boardKey: string;
		/** The tier this win finishes on — it gets the pop; every crossing before it cross-fades. */
		finalKey: string;
		/** Changes once per win. This component no longer remounts per win, so it needs telling. */
		winId: number;
		maxBoardSize: number;
		breatheScale: number;
		mult: number;
		countUpText: string;
		fontSize: number;
	};

	const {
		boardKey,
		finalKey,
		winId,
		maxBoardSize,
		breatheScale,
		mult,
		countUpText,
		fontSize,
	}: Props = $props();

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
	const tierIndex = (key: string | null) => TIER_RANGES.findIndex((t) => t.key === key);

	// Tier transition: the outgoing board stays fully drawn while the incoming one fades up over
	// it, so the hero board is never absent from the screen. (It used to collapse to scale 0 and
	// re-pop, vanishing up to four times during its own climax.) The pop is kept for the first
	// appearance and for the tier the win actually ends on.
	// FADE_MS/POP_MS also set the floor on the tier cadence: with the `animating` guard below, two
	// tier changes can never render closer together than one transition, which is what keeps a huge
	// win (whose raw crossings all land inside ~100 ms) from strobing through five boards.
	const FADE_MS = 400;
	const POP_MS = 420;
	const FINAL_POP_FROM = 0.86;

	const pop = new Tween(0, { duration: POP_MS, easing: backOut });
	const fade = new Tween(1, { duration: FADE_MS, easing: cubicInOut });
	let displayedKey = $state<string | null>(null);
	let outgoingKey = $state<string | null>(null);
	let animating = $state(false);
	// Plain `let`, deliberately not `$state`: writing it must not re-trigger the effect below.
	let seenWinId = -1;

	$effect(() => {
		const next = boardKey;
		// A new win always restarts from a first appearance. Two wins can finish in the SAME tier,
		// so the tier alone cannot tell them apart — hence `winId`. By the time this user effect
		// runs, WinCountUpProvider's restart effect (an ancestor, so it runs first) has already
		// snapped the count back to 0, which means `boardKey` is the bottom tier again here.
		const isNewWin = winId !== seenWinId;
		if (animating || (!isNewWin && next === displayedKey)) return;
		seenWinId = winId;
		animating = true;
		(async () => {
			// Also treat a DOWNWARD tier change as a new win — a tier can only climb within one.
			const isFirstAppearance =
				isNewWin || !displayedKey || tierIndex(next) < tierIndex(displayedKey);
			const isFinal = next === finalKey;
			if (isFirstAppearance) {
				outgoingKey = null;
				displayedKey = next;
				fade.set(1, { duration: 0 });
				pop.set(0, { duration: 0 });
				await pop.set(1, { duration: POP_MS, easing: backOut });
			} else {
				outgoingKey = displayedKey;
				displayedKey = next;
				fade.set(0, { duration: 0 });
				if (isFinal) pop.set(FINAL_POP_FROM, { duration: 0 });
				await Promise.all([
					fade.set(1, { duration: FADE_MS, easing: cubicInOut }),
					isFinal ? pop.set(1, { duration: POP_MS, easing: backOut }) : Promise.resolve(),
				]);
				outgoingKey = null;
			}
			// Flipping `animating` re-runs the effect, catching up if the tier advanced mid-transition.
			animating = false;
		})();
	});

	const shownKey = $derived(displayedKey ?? boardKey);

	// Board grows within its tier: from that tier's base toward the next tier's base (capped at 80%
	// of the gap). Written as a function of the key so the outgoing board can be drawn at its own
	// size during a cross-fade — for it `mult` is already past the tier max, so the size is stable.
	const sizeFor = (key: string) => {
		const i = Math.max(tierIndex(key), 0);
		const range = TIER_RANGES[i];
		const base = TIER_BASE_SCALE[range.key] ?? 1;
		const nextBase = TIER_BASE_SCALE[TIER_RANGES[Math.min(i + 1, TIER_RANGES.length - 1)].key];
		const progress = Math.min(Math.max((mult - range.min) / (range.max - range.min), 0), 1);
		return maxBoardSize * (base + (nextBase - base) * progress * 0.8) * breatheScale;
	};

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
</script>

{#snippet tierArt(key: string, size: number, alpha: number)}
	{@const emblem = TIER_EMBLEM[key] ?? TIER_EMBLEM.sweetWinBoard}
	<Container {alpha}>
		<!-- Plan 10 merge: the 14 glow circles are tessellated once at the layout's reference radius;
		     the live part of the size (tier accumulation × breathe, all inside `size`) animates this
		     glow-only wrapper's scale instead. Rendered radius is identical (maxBoardSize·0.85 ×
		     size/maxBoardSize = size·0.85). The draw body deliberately does NOT read `size`, so the
		     Graphics effect re-runs only when the tier `key` (colour) changes — not per frame. The
		     scale stays on a wrapper around the glow alone: the Sprite below already sizes itself
		     from `size` and would grow quadratically under a shared scale. -->
		<Container scale={size / maxBoardSize}>
			<Graphics
				blendMode="add"
				draw={(g) => {
					const R = maxBoardSize * 0.85;
					const steps = 14;
					for (let i = steps; i >= 1; i--) {
						const t = i / steps;
						g.circle(0, 0, R * t);
						g.fill({ color: GLOW_COLOR[key] ?? 0xffc242, alpha: 0.055 * (1 - t) * (1 - t) + 0.005 });
					}
				}}
			/>
		</Container>
		<Sprite {key} anchor={0.5} width={size} height={size} />

		<!-- Golden P mark breathing on the gem medallion -->
		<Container y={size * emblem.y} scale={emblemPulse}>
			<Sprite
				key="winEmblemP"
				anchor={0.5}
				width={size * emblem.w}
				height={size * emblem.w * EMBLEM_ASPECT}
			/>
		</Container>
	</Container>
{/snippet}

{#if shownKey}
	{@const f = fade.current}
	{@const inSize = sizeFor(shownKey)}
	{@const outSize = outgoingKey ? sizeFor(outgoingKey) : inSize}
	{@const inTextY = inSize * (TIER_TEXT_Y[shownKey] ?? 0.343)}
	{@const outTextY = outSize * (TIER_TEXT_Y[outgoingKey ?? shownKey] ?? 0.343)}
	<!-- Outgoing tier stays at full size and opacity 1-f: the board never leaves the screen. -->
	{#if outgoingKey}
		{@render tierArt(outgoingKey, outSize, 1 - f)}
	{/if}
	<Container scale={pop.current}>
		{@render tierArt(shownKey, inSize, outgoingKey ? f : 1)}

		<!-- One amount text, not two: cross-fading a second copy of the same digits at a slightly
		     different size reads as ghosting. Its plaque position glides between the two tiers. -->
		{@const textSize = outSize + (inSize - outSize) * f}
		{@const amountMaxW = textSize * 0.62}
		{@const amountScale = amountNatW > 0 ? Math.min(1, amountMaxW / amountNatW) : 1}
		<Container y={outTextY + (inTextY - outTextY) * f} scale={amountScale}>
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
