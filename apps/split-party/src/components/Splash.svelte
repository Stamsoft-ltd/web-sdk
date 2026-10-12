<script lang="ts">
	import { onMount } from 'svelte';
	import Logo from './Logo.svelte';
	import Blob from './Blob.svelte';
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

	// Sky (Figma 11174:5004, a 1200×670 frame): cover-scaled behind the stage. The seascape and
	// its jelly domes are one baked image; clouds drift with the wind at random heights, sizes
	// and depths (far = small, soft, slow) and respawn off-screen; the islands only bob.
	const SKY = { w: 1200, h: 670 };
	let skyScale = $derived(Math.max(vw / SKY.w, vh / SKY.h) * 1.04);
	type Cloud = { id: number; far: boolean; y: number; w: number; dur: number; delay: number; alpha: number };
	let cloudId = 0;
	const rand = (a: number, b: number) => a + Math.random() * (b - a);
	function cloud(midway: boolean): Cloud {
		const far = Math.random() < 0.5;
		const w = far ? rand(140, 200) : rand(300, 430);
		// px/s: near clouds pass at ~22, far ones at ~9, so depth reads from parallax.
		const dur = (SKY.w + w + 80) / (far ? rand(7, 11) : rand(18, 26));
		return {
			id: cloudId++,
			far,
			y: far ? rand(30, 165) : rand(10, 120),
			w,
			dur,
			delay: midway ? -rand(0.05, 0.95) * dur : rand(0, 7),
			alpha: far ? rand(0.5, 0.7) : 0.7,
		};
	}
	// Five of the jelly domes (11174:5006/5010/5011/5012/5014) live as bubbles: each blows up
	// at a random moment after the logo lands, rests, bursts into droplets and vanishes, then
	// blows up again later. The other four stay put.
	type Phase = 'wait' | 'blow' | 'rest' | 'burst';
	const drops = (size: number) =>
		Array.from({ length: 7 }, (_, i) => {
			const a = -Math.PI * (0.1 + (0.8 * (i + Math.random() * 0.6)) / 7);
			const r = size * rand(0.35, 0.6);
			return { dx: Math.cos(a) * r, dy: Math.sin(a) * r, s: rand(5, 11) };
		});
	let domes = $state(
		DOMES.map((d) => ({ ...d, phase: (d.pop ? 'wait' : 'rest') as Phase, n: 0, drops: drops(d.size) })),
	);
	onMount(() => {
		if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
			domes.forEach((d) => (d.phase = 'rest'));
			return;
		}
		const timers = new Set<ReturnType<typeof setTimeout>>();
		const later = (ms: number, fn: () => void) => {
			const t = setTimeout(() => (timers.delete(t), fn()), ms);
			timers.add(t);
		};
		const step = (i: number, phase: Phase) => {
			const d = domes[i];
			d.phase = phase;
			d.n++;
			if (phase === 'blow' || phase === 'burst') d.drops = drops(d.size);
			if (phase === 'blow') later(950, () => step(i, 'rest'));
			else if (phase === 'rest') later(rand(2500, 7500), () => step(i, 'burst'));
			else if (phase === 'burst') later(420, () => step(i, 'wait'));
			else later(rand(1200, 4800), () => step(i, 'blow'));
		};
		domes.forEach((d, i) => d.pop && later(rand(900, 3400), () => step(i, 'blow')));
		return () => timers.forEach(clearTimeout);
	});
	let clouds = $state(Array.from({ length: 5 }, () => cloud(true)));
	const respawn = (id: number) => (clouds = clouds.map((c) => (c.id === id ? cloud(false) : c)));
</script>

