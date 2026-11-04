<script lang="ts" module>
	/** When the build-up has landed (the prize is up), at pace 1; the card then waits for a press. */
	export const CARD_BUILD_MS = 2150;
	export type CardKind = 'mystery' | 'end';
</script>

<script lang="ts">
	// The bonus cards, on the 1200×670 stage:
	//   mystery  the bonus won or bought, Figma 11433:30053: the glossy pink jelly banner drops
	//            in, CONGRATULATIONS / YOU WON on it, the bonus's name and rule in a pink box and
	//            its spins beside it; the medallion rises behind it with the tiles' starting
	//            blobs ("Nx" and a tile split that far). Its balloons let go and float away.
	//            (The two blobs that peeked out from behind it were removed, user 2026-11-04.)
	//   end      the bonus total once the free spins finish, Figma 11428:18495 (user 2026-11-03:
	//            "make final congrats simpler"): a laughing blob, the title and the total in a
	//            pink box, nothing else.
	import { onMount } from 'svelte';
	import Blob from './Blob.svelte';
	let {
		kind,
		title,
		won,
		count = 10,
		sub,
		amount = '',
		total = 0,
		format,
		bonus = '',
		desc = '',
		blobs = 1,
		symbol = 'GRAPES',
		tier = '',
		pace = 1,
		prompt = '',
		onskip,
	}: {
		kind: CardKind;
		title: string;
		won: string;
		/** Free spins awarded (mystery; the end card shows none). */
		count?: number;
		/** "Free spins". */
		sub: string;
		/** end: the formatted total. */
		amount?: string;
		/** end: the total as a number and its formatter, to count it up as it rises; without
		 * them `amount` shows as is. */
		total?: number;
		format?: (v: number) => string;
		/** mystery: the bonus's name and rule line, and its starting blobs per tile. */
		bonus?: string;
		desc?: string;
		blobs?: number;
		symbol?: string;
		/** The bonus tier ('normal' | 'super' | 'hidden'): the mystery card's palette and backdrop. */
		tier?: string;
		pace?: number;
		/** A line at the bottom once the card has built up ("Press to continue"). */
		prompt?: string;
		onskip?: () => void;
	} = $props();

	let vw = $state(1200);
	let vh = $state(670);
	// Landscape shows the stage at 80%, so the game stays visible round the card; the small
	// popout (vh ≤ 340) shows it whole, or its copy drops under 9px. A tall screen fits the
	// card's own width (the banner and its balloons; the end card's title) to 96% of the width.
	const CARD_SCALE = 0.8;
	const SPAN = { mystery: 1080, end: 620 };
	let fit = $derived(
		vw < vh
			? Math.min((0.96 * vw) / SPAN[kind], vh / 670)
			: Math.min(vw / 1200, vh / 670) * (vh <= 340 ? 1 : CARD_SCALE),
	);
	// The smallest copy (the rule line, the medal's pill) never goes under this on screen: its
	// design size, in stage px, at this fit.
	let minText = $derived(9.5 / fit);
	// The prompt sits just under the card (the banner's opaque foot, the total's box), sized
	// with the card, at most ~70% of the width, and on screen whatever the card's height.
	const BOTTOM = { mystery: 573, end: 468 };
	let promptSize = $derived(Math.max(9.5, Math.min(34 * fit, 0.033 * vw, 32)));
	let promptTop = $derived(Math.min(vh - promptSize * 1.9 - 6, vh / 2 + (BOTTOM[kind] - 335) * fit + 12));

	// Coiny lines that must hold their box in every language: the design's size, shrunk when the
	// text is longer than the design's (its caps run ~0.77em a glyph, digits ~0.6em).
	const fitFont = (text: string, size: number, width: number, em = 0.77) =>
		`font-size:${Math.min(size, width / (Math.max(1, text.length) * em)).toFixed(1)}px`;

	const px = ([l, t, w, h]: number[]) => `left:${l}px;top:${t}px;width:${w}px;height:${h}px`;
	// The design's purple bubbles round the banner (11433:30289-30296) and its two jelly
	// clovers on it (11433:30479/30480).
	const BUBBLE = './win/hd/bubble.webp';
	const BUBBLES = [
		[36, 19, 50, 42],
		[149, 41, 85, 71],
		[24, 172, 50, 42],
		[247, 157, 50, 42],
		[804, 93, 50, 42],
		[966, 73, 50, 42],
		[1075, 26, 85, 71],
		[1119, 176, 50, 42],
	];
	// The bubbles are party balloons (user 2026-11-04 "make the ballons ... more cool"): each
	// wears a little blob face and trails a string from a knot, in the blobs' colours (the
	// purple art hue-shifted; the big two stay the design's purple and pink).
	const TINTS = [
		'hue-rotate(55deg) saturate(1.1)',
		'none',
		'hue-rotate(-95deg) saturate(1.1)',
		'hue-rotate(150deg) saturate(1.35) brightness(1.3)',
		'hue-rotate(-40deg)',
		'hue-rotate(-160deg) saturate(1.2) brightness(1.1)',
		'hue-rotate(55deg) saturate(1.1)',
		'hue-rotate(125deg) saturate(1.3) brightness(1.2)',
	];
	const CLOVERS = [
		[217, 334.69, 73.3, 71.82, -8],
		[684.85, 459.23, 67.02, 65.66, 14],
	];
	// Released balloons (user 2026-11-04 "make the ballons fly away", "they should start from
	// start flying"): each floats up off the top from the moment it pops in (fs-pop's own delay),
	// drifting aside; from then on it keeps rising up through the stage from under its foot.
	// Scripted (element.animate on `translate`), so it sits over the CSS bob and keeps the sway.
	function release(el: HTMLImageElement, i: number) {
		if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		const [, y, , h] = BUBBLES[i];
		const up = y + h + 60;
		const down = 670 - y + 40;
		const dx = (i % 2 ? 1 : -1) * (30 + ((i * 37) % 50));
		const away = el.animate([{ translate: '0 0' }, { translate: `${dx}px ${-up}px` }], {
			duration: (2400 + i * 260) * pace,
			delay: (250 + i * 90) * pace,
			easing: 'cubic-bezier(0.3, 0.2, 0.7, 0.8)',
			fill: 'forwards',
		});
		away.finished
			.then(() => {
				el.animate([{ translate: `${-dx * 0.5}px ${down}px` }, { translate: `${dx}px ${-up}px` }], {
					duration: 7000 + i * 650,
					iterations: Infinity,
				});
				away.cancel();
			})
			.catch(() => {});
	}

	// When the card closes the balloons pop where they are, one after another (the wrapper's
	// fade alone left them hanging in place). On `transform`, which nothing else animates on
	// them, so it adds to the running rise and sway.
	const popOut = (node: HTMLElement, i: number) => ({
		delay: i * 28,
		duration: 190,
		tick: (t: number) => {
			const u = 1 - t;
			node.style.transform = `scale(${1 + 0.45 * u}, ${1 + 0.3 * u})`;
			node.style.opacity = String(Math.min(1, t * 1.8));
		},
	});

	// The medallion's tile starts as one blob and splits into the tier's starting blobs once
	// the medal is up: the card shows the bonus's rule happening, not just its number.
	const MEDAL_SPLIT_MS = 1500;
	// end: the total counts up fast from when its box rises, easing out, then pulses once and
	// keeps breathing until the press.
	const COUNT_AT_MS = 950;
	const COUNT_MS = 750;
	let shown = $state(0);
	let counted = $state(false);
	let totalText = $derived(format && total > 0 ? format(counted ? total : shown) : amount);
	let medalUnits = $state(1);
	// Super's rays and Hidden's night sky: seeded once per card.
	const rand = (a: number, b: number) => a + Math.random() * (b - a);
	const STARS = Array.from({ length: 18 }, () => ({
		x: rand(40, 1160),
		y: rand(10, 640),
		s: rand(6, 16),
		d: rand(0, 2.4),
		t: rand(1.4, 2.6),
	}));

	onMount(() => {
		if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
			medalUnits = blobs;
			counted = true;
			return;
		}
		const timers = new Set<ReturnType<typeof setTimeout>>();
		const later = (ms: number, fn: () => void) => {
			const t = setTimeout(() => (timers.delete(t), fn()), ms * pace);
			timers.add(t);
		};
		if (kind === 'mystery' && blobs > 1) later(MEDAL_SPLIT_MS, () => (medalUnits = blobs));
		let raf = 0;
		if (kind === 'end')
			later(COUNT_AT_MS, () => {
				const t0 = performance.now();
				raf = requestAnimationFrame(function step(now) {
					const t = Math.min(1, (now - t0) / (COUNT_MS * pace));
					shown = total * (1 - (1 - t) ** 3);
					if (t < 1) raf = requestAnimationFrame(step);
					else counted = true;
				});
			});
		return () => {
			timers.forEach(clearTimeout);
			cancelAnimationFrame(raf);
		};
	});
