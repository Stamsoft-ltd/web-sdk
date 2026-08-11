<script lang="ts">
	import { Container, Graphics, PIXI, Sprite, Text, type Sizes } from 'pixi-svelte';
	import { Tween } from 'svelte/motion';
	import { backOut, cubicOut } from 'svelte/easing';
	import { bookEventAmountToCurrencyString } from 'utils-shared/amount';

	import SparkBurst from './SparkBurst.svelte';
	import { WIN_GRADIENT } from '../game/goldGradient';
	import type { SignPart, WinSignTier } from '../game/winSignTiers';

	// Version2 big-win sign (Figma 7022:7751 "Sweet win", 7022:8274 "Epic win", ...). Each design
	// ships the sign as four loose parts plus the plate, and the presentation ASSEMBLES it: the
	// pillars fly in from the screen sides, the magnet drops from the top, the title rises from
	// the bottom, and each part lands with the same damped-spring stone-hit used across the game
	// (splash logo, congratulations). Per-tier art + rects live in game/winSignTiers.ts.
	const props: { tier: WinSignTier; amount: number; screenW: number; screenH: number } = $props();

	// The design frame is landscape (1200x670). Portrait is width-limited, so fitting the full
	// 1200 frame width wastes a quarter of the screen on the frame's empty margins — fit the
	// tier's visible extent instead.
	const isPortrait = $derived(props.screenW < props.screenH);
	// ...and then hold the portrait sign off the screen edges: fitting the visible extent exactly
	// left the pillars running wall to wall on a phone (user pass 2026-08-10).
	const PORTRAIT_SHRINK = 0.87;
	const S = $derived(
		Math.min(
			props.screenW / (isPortrait ? props.tier.portraitFit : 1200),
			props.screenH / 670,
		) * (isPortrait ? PORTRAIT_SHRINK : 1),
	);

	const PLATE = $derived(props.tier.plate);
	const PILLAR_L = $derived(props.tier.pillarL);
	const PILLAR_R = $derived(props.tier.pillarR);
	const MAGNET = $derived(props.tier.magnet);
	const TITLE = $derived(props.tier.title);
	// Amount plaque (drawn, not art): #100f0b plate with a #f1b303 border, amount in Chakra Petch
	// with the shared gold gradient — all straight from the design nodes (identical across tiers
	// except the vertical position).
	const AMOUNT = $derived({ x: 0, y: props.tier.amountY, w: 373, h: 99, r: 10 });
	const AMOUNT_FONT = 64;
	const GLOW = $derived(props.tier.glow);

	// ── Assembly choreography ─────────────────────────────────────────────────
	// Plate pops first (it is what the parts connect TO), then pillars → magnet → title, each a
	// 620ms backOut flight from off-screen. Landings at 0.72s / 0.92s / 1.08s drive the impacts.
	const ENTRY_MS = 620;
	const PILLAR_DELAY = 100;
	const MAGNET_DELAY = 300;
	const TITLE_DELAY = 460;

	const platePop = new Tween(0, { duration: 240, easing: cubicOut });
	const pillarFly = new Tween(0, { duration: ENTRY_MS, easing: backOut, delay: PILLAR_DELAY });
	const magnetFly = new Tween(0, { duration: ENTRY_MS, easing: backOut, delay: MAGNET_DELAY });
	const titleFly = new Tween(0, { duration: ENTRY_MS, easing: backOut, delay: TITLE_DELAY });
	$effect(() => {
		platePop.set(1);
		pillarFly.set(1);
		magnetFly.set(1);
		titleFly.set(1);
	});

	// One persistent clock for the impact springs and the idle breathe (WonPanel pattern).
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

	const L_PILLAR = (PILLAR_DELAY + ENTRY_MS) / 1000;
	const L_MAGNET = (MAGNET_DELAY + ENTRY_MS) / 1000;
	const L_TITLE = (TITLE_DELAY + ENTRY_MS) / 1000;
	const impact = (dt: number) => (dt < 0 || dt > 0.55 ? 0 : Math.exp(-dt * 12) * Math.cos(dt * 34));
	const pillarHit = $derived(impact(clock - L_PILLAR));
	const magnetHit = $derived(impact(clock - L_MAGNET));
	const titleHit = $derived(impact(clock - L_TITLE));

	// Idle: the title breathes ±3% once it has landed (amplitude ramps in so there is no step out
	// of the landing squash).
	const breathe = $derived(
		1 +
			0.03 *
				Math.min(1, Math.max(0, (clock - L_TITLE) / 0.5)) *
				Math.sin((clock - L_TITLE) * 2.4),
	);

	// The sign reacts to its own assembly: the pillars clamp on with a horizontal pinch, the
	// magnet knocks it down, the title thumps it from below (smaller).
	const signJoltY = $derived(670 * S * (0.012 * magnetHit + 0.006 * titleHit));
	const signPinch = $derived(1 - 0.015 * pillarHit);

	// Entry start offsets in screen units — off-screen regardless of viewport shape.
	const pillarStartDX = $derived(props.screenW / 2 + PILLAR_L.w * S);
	const magnetStartDY = $derived(-props.screenH / 2 - MAGNET.h * S - MAGNET.y * S);
	const titleStartDY = $derived(props.screenH / 2 + TITLE.h * S - TITLE.y * S);

	// The amount plaque holds back until the title has landed, then fades in fast.
	const amountAlpha = $derived(Math.min(1, Math.max(0, (clock - L_TITLE) / 0.2)));

	// ── Live tube lights ──
	// The pillars' glass cylinders and the plate's neon edge strip are painted FLAT in the art, so
	// they are lit here with the same recipe as the congratulations frame (WonPanel): a stacked
	// power-falloff halo (a few hard rectangles read as a sticker), a white-hot filament, an
	// irregular ballast flicker instead of a clean sine, and a hotspot drifting INSIDE the tube.
	// `lit` ramps the whole thing in as the part lands, so the tubes strike when the sign assembles.
	// PIXI is re-exported as a VALUE (apps must not import pixi.js directly), so the graphics
	// instance type comes off the constructor rather than a namespace.
	const drawTubes = (g: InstanceType<typeof PIXI.Graphics>, part: SignPart, lit: number) => {
		g.clear();
		if (!part.tubes || lit <= 0) return;
		const pw = part.w * S;
		const ph = part.h * S;
		for (let i = 0; i < part.tubes.length; i++) {
			const t = part.tubes[i];
			const x = (t.cx - 0.5) * pw;
			const y = (t.cy - 0.5) * ph;
			const w = Math.max(2, t.w * pw);
			const h = Math.max(2, t.h * ph);
			const vertical = h >= w;
			const p = i * 1.7 + part.x * 0.01;
			const cr = (t.color >> 16) & 0xff;
			const cg = (t.color >> 8) & 0xff;
			const cb = t.color & 0xff;

			const breath = 0.86 + 0.14 * Math.sin(clock * 1.35 + p);
			const dip =
				0.16 * Math.max(0, Math.sin(clock * 21.7 + p * 3)) ** 10 +
				0.1 * Math.max(0, Math.sin(clock * 6.9 + p * 1.7)) ** 8;
			const level = Math.max(0.35, breath - dip) * lit;

			// Halo: white at the core, ramping to the tube's own colour as the layers widen.
			const LAYERS = 7;
			for (let k = 0; k < LAYERS; k++) {
				const f = k / (LAYERS - 1);
				const grow = f ** 1.5;
				const gw = w * (vertical ? 0.62 + 2.6 * grow : 1 + 0.22 * grow);
				const gh = h * (vertical ? 1 + 0.22 * grow : 0.62 + 2.6 * grow);
				const m = 1 - f;
				// Only PARTLY toward white at the core: a full white core blew the widest tube (sweet's
				// cylinder) out to milky grey, since additive white over an already bright art clips.
				const mix = (c: number) => Math.round(c + (255 - c) * 0.55 * m ** 1.8);
				g.roundRect(x - gw / 2, y - gh / 2, gw, gh, Math.min(gw, gh) / 2);
				g.fill({
					color: (mix(cr) << 16) | (mix(cg) << 8) | mix(cb),
					alpha: (0.018 + 0.12 * m ** 2.2) * level,
				});
			}
			// Hot filament down the middle — near-white, but carrying a little of the tube's colour so
			// wide tubes read as glowing gas rather than a white bar.
			const hot = (c: number) => Math.round(c + (255 - c) * 0.82);
			const hotColor = (hot(cr) << 16) | (hot(cg) << 8) | hot(cb);
			const cw = (vertical ? w : h) * 0.2;
			const cl = (vertical ? h : w) * 0.95;
			const fw = vertical ? cw : cl;
			const fh = vertical ? cl : cw;
			g.roundRect(x - fw / 2, y - fh / 2, fw, fh, Math.min(fw, fh) / 2);
			g.fill({ color: hotColor, alpha: 0.22 * level });

			// Hotspot drifting inside the tube — a sine sweep, so it eases at both ends.
			const span = vertical ? h : w;
			const c = span * 0.3 * Math.sin(clock * 0.72 + p * 0.9);
			for (let k = 0; k < 3; k++) {
				const f = k / 2;
				const len = span * (0.16 + 0.34 * f);
				const thin = (vertical ? w : h) * (0.62 - 0.22 * f);
				const bw = vertical ? thin : len;
				const bh = vertical ? len : thin;
				const bx = vertical ? x : x + c;
				const by = vertical ? y + c : y;
				g.roundRect(bx - bw / 2, by - bh / 2, bw, bh, Math.min(bw, bh) / 2);
				g.fill({ color: hotColor, alpha: (0.13 - 0.04 * k) * level });
			}
		}
	};

	// Strike-on: the tubes come up over 0.35s from the part's landing, with a flash on the impact
	// itself (the springs are signed, so only the positive lobe brightens).
	const ramp = (t: number) => Math.min(1, Math.max(0, t / 0.35));
	const plateLit = $derived(platePop.current ** 2);
	const pillarLit = $derived(ramp(clock - L_PILLAR) * (1 + 1.4 * Math.max(0, pillarHit)));

	let amountSizes = $state<Sizes>({ width: 0, height: 0 });
	const amountMaxW = $derived(AMOUNT.w * S * 0.9);
	const amountFit = $derived(amountSizes.width > amountMaxW ? amountMaxW / amountSizes.width : 1);