<svelte:window bind:innerWidth={vw} bind:innerHeight={vh} />

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="splash" class:ready onclick={start}>
	<div
		class="splash-sky"
		aria-hidden="true"
		style={`width:${SKY.w}px;height:${SKY.h}px;transform:translate(-50%,-50%) scale(${skyScale})`}
	>
		<img class="sky-bg" src="/splash/sky-bg.webp" alt="" />
		{#each domes as d (d.node)}
			<div
				class="dome"
				style={`left:${d.x}px;top:${d.y}px;width:${d.size}px;height:${d.size}px;--ox:${d.ox}px;--oy:${d.oy}px;--c:${d.color}`}
			>
				<img class={d.phase} src={d.src} alt="" />
				{#if d.phase === 'blow' || d.phase === 'burst'}
					{#key d.n}
						<span class="dome-burst" class:now={d.phase === 'burst'}>
							<span class="dome-ring"></span>
							{#each d.drops as p}<span
									class="dome-drop"
									style={`--dx:${p.dx.toFixed(1)}px;--dy:${p.dy.toFixed(1)}px;width:${p.s.toFixed(1)}px;height:${p.s.toFixed(1)}px`}
								></span>{/each}
						</span>
					{/key}
				{/if}
			</div>
		{/each}
		<!-- Islands 11174:5015 / 11174:5016; the baked blur margin is outside the art box. -->
		<img class="island" src="/splash/island.webp" alt="" style="left:131px;top:39px;width:105px" />
		<img
			class="island island-2"
			src="/splash/island.webp"
			alt=""
			style="left:996px;top:142px;width:90px"
		/>
		{#each clouds as c (c.id)}
			<div
				class="cloud"
				style={`top:${c.y.toFixed(0)}px;--w:${c.w.toFixed(0)}px;animation-duration:${c.dur.toFixed(1)}s;animation-delay:${c.delay.toFixed(1)}s`}
				onanimationend={(e) => e.target === e.currentTarget && respawn(c.id)}
			>
				<img
					src={c.far ? '/splash/cloud-far.webp' : '/splash/cloud.webp'}
					alt=""
					style={`opacity:${c.alpha.toFixed(2)};animation-delay:${(-c.dur * 0.37).toFixed(1)}s`}
				/>
			</div>
		{/each}
	</div>
	<div
		class="splash-fit"
		class:portrait
		style={`width:${stage.w}px;height:${stage.h}px;transform:translate(-50%,-50%) scale(${scale})`}
	>
		<section class="splash-stage" role="dialog" aria-modal="true" aria-label="Blob Split">
			<div class="studio-badge" aria-hidden="true">
				<img class="studio-mark" src="/splash/studio-mark.svg" alt="" /><img
					class="studio-word"
					src="/splash/studio-word.svg"
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
				<img class="card-frame" src="/splash/panel.webp" alt="" />
				<h2 class="card-title green">BONUS<br />GAMES</h2>
				<ul class="tiers">
					<li><b>3</b> scatters for<em class="first">Gravity Breach</em></li>
					<li><b>4</b> scatters for<em>Core Overload</em></li>
					<li><b>5</b> scatters for<em>Zero Point Protocol</em></li>
				</ul>
			</div>

			<div class="card card-2" class:active={slide === 1}>
				<img class="card-frame" src="/splash/panel.webp" alt="" />
				<h2 class="card-title pink polarity">Polarity Shifter</h2>
				<div class="egg" aria-hidden="true"><div class="egg-body"><img src="/splash/egg.webp" alt="" /></div></div>
				<p class="card-copy">Slams all symbols toward one wall — Left, Right, Up, or Down!</p>
			</div>

			<div class="card card-3" class:active={slide === 2}>
				<span class="peeker peek-pink" aria-hidden="true"
					><span class="peek-face"><Blob symbol="STRAWBERRY" uid="peek-pink" /></span></span
				>
				<span class="peeker peek-purple" aria-hidden="true"
					><span class="peek-face"><Blob symbol="GRAPES" uid="peek-purple" /></span></span
				>
				<img class="card-frame" src="/splash/panel.webp" alt="" />
				<h2 class="card-title yellow maxwin">MAX<br />WIN</h2>
				<p class="max-line upto">up to</p>
				<strong class="max-big">20'000X</strong>
				<p class="max-line multiplier">multiplier</p>
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
	.sky-bg {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		animation: splash-shake 0.6s 0.72s both;
	}
	.dome {
		position: absolute;
	}
	.dome img {
		display: block;
		width: 100%;
		height: 100%;
		transform-origin: var(--ox) var(--oy);
	}
	.dome img.wait {
		opacity: 0;
	}
	.dome img.blow {
		animation: dome-blow 0.95s both;
	}
	.dome img.burst {
		animation: dome-pop 0.32s ease-in forwards;
	}
	/* Droplets fly at the blow-up's pop (54% of dome-blow) or right away on a burst. */
	.dome-burst {
		--pd: 0.5s;
	}
	.dome-burst.now {
		--pd: 0s;
	}
	.dome-ring,
	.dome-drop {
		position: absolute;
		left: var(--ox);
		top: calc(var(--oy) * 0.55);
		border-radius: 50%;
		pointer-events: none;
	}
	.dome-ring {
		width: 40%;
		aspect-ratio: 1;
		border: 3px solid color-mix(in srgb, var(--c), white 45%);
		translate: -50% -50%;
		animation: dome-ring 0.5s ease-out var(--pd) both;
	}
	.dome-drop {
		background: radial-gradient(circle at 35% 30%, #fffc 0 18%, var(--c) 30%);
		translate: -50% -50%;
		animation: dome-drop 0.75s cubic-bezier(0.2, 0.6, 0.4, 1) var(--pd) both;
	}
	.island {
		position: absolute;
		animation: island-bob 6.4s ease-in-out infinite;
	}
	.island-2 {
		animation-duration: 7.6s;
		animation-delay: -3.1s;
	}
	.cloud {
		position: absolute;
		left: 0;
		width: var(--w);
		animation: cloud-drift linear both;
	}
	.cloud img {
		display: block;
		width: 100%;
		transform-origin: 50% 80%;
		animation: cloud-breathe 11s ease-in-out infinite;
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
		animation: splash-shake 0.6s 0.72s both;
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
		animation: logo-drop 1.05s 0.15s both;
	}

	/* Cards: 273×410 frames; every child is placed at its Figma offset from the card. */
	.card {
		position: absolute;
		width: 273px;
		height: 410px;
	}
	.card-1 {
		left: 183px;
		top: 250px;
	}
	.card-2 {
		left: 464px;
		top: 250px;
	}
	.card-3 {
		left: 748px;
		top: 248px;
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
		color: #94f051;
	}
	.card-title.pink {
		left: 136px;
		width: 236px;
		color: #f782fe;
		text-transform: uppercase;
	}
	.card-title.yellow {
		left: 136.5px;
		width: 115px;
		color: #fece06;
	}
	.tiers {
		left: 137px;
		top: 153px;
		width: 226px;
		padding: 0;
		list-style: none;
		display: grid;
		gap: 9px;
		color: #d7d7d7;
		font-size: 17.707px;
		letter-spacing: 0.62px;
	}
	.tiers li {
		line-height: 1.12;
	}
	.tiers b {
		font-weight: 400;
		font-size: 25.085px;
		color: #f782fe;
	}
	.tiers em {
		display: block;
		font-style: normal;
		font-size: 16px;
		letter-spacing: 0.48px;
		text-transform: uppercase;
		color: #fdcd06;
		white-space: nowrap;
	}
	/* Figma's first tier row is taller (37px name offset vs 28px for the others). */
	.tiers em.first {
		margin: 9px 0 7px;
	}
	.egg {
		left: 136.5px;
		top: 155px;
		width: 89px;
		height: 97px;
	}
	.egg-body {
		position: absolute;
		inset: 0;
		overflow: hidden;
		transform-origin: 50% 90%;
		animation: egg-breathe 3.2s ease-in-out infinite;
	}
	.egg img {
		position: absolute;
		left: -8.64%;
		top: 0;
		width: 108.64%;
		height: 100%;
	}
	.card-copy {
		left: 136.5px;
		top: 274px;
		width: 215px;
		font-size: 16px;
		letter-spacing: 0.48px;
		line-height: 1.1;
		color: #fff;
	}
	.max-line {
		width: 140px;
		font-size: 20px;
		letter-spacing: 0.6px;
		line-height: 1.1;
		color: #fff;
	}
	.upto {
		left: 133.5px;
		top: 166px;
	}
	.multiplier {
		left: 135px;
		top: 318px;
	}
	.max-big {
		left: 137px;
		top: 230px;
		width: 200px;
		font-weight: 400;
		font-size: 40px;
		letter-spacing: 1.2px;
		line-height: 1.1;
		color: #f782fe;
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
		top: 44px;
	}
	.portrait .card {
		left: 95px;
		top: 318px;
		transform: scale(1.5);
		transform-origin: 0 0;
		display: none;
	}
	.portrait .card.active {
		display: block;
		animation: card-in 0.45s ease-out both;
	}
	.portrait .splash-action {
		top: 972px;
		width: 560px;
	}

	@keyframes card-in {
		from {
			opacity: 0;
			translate: 0 18px;
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
	/* Bubble blowing up from the ground: inflates past full size, pops into a squash, jiggles. */
	@keyframes dome-blow {
		0% {
			opacity: 0;
			transform: scale(0.06, 0.03);
			animation-timing-function: cubic-bezier(0.25, 0.6, 0.4, 1);
		}
		10% {
			opacity: 1;
		}
		54% {
			transform: scale(1.14, 1.2);
			animation-timing-function: cubic-bezier(0.5, 0, 0.6, 1);
		}
		66% {
			transform: scale(1.2, 0.84);
		}
		78% {
			transform: scale(0.94, 1.07);
		}
		89% {
			transform: scale(1.03, 0.97);
		}
		100% {
			opacity: 1;
			transform: none;
		}
	}
	/* Burst: a last stretch, then the skin is gone. */
	@keyframes dome-pop {
		0% {
			transform: none;
		}
		50% {
			opacity: 1;
			transform: scale(1.1, 1.14);
		}
		100% {
			opacity: 0;
			transform: scale(1.35, 1.2);
		}
	}
	@keyframes dome-ring {
		from {
			opacity: 0.9;
			transform: scale(0.3);
		}
		to {
			opacity: 0;
			transform: scale(2.4);
		}
	}
	@keyframes dome-drop {
		0% {
			opacity: 0;
			transform: none;
		}
		12% {
			opacity: 1;
		}
		70% {
			opacity: 1;
			transform: translate(var(--dx), var(--dy)) scale(1);
		}
		100% {
			opacity: 0;
			transform: translate(calc(var(--dx) * 1.1), calc(var(--dy) + 18px)) scale(0.4);
		}
	}
	@keyframes cloud-drift {
		from {
			transform: translateX(calc(-1 * var(--w) - 40px));
		}
		to {
			transform: translateX(1240px);
		}
	}
	/* Clouds slowly swell and rise a touch, so they don't read as stickers sliding. */
	@keyframes cloud-breathe {
		50% {
			transform: translateY(-4px) scale(1.05, 1.03);
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
	@media (prefers-reduced-motion: reduce) {
		.peeker {
			transform: none;
		}
	}
</style>