</script>

<svelte:window bind:innerWidth={vw} bind:innerHeight={vh} />

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class={`bonus-card ${kind} ${tier ? `t-${tier}` : ''}`} style={`--p:${pace};--min:${minText.toFixed(1)}px`} onclick={onskip}>
	<div class="dim"></div>
	<div class="frame" style={`transform:translate(-50%,-50%) scale(${fit})`}>
		{#if kind === 'mystery'}
			{#if tier === 'super'}<div class="rays"></div>{/if}
			{#if tier === 'hidden'}
				{#each STARS as st}<i
						class="star"
						style={`left:${st.x.toFixed(0)}px;top:${st.y.toFixed(0)}px;--s:${st.s.toFixed(1)}px;--d:${st.d.toFixed(2)}s;--t:${st.t.toFixed(2)}s`}
					></i>{/each}
			{/if}
			{#each BUBBLES as box, i}
				<div use:release={i} out:popOut|global={i} class="balloon" style={`${px(box)};--i:${i};filter:${TINTS[i]}`}>
					<svg class="string" viewBox="0 0 14 100" preserveAspectRatio="none" aria-hidden="true"
						><path d="M7 0 C1 16 13 30 7 48 S1 80 7 100" /></svg
					>
					<span class="knot"></span>
					<img src={BUBBLE} alt="" />
					<!-- A blob's face, in the art's 700x580 box (the ball is centred at 350,295). -->
					<svg class="face" viewBox="0 0 700 580" aria-hidden="true">
						<ellipse class="cheek" cx="236" cy="352" rx="34" ry="19" />
						<ellipse class="cheek" cx="464" cy="352" rx="34" ry="19" />
						<g class="eyes">
							<ellipse cx="292" cy="290" rx="24" ry="33" />
							<ellipse cx="408" cy="290" rx="24" ry="33" />
							<circle class="hi" cx="284" cy="278" r="9" />
							<circle class="hi" cx="400" cy="278" r="9" />
						</g>
						<path class="smile" d="M310 352 Q350 392 390 352" />
					</svg>
				</div>
			{/each}
			<!-- Behind the banner: the medallion rises out of its top. -->
			<div class="medal">
				<img src="./freespins/medal-pink.svg" alt="" width="170.6" height="170.6" />
				<span class="medal-pill">{blobs}x</span>
				<span class="medal-blob"><Blob {symbol} units={medalUnits} uid="card-medal" /></span>
			</div>
			<div class="banner"><img src="./win/pink-blob.webp" alt="" width="1021" height="510" /></div>
			<div class="heading">
				<strong style={fitFont(title, 48, 589)}>{title}</strong>
				<span>{won}</span>
			</div>
			<div class="bonus-box">
				<b style={fitFont(bonus, 35.19, 399)}>{bonus}</b>
				<p>{desc}</p>
			</div>
			<div class="spins">
				<b style={fitFont(String(count), 150, 230, 0.62)}>{count}</b>
				<span>{sub}</span>
			</div>
			{#each CLOVERS as [l, t, w, h, r], i}
				<img class="clover" src="./freespins/clover.webp" alt="" style={`${px([l, t, w, h])};--r:${r}deg;--i:${i}`} />
			{/each}
		{:else}
			<div class="mascot"><Blob symbol="GRAPES" uid="card-mascot" cheer /></div>
			<div class="heading">
				<strong style={fitFont(title, 48, 589)}>{title}</strong>
				<span>{won}</span>
			</div>
			<div class="total-box">
				<span class="total" class:counted style={fitFont(totalText, 63.52, 480, 0.6)}>{totalText}</span>
			</div>
		{/if}
	</div>
	{#if prompt}<p class="prompt" style={`top:${promptTop.toFixed(0)}px;font-size:${promptSize.toFixed(1)}px`}>{prompt}</p>{/if}
</div>

<style>
	/* Timeline (ms at pace 1). mystery: dim 0-300, bubbles pop 250-1000, banner drops 150-850,
	   medal rises 650-1200 (its tile splits at 1500), balloons rise from their pop, heading
	   800-1300, bonus box 1000-1550, spins 1250-1800, clovers 1300-1700. end: mascot drops
	   150-800, heading 450-950, total box 700-1250, counting 950-1700. App holds the card until
	   a press and fades it out. */
	.bonus-card {
		position: fixed;
		inset: 0;
		z-index: 45;
		cursor: pointer;
	}
	.dim {
		position: absolute;
		inset: 0;
		background: #000a;
		animation: fs-fade calc(300ms * var(--p)) both;
	}
	@keyframes fs-fade {
		from {
			opacity: 0;
		}
	}
	/* Just under the card (top and size from the script); rises in once the prize is up
	   (CARD_BUILD_MS), then breathes so it reads as waiting for the player. */
	.prompt {
		position: absolute;
		left: 50%;
		margin: 0;
		padding: 0.5em 1.2em 0.4em;
		border-radius: 999px;
		/* A dark capsule, so it never reads as one of the HUD's labels. */
		background: #1a0f3fe6;
		box-shadow:
			inset 0 0 0 2px #8b6cf0,
			0 6px 20px #0009;
		translate: -50% 0;
		font-family: 'Coiny', sans-serif;
		line-height: 1;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		white-space: nowrap;
		color: #fff;
		text-shadow:
			0 3px 0 #3b2380,
			0 0 18px #f782fe;
		animation:
			prompt-in 400ms ease-out calc(2150ms * var(--p)) both,
			prompt-pulse 1.4s ease-in-out calc(2550ms * var(--p)) infinite;
	}
	@keyframes prompt-in {
		from {
			opacity: 0;
			transform: translateY(16px);
		}
	}
	@keyframes prompt-pulse {
		50% {
			opacity: 0.55;
			transform: scale(0.96);
		}
	}
	.frame {
		position: absolute;
		left: 50%;
		top: 50%;
		width: 1200px;
		height: 670px;
	}
	.frame > * {
		position: absolute;
	}
	img {
		display: block;
	}

	/* The design's copy: white, with its soft 2.78px drop. */
	.heading,
	.bonus-box,
	.spins,
	.total-box {
		font-family: 'Coiny', sans-serif;
		text-align: center;
		color: #fff;
		text-shadow: 0 2.78px 2.78px rgb(0 0 0 / 0.25);
		text-transform: uppercase;
		pointer-events: none;
	}
	.bonus-box p {
		text-transform: none;
	}
	/* 11433:30304 (mystery) / 11428:18717 (end): 589 wide; CONGRATULATIONS over YOU WON. */
	.heading {
		left: 325px;
		top: 247px;
		width: 589px;
		display: grid;
		justify-items: center;
		white-space: nowrap;
		animation: fs-pop-in calc(500ms * var(--p)) cubic-bezier(0.3, 1.5, 0.5, 1) calc(800ms * var(--p)) both;
	}
	.heading strong {
		font-weight: 400;
		line-height: 53px;
		letter-spacing: 0.03em;
	}
	.heading span {
		font: 700 max(24px, var(--min)) / 36px 'Poppins', sans-serif;
		letter-spacing: 0.72px;
	}
	@keyframes fs-pop-in {
		from {
			opacity: 0;
			transform: scale(0.4);
		}
		40% {
			opacity: 1;
		}
	}
	@keyframes fs-rise {
		from {
			opacity: 0;
			transform: translateY(70px) scale(0.85);
		}
		40% {
			opacity: 1;
		}
	}

	/* The banner (11433:30303, the small win's pink blob at 1021×510) drops in from above and
	   lands with a jelly squash, then keeps a slow wobble. */
	.banner {
		left: 89px;
		top: 102px;
		width: 1021px;
		height: 510px;
		transform-origin: 50% 90%;
		animation:
			fs-drop calc(700ms * var(--p)) cubic-bezier(0.3, 1.3, 0.5, 1) calc(150ms * var(--p)) both,
			fs-wobble 3.2s ease-in-out calc(900ms * var(--p)) infinite;
	}
	.banner img {
		width: 100%;
		height: 100%;
	}
	@keyframes fs-drop {
		0% {
			transform: translateY(-760px);
		}
		60% {
			transform: translateY(14px) scale(1.05, 0.93);
		}
		80% {
			transform: translateY(-4px) scale(0.98, 1.03);
		}
		100% {
			transform: none;
		}
	}
	@keyframes fs-wobble {
		0%,
		100% {
			transform: none;
		}
		50% {
			transform: scale(1.012, 0.988);
		}
	}

	/* 11433:30308: the bonus's name and rule in a frosted pink box. */
	.bonus-box {
		box-sizing: border-box;
		left: 238px;
		top: 346px;
		width: 484px;
		min-height: 146px;
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 7.72px;
		padding: 15.45px 23.17px;
		border: 1.93px solid #fa3a93;
		border-radius: 23.17px;
		background: rgb(255 168 207 / 0.6);
		animation: fs-rise calc(550ms * var(--p)) cubic-bezier(0.3, 1.4, 0.5, 1) calc(1000ms * var(--p)) both;
	}
	.bonus-box b {
		font-weight: 400;
		line-height: normal;
		letter-spacing: 0.03em;
		white-space: nowrap;
	}
	.bonus-box p {
		margin: 0;
		font: 400 max(15.45px, var(--min)) / 1.3 'Poppins', sans-serif;
		letter-spacing: 0.46px;
	}
	/* The spins: the design's "10" (11433:30312, 176×112 at 759,344) and "free spins" under it. */
	.spins {
		left: 732px;
		top: 336px;
		width: 230px;
		display: grid;
		justify-items: center;
	}
	.spins b {
		font-weight: 400;
		line-height: 128px;
		animation:
			fs-count-pop calc(600ms * var(--p)) cubic-bezier(0.3, 1.7, 0.5, 1) calc(1250ms * var(--p)) both,
			fs-breathe 1.6s ease-in-out calc(1850ms * var(--p)) infinite alternate;
	}
	.spins span {
		margin-top: -4px;
		font: 700 max(24px, var(--min)) / 36px 'Poppins', sans-serif;
		letter-spacing: 0.72px;
		text-transform: lowercase;
		white-space: nowrap;
		animation: fs-rise calc(450ms * var(--p)) cubic-bezier(0.3, 1.4, 0.5, 1) calc(1450ms * var(--p)) both;
	}
	@keyframes fs-count-pop {
		from {
			opacity: 0;
			transform: scale(0.2);
		}
		45% {
			opacity: 1;
			transform: scale(1.15, 0.9);
		}
		70% {
			transform: scale(0.96, 1.05);
		}
	}
	@keyframes fs-breathe {
		to {
			transform: scale(1.05);
		}
	}

	/* 11433:30280: the 170.6 ring at (548, 66), the "Nx" pill at (567, 127) and the tile's blob
	   box (609, 108) 92×80; it rises out from behind the banner's top. */
	.medal {
		left: 548px;
		top: 66px;
		width: 170.6px;
		height: 170.6px;
		animation: fs-medal calc(550ms * var(--p)) cubic-bezier(0.3, 1.6, 0.5, 1) calc(650ms * var(--p)) both;
	}
	.medal > img {
		width: 100%;
		height: 100%;
	}
	@keyframes fs-medal {
		from {
			opacity: 0;
			transform: translateY(110px) scale(0.6);
		}
		30% {
			opacity: 1;
		}
	}
	.medal-pill {
		position: absolute;
		left: 19.26px;
		top: 61.34px;
		padding: 6px 8.5px 4px;
		border: 1.42px solid #4b3981;
		border-radius: 12.78px;
		background: #23dcd6;
		font: 400 max(19.88px, var(--min)) / normal 'Coiny', sans-serif;
		letter-spacing: 0.6px;
		color: #502da0;
	}
	.medal-blob {
		position: absolute;
		left: 66px;
		top: 40px;
		width: 90px;
		height: 90px;
		--divide-ms: calc(1100ms * var(--p));
		animation: fs-bob 2.4s ease-in-out infinite;
	}
	@keyframes fs-bob {
		50% {
			translate: 0 -7px;
		}
	}

	/* The design's bubbles, as balloons: they pop in on their spots and bob and sway (release()
	   then floats them away), the string swinging under the knot and the face blinking. */
	.balloon {
		animation:
			fs-pop calc(450ms * var(--p)) cubic-bezier(0.3, 1.6, 0.5, 1) calc((250ms + var(--i) * 90ms) * var(--p)) both,
			fs-float calc(2.4s + var(--i) * 0.27s) ease-in-out calc(var(--i) * -0.8s) infinite,
			fs-sway calc(1.9s + var(--i) * 0.2s) ease-in-out calc(var(--i) * -0.7s) infinite;
	}
	@keyframes fs-pop {
		from {
			scale: 0;
		}
	}
	@keyframes fs-float {
		50% {
			translate: 0 -12px;
		}
	}
	@keyframes fs-sway {
		0%,
		100% {
			rotate: -6deg;
		}
		50% {
			rotate: 6deg;
		}
	}
	.balloon > * {
		position: absolute;
	}
	.balloon img {
		inset: 0;
		width: 100%;
		height: 100%;
	}
	.balloon .face {
		inset: 0;
		width: 100%;
		height: 100%;
	}
	.face .eyes {
		fill: #2a0b5c;
		transform-box: fill-box;
		transform-origin: center;
		animation: fs-blink calc(3.2s + var(--i) * 0.45s) calc(var(--i) * -0.9s) infinite;
	}
	.face .hi {
		fill: #fff;
	}
	.face .cheek {
		fill: #ff86cf;
		opacity: 0.55;
	}
	.face .smile {
		fill: none;
		stroke: #2a0b5c;
		stroke-width: 15;
		stroke-linecap: round;
	}
	@keyframes fs-blink {
		0%,
		93%,
		100% {
			scale: 1;
		}
		96.5% {
			scale: 1 0.12;
		}
	}
	/* The knot under the ball (it sits at 90% of the art's height) and the string from it. */
	.knot {
		left: calc(50% - 5px);
		top: calc(89% - 2px);
		width: 10px;
		height: 8px;
		background: #6a26d8;
		clip-path: polygon(50% 0, 100% 100%, 0 100%);
	}
	.string {
		left: calc(50% - 7px);
		top: calc(89% + 5px);
		width: 14px;
		height: 160%;
		overflow: visible;
		transform-origin: 50% 0;
		animation: fs-string calc(1.5s + var(--i) * 0.17s) ease-in-out calc(var(--i) * -0.6s) infinite alternate;
	}
	.string path {
		fill: none;
		stroke: #ffffffc0;
		stroke-width: 1.6;
		vector-effect: non-scaling-stroke;
	}
	@keyframes fs-string {
		from {
			rotate: -9deg;
			scale: 1 1;
		}
		to {
			rotate: 9deg;
			scale: 1 0.96;
		}
	}
	/* The jelly clovers stuck on the banner: pop on, then a slow jiggle. */
	.clover {
		rotate: var(--r);
		animation:
			fs-pop calc(400ms * var(--p)) cubic-bezier(0.3, 1.8, 0.5, 1) calc((1300ms + var(--i) * 180ms) * var(--p)) both,
			fs-jiggle calc(2.2s + var(--i) * 0.5s) ease-in-out calc(1700ms * var(--p)) infinite;
	}
	@keyframes fs-jiggle {
		0%,
		100% {
			transform: none;
		}
		30% {
			transform: scale(1.08, 0.93) rotate(-6deg);
		}
		60% {
			transform: scale(0.95, 1.06) rotate(5deg);
		}
	}

	/* end (11428:18495): the laughing antennae blob (11428:18722, its body 103.8×101.6 at
	   546.8, 120.4) over the heading at (306, 234) and the total's box (350, 346) 520×122. */
	.mascot {
		left: 533px;
		top: 102px;
		width: 132px;
		height: 132px;
		animation: fs-drop calc(650ms * var(--p)) cubic-bezier(0.3, 1.3, 0.5, 1) calc(150ms * var(--p)) both;
	}
	.end .heading {
		left: 306px;
		top: 234px;
		animation-delay: calc(450ms * var(--p));
	}
	.total-box {
		left: 350px;
		top: 346px;
		width: 520px;
		height: 122px;
		display: grid;
		place-items: center;
		border-radius: 24px;
		background: #fb73b1;
		animation: fs-rise calc(550ms * var(--p)) cubic-bezier(0.3, 1.4, 0.5, 1) calc(700ms * var(--p)) both;
	}
	.total {
		line-height: 1;
		letter-spacing: 0.03em;
		white-space: nowrap;
	}
	/* Counted: one pop as it lands, then a slow, slight breath while it waits for the press. */
	.total.counted {
		animation:
			fs-total-pop 420ms cubic-bezier(0.3, 1.6, 0.5, 1) both,
			fs-breathe 1.6s ease-in-out 420ms infinite alternate;
	}
	@keyframes fs-total-pop {
		40% {
			transform: scale(1.12);
		}
	}

	/* Each bonus tier opens in its own colours: Normal is the design's pink, Super sunset gold
	   under turning rays (sepia first: a plain hue turn splits the pink's shading in two),
	   Hidden violet on a night sky with twinkling stars. */
	.t-super :is(.banner, .clover) {
		filter: sepia(1) saturate(3.4) hue-rotate(8deg) brightness(1.04);
	}
	.t-hidden :is(.banner, .clover) {
		filter: hue-rotate(-62deg) saturate(1.1);
	}
	.t-super .bonus-box {
		border-color: #e08a12;
		background: rgb(255 214 120 / 0.55);
	}
	.t-hidden .bonus-box {
		border-color: #8a3ff0;
		background: rgb(196 160 255 / 0.55);
	}
	.t-super .medal-pill {
		background: #ffc24d;
		color: #6b3a0e;
		border-color: #6b3a0e;
	}
	.t-hidden .medal-pill {
		background: #ff7ae0;
		color: #3b1470;
		border-color: #3b1470;
	}
	.mystery.t-hidden .dim {
		background: radial-gradient(120% 90% at 50% 45%, #1a0b3dcc, #05021aee);
	}
	.rays {
		left: 600px;
		top: 300px;
		width: 1500px;
		height: 1500px;
		margin: -750px 0 0 -750px;
		border-radius: 50%;
		background: repeating-conic-gradient(#ffd36a33 0deg 7deg, #ffd36a00 7deg 20deg);
		mask-image: radial-gradient(closest-side, #000 18%, #0000 72%);
		animation:
			fs-fade calc(600ms * var(--p)) calc(300ms * var(--p)) both,
			rays-turn 24s linear infinite;
	}
	@keyframes rays-turn {
		to {
			rotate: 360deg;
		}
	}
	.star {
		width: var(--s);
		height: var(--s);
		margin: calc(var(--s) / -2) 0 0 calc(var(--s) / -2);
		background: radial-gradient(closest-side, #fff, #ffd9ff 30%, #ff8ae600 70%);
		clip-path: polygon(50% 0, 60% 40%, 100% 50%, 60% 60%, 50% 100%, 40% 60%, 0 50%, 40% 40%);
		animation:
			fs-fade calc(500ms * var(--p)) calc(400ms * var(--p)) both,
			star-twinkle var(--t) ease-in-out var(--d) infinite;
	}
	@keyframes star-twinkle {
		50% {
			opacity: 0.25;
			scale: 0.6;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.prompt,
		.string,
		.face .eyes {
			animation: none;
		}
		.rays,
		.star,
		.heading,
		.banner,
		.bonus-box,
		.spins b,
		.spins span,
		.medal,
		.medal-blob,
		.balloon,
		.clover,
		.mascot,
		.total-box,
		.total.counted {
			animation: fs-fade 300ms both;
		}
	}
</style>
