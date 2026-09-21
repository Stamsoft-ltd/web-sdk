<script lang="ts">
	import { onMount } from 'svelte';
	import { Container, Sprite } from 'pixi-svelte';

	// The tier win-pad, re-assembled from separate layers so it can ANIMATE (the baked pad art was a
	// single flat image). Sequence: the banner + title + stars pop in first ("the win"), then the two
	// sauce splashes swoosh in from behind it, the stars keep twinkling and the burger gently wobbles.
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
	const bannerAR = $derived(BANNER_AR[tier] ?? 3.3);
	const titleAR = $derived(TITLE_AR[tier] ?? 1.5);

	// rAF clock — runs the whole time the pad is shown (twinkle + wobble are continuous).
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

	type L = { id: string; key: string; x: number; y: number; w: number; h: number; rot: number; a: number };
	const layers = $derived.by((): L[] => {
		const w = W;
		// Win group (banner + title + stars + burger) pops first.
		const winP = phase(40, 340);
		const winS = easeOutBack(winP);
		const winA = clamp01(elapsed / 140);
		// Splashes swoosh in behind, a beat later, bursting outward from the centre.
		const splP = phase(200, 430);
		const splS = easeOutBack(splP);
		const splA = clamp01((elapsed - 200) / 160);
		// Continuous flourishes once settled.
		const twinkle = 1 + 0.09 * Math.sin(elapsed / 260);
		const twinkle2 = 1 + 0.09 * Math.sin(elapsed / 260 + Math.PI); // second star out of phase
		const burgerRot = 0.05 * Math.sin(elapsed / 620);
		const burgerBob = -0.004 * w * (1 + Math.sin(elapsed / 620));

		const out: L[] = [];
		// Splash layer — scaled + translated about the origin so it grows out from behind the banner.
		const splash = (id: string, key: string, bx: number, by: number, bw: number, ar: number) =>
			out.push({ id, key, x: bx * splS, y: by * splS, w: bw * splS, h: (bw / ar) * splS, rot: 0, a: splA });
		splash('sy', 'winSplashYellow', -0.315 * w, -0.02 * w, 0.185 * w, 1.2);
		splash('sy2', 'winSplashYellow2', -0.40 * w, 0.08 * w, 0.10 * w, 1.36);
		splash('sr', 'winSplashRed', 0.315 * w, -0.02 * w, 0.185 * w, 1.71);
		splash('sr2', 'winSplashRed2', 0.40 * w, 0.07 * w, 0.085 * w, 1.09);

		// Win group — scaled + translated about the origin (pop-in together).
		const win = (id: string, key: string, bx: number, by: number, bw: number, ar: number, extra = 1, rot = 0) =>
			out.push({ id, key, x: bx * winS, y: (by + (id === 'burger' ? burgerBob : 0)) * winS, w: bw * winS * extra, h: (bw / ar) * winS * extra, rot, a: winA });
		win('banner', bannerKey, 0, 0.015 * w, 0.70 * w, bannerAR);
		win('starL', 'winStar', -0.245 * w, 0.03 * w, 0.072 * w * twinkle, 1.03);
		win('starR', 'winStar', 0.245 * w, 0.03 * w, 0.072 * w * twinkle2, 1.03);
		win('title', titleKey, 0, -0.03 * w, 0.42 * w, titleAR);
		win('burger', 'winPadBurger', 0, -0.145 * w, 0.085 * w, 1.84, 1, burgerRot);
		return out;
	});
</script>

<Container>
	{#each layers as l (l.id)}
		<Sprite key={l.key} x={l.x} y={l.y} anchor={0.5} width={l.w} height={l.h} rotation={l.rot} alpha={l.a} />
	{/each}
</Container>
