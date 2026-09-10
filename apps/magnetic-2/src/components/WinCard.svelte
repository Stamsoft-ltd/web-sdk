<script lang="ts">
	import { Container, Graphics, Sprite, Text, type Sizes } from 'pixi-svelte';
	import { Tween } from 'svelte/motion';
	import { backOut, cubicInOut } from 'svelte/easing';
	import { bookEventAmountToCurrencyString } from 'utils-shared/amount';

	import SparkBurst from './SparkBurst.svelte';
	import { DRIP_OFFSETS, drawSlimeCluster, drawSlimeDrips } from '../game/slimeDrip';
	import { buildWinSlime, makeRng } from '../game/winSlime';
	import {
		WIN_CARD_FRAME,
		WIN_CARD_INK,
		WIN_CARD_PLATE_SLAB,
		WIN_CARD_SAUCER_BELT,
		type WinCardTier,
	} from '../game/winCardTiers';

	// MOTHERSHIP big-win card, built to the assembled design screens (Figma SECTION 4013:920
	// "Types of wins" — one 1200x670 frame per tier).
	//
	// The card is a LOCKUP, not a banner with text in it: the wordmark is the hero and deliberately
	// overflows the plate top and bottom, the plate is the slab it straddles, the saucer pokes out
	// of the plate's top edge with the alien's head in its dome, a slime blob sits beside the mark,
	// and the amount is on its own plaque BELOW the whole assembly. Every placement comes from
	// game/winCardTiers.ts, which is generated off the design — nothing here is eyeballed.
	//
	// The choreography is the brief the design was handed over with: the plate comes up from the
	// bottom, the texts drop in from the top, and then the saucer flies in from far away.
	const props: {
		tier: WinCardTier;
		/** Which tier this is — the slime table is keyed by it (game/winSlime.ts). */
		tierKey: string;
		amount: number;
		screenW: number;
		screenH: number;
	} = $props();

	// ── Fit ───────────────────────────────────────────────────────────────────
	// Landscape fits the design frame itself, so the card lands exactly where the design puts it.
	// Portrait is width-limited and would spend a third of a phone screen on the frame's empty
	// side margins, so it fits the LOCKUP's own width instead and lets the outer slime run off the
	// edges — the blobs are confetti, and the scrim behind them is full-bleed black either way.
	const isPortrait = $derived(props.screenW < props.screenH);
	const PORTRAIT_FIT = 820;
	const S = $derived(
		Math.min(
			props.screenW / (isPortrait ? PORTRAIT_FIT : WIN_CARD_FRAME.w),
			props.screenH / WIN_CARD_FRAME.h,
		) * (isPortrait ? 0.98 : 1),
	);
	// Product pass 2026-09-04: the WORDMARK read as too big. Measured off a 1600x900 capture the
	// card itself was already at the design's proportions (plate 53.6% of the screen against the
	// design render's 53.8%, plate/word 1.185 against 1.179), so the first fix — shrinking the whole
	// lockup — made the plate too small without fixing what was actually complained about. Only the
	// mark steps down now, which is also what widens the plate around it. Stepped down again
	// 2026-09-08 (0.86 -> 0.74) on the same complaint, together with the amount.
	const WORD_FIT = 0.74;

	const tier = $derived(props.tier);
	const ink = $derived(tier.ink ?? WIN_CARD_INK);

	// ── Choreography ──────────────────────────────────────────────────────────
	// Three beats, IN ORDER, each one readable on its own: the wordmark drops in from the top
	// (0.18 → 0.80s), the plate rises from the bottom to meet it (0.30 → 0.86s) with the plaque a
	// beat behind, and only once both have landed does the saucer fly in from far away and dock
	// (0.90 → 2.00s); the alien and the slime land behind it. The earlier cut overlapped all four
	// so tightly that the card read as one fade-in — the saucer was already parked before the
	// plate had stopped moving.
	//
	// LEAD: the card sits inside Win.svelte's FadeContainer, which fades in over 400ms, so a tween
	// that starts on mount spends its first half invisible. Everything waits 180ms.
	const LEAD = 180;
	const TEXT_MS = 620;
	const WORD_DELAY = LEAD;
	const PLATE_MS = 560;
	const PLATE_DELAY = LEAD + 120;
	const PLAQUE_DELAY = PLATE_DELAY + 160;
	const SHIP_MS = 1200;
	const SHIP_DELAY = 900;
	const ALIEN_DELAY = SHIP_DELAY + SHIP_MS - 60;
	const BLOB_DELAY = ALIEN_DELAY + 120;

	const plateRise = new Tween(0, { duration: PLATE_MS, easing: backOut, delay: PLATE_DELAY });
	const wordDrop = new Tween(0, { duration: TEXT_MS, easing: backOut, delay: WORD_DELAY });
	const plaqueRise = new Tween(0, { duration: TEXT_MS, easing: backOut, delay: PLAQUE_DELAY });
	// The saucer's approach is NOT backOut: a far-away arrival that overshoots reads as a bounce off
	// an invisible wall. And not cubicOut either — timed captures showed it covering most of the
	// distance in its first 400ms and parked by 1.5s, so the flight was never seen. cubicInOut is
	// how an approach at constant speed looks: slow and small while it is far, quickest as it
	// closes, decelerating into its parking spot.
	const shipFly = new Tween(0, { duration: SHIP_MS, easing: cubicInOut, delay: SHIP_DELAY });
	const alienPop = new Tween(0, { duration: 380, easing: backOut, delay: ALIEN_DELAY });
	// The slime is NOT a tween: `drawSlimeCluster` grows the splat itself, lobe by lobe out of its
	// first one (`grow`), so what it needs is a plain 0..1 ramp per splat off the card's own clock.
	// The tween it replaces scaled each finished splat up as one rigid group in ~100ms, which is
	// what read as the slime "showing instantly" — a sticker appearing, not a mass oozing out.
	const BLOB_START = BLOB_DELAY / 1000;
	/** How long one splat takes to come out, and the gap between one splat and the next. */
	const BLOB_GROW = 1.05;
	const BLOB_LAG = 0.34;
	/** When splat `i` starts, and when it is fully out — its drops only begin gathering after that. */
	const splatStart = (i: number) => BLOB_START + i * BLOB_LAG;
	const splatDone = (i: number) => splatStart(i) + BLOB_GROW;
	const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
	$effect(() => {
		plateRise.set(1);
		wordDrop.set(1);
		plaqueRise.set(1);
		shipFly.set(1);
		alienPop.set(1);
	});

	// One persistent clock for the landing springs and the idle drift (the WonPanel pattern).
	let clock = $state(0);
	$effect(() => {
		let raf = 0;
		const t0 = performance.now();
		const tick = (now: number) => {
			clock = (now - t0) / 1000;
			raf = requestAnimationFrame(tick);
		};
		raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
	});

	// One roll per card instance: `seed` is captured at init and the generator is pure, so the slime
	// is fixed for as long as the card is up but different the next time one appears.
	// The visible slab, not the plate sprite's box — see WIN_CARD_PLATE_SLAB.
	const slab = $derived({
		cx:
			tier.plate.cx +
			((WIN_CARD_PLATE_SLAB.left + WIN_CARD_PLATE_SLAB.right) / 2 - 0.5) * tier.plate.w,
		cy:
			tier.plate.cy +
			((WIN_CARD_PLATE_SLAB.top + WIN_CARD_PLATE_SLAB.bottom) / 2 - 0.5) * tier.plate.h,
		w: (WIN_CARD_PLATE_SLAB.right - WIN_CARD_PLATE_SLAB.left) * tier.plate.w,
		h: (WIN_CARD_PLATE_SLAB.bottom - WIN_CARD_PLATE_SLAB.top) * tier.plate.h,
	});

	const seed = Math.random();
	const splats = $derived(
		buildWinSlime({
			tierKey: props.tierKey,
			ring: slab,
			guards: [
				// NEGATIVE clearance on the mark: its bounding box is as tall as the plate itself on MAX,
				// so honouring the box outright leaves only the two side edges free and the slime lines
				// up in two caterpillar columns. The ink is what matters, and it is well inside the box.
				{ rect: tier.word, pad: -1.2 },
				{ rect: tier.plaque, pad: 1 },
				{ rect: tier.saucer, pad: 0.9 },
			],
			rng: makeRng(seed),
		}),
	);

	const L_PLATE = (PLATE_DELAY + PLATE_MS) / 1000;
	const L_WORD = (WORD_DELAY + TEXT_MS) / 1000;
	const L_SHIP = (SHIP_DELAY + SHIP_MS) / 1000;
	const impact = (dt: number) => (dt < 0 || dt > 0.55 ? 0 : Math.exp(-dt * 12) * Math.cos(dt * 34));
	const plateHit = $derived(impact(clock - L_PLATE));
	const wordHit = $derived(impact(clock - L_WORD));

	// Entry offsets in SCREEN units, so every piece starts genuinely off-screen whatever the shape
	// of the viewport.
	const fromBelow = $derived(props.screenH / 2 + tier.plate.h * S);
	const fromAbove = $derived(-props.screenH / 2 - tier.word.h * S);
	// "From far away": the saucer starts as a speck high and off to the side and grows in as it
	// closes, which is the whole read — a pure translate at full size is just a slide.
	const SHIP_START_SCALE = 0.05;
	const shipT = $derived(shipFly.current);
	const shipStartDX = $derived(props.screenW * 0.36);
	const shipStartDY = $derived(-props.screenH * 0.48);
	// A straight line at constant growth is a slide. The saucer grows LATE (it is far away for most
	// of the trip and only fills out over the last third), swings wide of the straight line on the
	// way in and banks into that turn, then levels off as it docks.
	const shipScale = $derived(SHIP_START_SCALE + (1 - SHIP_START_SCALE) * shipT ** 1.7);
	const shipSwing = $derived(Math.sin(Math.PI * shipT));
	const shipBowX = $derived(-props.screenW * 0.11 * shipSwing);
	const shipBowY = $derived(props.screenH * 0.06 * shipSwing);
	const shipBank = $derived(-16 * shipSwing * (1 - shipT));

	// Where the ship PARKS: tucked behind the wordmark, which is drawn over its bottom quarter —
	// the design's sample has the text cutting across the hull, not a ship floating above it. The
	// tier table places the ship off the design's node box, but the wordmark was stepped down to
	// WORD_FIT of its box on request, which dropped its top edge below the ship's bottom and left
	// the gap. So the seat is taken from the wordmark as RENDERED: the ship's bottom sits
	// SAUCER_TUCK of its height below that top edge, and the alien and its clip ride with it.
	const SAUCER_TUCK = 0.25;
	const wordTop = $derived(tier.word.cy - (tier.word.h * WORD_FIT) / 2);
	const shipSeatDY = $derived(
		wordTop + SAUCER_TUCK * tier.saucer.h - (tier.saucer.cy + tier.saucer.h / 2),
	);

	// Idle, once each piece has landed. Amplitudes ramp in so nothing steps out of its landing
	// squash, and the wordmark keeps pulsing — it is what the eye comes back to.
	const ease = (t: number) => Math.min(1, Math.max(0, t));
	const plateIdle = $derived(ease((clock - L_PLATE) / 0.6));
	const shipIdle = $derived(ease((clock - L_SHIP) / 0.6));
	const cardBreathe = $derived(1 + 0.007 * plateIdle * Math.sin(clock * 1.9));
	const shipBobY = $derived(7 * shipIdle * Math.sin(clock * 1.6));
	const shipRoll = $derived(2.6 * shipIdle * Math.sin(clock * 1.1));
	const alienBobY = $derived(4 * shipIdle * Math.sin(clock * 2.3 + 1.1));
	// The wordmark pulses DOWN from its true size and back, never above it: it was a ±2.5% sine
	// on a 2.6s period, and the user asked for it quicker with a bigger gap between the smallest
	// and the actual size (2026-09-08). Now the largest state is the design's size and it dips to
	// 1 - WORD_PULSE_DEPTH on a WORD_PULSE_PERIOD-second cycle, starting at full size on landing.
	const WORD_PULSE_DEPTH = 0.08;
	const WORD_PULSE_PERIOD = 1.5;
	const wordBreathe = $derived(
		1 -
			WORD_PULSE_DEPTH *
				ease((clock - L_WORD) / 0.5) *
				(0.5 - 0.5 * Math.cos(((clock - L_WORD) * 2 * Math.PI) / WORD_PULSE_PERIOD)),
	);
	// The card reacts to its own assembly: the plate thumps as it lands, the wordmark thumps again.
	const cardJoltY = $derived(WIN_CARD_FRAME.h * S * (0.014 * plateHit + 0.006 * wordHit));

	// The amount is the one part of the card that is TEXT. Lilita One at the design's 59.33px in a
	// 120px plaque; a long currency string ("$1,234,567.89") is wider than the plaque, so it is
	// measured and squeezed to fit rather than allowed to spill over the stroke.
	// The design's 59.33 read as too big beside the stepped-down wordmark; 0.85 of it.
	const AMOUNT_FONT = 50.4;
	const AMOUNT_FILL = 0.88;
	let amountSizes = $state<Sizes>({ width: 0, height: 0 });
	const amountMaxW = $derived(tier.plaque.w * S * AMOUNT_FILL);
	const amountFit = $derived(
		amountSizes.width > amountMaxW && amountSizes.width > 0 ? amountMaxW / amountSizes.width : 1,
	);
