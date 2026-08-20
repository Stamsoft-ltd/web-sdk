<script lang="ts" module>
	import type { MaxWinPart } from '../game/maxWinCard';

	// === TIMELINE (ms from the card appearing) ===
	//
	// The design (Figma 6090:4147) is one glued-together lockup, and the brief was to have it arrive
	// rather than appear: the plate lands first and every other piece flies onto it from the side it
	// hangs off, so the card assembles itself in front of the player.
	//
	// Everything travels IN TOWARDS the plate along its own axis — the rides sweep in from behind the
	// shoulders, the balloons rise, the tents come up off the floor, the duck drops onto the arch —
	// and the wordmark is last and hardest, driving down out of the sky and jolting the whole card.

	/** How a piece arrives: when, for how long, from where (in card widths) and how much it turns. */
	type Entrance = { at: number; dur: number; dx: number; dy: number; spin: number; scale?: number };

	const PLATE = { at: 0, dur: 460 };
	const WORD = { at: 760, dur: 640 };
	/** Share of the wordmark's travel spent falling; the rest is the bounce back off the landing. */
	const FALL = 0.72;
	/** When the wordmark hits. The shake, the bulb flare and the star arrival all read off this. */
	export const MAXWIN_IMPACT_MS = WORD.at + WORD.dur * FALL;

	const ENTRANCES: Record<MaxWinPart, Entrance> = {
		// The two rides sweep in from behind the plate's shoulders, tipping upright as they land.
		coaster: { at: 140, dur: 560, dx: -1.5, dy: -0.25, spin: -0.5 },
		wheel: { at: 200, dur: 560, dx: 1.5, dy: -0.3, spin: 0.55 },
		// Balloons do the one thing balloons do: they come up from under the card, and they are the
		// only pieces that overshoot on the vertical rather than the scale.
		balloonL: { at: 340, dur: 640, dx: -0.25, dy: 1.5, spin: -0.35 },
		balloonR: { at: 400, dur: 640, dx: 0.25, dy: 1.5, spin: 0.35 },
		// Tents slide in along the floor.
		tentL: { at: 300, dur: 520, dx: -1.3, dy: 0.15, spin: -0.25 },
		tentR: { at: 350, dur: 520, dx: 1.3, dy: 0.15, spin: 0.25 },
		plate: { at: PLATE.at, dur: PLATE.dur, dx: 0, dy: 0, spin: 0, scale: 0.62 },
		// The duck drops onto the arch just before the wordmark does, so the card is already moving
		// when the big hit lands.
		duck: { at: 520, dur: 520, dx: 0, dy: -1.1, spin: 0.14 },
		word: { at: WORD.at, dur: WORD.dur, dx: 0, dy: -1.5, spin: 0 },
		// Stars last, spinning in off the sides once the jolt has died down.
		starL: { at: MAXWIN_IMPACT_MS + 110, dur: 520, dx: -1.7, dy: 0, spin: -4.4, scale: 0.3 },
		starR: { at: MAXWIN_IMPACT_MS + 170, dur: 520, dx: 1.7, dy: 0, spin: 4.4, scale: 0.3 },
		// The logo is the card's foot: it rises into place under everything else.
		logo: { at: 620, dur: 520, dx: 0, dy: 0.8, spin: 0 },
	};

	/** Paint order, back to front. Mount order IS paint order, so this is the render list. */
	const ORDER: MaxWinPart[] = [
		'coaster',
		'wheel',
		'balloonL',
		'balloonR',
		'tentL',
		'tentR',
		'plate',
		'duck',
		'word',
		'starL',
		'starR',
		'logo',
	];

	/** Asset key per piece, matching the keys registered in assets.ts. */
	const KEY: Record<MaxWinPart, string> = {
		coaster: 'maxWinCoaster',
		wheel: 'maxWinWheel',
		balloonL: 'maxWinBalloonL',
		balloonR: 'maxWinBalloonR',
		tentL: 'maxWinTentL',
		tentR: 'maxWinTentR',
		plate: 'maxWinPlate',
		duck: 'maxWinDuck',
		word: 'maxWinWord',
		starL: 'maxWinStarL',
		starR: 'maxWinStarR',
		logo: 'maxWinLogo',
	};
</script>

