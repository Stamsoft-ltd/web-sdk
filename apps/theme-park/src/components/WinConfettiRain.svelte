<script lang="ts" module>
	/**
	 * How many scraps fall for a win of this size. Scaling the count is what makes a big win feel
	 * bigger before the number has finished climbing.
	 *
	 * Anchored on the WIN TIERS rather than run as one smooth curve over the whole range. A single
	 * log ramp was the first pass and it was not readable: it put a 20x at 12 scraps and a 1000x at
	 * 34, and a couple of dozen scraps scattered over the whole canvas look much like a dozen. What
	 * the player actually sees is the tier, so each tier gets a count clearly apart from its
	 * neighbours — a handful on SWEET, a downpour on LEGENDARY — with the multipliers inside a tier
	 * interpolated logarithmically so a 900x still out-rains a 260x.
	 */
	const STEPS: [multiplier: number, scraps: number][] = [
		[20, 10], // SWEET
		[50, 20], // WILD
		[100, 34], // EPIC
		[250, 56], // MYTHIC
		[1000, 96], // LEGENDARY
		[25000, 160], // MAX
	];

	export const confettiForMultiplier = (multiplier: number) => {
		const value = Math.max(multiplier, STEPS[0][0]);
		for (let i = 1; i < STEPS.length; i += 1) {
			const [hi, hiCount] = STEPS[i];
			if (value >= hi) continue;
			const [lo, loCount] = STEPS[i - 1];
			const t = Math.log(value / lo) / Math.log(hi / lo);
			return Math.round(loCount + (hiCount - loCount) * t);
		}
		return STEPS[STEPS.length - 1][1];
	};
</script>

