<script lang="ts">
	import { onMount } from 'svelte';
	import { Container, Graphics, Sprite } from 'pixi-svelte';

	import AnimatedSymbol from './AnimatedSymbol.svelte';
	import { H1_ASSEMBLE } from '../game/symbolParts';
	import { drawSauceSquirt, squirtHash, type SquirtGraphics } from '../game/ketchupSquirt';
	import { splashShapes, SPLASH_RED, SPLASH_YELLOW } from '../game/winSplash';

	// The tier win-pad, re-assembled from separate layers so it can ANIMATE (the baked pad art was a
	// single flat image). Sequence: the banner + stars pop in first, then the title words are STAMPED
	// onto it — they hit at HIT_MS, squash flat, and the impact squeezes the two sauce splashes (drawn in
	// code, game/winSplash.ts) out from under the banner ends. The title keeps breathing (expand /
	// retract), the stars twinkle, and the real BURGER SYMBOL sits behind the title and pops once.
	type Props = {
		/** 'winPadSweet' | 'winPadLegendary' | 'winPadEpic' | 'winPadWild' | 'winPadMythic' */
		padKey: string;
		/** Rendered pad width (matches the old flat sprite footprint). */
		width: number;
		/** Portrait: the pad is nearly screen-wide, so the splashes are tucked in and drawn smaller. */
		compact?: boolean;
	};
	const props: Props = $props();
	const W = $derived(props.width);

	const tier = $derived(props.padKey.replace('winPad', '').toLowerCase());
	const cap = $derived(tier.charAt(0).toUpperCase() + tier.slice(1));
	const bannerKey = $derived(`winBanner${cap}`);
	// Title is TWO separate words — the tier wordmark (top) and the shared "WIN" (bottom), stamped onto
	// the banner together. Aspects (w/h) from the exported word rasters.
	const wordKey = $derived(`winWord${cap}`);
	const BANNER_AR: Record<string, number> = { sweet: 3.39, legendary: 3.25, epic: 3.22, wild: 3.29, mythic: 3.3 };
	const WORD_AR: Record<string, number> = { sweet: 2.645, legendary: 3.16, epic: 2.078, wild: 2.365, mythic: 2.573 };
	const WIN_AR = 2.374;
	// Tier word target height (fraction of pad) — SAME for every tier so the wordmarks read equal-sized;
	// longer words (LEGENDARY) just run wider, and still fit inside the banner.
	const TIER_H_ALL = 0.145;
	const TIER_H: Record<string, number> = { sweet: TIER_H_ALL, legendary: TIER_H_ALL, epic: TIER_H_ALL, wild: TIER_H_ALL, mythic: TIER_H_ALL };
	const bannerAR = $derived(BANNER_AR[tier] ?? 3.3);
	const wordAR = $derived(WORD_AR[tier] ?? 2.5);
	const tierH = $derived(TIER_H[tier] ?? 0.15);

	// rAF clock — runs the whole time the pad is shown (breathe + twinkle are continuous).
	let clock = $state(0);
	let start = $state(0);
	onMount(() => {
		start = performance.now();
		clock = start;
		let raf = 0;
		const loop = (ts: number) => {
			clock = ts;
			raf = requestAnimationFrame(loop);
		};
		raf = requestAnimationFrame(loop);
		return () => cancelAnimationFrame(raf);
	});
	const elapsed = $derived(clock - start);
	const HIT_MS = 640; // the title words land on the banner
	const STAMP_FROM = 330; // …after coming down from 1.7× from here

	const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
	const phase = (start_: number, dur: number) => clamp01((elapsed - start_) / dur);
	// 0 → slight overshoot (~1.1) → settle at 1.
	const easeOutBack = (x: number) => {
		if (x <= 0) return 0;
		if (x >= 1) return 1;
		const c1 = 1.70158;
		const c3 = c1 + 1;
		return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2;
	};

	type L = { id: string; key: string; x: number; y: number; w: number; h: number; a: number; rot: number };
	const anim = $derived.by(() => {
		const w = W;
		// Win group (banner + title + stars) pops first.
		const winS = easeOutBack(phase(40, 340));
		const winA = clamp01(elapsed / 140);
		// The hit: everything squashes on impact and springs back (damped), the words hardest.
		const v = (elapsed - HIT_MS) / 520;
		const hitD = v >= 0 ? Math.exp(-6 * v) * Math.cos(v * Math.PI * 3) : 0;
		const bannerSx = 1 + 0.035 * hitD;
		const bannerSy = 1 - 0.05 * hitD;
		// Continuous flourishes once settled.
		const twinkle = 1 + 0.09 * Math.sin(elapsed / 260);
		const twinkle2 = 1 + 0.09 * Math.sin(elapsed / 260 + Math.PI);
		const starRot = 0.1 * Math.sin(elapsed / 600);
		const titleBreathe = 1 + 0.03 * Math.sin(elapsed / 470); // expand / retract

		const back: L[] = [];
		back.push({ id: 'banner', key: bannerKey, x: 0, y: 0.015 * w * winS, w: 0.70 * w * winS * bannerSx, h: (0.70 * w / bannerAR) * winS * bannerSy, a: winA, rot: 0 });
		back.push({ id: 'starL', key: 'winStar', x: -0.245 * w * winS, y: 0.03 * w * winS, w: 0.072 * w * winS * twinkle, h: (0.072 * w / 1.03) * winS * twinkle, a: winA, rot: starRot });
		back.push({ id: 'starR', key: 'winStar', x: 0.245 * w * winS, y: 0.03 * w * winS, w: 0.072 * w * winS * twinkle2, h: (0.072 * w / 1.03) * winS * twinkle2, a: winA, rot: -starRot });

		// Title: both words are STAMPED onto the banner — they come down from 1.7× (accelerating, fading
		// in), hit at HIT_MS, squash wide + flat and spring back. Then they breathe together.
		const q = clamp01((elapsed - STAMP_FROM) / (HIT_MS - STAMP_FROM));
		const stamp = 1.7 - 0.7 * q * q;
		const wordA = clamp01((elapsed - STAMP_FROM) / 120);
		const wordSx = stamp * (1 + 0.16 * hitD);
		const wordSy = stamp * (1 - 0.2 * hitD);
		const tierHpx = tierH * w * titleBreathe;
		const winHpx = 0.105 * w * titleBreathe;
		const tierWord: L = {
			id: 'tierWord',
			key: wordKey,
			x: 0,
			y: -0.05 * w,
			w: tierHpx * wordAR * wordSx,
			h: tierHpx * wordSy,
			a: wordA,
			rot: 0,
		};
		const winWord: L = {
			id: 'winWord',
			key: 'winWordWin',
			x: 0,
			y: 0.078 * w,
			w: winHpx * WIN_AR * wordSx,
			h: winHpx * wordSy,
			a: wordA,
			rot: 0,
		};

		// Star SHINE: an additive copy of each star flashes bright on a periodic glint (offset so the two
		// stars sparkle out of sync).
		const glint = (off: number) => {
			const p = ((elapsed + off) % 2200) / 2200;
			return Math.exp(-(((p - 0.5) * 7) ** 2)) * 0.85 * winA;
		};
		const glints: L[] = [
			{ id: 'gL', key: 'winStar', x: -0.245 * w * winS, y: 0.03 * w * winS, w: 0.083 * w * winS * twinkle, h: (0.083 * w / 1.03) * winS * twinkle, a: glint(0), rot: starRot },
			{ id: 'gR', key: 'winStar', x: 0.245 * w * winS, y: 0.03 * w * winS, w: 0.083 * w * winS * twinkle2, h: (0.083 * w / 1.03) * winS * twinkle2, a: glint(1100), rot: -starRot },
		];

		// Real burger symbol, BEHIND the plaque. It ASSEMBLES slice-by-slice ONCE (H1_ASSEMBLE land
		// one-shot, winning=false so the separate-and-reassemble loop never runs / never "repeats"),
		// then the WHOLE built burger just SETTLES with a gentle bob (all slices move together, so it
		// never comes apart). The bob only ever goes DOWN from the resting height + squashes a hair —
		// it never rises above rest, so on desktop (where the board's McSchmutzo logo sits right above
		// the burger) the bounce can't push it up into the logo. `(1-cos)/2` is a seamless 0→1→0 that
		// stays >= 0 (down only); at bigger sizes this is the same fraction, so it's clear everywhere.
		const bph = elapsed / 430;
		const bounceIn = clamp01((elapsed - 1750) / 500); // ease the bounce in once assembled (~land end)
		const settle = (bounceIn * (1 - Math.cos(bph))) / 2; // 0 → 1 → 0, always >= 0 (downward only)
		// Rest height (-0.185w) sits the burger peeking well over the banner — high enough that the
		// slice-by-slice assemble reads (at -0.15w it sat too low and the build hid behind the banner) —
		// yet still clear of the McSchmutzo logo that hugs the board's top edge on desktop (it used to be
		// -0.205w and covered the logo). The
		// bob then only ever settles DOWN from here, so it can never climb back into the logo.
		const burger = { x: 0, y: -0.185 * w + settle * 0.02 * w, scale: 1.5 * (1 - settle * 0.025), winning: false };
		return { back, tierWord, winWord, burger, glints };
	});

	// The two splashes squeezed out by the title hit (behind the banner), in pad-width units.
	const drawSplashes = (g: any) => {
		const ms = elapsed - HIT_MS;
		if (ms < 0) return;
		for (const [spec, side, seed] of [[SPLASH_YELLOW, -1, 0], [SPLASH_RED, 1, 2]] as const) {
			const place = props.compact ? { ox: 0.26, k: 0.7 } : undefined;
			for (const s of splashShapes(spec, side, ms, seed, place)) {
				if (s.alpha <= 0.002) continue;
				if (s.kind === 'poly') g.poly(s.pts.map((p) => p * W), true).fill({ color: s.color, alpha: s.alpha });
				else if (s.kind === 'circle') g.circle(s.x * W, s.y * W, s.r * W).fill({ color: s.color, alpha: s.alpha });
				else g.ellipse(s.x * W, s.y * W, s.rx * W, s.ry * W).fill({ color: s.color, alpha: s.alpha });
			}
		}
	};

	// Impact spray as the splashes burst out: a fan of three sauce jets thrown outward from each banner
	// end, snapping into drops of mixed sizes. One-shot, behind the banner.
	const SPRAYS = [
		{ x: -0.34, y: -0.03, dir: -2.5, color: 0xefa80e },
		{ x: 0.34, y: -0.03, dir: -0.64, color: 0xc41e0a },
	];
	const drawSpray = (g: SquirtGraphics) => {
		const u0 = elapsed - HIT_MS; // as the title hits and squeezes the sauce out
		if (u0 < 0 || u0 > 2200) return;
		SPRAYS.forEach((sp, i) => {
			for (let j = 0; j < 3; j++) {
				const dir = sp.dir + (j - 1) * 0.55 + (squirtHash(i * 5 + j) - 0.5) * 0.2;
				drawSauceSquirt(g, {
					u: u0 - j * 40,
					unit: 0.36 * W * (0.8 + 0.35 * squirtHash(i * 3 + j * 7)),
					color: sp.color,
					seed: i * 10 + j,
					widthScale: 1.5,
					nozzleAt: () => ({ x: sp.x * W, y: sp.y * W, dir }),
				});
			}
		});
	};