<script lang="ts">
	import { Container, Sprite, Text, PIXI } from 'pixi-svelte';

	import { getContext } from '../game/context';
	import {
		MAXWIN_AMOUNT,
		MAXWIN_PARTS,
		MAXWIN_PLATE_BULBS,
		MAXWIN_WORD_BULBS,
	} from '../game/maxWinCard';
	import { AMOUNT_GOLD } from '../game/winCardText';
	import WinCardLights from './WinCardLights.svelte';

	type Props = {
		winId: number;
		/**
		 * Width of the PLATE in the parent's units. Every piece's rect is a fraction of it — see
		 * maxWinCard.ts — so this one number scales the whole assembly. The assembly is WIDER than the
		 * plate here, unlike the marquee card: <Win> allows for that.
		 */
		cardWidth: number;
		amountText: string;
		/** Whether the card is on screen; it stays mounted between wins, so the clock is gated. */
		active: boolean;
	};

	const { winId, cardWidth, amountText, active }: Props = $props();
	const context = getContext();

	/** Nothing is drawn until the plate is here — a lockup missing its base is worse than a beat of
	 * black, and the pieces are deferred behind the marquee card's. */
	const ready = $derived(!!context.stateApp.loadedAssets?.maxWinPlate);

	let elapsed = $state(0);
	let seenWinId = -1;

	// One clock for the whole card, off the application ticker rather than a private rAF — same
	// reason as <WinCard>: a private rAF runs out of phase with the frames <SceneAnimationDriver>
	// actually renders, and the card would judder against everything else on screen.
	$effect(() => {
		const app = context.stateApp.pixiApplication;
		if (!app) return;
		const tick = () => {
			if (active) elapsed += app.ticker.deltaMS / 1000;
		};
		app.ticker.add(tick, null, PIXI.UPDATE_PRIORITY.HIGH);
		return () => app.ticker.remove(tick, null);
	});

	$effect(() => {
		if (winId === seenWinId) return;
		seenWinId = winId;
		elapsed = 0;
	});

	const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
	const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
	const at = (stage: { at: number; dur: number }) => clamp01((elapsed * 1000 - stage.at) / stage.dur);

	/** Overshoot ease. `s` sets how far past the target it goes; 1.70158 is the standard 10%. */
	const backOut = (s: number) => (t: number) => {
		const u = t - 1;
		return 1 + (s + 1) * u ** 3 + s * u ** 2;
	};
	const softBack = backOut(1.5);
	const outCubic = (t: number) => 1 - (1 - t) ** 3;

	/** The wordmark's fall: gravity in, one damped wobble out. See <WinCard> for why not backOut. */
	const OVERSHOOT = 0.07;
	const gravityDrop = (t: number) => {
		if (t <= 0) return 0;
		if (t < FALL) return (1 + OVERSHOOT) * (t / FALL) ** 2;
		const u = (t - FALL) / (1 - FALL);
		return 1 + OVERSHOOT * (1 - u) ** 2 * Math.cos(u * Math.PI * 1.5);
	};

	// === IMPACT ===
	// The landing, as one 0-1 value that starts at 1 the frame the wordmark lands and decays away.
	// Bigger than the marquee card's: this is the 25,000x.
	const SHAKE_MS = 620;
	const SHAKE_FREQ = 19;
	const SHAKE_X = 0.008;
	const SHAKE_Y = 0.024;
	const sinceImpact = $derived(elapsed * 1000 - MAXWIN_IMPACT_MS);
	const impactDecay = $derived(clamp01(1 - sinceImpact / SHAKE_MS) ** 2 * (sinceImpact > 0 ? 1 : 0));
	const shake = $derived({
		x: Math.sin((sinceImpact / 1000) * SHAKE_FREQ * 1.7) * SHAKE_X * impactDecay * cardWidth,
		y: Math.sin((sinceImpact / 1000) * SHAKE_FREQ) * SHAKE_Y * impactDecay * cardWidth,
	});

	/**
	 * Where a piece is on this frame. One function for all twelve: they differ only by their row in
	 * ENTRANCES, and having the travel, the turn, the scale and the fade read from a single place is
	 * what keeps a card of this many parts from drifting out of step when a beat is retimed.
	 */
	const piece = (name: MaxWinPart) => {
		const rect = MAXWIN_PARTS[name];
		const entrance = ENTRANCES[name];
		const progress = at(entrance);
		const eased = name === 'word' ? gravityDrop(progress) : softBack(progress);
		const back = 1 - eased;
		return {
			x: (rect.x + entrance.dx * back) * cardWidth,
			y: (rect.y + entrance.dy * back) * cardWidth,
			w: rect.w * cardWidth,
			h: rect.h * cardWidth,
			// Unwound from a curve of its own: the positional ease is nearly finished a fifth of the
			// way in, which would put the whole turn in the first hundred milliseconds and leave the
			// piece gliding the rest of the way already still.
			rotation: (1 - progress) ** 2 * entrance.spin,
			scale: entrance.scale === undefined ? 1 : lerp(entrance.scale, 1, outCubic(progress)),
			alpha: clamp01(progress * 6),
		};
	};

	const parts = $derived(Object.fromEntries(ORDER.map((name) => [name, piece(name)])) as Record<
		MaxWinPart,
		ReturnType<typeof piece>
	>);

	// === PLATE ===
	/** A squat on impact — the plate takes the weight and gives, which is what sells the landing. */
	const plateSquash = $derived(impactDecay * 0.04 * Math.cos((sinceImpact / 1000) * SHAKE_FREQ));
	/**
	 * A second copy of the plate drawn additively. Additive blending scales with source brightness,
	 * so this blooms the bulbs and the gold frame and leaves the dark purple field alone — the whole
	 * card breathes light for the cost of one sprite. It spikes on impact, then settles to a pulse.
	 */
	const plateBloom = $derived(
		(0.1 + 0.07 * Math.sin(elapsed * 2.2)) * parts.plate.alpha + impactDecay * 0.6,
	);
	/** The wordmark's own bloom, so the letters flare white on the hit rather than only the frame. */
	const wordBloom = $derived(0.06 * parts.word.alpha + impactDecay * 0.7);

	// === WORDMARK ===
	/** Squashed by how far it is driven past the landing, stretched by how fast it is still falling. */
	const wordProgress = $derived(at(WORD));
	const wordSquash = $derived(
		Math.max(0, gravityDrop(wordProgress) - 1) * 2.6 + impactDecay * 0.06,
	);
	const wordStretch = $derived((1 - wordProgress) ** 2 * 0.24);

	// === AMOUNT ===
	// Typed straight into the lozenge painted on the plate — unlike the marquee card, which has to
	// draw its own plate because the design hangs it below the art.
	const AMOUNT_IN = { at: 380, dur: 420 };
	const amountIn = $derived(outCubic(at(AMOUNT_IN)));
	const amountW = $derived(MAXWIN_AMOUNT.w * cardWidth);
	const amountH = $derived(MAXWIN_AMOUNT.h * cardWidth);
	/** Filling the lozenge, less the bevel its art already spends on the inside edge. */
	const fontSize = $derived(amountH * 0.78);
	let amountTextWidth = $state(0);
	const amountScale = $derived(
		amountTextWidth > 0 ? Math.min(1, (amountW * 0.9) / amountTextWidth) : 1,
	);
