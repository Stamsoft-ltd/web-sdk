<script lang="ts">
	import { onMount } from 'svelte';
	import { Container, Sprite } from 'pixi-svelte';

	import AnimatedSymbol from './AnimatedSymbol.svelte';
	import { H1_ASSEMBLE } from '../game/symbolParts';

	// The tier win-pad, re-assembled from separate layers so it can ANIMATE (the baked pad art was a
	// single flat image). Sequence: the banner + title + stars pop in first ("the win"), then the two
	// sauce splashes swoosh in from behind it. The title keeps breathing (expand / retract), the stars
	// twinkle, and the real BURGER SYMBOL sits behind the title and pops once (its separate-reassemble).
	type Props = {
		/** 'winPadSweet' | 'winPadLegendary' | 'winPadEpic' | 'winPadWild' | 'winPadMythic' */
		padKey: string;
		/** Rendered pad width (matches the old flat sprite footprint). */
		width: number;
	};
	const props: Props = $props();
	const W = $derived(props.width);

	const tier = $derived(props.padKey.replace('winPad', '').toLowerCase());
	const cap = $derived(tier.charAt(0).toUpperCase() + tier.slice(1));
	const bannerKey = $derived(`winBanner${cap}`);
	// Title is now TWO separate words — the tier wordmark (top) and the shared "WIN" (bottom) — so each
	// can fly in from its own edge. Aspects (w/h) from the exported word rasters.
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
		// Splashes get THROWN in behind, a beat later: they burst outward from the centre, spinning into
		// place with a slight overshoot, then keep throbbing/wobbling like wet sauce.
		const splP = phase(200, 430);
		const splS = easeOutBack(splP);
		const splA = clamp01((elapsed - 200) / 160);
		const spinIn = (1 - splP) ** 2; // spin swing that eases out as it lands
		const splThrobY = 1 + 0.05 * Math.sin(elapsed / 250);
		const splThrobR = 1 + 0.05 * Math.sin(elapsed / 250 + 2.1);
		const splWobble = 0.035 * Math.sin(elapsed / 360);
		// Continuous flourishes once settled.
		const twinkle = 1 + 0.09 * Math.sin(elapsed / 260);
		const twinkle2 = 1 + 0.09 * Math.sin(elapsed / 260 + Math.PI);
		const starRot = 0.1 * Math.sin(elapsed / 600);
		const titleBreathe = 1 + 0.03 * Math.sin(elapsed / 470); // expand / retract

		const syW = 0.205 * w;
		const srW = 0.205 * w;
		const back: L[] = [];
		back.push({ id: 'sy', key: 'winSplashYellow', x: -0.315 * w * splS, y: -0.02 * w * splS, w: syW * splS * splThrobY, h: (syW / 1.2) * splS * splThrobY, a: splA, rot: -0.55 * spinIn + splWobble });
		back.push({ id: 'sr', key: 'winSplashRed', x: 0.315 * w * splS, y: -0.02 * w * splS, w: srW * splS * splThrobR, h: (srW / 1.71) * splS * splThrobR, a: splA, rot: 0.55 * spinIn - splWobble });
		back.push({ id: 'banner', key: bannerKey, x: 0, y: 0.015 * w * winS, w: 0.70 * w * winS, h: (0.70 * w / bannerAR) * winS, a: winA, rot: 0 });
		back.push({ id: 'starL', key: 'winStar', x: -0.245 * w * winS, y: 0.03 * w * winS, w: 0.072 * w * winS * twinkle, h: (0.072 * w / 1.03) * winS * twinkle, a: winA, rot: starRot });
		back.push({ id: 'starR', key: 'winStar', x: 0.245 * w * winS, y: 0.03 * w * winS, w: 0.072 * w * winS * twinkle2, h: (0.072 * w / 1.03) * winS * twinkle2, a: winA, rot: -starRot });

		// Split title: the tier word DROPS in from the top, the shared WIN RISES from the bottom, both
		// with an easeOutBack settle + fade. The tier word's drop is short and it fades in as it lands, so
		// it stays clear of the assembling burger that peeks above the banner. Then both breathe together.
		// Start the words AFTER the banner has popped in, so their fly-in from top/bottom reads clearly
		// against the settled banner instead of moving while the whole pad is still scaling up.
		const wordE = easeOutBack(phase(330, 540));
		const wordA = clamp01((elapsed - 330) / 260);
		const tierHpx = tierH * w * titleBreathe;
		const winHpx = 0.105 * w * titleBreathe;
		const tierRestY = -0.05 * w;
		const winRestY = 0.078 * w;
		const tierWord: L = {
			id: 'tierWord',
			key: wordKey,
			x: 0,
			y: tierRestY - (1 - wordE) * 0.08 * w, // enters from ABOVE (short drop, clear of the burger)
			w: tierHpx * wordAR,
			h: tierHpx,
			a: wordA,
			rot: 0,
		};
		const winWord: L = {
			id: 'winWord',
			key: 'winWordWin',
			x: 0,
			y: winRestY + (1 - wordE) * 0.2 * w, // rises from BELOW
			w: winHpx * WIN_AR,
			h: winHpx,
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
		const bounceIn = clamp01((elapsed - 1550) / 500); // ease the bounce in once assembled (~land end)
		const settle = (bounceIn * (1 - Math.cos(bph))) / 2; // 0 → 1 → 0, always >= 0 (downward only)
		// Rest height (-0.185w) sits the burger peeking well over the banner — high enough that the
		// slice-by-slice assemble reads (at -0.15w it sat too low and the build hid behind the banner) —
		// yet still clear of the McSchmutzo logo that hugs the board's top edge on desktop (it used to be
		// -0.205w and covered the logo). The
		// bob then only ever settles DOWN from here, so it can never climb back into the logo.
		const burger = { x: 0, y: -0.185 * w + settle * 0.02 * w, scale: 1.5 * (1 - settle * 0.025), winning: false };
		return { back, tierWord, winWord, burger, glints };
	});
</script>

<Container>
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