</script>

<Container>
	<!-- Impact spray (behind everything on the pad). -->
	<Graphics draw={drawSpray} />
	<!-- Sauce squeezed out from under the banner ends by the title hit. -->
	<Graphics draw={drawSplashes} />
	<!-- Burger BEHIND the plaque: assembles slice-by-slice ONCE, then bobs (whole-burger bounce). -->
	<AnimatedSymbol config={H1_ASSEMBLE} x={anim.burger.x} y={anim.burger.y} scale={anim.burger.scale} state="land" winning={anim.burger.winning} />
	{#each anim.back as l (l.id)}
		<Sprite key={l.key} x={l.x} y={l.y} anchor={0.5} width={l.w} height={l.h} rotation={l.rot} alpha={l.a} />
	{/each}
	{#each anim.glints as g (g.id)}
		<Sprite key={g.key} x={g.x} y={g.y} anchor={0.5} width={g.w} height={g.h} rotation={g.rot} alpha={g.a} blendMode="add" />
	{/each}
	<!-- Title words on top: tier wordmark (dropped in from above) + shared WIN (risen from below). -->
	<Sprite key={anim.winWord.key} x={anim.winWord.x} y={anim.winWord.y} anchor={0.5} width={anim.winWord.w} height={anim.winWord.h} rotation={anim.winWord.rot} alpha={anim.winWord.a} />
	<Sprite key={anim.tierWord.key} x={anim.tierWord.x} y={anim.tierWord.y} anchor={0.5} width={anim.tierWord.w} height={anim.tierWord.h} rotation={anim.tierWord.rot} alpha={anim.tierWord.a} />
</Container>
