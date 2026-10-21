<script lang="ts">
	import { onMount } from 'svelte';
	import Logo from './Logo.svelte';
	import Blob from './Blob.svelte';
	import JellyDome from './JellyDome.svelte';
	import SkyClouds from './SkyClouds.svelte';
	import DOMES from '../lib/splash-domes.json';

	// Splash, built from Figma 9078:18632 (1200×670 frame). Landscape keeps the frame's
	// absolute layout scaled to fit; portrait stacks the logo over one card at a time.
	// The logo drops in and shakes the screen; the four blobs hide behind their cards
	// and creep out to sniff (their design pose is the fully peeked-out position).
	let {
		ready,
		busy,
		demo,
		tr,
		onstart,
	}: {
		ready: boolean;
		busy: boolean;
		demo: boolean;
		tr: (key: string) => string;
		onstart: () => void;
	} = $props();

	const LANDSCAPE = { w: 1200, h: 720 };
	const PORTRAIT = { w: 600, h: 1040 };
	const CARDS = 3;

	let vw = $state(1200);
	let vh = $state(720);
	let slide = $state(0);
	let portrait = $derived(vw < vh);
	let stage = $derived(portrait ? PORTRAIT : LANDSCAPE);
	let scale = $derived(Math.min(vw / stage.w, vh / stage.h));

	$effect(() => {
		if (!portrait) return;
		const id = setInterval(() => (slide = (slide + 1) % CARDS), 3500);
		return () => clearInterval(id);
	});

	const start = () => ready && onstart();

	// The split card's blob keeps dividing: 1 → 2 → 3 → 4 → 6, then starts over.
	const SPLIT_STEPS = [1, 2, 3, 4, 6];
	let splitStep = $state(0);
	let splitUnits = $derived(SPLIT_STEPS[splitStep]);
	$effect(() => {
		const id = setInterval(() => (splitStep = (splitStep + 1) % SPLIT_STEPS.length), 1600);
		return () => clearInterval(id);
	});

	// The max win counts up once its card has revealed (keep in step with --in on .card-2 + --at on .max-big).
	const MAX_WIN = 20000;
	// Translated titles run longer than the design's ("Split for / bigger wins"): the font
	// shrinks with the longest line past what the box holds at the design size.
	const titleFit = (text: string, px: number, chars: number) =>
		`font-size:${(px * Math.min(1, chars / Math.max(...text.split('\n').map((l) => l.length)))).toFixed(1)}px`;
	let maxWin = $state(0);
	const maxWinText = $derived(`${Math.round(maxWin).toLocaleString('en-US')}×`);
	onMount(() => {
		if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
			maxWin = MAX_WIN;
			return;
		}
		let raf = 0;
		const timer = setTimeout(() => {
			const t0 = performance.now();
			const tick = (t: number) => {
				// The first rAF timestamp can predate t0 (it's the frame's start): clamp, or the
				// counter opens on a negative number.
				const k = Math.min(1, Math.max(0, (t - t0) / 900));
				maxWin = MAX_WIN * (1 - (1 - k) ** 3);
				if (k < 1) raf = requestAnimationFrame(tick);
			};
			raf = requestAnimationFrame(tick);
		}, 750);
		return () => (clearTimeout(timer), cancelAnimationFrame(raf));
	});

	// Sky (Figma 11174:5004, a 1200×670 frame): cover-scaled behind the stage. The seascape and
	// its jelly domes are one baked image; clouds drift with the wind at random heights, sizes
	// and depths (far = small, soft, slow) and respawn off-screen; the islands only bob.
	const SKY = { w: 1200, h: 670 };
	let skyScale = $derived(Math.max(vw / SKY.w, vh / SKY.h) * 1.04);
	// The sea in sky-bg is one still painting (horizon y≈388, shore foam y≈494–527), so a
	// layer over it brings it to life: wave caps that swell and roll shoreward, glints near
	// the horizon, and foam that laps the beach. SEA_TOP is the layer's offset in frame px.
	const SEA_TOP = 380;
	// Shore foam centre line, traced from sky-bg every 50 frame px.
	const SHORE = [494, 497, 500, 504, 508, 514, 517, 521, 525, 527, 526, 524, 522, 518, 516, 515, 515, 516, 520, 521, 521, 518, 517, 515, 510];
	const shorePath = (dy: number) => {
		const p = SHORE.map((y, i) => [i * 50, y - SEA_TOP + dy]);
		let d = `M${p[0][0]},${p[0][1]}`;
		for (let i = 1; i < p.length - 1; i++)
			d += ` Q${p[i][0]},${p[i][1]} ${(p[i][0] + p[i + 1][0]) / 2},${(p[i][1] + p[i + 1][1]) / 2}`;
		return d + ` L${p.at(-1)![0]},${p.at(-1)![1]}`;
	};
	// Caps get longer, thicker and slower toward the viewer (y is in frame px).
	const CAPS = [
		[470, 404, 60], [700, 409, 70], [880, 400, 50], [350, 414, 80], [590, 420, 90],
		[760, 432, 120], [420, 441, 110], [960, 446, 120], [300, 456, 140], [640, 462, 150],
		[850, 474, 170], [480, 482, 180], [700, 491, 160],
	].map(([x, y, w], i) => {
		const t = (y - 400) / 95; // 0 at the horizon, 1 near the shore
		return { x, y: y - SEA_TOP, w, h: 3 + t * 4, dur: 4.2 + t * 2.4, delay: -((i * 1.37) % 5.5), drift: 10 + t * 22 };
	});
	const GLINTS = [
		[520, 398], [640, 405], [760, 397], [905, 411], [380, 407], [575, 427], [830, 423], [690, 444],
	].map(([x, y], i) => ({ x, y: y - SEA_TOP, s: 7 + ((i * 5) % 6), delay: -((i * 0.83) % 3.6) }));
	// One cloud per height band: near up top, far in the middle, a second near one lower down.
	const CLOUD_LANES: { far: boolean; y: [number, number] }[] = [
		{ far: false, y: [28, 45] },
		{ far: true, y: [138, 155] },
		{ far: false, y: [212, 230] },
	];