<script lang="ts">
	import { Sprite, PIXI } from 'pixi-svelte';

	import { getContext } from '../game/context';
	import { MARQUEE_CONFETTI } from '../game/winCardMarquee';

	// Confetti falling down the big-win screen, in place of the coin rain the old cards had.
	//
	// It is the SAME fifteen scraps the card throws out of the marquee (winCardMarquee.ts), so the
	// screen has one vocabulary of paper rather than a card that throws ribbons over a sky raining
	// coins. Falling across the whole canvas rather than being trapped inside the card's box, and
	// BEHIND the card so it never comes between the player and the amount.
	//
	// A scrap flutters by having its WIDTH driven by a cosine while its height stays put: a flat
	// piece of paper turning about its vertical axis is exactly a horizontal squash. Unlike the coin
	// this needs no second sprite for the far face — paper has no thickness to show — but it does
	// need the turn to be slower and less regular than a coin's, because paper does not spin freely:
	// it stalls, tips and slips.

	type Props = {
		/** Scraps on screen at once — see `confettiForMultiplier`. */
		count?: number;
		/** Scrap width as a fraction of the canvas width, smallest to largest. Design: Figma 7013:9117. */
		size?: [number, number];
		/** Seconds to fall the full height, slowest to fastest. */
		fall?: [number, number];
		alpha?: number;
		/** Deterministic seed, so two layers do not fall in identical lanes. */
		seed?: number;
		/** 0-1 gate, so the rain can be switched off without unmounting (mount order is paint order). */
		intensity?: number;
		/** Seconds to hold before the first scrap enters — the card's impact is what lets it go. */
		delay?: number;
		/** Change to restart the fall, so every win gets the entrance rather than a rain in progress. */
		restartKey?: number;
	};

	const {
		count = 24,
		size = [0.018, 0.046],
		fall = [1.5, 2.8],
		alpha = 1,
		seed = 1,
		intensity = 1,
		delay = 0,
		restartKey = 0,
	}: Props = $props();

	const context = getContext();
	const canvas = $derived(context.stateLayoutDerived.canvasSizes());

	/** Turns per second, slowest scrap to fastest. Well below the coin rain's: paper tumbles lazily. */
	const FLUTTER_RATE = [0.55, 1.25];
	/**
	 * How the flutter is shaped. A turning sheet's apparent width is |cos|, which spends most of its
	 * time well under full and read as permanently creased. The exponent below 1 pushes the curve
	 * towards face-on, so a scrap shows its face most of the time and flicks quickly through edge-on.
	 */
	const FLUTTER_SHAPE = 0.45;
	/** Never thinner than this share of its width, so a scrap does not flicker out at edge-on. */
	const EDGE_FLOOR = 0.08;
	/** How far a scrap darkens as it turns away from the light. */
	const SHADE = 0.35;

	const greyTint = (level: number) => {
		const v = Math.max(0, Math.min(255, Math.round(level * 255)));
		return (v << 16) | (v << 8) | v;
	};

	/**
	 * How long the scraps take to all be falling, in fall cycles. The rain has to START — a screen
	 * already at full downpour on the frame the card appears reads as a backdrop rather than as
	 * something the win threw — but a single curtain entering together reads worse still, so each
	 * scrap is held back by its own share of this.
	 */
	const ENTRY_SPREAD = 0.85;

	let elapsed = $state(0);
	let seenRestartKey = -1;
	$effect(() => {
		const app = context.stateApp.pixiApplication;
		if (!app) return;
		const tick = () => {
			if (intensity > 0) elapsed += app.ticker.deltaMS / 1000;
		};
		app.ticker.add(tick, null, PIXI.UPDATE_PRIORITY.HIGH);
		return () => app.ticker.remove(tick, null);
	});

	// Reading restartKey is what subscribes this effect.
	$effect(() => {
		if (restartKey === seenRestartKey) return;
		seenRestartKey = restartKey;
		elapsed = 0;
	});

	/** Deterministic 0-1 from a scrap index and a channel — no Math.random, so a resize is stable. */
	const rnd = (index: number, channel: number) => {
		const v = Math.sin((index + 1) * 12.9898 + channel * 78.233 + seed * 37.719) * 43758.5453;
		return v - Math.floor(v);
	};
	const mix = (a: number, b: number, t: number) => a + (b - a) * t;

	/**
	 * Which scrap image each falling piece uses. Fixed up front and iterated in texture order below,
	 * so pixi binds each of the fifteen images once for the whole rain rather than once per scrap.
	 */
	const order = $derived(
		Array.from({ length: count }, (_, index) => index).sort(
			(a, b) => (a % MARQUEE_CONFETTI.length) - (b % MARQUEE_CONFETTI.length),
		),
	);

	const scraps = $derived.by(() => {
		const width = canvas.width;
		const height = canvas.height;
		return order.map((index) => {
			const shape = index % MARQUEE_CONFETTI.length;
			const piece = MARQUEE_CONFETTI[shape];
			const w = mix(size[0], size[1], rnd(index, 0)) * width;
			const duration = mix(fall[1], fall[0], rnd(index, 1));
			const margin = w * 1.4;
			const span = height + margin * 2;
			// Counted from the scrap's own release rather than wrapped, so before it is released the
			// scrap is genuinely absent instead of being somewhere mid-fall already.
			const released = (elapsed - delay) / duration - rnd(index, 2) * ENTRY_SPREAD;
			const t = released % 1;
			const sway = mix(0.012, 0.05, rnd(index, 3)) * width;
			const spin = mix(FLUTTER_RATE[0], FLUTTER_RATE[1], rnd(index, 4));
			const turn = Math.cos(elapsed * spin * Math.PI * 2 + index * 1.7);
			const facing = Math.max(Math.abs(turn) ** FLUTTER_SHAPE, EDGE_FLOOR);
			return {
				id: index,
				shape,
				w: w * facing,
				h: (w * piece.h) / piece.w,
				x: rnd(index, 5) * width + Math.sin(elapsed * mix(0.5, 1.4, rnd(index, 6)) + index) * sway,
				y: -margin + t * span,
				// A slow roll on top of the flutter, so scraps are not all falling bolt upright.
				rotation:
					index * 1.3 +
					elapsed * mix(-0.9, 0.9, rnd(index, 7)) +
					Math.sin(elapsed * 0.8 + index) * 0.4,
				// Fade the ends of the fall so a scrap does not pop in or out at the canvas edge.
				alpha: released < 0 ? 0 : alpha * intensity * Math.min(1, (1 - t) * 8, t * 14),
				tint: greyTint(1 - SHADE + SHADE * Math.abs(turn) ** 0.6),
			};
		});
	});
</script>

{#each scraps as scrap (scrap.id)}
	<Sprite
		key={`winMarqueeConfetti${scrap.shape}`}
		anchor={0.5}
		x={scrap.x}
		y={scrap.y}
		width={scrap.w}
		height={scrap.h}
		rotation={scrap.rotation}
		alpha={scrap.alpha}
		tint={scrap.tint}
	/>
{/each}