</script>

<!-- Every layer stays mounted for the life of the card and is driven by alpha: mount order is paint
     order in pixi-svelte, so a layer mounted on demand would jump to the front. -->
<Container x={shake.x} y={shake.y} alpha={ready ? 1 : 0}>
	{#each ORDER as name (name)}
		{@const part = parts[name]}
		{#if name === 'plate'}
			<Container
				x={part.x}
				y={part.y}
				scale={{ x: part.scale * (1 + plateSquash), y: part.scale * (1 - plateSquash) }}
				alpha={part.alpha}
			>
				<Sprite key={KEY[name]} anchor={0.5} width={part.w} height={part.h} />
				<Sprite
					key={KEY[name]}
					anchor={0.5}
					blendMode="add"
					width={part.w}
					height={part.h}
					alpha={plateBloom}
				/>
				<WinCardLights
					bulbs={MAXWIN_PLATE_BULBS}
					size={cardWidth}
					colour={0xffcf7a}
					radius={0.03}
					cycles={3}
					speed={0.34}
					floor={0.2}
					intensity={part.alpha * (1 + impactDecay * 1.8)}
					{elapsed}
				/>
			</Container>
		{:else if name === 'word'}
			<Container
				x={part.x}
				y={part.y}
				scale={{ x: 1 + wordSquash - wordStretch, y: 1 - wordSquash + wordStretch }}
				alpha={part.alpha}
			>
				<Sprite key={KEY[name]} anchor={0.5} width={part.w} height={part.h} />
				<Sprite
					key={KEY[name]}
					anchor={0.5}
					blendMode="add"
					width={part.w}
					height={part.h}
					alpha={wordBloom}
				/>
				<!-- Chased about the wordmark's own centre, so the light runs around MAX WIN rather than
				     around the plate it is sitting on. -->
				<WinCardLights
					bulbs={MAXWIN_WORD_BULBS}
					size={cardWidth}
					origin={{ x: MAXWIN_PARTS.word.x, y: MAXWIN_PARTS.word.y }}
					colour={0xfff0c0}
					radius={0.022}
					cycles={4}
					speed={0.5}
					floor={0.12}
					intensity={part.alpha * (1 + impactDecay * 2.2)}
					{elapsed}
				/>
			</Container>
		{:else}
			<Sprite
				key={KEY[name]}
				anchor={0.5}
				x={part.x}
				y={part.y}
				width={part.w * part.scale}
				height={part.h * part.scale}
				rotation={part.rotation}
				alpha={part.alpha}
			/>
		{/if}
	{/each}

	<!-- The number, in the lozenge the plate art already carries. -->
	<Container
		x={MAXWIN_AMOUNT.x * cardWidth}
		y={MAXWIN_AMOUNT.y * cardWidth}
		alpha={amountIn * parts.plate.alpha}
	>
		<Container scale={amountScale}>
			<Text
				anchor={0.5}
				text={amountText}
				onresize={({ width }) => (amountTextWidth = width)}
				style={{
					fontFamily: 'Lilita One',
					fontWeight: '400',
					fontSize,
					align: 'center',
					fill: AMOUNT_GOLD,
					letterSpacing: fontSize * 0.03,
					stroke: { color: 0x000000, width: Math.max(1, fontSize / 64) },
				}}
			/>
		</Container>
	</Container>
</Container>
