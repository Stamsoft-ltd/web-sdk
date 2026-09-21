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
	const titleKey = $derived(`winTitle${cap}`);
	// w / h of each part (from the exported art) so we can size by width and keep the aspect.
	const BANNER_AR: Record<string, number> = { sweet: 3.39, legendary: 3.25, epic: 3.22, wild: 3.29, mythic: 3.3 };
	const TITLE_AR: Record<string, number> = { sweet: 1.62, legendary: 2.14, epic: 1.29, wild: 1.42, mythic: 1.49 };
	// Title width as a fraction of the pad. LEGENDARY is a long word, so at the shared width its
	// letters render smaller than the other tiers — give it more width so its type matches theirs.
	const TITLE_W: Record<string, number> = { sweet: 0.42, legendary: 0.55, epic: 0.42, wild: 0.42, mythic: 0.44 };
	const bannerAR = $derived(BANNER_AR[tier] ?? 3.3);
	const titleAR = $derived(TITLE_AR[tier] ?? 1.5);
	const titleW = $derived(TITLE_W[tier] ?? 0.42);

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

		const s = winS * titleBreathe;
		const title: L = { id: 'title', key: titleKey, x: 0, y: -0.03 * w * winS, w: titleW * w * s, h: (titleW * w / titleAR) * s, a: winA, rot: 0 };

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

		// Real burger symbol, BEHIND the plaque (drawn first) so it peeks over the top of the banner.
		// It ASSEMBLES slice-by-slice (H1_ASSEMBLE land one-shot) then hands over to the board's dancing
		// idle (winning loop). Fixed size — the assemble is its entrance, not the group pop.
		const burger = { x: 0, y: -0.205 * w, scale: 1.5, winning: true };
		return { back, title, burger, glints };
	});
</script>

<Container>
	<!-- Burger BEHIND the plaque: assembles slice-by-slice, then dances (H1 idle loop). -->
	<AnimatedSymbol config={H1_ASSEMBLE} x={anim.burger.x} y={anim.burger.y} scale={anim.burger.scale} state="land" winning={anim.burger.winning} />
	{#each anim.back as l (l.id)}
		<Sprite key={l.key} x={l.x} y={l.y} anchor={0.5} width={l.w} height={l.h} rotation={l.rot} alpha={l.a} />
	{/each}
	{#each anim.glints as g (g.id)}
		<Sprite key={g.key} x={g.x} y={g.y} anchor={0.5} width={g.w} height={g.h} rotation={g.rot} alpha={g.a} blendMode="add" />
	{/each}
	<Sprite key={anim.title.key} x={anim.title.x} y={anim.title.y} anchor={0.5} width={anim.title.w} height={anim.title.h} rotation={anim.title.rot} alpha={anim.title.a} />
</Container>
