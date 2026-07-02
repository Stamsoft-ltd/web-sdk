<script lang="ts">
	import { Tween } from 'svelte/motion';
	import { cubicOut, cubicInOut, linear } from 'svelte/easing';

	import { FillGradient } from 'pixi.js';
	import { Sprite, Container, Text } from 'pixi-svelte';

	type Props = {
		boardKey: string;
		maxBoardSize: number;
		breatheScale: number;
		mult: number;
		countUpText: string;
		fontSize: number;
	};

	const { boardKey, maxBoardSize, breatheScale, mult, countUpText, fontSize }: Props = $props();

	const TIER_BASE_SCALE: Record<string, number> = {
		sweetWinBoard:     0.72,
		wildWinBoard:      0.80,
		epicWinBoard:      0.87,
		mythicWinBoard:    0.93,
		legendaryWinBoard: 1.00,
	};

	const TIER_RANGES = [
		{ key: 'sweetWinBoard',     min: 0,    max: 50 },
		{ key: 'wildWinBoard',      min: 50,   max: 100 },
		{ key: 'epicWinBoard',      min: 100,  max: 200 },
		{ key: 'mythicWinBoard',    min: 200,  max: 500 },
		{ key: 'legendaryWinBoard', min: 500,  max: 5000 },
	];

	// Transition tweens — a gentle centred cross-dissolve: the incoming board eases up from a
	// slightly smaller size (cubicOut, no overshoot) while the outgoing one eases down and fades.
	const currScaleTween = new Tween(1, { duration: 520, easing: cubicOut });
	const currAlphaTween = new Tween(1, { duration: 360, easing: linear });
	const prevScaleTween = new Tween(1, { duration: 460, easing: cubicInOut });
	const prevAlphaTween = new Tween(0, { duration: 420, easing: linear });

	let prevKey = $state<string | null>(null);
	let outgoingKey = $state<string | null>(null);
	let showPrev = $state(false);

	// Gentle "start size" for the cross-dissolve — close to full so the scale change is subtle.
	const FROM = 0.82;

	$effect(() => {
		const key = boardKey;
		if (prevKey === null) {
			// First appearance: soft zoom-in from the centre (no bounce).
			prevKey = key;
			currScaleTween.set(0.7, { duration: 0 });
			currAlphaTween.set(0, { duration: 0 });
			currScaleTween.set(1, { duration: 520, easing: cubicOut });
			currAlphaTween.set(1, { duration: 360, easing: linear });
			return;
		}
		if (key === prevKey) return;

		// Keep the outgoing board on screen (as its own key) so it cross-dissolves with the new one.
		outgoingKey = prevKey;
		prevKey = key;
		showPrev = true;

		// Outgoing: ease down from its CURRENT on-screen size and fade out.
		prevScaleTween.set(1, { duration: 0 });
		prevAlphaTween.set(1, { duration: 0 });
		prevScaleTween.set(FROM, { duration: 460, easing: cubicInOut });
		prevAlphaTween.set(0, { duration: 420, easing: linear });

		// Incoming: ease up from a slightly smaller size and fade in (smooth, no overshoot).
		currScaleTween.set(FROM, { duration: 0 });
		currAlphaTween.set(0, { duration: 0 });
		currScaleTween.set(1, { duration: 520, easing: cubicOut });
		currAlphaTween.set(1, { duration: 360, easing: linear });

		// Hide the outgoing sprite once it has fully faded.
		setTimeout(() => { showPrev = false; }, 440);
	});

	const tierRange = $derived(TIER_RANGES.find((t) => t.key === boardKey) ?? TIER_RANGES[0]);
	const tierIdx = $derived(TIER_RANGES.indexOf(tierRange));
	const nextTierBaseScale = $derived(TIER_BASE_SCALE[TIER_RANGES[Math.min(tierIdx + 1, TIER_RANGES.length - 1)].key]);
	const tierProgress = $derived(Math.min((mult - tierRange.min) / (tierRange.max - tierRange.min), 1));
	// Board grows within tier: from tierBase toward next tier's base (capped at 80% of the gap)
	const accumulationScale = $derived(
		TIER_BASE_SCALE[boardKey] + (nextTierBaseScale - TIER_BASE_SCALE[boardKey]) * tierProgress * 0.8,
	);
	const boardSize = $derived(maxBoardSize * accumulationScale * breatheScale * currScaleTween.current);
	// The outgoing tier was on-screen near its GROWN size (base + 80% toward the next tier), so start
	// its zoom-out from there — using the bare base caused a visible snap-smaller at the swap.
	const maxAccumFor = (key: string | null) => {
		const idx = TIER_RANGES.findIndex((t) => t.key === key);
		const base = TIER_BASE_SCALE[key ?? ''] ?? 1;
		const nextBase = TIER_BASE_SCALE[TIER_RANGES[Math.min(idx + 1, TIER_RANGES.length - 1)]?.key] ?? base;
		return idx < 0 ? base : base + (nextBase - base) * 0.8;
	};
	const prevBoardSize = $derived(maxBoardSize * maxAccumFor(outgoingKey) * breatheScale * prevScaleTween.current);

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

	// Each board art has its amount plaque at a slightly different height. mega_win
	// (mythic) has more bottom padding, so its text needs to sit a bit higher.
	const TIER_TEXT_Y: Record<string, number> = {
		sweetWinBoard: 0.36,
		wildWinBoard: 0.36,
		epicWinBoard: 0.36,
		mythicWinBoard: 0.345,
		legendaryWinBoard: 0.36,
	};
	const textYFrac = $derived(TIER_TEXT_Y[boardKey] ?? 0.36);
</script>

{#if showPrev && outgoingKey && outgoingKey !== boardKey}
	<Sprite
		key={outgoingKey}
		anchor={0.5}
		width={prevBoardSize}
		height={prevBoardSize}
		alpha={prevAlphaTween.current}
	/>
{/if}

<Sprite
	key={boardKey}
	anchor={0.5}
	width={boardSize}
	height={boardSize}
	alpha={currAlphaTween.current}
/>

<Container y={boardSize * textYFrac - 8} scale={amountScale}>
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
		}}
		onresize={({ width }) => (amountNatW = width)}
	/>
</Container>