</script>

<Container y={cardJoltY} scale={cardBreathe}>
	<!-- Tier-coloured halo behind the whole card. -->
	<Graphics
		blendMode="add"
		alpha={plateRise.current}
		draw={(g) => {
			g.clear();
			const R = 560 * S;
			for (let i = 12; i >= 1; i--) {
				const t = i / 12;
				g.ellipse(0, tier.plate.cy * S * 0.5, R * t, R * 0.74 * t);
				g.fill({ color: tier.glow, alpha: 0.05 * (1 - t) * (1 - t) + 0.004 });
			}
		}}
	/>

	<!-- Plate: up from below, landing with a squash. It is the design's belly-less drawing (Figma
	     9148:31503), so it goes down FIRST and the saucer — which carries its own belly — parks
	     over it at its design box, alien in the dome; the wordmark covers the band between the
	     belly and the plate's top edge. (The retired plate had the belly baked in, which forced
	     the reverse order and left the alien sitting on a piece of the background.) -->
	<Container
		x={tier.plate.cx * S}
		y={tier.plate.cy * S + fromBelow * (1 - plateRise.current)}
		scale={{ x: 1 + 0.05 * plateHit, y: 1 - 0.07 * plateHit }}
	>
		<Sprite key="winCardPlate" anchor={0.5} width={tier.plate.w * S} height={tier.plate.h * S} />
	</Container>

	<!-- Saucer, then alien. The saucer flies the whole way in from a speck and only starts bobbing
	     once it has parked. -->
	<Container
		x={tier.saucer.cx * S + shipStartDX * (1 - shipT) + shipBowX}
		y={(tier.saucer.cy + shipSeatDY + shipBobY) * S + shipStartDY * (1 - shipT) + shipBowY}
		scale={shipScale}
		alpha={Math.min(1, shipT * 4)}
		angle={shipRoll + shipBank}
	>
		<Sprite key="winCardSaucer" anchor={0.5} width={tier.saucer.w * S} height={tier.saucer.h * S} />
		<SparkBurst
			active={clock >= L_SHIP}
			radius={tier.saucer.w * S * 0.5}
			count={16}
			color={tier.glow}
			duration={0.7}
		/>
	</Container>

	<!-- The alien sits IN the dome: everything below the saucer's belly line is clipped, so the
	     head and shoulders show through the glass and the body is behind the hull (the retired
	     plate's baked belly used to cover it). The clip rides the saucer's bob, not the alien's. -->
	<Container>
		<Graphics
			isMask
			draw={(g) => {
				g.clear();
				const belt =
					(tier.saucer.cy +
						shipSeatDY -
						tier.saucer.h / 2 +
						WIN_CARD_SAUCER_BELT * tier.saucer.h +
						shipBobY) *
					S;
				g.rect(-props.screenW, -props.screenH, props.screenW * 2, belt + props.screenH);
				g.fill(0xffffff);
			}}
		/>
		<Container
			x={tier.alien.cx * S}
			y={(tier.alien.cy + shipSeatDY + alienBobY) * S}
			alpha={alienPop.current}
			scale={alienPop.current}
		>
			<Sprite key="winCardAlien" anchor={0.5} width={tier.alien.w * S} height={tier.alien.h * S} />
		</Container>
	</Container>

	<!-- Wordmark: in from the top, over the plate, overflowing it exactly as the design does. -->
	<Container
		x={tier.word.cx * S}
		y={tier.word.cy * S + fromAbove * (1 - wordDrop.current)}
		scale={{ x: wordBreathe * (1 + 0.09 * wordHit), y: wordBreathe * (1 - 0.12 * wordHit) }}
	>
		<Sprite
			key={tier.word.key}
			anchor={0.5}
			width={tier.word.w * S * WORD_FIT}
			height={tier.word.h * S * WORD_FIT}
		/>
	</Container>

	<!-- Slime, last on top. It is DRAWN and generated per showing (game/winSlime.ts) rather than the
	     four fixed `winBlob*` rotations: the amount of it is a win-level cue, so it has to scale with
	     the tier, and a drop that falls has to change shape as it goes. Each splat lands on its own
	     beat so they arrive as a spatter. -->
	{#each splats as splat, i (i)}
		{@const t = clamp01((clock - splatStart(i)) / BLOB_GROW)}
		{#if t > 0.002}
			<!-- The drops run on their OWN clock, which is zero until the splat is out: on the card's
			     clock the first drop was already half fallen the frame the splat appeared. -->
			{@const dripClock = Math.max(0, clock - splatDone(i))}
			<Container alpha={Math.min(1, t * 4)}>
				<Graphics
					draw={(g) => {
						g.clear();
						// The outline scales with the SPLAT, not the card: a flat 3px edge disappears on a
						// big splat and swamps a small one.
						const big = Math.max(...splat.lobes.map((lobe) => lobe.r));
						const edge = Math.max(1, big * S * 0.13);
						if (splat.drip) {
							drawSlimeDrips(g, {
								x: splat.drip.x * S,
								y: splat.drip.y * S,
								r: splat.drip.r * S,
								fall: 150 * S,
								edge,
								clock: dripClock,
								period: splat.period,
							});
						}
						drawSlimeCluster(g, {
							lobes: splat.lobes.map((lobe) => ({
								x: lobe.x * S,
								y: lobe.y * S,
								r: lobe.r * S,
							})),
							edge,
							clock: clock + i * 1.7,
							grow: t,
							highlights: splat.highlights,
							sag: 0.5,
							// The cluster runs on `clock + i * 1.7` and the drips on `clock - splatDone(i)`,
							// so the drop phase the feeding lobe swells to is corrected by the difference.
							drip: splat.drip
								? {
										period: splat.period,
										offsets: DRIP_OFFSETS.map(
											(off) => off - (i * 1.7 + splatDone(i)) / splat.period,
										),
									}
								: undefined,
						});
					}}
				/>
			</Container>
		{/if}
	{/each}

	<!-- Amount plaque: up from below with the plate, a beat behind it. -->
	<Container
		x={tier.plaque.cx * S}
		y={tier.plaque.cy * S + fromBelow * (1 - plaqueRise.current)}
		alpha={Math.min(1, plaqueRise.current * 2)}
	>
		<Graphics
			draw={(g) => {
				g.clear();
				const w = tier.plaque.w * S;
				const h = tier.plaque.h * S;
				g.roundRect(-w / 2, -h / 2, w, h, 17.8 * S);
				g.fill(0x3a3981);
				// 4px INSIDE stroke in the design; pixi centres its stroke, so it is inset by half.
				g.roundRect(-w / 2 + 2 * S, -h / 2 + 2 * S, w - 4 * S, h - 4 * S, 15.8 * S);
				g.stroke({ color: ink, width: 4 * S });
			}}
		/>
		<Container scale={amountFit}>
			<Text
				anchor={0.5}
				onresize={(s) => (amountSizes = s)}
				text={bookEventAmountToCurrencyString(props.amount)}
				style={{
					// Lilita One is the design's own face here and ships with the game
					// (static/fonts/web). Its only weight is Regular — 700 would ask PIXI for a
					// synthesised bold.
					fontFamily: '"Lilita One", Audiowide, Inter, sans-serif',
					fontWeight: '400',
					fontSize: AMOUNT_FONT * S,
					fill: ink,
					align: 'center',
					letterSpacing: 2.08 * S,
				}}
			/>
		</Container>
	</Container>
</Container>