</script>

<svelte:window bind:innerWidth={vw} bind:innerHeight={vh} />

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="splash" class:ready onclick={start}>
	<div
		class="splash-sky"
		aria-hidden="true"
		style={`width:${SKY.w}px;height:${SKY.h}px;transform:translate(-50%,-50%) scale(${skyScale})`}
	>
		<div class="sky-base">
			<img class="sky-bg" src="./splash/sky-bg.webp" alt="" />
			<div class="sea" style={`top:${SEA_TOP}px`}>
				{#each CAPS as c}
					<span
						class="sea-cap"
						style={`left:${c.x}px;top:${c.y}px;width:${c.w}px;height:${c.h.toFixed(1)}px;--drift:${c.drift.toFixed(0)}px;animation-duration:${c.dur.toFixed(1)}s;animation-delay:${c.delay.toFixed(2)}s`}
					></span>
				{/each}
				{#each GLINTS as g}
					<span
						class="sea-glint"
						style={`left:${g.x}px;top:${g.y}px;width:${g.s}px;height:${g.s}px;animation-delay:${g.delay.toFixed(2)}s`}
					></span>
				{/each}
				<svg class="sea-shore" width={SKY.w} height="170" viewBox={`0 0 ${SKY.w} 170`}>
					<g class="foam-in">
						<path d={shorePath(-16)} class="foam-soft" />
						<path d={shorePath(-16)} class="foam-line" />
					</g>
					<g class="foam-lap">
						<path d={shorePath(-3)} class="foam-soft" />
						<path d={shorePath(-3)} class="foam-line" />
					</g>
				</svg>
			</div>
		</div>
		<!-- Five of the jelly domes (11174:5006/5010/5011/5012/5014) live as bubbles; the other four stay put. -->
		{#each DOMES as d (d.node)}
			<JellyDome src={d.src} x={d.x} y={d.y} w={d.size} ox={d.ox} oy={d.oy} color={d.color} pop={d.pop} />
		{/each}
		<!-- Islands 11174:5015 / 11174:5016; the baked blur margin is outside the art box. -->
		<img class="island" src="./splash/island.webp" alt="" style="left:131px;top:39px;width:105px" />
		<img
			class="island island-2"
			src="./splash/island.webp"
			alt=""
			style="left:996px;top:142px;width:90px"
		/>
		<SkyClouds lanes={CLOUD_LANES} width={SKY.w} />
	</div>
	<div
		class="splash-fit"
		class:portrait
		style={`width:${stage.w}px;height:${stage.h}px;transform:translate(-50%,-50%) scale(${scale})`}
	>
		<section class="splash-stage" role="dialog" aria-modal="true" aria-label="Blob Split">
			<div class="studio-badge" aria-hidden="true">
				<img class="studio-mark" src="./splash/studio-mark.svg" alt="" /><img
					class="studio-word"
					src="./splash/studio-word.svg"
					alt=""
				/>
			</div>
			<div class="splash-logo"><Logo uid="splash-logo" /></div>

			<div class="card card-1" class:active={slide === 0}>
				<span class="peeker peek-teal" aria-hidden="true"
					><span class="peek-face"><Blob symbol="KIWI" uid="peek-teal" /></span></span
				>
				<span class="peeker peek-yellow" aria-hidden="true"
					><span class="peek-face"><Blob symbol="LEMON" uid="peek-yellow" /></span></span
				>
				<img class="card-frame" src="./splash/panel.webp" alt="" />
				<h2 class="card-title green long" data-shine={tr('SPLASH SPLIT TITLE')} style={titleFit(tr('SPLASH SPLIT TITLE'), 23, 12)}>{tr('SPLASH SPLIT TITLE')}</h2>
				<!-- One blob dividing over and over, up to the tile's 6. -->
				<span class="split-art" aria-hidden="true"><Blob symbol="KIWI" units={splitUnits} uid="splash-split" /></span>
				<p class="card-copy">{tr('SPLASH SPLIT TEXT')}</p>
			</div>

			<div class="card card-2" class:active={slide === 1}>
				<img class="card-frame" src="./splash/panel.webp" alt="" />
				<h2 class="card-title yellow maxwin" data-shine={tr('SPLASH MAX TITLE')} style={titleFit(tr('SPLASH MAX TITLE'), 36, 8)}>{tr('SPLASH MAX TITLE')}</h2>
				<strong class="max-big" data-shine={maxWinText}>{maxWinText}</strong>
				<p class="card-copy max-copy">{tr('SPLASH MAX TEXT')}</p>
			</div>

			<div class="card card-3" class:active={slide === 2}>
				<span class="peeker peek-pink" aria-hidden="true"
					><span class="peek-face"><Blob symbol="STRAWBERRY" uid="peek-pink" /></span></span
				>
				<span class="peeker peek-purple" aria-hidden="true"
					><span class="peek-face"><Blob symbol="GRAPES" uid="peek-purple" /></span></span
				>
				<img class="card-frame" src="./splash/panel.webp" alt="" />
				<h2 class="card-title pink long" data-shine={tr('SPLASH BONUS TITLE')} style={titleFit(tr('SPLASH BONUS TITLE'), 23, 12)}>{tr('SPLASH BONUS TITLE')}</h2>
				<div class="egg" aria-hidden="true"><div class="egg-body"><img src="./splash/egg.webp" alt="" /></div></div>
				<p class="card-copy">{tr('SPLASH BONUS TEXT')}</p>
			</div>

			{#if portrait}
				<div class="dots" aria-hidden="true">
					{#each Array(CARDS) as _, i (i)}<span class:on={slide === i}></span>{/each}
				</div>
			{/if}

			<div class="splash-action">
				{#if ready}<button class="press-label" onclick={start}
						>{tr('PRESS TO CONTINUE')}&nbsp;→</button
					>{:else if !busy}<p>{tr('NO_SESSION')}</p>
					<a class="splash-link" href="?demo=1">{tr('OPEN_PREVIEW')} →</a>{:else}<p>
						{tr('CONNECTING')}
					</p>{/if}{#if demo}<small>{tr('PREVIEW_NOTE')}</small>{/if}
			</div>
		</section>
	</div>
</div>

<style>
	.splash {
		position: fixed;
		inset: 0;
		z-index: 20;
		overflow: hidden;
		background: #5b4fd6;
		user-select: none;
		/* Its own layer from the start, so the ×9 zoom into the island (App enterGame) scales
		   that layer instead of re-painting the whole splash at up to 9× resolution. */
		will-change: transform;
	}
	.splash.ready {
		cursor: pointer;
	}
	/* Overscanned 4% (skyScale) so the shake never shows an edge. */
	.splash-sky {
		position: absolute;
		left: 50%;
		top: 50%;
		overflow: hidden;
		pointer-events: none;
	}
	/* The painting and its live sea shake as one piece. */
	.sky-base {
		position: absolute;
		inset: 0;
		animation: splash-shake 0.6s 0.45s both;
	}
	.sky-bg {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
	}
	.sea {
		position: absolute;
		left: 0;
		width: 1200px;
		height: 170px;
		/* The painting is soft-focus; unblurred caps and foam would read as stickers. */
		filter: blur(1.2px);
	}
	/* A wave cap: swells in, stretches as it rolls a little shoreward, then breaks up. */
	.sea-cap {
		position: absolute;
		border-radius: 50%;
		background: radial-gradient(closest-side, #fffe 0 25%, #fff0);
		opacity: 0;
		animation: sea-cap ease-in-out infinite;
	}
	.sea-glint {
		position: absolute;
		translate: -50% -50%;
		background:
			linear-gradient(#fff, #fff) center / 100% 18% no-repeat,
			linear-gradient(#fff, #fff) center / 18% 100% no-repeat;
		border-radius: 50%;
		opacity: 0;
		animation: sea-glint 3.6s ease-in-out infinite;
	}
	.sea-shore {
		position: absolute;
		left: 0;
		top: 0;
		overflow: visible;
	}
	.sea-shore path {
		fill: none;
		stroke: #fff;
		stroke-linecap: round;
	}
	.foam-soft {
		stroke-width: 9;
		stroke-opacity: 0.25;
	}
	.foam-line {
		stroke-width: 3.5;
		stroke-dasharray: 46 9 22 6 70 12;
		animation: foam-flow 9s linear infinite;
	}
	.foam-lap {
		animation: foam-lap 4.6s ease-in-out infinite;
	}
	.foam-in {
		animation: foam-in 4.6s ease-in infinite;
	}
	.island {
		position: absolute;
		animation: island-bob 6.4s ease-in-out infinite;
	}
	.island-2 {
		animation-duration: 7.6s;
		animation-delay: -3.1s;
	}
	.splash-fit {
		position: absolute;
		left: 50%;
		top: 50%;
		transform-origin: 50% 50%;
	}
	.splash-stage {
		position: relative;
		width: 100%;
		height: 100%;
		margin: 0;
		font-family: 'Coiny', 'Blob Display', ui-rounded, sans-serif;
		font-weight: 400;
		text-align: center;
		animation: splash-shake 0.6s 0.45s both;
	}
	.studio-badge {
		position: absolute;
		left: 1088px;
		top: 25px;
		width: 90px;
		height: 29px;
	}
	.studio-mark {
		position: absolute;
		left: 0;
		top: 0;
		width: 15.94px;
		height: 29px;
	}
	.studio-word {
		position: absolute;
		left: 20.07px;
		top: 9.7px;
		width: 69.56px;
		height: 14.39px;
	}
	.splash-logo {
		position: absolute;
		z-index: 3;
		left: 382px;
		top: 25px;
		width: 436px;
		height: 218px;
		transform-origin: 50% 100%;
		animation: logo-drop 0.75s 0.05s both;
	}

	/* Cards: 273×410 frames; every child is placed at its Figma offset from the card.
	   As the logo lands (0.45s) they rise in one after another (--d), then their content
	   reveals line by line from --in, and they keep floating gently. The whole reveal is done
	   by ~1.1s (card 3's copy: 0.39 + 0.2 + 0.2 + 0.3). Motion uses the
	   individual translate/scale properties: children are centred with transform, and
	   portrait cards are scaled with it. */
	.card {
		position: absolute;
		width: 273px;
		height: 410px;
		--in: calc(var(--d) + 0.2s);
		animation:
			card-rise 0.45s var(--d) both,
			card-float 5.2s calc(var(--d) + 0.45s) ease-in-out infinite;
	}
	.card-1 {
		left: 183px;
		top: 250px;
		--d: 0.25s;
	}
	.card-2 {
		left: 464px;
		top: 250px;
		--d: 0.32s;
	}
	.card-3 {
		left: 748px;
		top: 248px;
		--d: 0.39s;
	}
	/* Content reveal: each line pops up in its turn (--at, after the card's --in). */
	.card-title,
	.card-copy,
	.max-big {
		animation: line-in 0.3s cubic-bezier(0.2, 0.8, 0.3, 1.2) calc(var(--in) + var(--at, 0s)) both;
	}
	.card-copy {
		--at: 0.2s;
	}
	.max-big {
		--at: 0.12s;
	}
	/* Titles and the max win catch a light now and then: a white copy of the text (data-shine)
	   glints over it. Opacity only, so the glint runs on the compositor (it used to sweep a
	   background-position, a repaint of the clipped text every frame). */
	.card-title,
	.max-big {
		color: var(--c);
	}
	.card-title::after,
	.max-big::after {
		content: attr(data-shine);
		position: absolute;
		inset: 0;
		color: #fff;
		opacity: 0;
		pointer-events: none;
		animation: shine 5.5s ease-in-out calc(var(--in) + var(--at, 0s) + var(--shine, 1s)) infinite;
	}
	.card-2 .card-title {
		--shine: 2.6s;
	}
	.card-3 .card-title {
		--shine: 4.2s;
	}
	.max-big {
		--shine: 2s;
	}
	.card-frame {
		position: absolute;
		z-index: 1;
		inset: 0;
		width: 100%;
		height: 100%;
	}
	.card > :not(.card-frame, .peeker) {
		position: absolute;
		z-index: 2;
		margin: 0;
		transform: translateX(-50%);
	}
	.card-title {
		top: 53px;
		font-size: 36px;
		font-weight: 400;
		letter-spacing: 1.08px;
		line-height: 1.1;
	}
	.card-title.green {
		left: 137px;
		top: 58px;
		width: 160px;
		line-height: 1;
		--c: #94f051;
	}
	.card-title.pink {
		left: 136px;
		width: 236px;
		--c: #f782fe;
	}
	.card-title.yellow {
		left: 136.5px;
		/* Wide enough for the translated titles ("MAX. GEWINN", "PREMIO MÁXIMO"). */
		width: 236px;
		--c: #fece06;
	}
	.card-title {
		text-transform: uppercase;
		/* The i18n titles carry their line break as "\n". */
		white-space: pre-line;
	}
	/* Two-line titles too wide for 36px. */
	.card-title.long {
		top: 52px;
		width: 236px;
		font-size: 23px;
		letter-spacing: 0.6px;
		line-height: 1.08;
	}
	.split-art {
		left: 136.5px;
		top: 124px;
		width: 132px;
		height: 122px;
		display: block;
		--divide-ms: 900ms;
		animation: egg-show 0.25s calc(var(--in) + 0.2s) both;
	}
	.egg {
		left: 136.5px;
		top: 140px;
		width: 89px;
		height: 97px;
		transform-origin: 50% 100%;
		/* Fades in with its card and hops in (the same kick the logo's impact used to give it). */
		animation:
			egg-show 0.25s calc(var(--in) + 0.2s) both,
			egg-jump 1.15s calc(var(--in) + 0.2s) both;
	}
	.egg-body {
		position: absolute;
		inset: 0;
		overflow: hidden;
		transform-origin: 50% 90%;
		animation:
			egg-breathe 3.2s ease-in-out infinite,
			egg-wiggle 4.6s ease-in-out 3.2s infinite;
	}
	.egg img {
		position: absolute;
		left: -8.64%;
		top: 0;
		width: 108.64%;
		height: 100%;
	}
	/* Body copy in the body face (Lilita at 15px set it as a dense bold block). */
	.card-copy {
		left: 136.5px;
		top: 254px;
		width: 226px;
		font-family: 'Poppins', sans-serif;
		font-weight: 700;
		font-size: 13.5px;
		letter-spacing: 0.1px;
		line-height: 1.3;
		color: #fff;
	}
	.max-copy {
		top: 252px;
		font-size: 15px;
	}
	.max-big {
		left: 137px;
		top: 168px;
		width: 200px;
		font-weight: 400;
		font-size: 46px;
		letter-spacing: 1.2px;
		line-height: 1.1;
		--c: #f782fe;
		white-space: nowrap;
	}

	/* Hidden blobs. Each sits at its Figma pose (peeked out) and is pushed back behind
	   the card by --hx/--hy; the loop brings it out, sniffs, and ducks away again. */
	.peeker {
		position: absolute;
		z-index: 0;
		display: grid;
		place-items: center;
		animation: blob-peek 5.6s ease-in-out infinite both;
	}
	/* The same art as the board symbols, so the peekers get the live faces too. */
	.peek-face {
		display: block;
		width: var(--img, 100%);
		height: var(--img, 100%);
		transform: rotate(var(--tilt, 0deg));
	}
	.peek-teal {
		--hy: 80px;
		left: 74px;
		top: -67px;
		width: 125px;
		height: 125px;
		animation-delay: 1.5s;
	}
	.peek-yellow {
		--hx: 85px;
		--tilt: -88.85deg;
		--img: 114.28px;
		left: -70px;
		top: 162px;
		width: 116.56px;
		height: 116.56px;
		animation-delay: 2.9s;
	}
	.peek-pink {
		--hy: 66px;
		left: 80px;
		top: -53px;
		width: 106px;
		height: 106px;
		animation-delay: 4.3s;
	}
	.peek-purple {
		--hx: -90px;
		--tilt: 86.66deg;
		--img: 118.72px;
		left: 223px;
		top: 155px;
		width: 125.43px;
		height: 125.43px;
		animation-delay: 5.7s;
	}

	.dots {
		position: absolute;
		left: 50%;
		top: 935px;
		display: flex;
		gap: 14px;
		transform: translateX(-50%);
	}
	.dots span {
		width: 14px;
		height: 14px;
		border-radius: 50%;
		background: #ffffff66;
		transition: background 0.3s;
	}
	.dots span.on {
		background: #fff;
	}
	.splash-action {
		position: absolute;
		left: 50%;
		top: 668px;
		width: 900px;
		display: grid;
		justify-items: center;
		gap: 4px;
		transform: translateX(-50%);
		color: #fff;
		font-size: 18px;
		letter-spacing: 0.6px;
		text-shadow: 0 2px 5px #1d0f4a99;
	}
	.splash-action p {
		margin: 0;
	}
	.press-label,
	.splash-link {
		padding: 4px 14px;
		border: 0;
		background: none;
		font: inherit;
		font-size: 22px;
		letter-spacing: 1.1px;
		text-transform: uppercase;
		color: #fff;
		text-shadow: inherit;
		white-space: nowrap;
		cursor: pointer;
	}
	.press-label {
		animation: press-blink 1.6s ease-in-out infinite;
	}
	.splash-action small {
		font-family: 'Nunito', ui-rounded, sans-serif;
		font-size: 11px;
		opacity: 0.85;
	}

	/* Portrait: logo on top, one card at a time (auto-advancing), dots, prompt. */
	.portrait .studio-badge {
		left: 255px;
		top: 18px;
	}
	.portrait .splash-logo {
		left: 82px;
		top: 68px;
	}
	.portrait .card {
		left: 95px;
		top: 318px;
		transform: scale(1.5);
		transform-origin: 0 0;
		display: none;
	}
	/* One card at a time: each reveals its lines as soon as it slides in. */
	.portrait .card {
		--d: 0s;
	}
	.portrait .card.active {
		display: block;
		animation: card-in 0.45s ease-out both;
	}
	.portrait .splash-action {
		top: 972px;
		width: 560px;
	}

	@keyframes card-rise {
		0% {
			opacity: 0;
			translate: 0 46px;
			scale: 0.92;
		}
		60% {
			opacity: 1;
			translate: 0 -6px;
			scale: 1.02;
		}
		100% {
			translate: 0 0;
			scale: 1;
		}
	}
	@keyframes card-float {
		0%,
		100% {
			translate: 0 0;
		}
		50% {
			translate: 0 -5px;
		}
	}
	@keyframes line-in {
		from {
			opacity: 0;
			translate: 0 12px;
			scale: 0.9;
		}
	}
	@keyframes shine {
		0%,
		30%,
		60%,
		100% {
			opacity: 0;
		}
		42% {
			opacity: 0.6;
		}
	}
	@keyframes egg-show {
		from {
			opacity: 0;
		}
	}
	@keyframes egg-wiggle {
		0%,
		14%,
		100% {
			rotate: 0deg;
		}
		3% {
			rotate: -9deg;
		}
		6% {
			rotate: 8deg;
		}
		9% {
			rotate: -5deg;
		}
		12% {
			rotate: 2deg;
		}
	}
	@keyframes card-in {
		from {
			opacity: 0;
			translate: 0 18px;
		}
	}
	/* The ground kicks it: squash, leap with a spin, land squashed, one small bounce. */
	@keyframes egg-jump {
		0% {
			translate: 0 0;
			scale: 1;
			rotate: 0deg;
			animation-timing-function: ease-out;
		}
		8% {
			translate: 0 4px;
			scale: 1.14 0.84;
			animation-timing-function: cubic-bezier(0.2, 0.7, 0.4, 1);
		}
		38% {
			translate: 0 -42px;
			scale: 0.94 1.08;
			rotate: -14deg;
			animation-timing-function: cubic-bezier(0.55, 0, 0.9, 0.5);
		}
		58% {
			translate: 0 0;
			scale: 0.96 1.05;
			rotate: 4deg;
			animation-timing-function: ease-out;
		}
		64% {
			scale: 1.16 0.82;
			rotate: 0deg;
			animation-timing-function: cubic-bezier(0.2, 0.7, 0.4, 1);
		}
		76% {
			translate: 0 -12px;
			scale: 0.97 1.04;
			rotate: 5deg;
			animation-timing-function: cubic-bezier(0.55, 0, 0.9, 0.5);
		}
		86% {
			translate: 0 0;
			scale: 1.07 0.93;
			rotate: 0deg;
		}
		93% {
			scale: 0.98 1.02;
		}
		100% {
			translate: 0 0;
			scale: 1;
			rotate: 0deg;
		}
	}
	/* Slow breath: swells a little wider, settles back. */
	@keyframes egg-breathe {
		0%,
		100% {
			transform: none;
		}
		50% {
			transform: scale(1.05, 1.03);
		}
	}
	@keyframes island-bob {
		0%,
		100% {
			transform: none;
		}
		50% {
			transform: translateY(-5px) rotate(1.5deg);
		}
	}
	@keyframes press-blink {
		50% {
			opacity: 0.35;
		}
	}
	@keyframes logo-drop {
		0% {
			transform: translateY(-120vh) scale(0.9, 1.15);
			animation-timing-function: cubic-bezier(0.55, 0, 1, 0.45);
		}
		54% {
			transform: translateY(0) scale(0.92, 1.12);
			animation-timing-function: ease-out;
		}
		62% {
			transform: translateY(8px) scale(1.22, 0.74);
			animation-timing-function: ease-out;
		}
		75% {
			transform: translateY(-18px) scale(0.94, 1.07);
			animation-timing-function: ease-in-out;
		}
		88% {
			transform: translateY(0) scale(1.04, 0.96);
		}
		100% {
			transform: none;
		}
	}
	@keyframes splash-shake {
		0%,
		100% {
			transform: none;
		}
		10% {
			transform: translate(-9px, 12px) rotate(-1.2deg);
		}
		22% {
			transform: translate(10px, -6px) rotate(1deg);
		}
		34% {
			transform: translate(-7px, 5px) rotate(-0.8deg);
		}
		48% {
			transform: translate(5px, -3px) rotate(0.5deg);
		}
		62% {
			transform: translate(-3px, 2px) rotate(-0.3deg);
		}
		78% {
			transform: translate(1px, -1px);
		}
	}
	/* One cycle: creep out, sniff-sniff-sniff, look around at the design pose, dart back. */
	@keyframes blob-peek {
		0%,
		8% {
			transform: translate(var(--hx, 0px), var(--hy, 0px));
		}
		16% {
			transform: translate(calc(var(--hx, 0px) * 0.5), calc(var(--hy, 0px) * 0.5));
		}
		20% {
			transform: translate(calc(var(--hx, 0px) * 0.55), calc(var(--hy, 0px) * 0.55));
		}
		24% {
			transform: translate(calc(var(--hx, 0px) * 0.3), calc(var(--hy, 0px) * 0.3)) scale(1.04, 0.97);
		}
		26% {
			transform: translate(calc(var(--hx, 0px) * 0.36), calc(var(--hy, 0px) * 0.36));
		}
		28% {
			transform: translate(calc(var(--hx, 0px) * 0.22), calc(var(--hy, 0px) * 0.22)) scale(1.05, 0.96);
		}
		30% {
			transform: translate(calc(var(--hx, 0px) * 0.3), calc(var(--hy, 0px) * 0.3));
		}
		32% {
			transform: translate(calc(var(--hx, 0px) * 0.16), calc(var(--hy, 0px) * 0.16)) scale(1.05, 0.96);
		}
		38%,
		46% {
			transform: rotate(5deg);
		}
		50% {
			transform: rotate(-5deg);
		}
		54% {
			transform: translate(calc(var(--hx, 0px) * -0.06), calc(var(--hy, 0px) * -0.06));
			animation-timing-function: cubic-bezier(0.6, 0, 1, 0.6);
		}
		60%,
		100% {
			transform: translate(var(--hx, 0px), var(--hy, 0px));
		}
	}
	@keyframes sea-cap {
		0% {
			opacity: 0;
			transform: translate(calc(var(--drift) * -0.4), 0) scaleX(0.4);
		}
		45% {
			opacity: 0.9;
			transform: translate(0, 2px) scaleX(1);
		}
		100% {
			opacity: 0;
			transform: translate(var(--drift), 5px) scaleX(0.75);
		}
	}
	@keyframes sea-glint {
		0%,
		60%,
		100% {
			opacity: 0;
			transform: scale(0.2) rotate(0deg);
		}
		75% {
			opacity: 1;
			transform: scale(1) rotate(45deg);
		}
	}
	@keyframes foam-flow {
		to {
			stroke-dashoffset: -330;
		}
	}
	/* The shore foam runs up the beach and slides back, fading as it thins. */
	@keyframes foam-lap {
		0%,
		100% {
			opacity: 0.55;
			transform: translateY(-3px);
		}
		45% {
			opacity: 1;
			transform: translateY(5px);
		}
	}
	/* The next crest rolls in from behind and merges into the lap as it breaks. */
	@keyframes foam-in {
		0% {
			opacity: 0;
			transform: translateY(-10px);
		}
		30% {
			opacity: 0.8;
		}
		45%,
		100% {
			opacity: 0;
			transform: translateY(14px);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.peeker {
			transform: none;
		}
		.card,
		.card *,
		.portrait .card.active {
			animation: none !important;
		}
		.sea {
			display: none;
		}
	}
</style>