</script>

<Container y={signJoltY} scale={{ x: signPinch, y: 1 }}>
	<!-- Soft tier-coloured glow behind the sign (the design's radial ellipse). -->
	<Graphics
		blendMode="add"
		alpha={platePop.current}
		draw={(g) => {
			g.clear();
			const R = 500 * S;
			for (let i = 12; i >= 1; i--) {
				const t = i / 12;
				g.ellipse(0, -40 * S, R * t, R * 0.72 * t);
				g.fill({ color: GLOW, alpha: 0.045 * (1 - t) * (1 - t) + 0.004 });
			}
		}}
	/>

	<!-- Plate: quick pop — the base the parts connect to. -->
	<Container
		x={PLATE.x * S}
		y={PLATE.y * S}
		alpha={platePop.current}
		scale={0.94 + 0.06 * platePop.current}
	>
		<Sprite key={PLATE.key} anchor={0.5} width={PLATE.w * S} height={PLATE.h * S} />
		<Graphics blendMode="add" draw={(g) => drawTubes(g, PLATE, plateLit)} />
	</Container>

	<!-- Pillars: in from the sides, mirrored, landing with a horizontal squash. -->
	{#each [{ part: PILLAR_L, dir: -1 }, { part: PILLAR_R, dir: 1 }] as p (p.part.key)}
		<Container
			x={p.part.x * S + p.dir * pillarStartDX * (1 - pillarFly.current)}
			y={p.part.y * S}
			scale={{ x: 1 - 0.14 * pillarHit, y: 1 + 0.1 * pillarHit }}
		>
			<Sprite key={p.part.key} anchor={0.5} width={p.part.w * S} height={p.part.h * S} />
			<Graphics blendMode="add" draw={(g) => drawTubes(g, p.part, pillarLit)} />
			<SparkBurst
				active={clock >= L_PILLAR}
				radius={p.part.h * S * 0.4}
				count={14}
				color={GLOW}
				duration={0.6}
			/>
		</Container>
	{/each}

	<!-- Magnet: drops from the top onto the plate. -->
	<Container
		x={MAGNET.x * S}
		y={MAGNET.y * S + magnetStartDY * (1 - magnetFly.current)}
		scale={{ x: 1 + 0.12 * magnetHit, y: 1 - 0.16 * magnetHit }}
	>
		<Sprite key={MAGNET.key} anchor={0.5} width={MAGNET.w * S} height={MAGNET.h * S} />
		<SparkBurst
			active={clock >= L_MAGNET}
			radius={MAGNET.w * S * 0.45}
			count={18}
			color={GLOW}
			duration={0.7}
		/>
	</Container>

	<!-- Title: rises from the bottom onto the plate, then breathes. -->
	<Container
		x={TITLE.x * S}
		y={TITLE.y * S + titleStartDY * (1 - titleFly.current)}
		scale={{ x: breathe * (1 + 0.1 * titleHit), y: breathe * (1 - 0.14 * titleHit) }}
	>
		<Sprite key={TITLE.key} anchor={0.5} width={TITLE.w * S} height={TITLE.h * S} />
	</Container>

	<!-- Amount plaque + counting number. -->
	<Container x={AMOUNT.x * S} y={AMOUNT.y * S} alpha={amountAlpha}>
		<Graphics
			draw={(g) => {
				g.clear();
				const w = AMOUNT.w * S;
				const h = AMOUNT.h * S;
				g.roundRect(-w / 2, -h / 2, w, h, AMOUNT.r * S);
				g.fill({ color: 0x100f0b, alpha: 0.96 });
				g.roundRect(-w / 2, -h / 2, w, h, AMOUNT.r * S);
				g.stroke({ width: Math.max(1, 1.5 * S), color: 0xf1b303 });
			}}
		/>
		<Container scale={amountFit}>
			<Text
				anchor={0.5}
				onresize={(s) => (amountSizes = s)}
				text={bookEventAmountToCurrencyString(props.amount)}
				style={{
					fontFamily: 'Chakra Petch, Inter, sans-serif',
					fontWeight: '700',
					fontSize: AMOUNT_FONT * S,
					fill: WIN_GRADIENT,
					align: 'center',
					letterSpacing: AMOUNT_FONT * S * (1.92 / 64),
				}}
			/>
		</Container>
	</Container>
</Container>
