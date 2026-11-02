<script lang="ts" module>
	/** When the build-up has landed (the prize is up), at pace 1; the card then waits for a press. */
	export const CARD_BUILD_MS = 2150;
	export type CardKind = 'intro' | 'mystery' | 'end';
</script>

<script lang="ts">
	// The bonus cards, all on the 1200×670 stage: the neon badge zooms in, the glossy cloud
	// plaque drops onto it from the top, CONGRATULATIONS and YOU WON drop in after it and the
	// prize rises from the bottom. The design's bubbles bob in place, more fly out from behind
	// the cloud, and blobs peek out from behind the badge and the cloud, curious.
	//   intro    free spins awarded (Normal/Super), Figma 11233:12259
	//   mystery  the Mystery draw's result, Figma 11020:33134 (group 11233:12278): the bonus
	//            and its spins in two boxes, a medallion on top with the tiles' starting blobs
	//   end      the bonus total once the free spins finish, Figma 11233:12287
	import { onMount } from 'svelte';
	import Blob from './Blob.svelte';
	import JellyText from './JellyText.svelte';
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
		/** Free spins awarded (intro, mystery; the end card shows none). */
		count?: number;
		/** "Free spins". */
		sub: string;
		/** end: the formatted total. */
		amount?: string;
		/** end: the total as a number and its formatter, to count it up as it rises; without
		 * them `amount` shows as is. */
		total?: number;
		format?: (v: number) => string;
		/** mystery: the drawn bonus's name and rule line, and its starting blobs per tile. */
		bonus?: string;
		desc?: string;
		blobs?: number;
		symbol?: string;
		/** mystery: the bonus tier ('normal' | 'super' | 'hidden'): its palette and backdrop. */
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
	// badge's opaque width (its neon ends: 90.2% of its box) to 96% of the width instead, so
	// the card fills the width without running off the sides.
	const CARD_SCALE = 0.8;
	const BADGE_OPAQUE = 0.902;
	let fit = $derived(
		vw < vh
			? Math.min((0.96 * vw) / (LAYOUTS[kind].badge[2] * BADGE_OPAQUE), vh / 670)
			: Math.min(vw / 1200, vh / 670) * (vh <= 340 ? 1 : CARD_SCALE),
	);
	// The smallest copy (the Mystery rule line, the medal's pill, the labels) never goes under
	// this on screen: its design size, in stage px, at this fit.
	let minText = $derived(9.5 / fit);
	// The prompt sits just under the badge (its opaque bottom is 86.25% down its box), sized
	// with the card, at most ~70% of the width, and on screen whatever the card's height.
	let promptSize = $derived(Math.max(9.5, Math.min(34 * fit, 0.033 * vw, 32)));
	let promptTop = $derived(
		Math.min(
			vh - promptSize * 1.9 - 6,
			vh / 2 + (LAYOUTS[kind].badge[1] + LAYOUTS[kind].badge[3] * 0.8625 - 335) * fit + 4 + 8 * fit,
		),
	);

	// The design's boxes [left, top, width, height] on the stage. Each badge box is its frame
	// with the image overflowing it 13.14% upward, so the image box is used here.
	type Layout = { badge: number[]; cloud: number[]; bubbles: [string, number[], boolean][] };
	const PINK = './freespins/hd/pink-bubble.webp';
	const PURPLE = './win/hd/bubble.webp';
	// [src, box, front]: front ones sit over the badge, the rest behind it.
	const LAYOUTS: Record<CardKind, Layout> = {
		intro: {
			badge: [-6.5, 60, 1214, 607],
			cloud: [142, 122.67, 921.79, 461.24],
			bubbles: [
				[PINK, [710.68, 3.94, 394.86, 394.86], false],
				[PINK, [160.48, 3.94, 394.86, 394.86], false],
				[PURPLE, [268.6, 123.02, 165.61, 138.24], false],
				[PURPLE, [160.48, 155.18, 165.61, 138.24], false],
				[PURPLE, [924.19, 210.61, 143.71, 119.76], true],
			],
		},
		mystery: {
			badge: [-65, 32.18, 1324, 662],
			cloud: [96.95, 100.49, 1005.32, 503.03],
			bubbles: [
				[PINK, [717.16, -9, 430.64, 430.64], false],
				[PINK, [117.11, -9, 430.64, 430.64], false],
				[PURPLE, [235.03, 120.86, 180.61, 150.76], false],
				[PURPLE, [117.11, 155.94, 180.61, 150.76], false],
				[PURPLE, [950.02, 216.4, 156.73, 130.61], true],
			],
		},
		end: {
			badge: [-62, 35.18, 1324, 662],
			cloud: [99.95, 103.49, 1005.32, 503.03],
			bubbles: [
				[PINK, [720.16, -26, 430.64, 430.64], false],
				[PINK, [120.11, -26, 430.64, 430.64], false],
				[PURPLE, [238.03, 103.86, 180.61, 150.76], false],
				[PURPLE, [120.11, 138.94, 180.61, 150.76], false],
				[PURPLE, [953.02, 199.4, 156.73, 130.61], true],
			],
		},
	};
	// The Mystery frame's loose bubbles over everything (11020:33216-33221).
	const SKY_BUBBLES = [
		[29, 54, 117, 98],
		[1101, 37, 96, 80],
		[955, 79, 73, 61],
		[727, 56, 73, 61],
		[161, 110, 73, 61],
		[412, 14, 96, 80],
	];
	const L = $derived(LAYOUTS[kind]);
	// When the card closes the bubbles fly off out past their own side and up, fading, on
	// their own (the wrapper's fade alone left them hanging in place). Driven by left/top in a
	// tick, so it adds to their running CSS animations instead of replacing them.
	const vanish = (node: HTMLElement) => {
		const [x, y] = [node.offsetLeft, node.offsetTop];
		const side = x + node.offsetWidth / 2 < 600 ? -1 : 1;
		return {
			duration: 340,
			tick: (t: number) => {
				const u = (1 - t) * (1 - t);
				node.style.left = `${x + side * 520 * u}px`;
				node.style.top = `${y - 380 * u}px`;
				node.style.opacity = String(Math.min(1, t * 1.6));
			},
		};
	};
	const px = ([l, t, w, h]: number[]) => `left:${l}px;top:${t}px;width:${w}px;height:${h}px`;
	// Where a design bubble floats off to: out past its own side and up off the top of the
	// SCREEN. The stage is centred, so on a tall or wide screen its edges are inside the
	// screen's: the margin beyond them (in stage px) is added, or the bubbles stop in view.
	const away = ([l, t, w, h]: number[], i: number) => {
		const side = l + w / 2 < 600 ? -1 : 1;
		const mx = Math.max(0, vw / 2 / fit - 600);
		const my = Math.max(0, vh / 2 / fit - 335);
		return `--ax:${(side * (140 + ((i * 53) % 120) + mx)).toFixed(0)}px;--ay:${(-(t + h + 120 + my)).toFixed(0)}px`;
	};

	// Everything below was placed on the intro's cloud (centre 603, 353); the bigger clouds
	// scale it about their own centre.
	const C0 = { x: 603, y: 353, w: 921.79 };
	const fromIntro = (x: number, y: number) => {
		const [l, t, w, h] = LAYOUTS[kind].cloud;
		const k = w / C0.w;
		return { x: l + w / 2 + (x - C0.x) * k, y: t + h * 0.502 + (y - C0.y) * k, k };
	};

	const rand = (a: number, b: number) => a + Math.random() * (b - a);
	const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];

	// The design's bubbles start somewhere new every time the card shows: each takes a random
	// side of the badge (mirrored about the stage centre), a random offset from its design spot
	// and a slightly random size, then flies off from there. The Mystery card's loose sky
	// bubbles scatter along the top, clear of the medallion (x 500-710).
	const scatter = ([l, t, w, h]: number[]) => {
		const k = rand(0.8, 1.12);
		const cx = (Math.random() < 0.5 ? l + w / 2 : 1200 - (l + w / 2)) + rand(-0.25, 0.25) * w;
		const cy = t + h / 2 + rand(-0.18, 0.12) * h;
		return [cx - (w * k) / 2, cy - (h * k) / 2, w * k, h * k];
	};
	const skySpot = ([, , w, h]: number[]) => {
		const k = rand(0.75, 1.2);
		const x = Math.random() < 0.5 ? rand(10, 500 - w * k) : rand(710, 1190 - w * k);
		return [x, rand(0, 150), w * k, h * k];
	};
	// On the intro its copy pokes out over the cloud's shoulders: bubbles land clear of it (the
	// ball, not its canvas: the pink art's ball fills only 43% of it).
	const COPY = [280, 245, 920, 460];
	const onCopy = (src: string, [l, t, w, h]: number[]) => {
		const f = src === PINK ? 0.433 : 0.9;
		const [cx, cy, rx, ry] = [l + w / 2, t + h / 2, (w * f) / 2, (h * f) / 2];
		return kind === 'intro' && cx + rx > COPY[0] && cx - rx < COPY[2] && cy + ry > COPY[1] && cy - ry < COPY[3];
	};
	const place = (src: string, box: number[]) => {
		let b = scatter(box);
		for (let i = 0; i < 12 && onCopy(src, b); i++) b = scatter(box);
		return [src, onCopy(src, b) ? box : b] as const;
	};
	const backs = LAYOUTS[kind].bubbles.filter((b) => !b[2]).map(([src, box]) => place(src, box));
	const fronts = LAYOUTS[kind].bubbles.filter((b) => b[2]).map(([src, box]) => place(src, box));
	const sky = SKY_BUBBLES.map(skySpot);

	// Free bubbles: born just inside the cloud's rim, behind it, they float out away from its
	// centre, wobbling, and pop, so they never cross the copy. The pink art's ball fills only
	// 43% of its canvas, so it is drawn larger for the same ball.
	type Flyer = { id: number; pink: boolean; x: number; y: number; s: number; dx: number; dy: number; dur: number };
	let flyers = $state<Flyer[]>([]);
	let flyerId = 0;
	function flyer(): Flyer {
		let a = rand(0, Math.PI * 2);
		// The intro's copy spans the cloud's middle: flyers there start at its ends or its foot.
		while (kind === 'intro' && Math.abs(Math.cos(a)) < 0.82 && Math.sin(a) < 0.9) a = rand(0, Math.PI * 2);
		const r = rand(220, 420);
		const at = fromIntro(603 + Math.cos(a) * 380, 353 + Math.sin(a) * 120);
		return {
			id: flyerId++,
			pink: Math.random() < 0.35,
			x: at.x,
			y: at.y,
			s: rand(26, 78),
			dx: Math.cos(a) * r,
			dy: Math.sin(a) * r * 0.7 - rand(40, 140),
			dur: rand(2400, 4200),
		};
	}

	// Peek spots (on the intro), the hidden blob's centre and the offset it peeks out by: from
	// behind the badge at its two ends (sideways, leaning out to sneak a look), and from behind
	// the cloud, in front of the badge: its outer shoulders (top edge y ~280 at x 250 and 950)
	// and its centre bump (top edge y ~219 at x 600). The mystery card's medallion sits on that
	// bump, so it skips that spot.
	type Spot = { x: number; y: number; dx: number; dy: number; lean: number; front?: boolean };
	const SPOTS: Spot[] = [
		{ x: 110, y: 370, dx: -40, dy: -22, lean: -72 },
		{ x: 1090, y: 370, dx: 40, dy: -22, lean: 72 },
		{ x: 600, y: 282, dx: 0, dy: -90, lean: 0, front: true },
		{ x: 252, y: 345, dx: -30, dy: -80, lean: -32, front: true },
		{ x: 948, y: 335, dx: 30, dy: -80, lean: 32, front: true },
	];
	const PEEKERS = ['WATERMELON', 'CHERRIES', 'GRAPES', 'STRAWBERRY', 'BLUEBERRY', 'ORANGE', 'LEMON', 'KIWI'];
	const PEEK_MS = 2800;
	type Peek = Spot & { id: number; spot: number; symbol: string; flip: boolean; size: number };
	let peeks = $state<Peek[]>([]);
	let peekId = 0;

	// The medallion's tile starts as one blob and splits into the tier's starting blobs once
	// the medal has landed: the card shows the bonus's rule happening, not just its number.
	const MEDAL_SPLIT_MS = 1500;
	// end: the total counts up fast from when it starts rising (.total's delay), easing out, then
	// pulses once and keeps breathing until the press.
	const COUNT_AT_MS = 950;
	const COUNT_MS = 750;
	let shown = $state(0);
	let counted = $state(false);
	let totalText = $derived(format && total > 0 ? format(counted ? total : shown) : amount);
	let medalUnits = $state(1);
	// Super's rays and Hidden's night sky: seeded once per card.
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
		if (blobs > 1) later(MEDAL_SPLIT_MS, () => (medalUnits = blobs));
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
		const fly = () => {
			if (flyers.length < 22) {
				const f = flyer();
				flyers = [...flyers, f];
				later(f.dur + 100, () => (flyers = flyers.filter((o) => o.id !== f.id)));
			}
			later(rand(160, 380), fly);
		};
		later(500, fly);
		// A tall screen skips the badge's two ends: those blobs would peek off the screen's sides.
		const spots = SPOTS.map((_, i) => i).filter((i) => (kind !== 'mystery' || i !== 2) && (vw >= vh || i > 1));
		const peek = () => {
			const busy = new Set(peeks.map((p) => p.spot));
			const free = spots.filter((i) => !busy.has(i));
			if (free.length) {
				const spot = pick(free);
				const s = SPOTS[spot];
				const at = fromIntro(s.x, s.y);
				const p = {
					...s,
					x: at.x,
					y: at.y,
					size: 110 * at.k,
					id: peekId++,
					spot,
					symbol: pick(PEEKERS),
					flip: Math.random() < 0.5,
				};
				peeks = [...peeks, p];
				later(PEEK_MS + 80, () => (peeks = peeks.filter((o) => o.id !== p.id)));
			}
			later(rand(450, 1100), peek);
		};
		later(1400, peek);
		return () => {
			timers.forEach(clearTimeout);
			cancelAnimationFrame(raf);
		};
	});
</script>

<svelte:window bind:innerWidth={vw} bind:innerHeight={vh} />

{#snippet peeker(p: Peek)}
	<div
		class="peeker"
		style={`left:${p.x}px;top:${p.y}px;--dx:${p.dx}px;--dy:${p.dy}px;--lean:${p.lean}deg;--flip:${p.flip ? -1 : 1};--size:${p.size}px`}
	>
		<div class="peek-body">
			<div class="peek-flip"><Blob symbol={p.symbol} uid={`card-peek-${p.id}`} /></div>
		</div>
	</div>
{/snippet}

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class={`bonus-card ${kind} ${tier ? `t-${tier}` : ''}`} style={`--p:${pace};--min:${minText.toFixed(1)}px`} onclick={onskip}>
	<div class="dim"></div>
	<div class="frame" style={`transform:translate(-50%,-50%) scale(${fit})`}>
		{#if tier === 'super'}<div class="rays"></div>{/if}
		{#if tier === 'hidden'}
			{#each STARS as st}<i
					class="star"
					style={`left:${st.x.toFixed(0)}px;top:${st.y.toFixed(0)}px;--s:${st.s.toFixed(1)}px;--d:${st.d.toFixed(2)}s;--t:${st.t.toFixed(2)}s`}
				></i>{/each}
		{/if}
		{#each backs as [src, box], i}
			<img out:vanish|global class="still" {src} alt="" style={`${px(box)};--i:${i};${away(box, i)}`} />
		{/each}
		{#each peeks.filter((p) => !p.front) as p (p.id)}{@render peeker(p)}{/each}
		<img class="badge" src="./freespins/hd/badge.webp" alt="" style={px(L.badge)} />
		{#each fronts as [src, box]}
			<img out:vanish|global class="still" {src} alt="" style={`${px(box)};--i:4;${away(box, 4)}`} />
		{/each}
		{#each peeks.filter((p) => p.front) as p (p.id)}{@render peeker(p)}{/each}
		{#each flyers as f (f.id)}
			<img
				out:vanish|global
				class="flyer"
				src={f.pink ? PINK : PURPLE}
				alt=""
				style={`left:${f.x}px;top:${f.y}px;width:${(f.pink ? f.s / 0.433 : f.s).toFixed(0)}px;--dx:${f.dx.toFixed(0)}px;--dy:${f.dy.toFixed(0)}px;animation-duration:${(f.dur * pace).toFixed(0)}ms`}
			/>
		{/each}
		<img class="cloud" src="./freespins/hd/cloud.webp" alt="" style={px(L.cloud)} />
		{#if kind === 'intro'}
			<div class="copy">
				<strong class="title"><JellyText text={title} /></strong>
				<span class="won">{won}</span>
				<span class="spins"><b><JellyText text={String(count)} look="green" /></b>{sub}</span>
			</div>
		{:else if kind === 'mystery'}
			<div class="copy big">
				<strong class="title"><JellyText text={title} /></strong>
				<span class="won">{won}</span>
				<div class="boxes">
					<div class="box bonus-box">
						<b><JellyText text={bonus} look="teal" /></b>
						<p>{desc}</p>
					</div>
					<div class="box spins-box"><b><JellyText text={String(count)} look="pink" /></b><span>{sub}</span></div>
				</div>
			</div>
			<!-- The medallion: the tiles' starting blobs as "Nx" beside a tile split that far. -->
			<div class="medal">
				<img src="./freespins/medal.svg" alt="" />
				<span class="medal-pill">{blobs}x</span>
				<span class="medal-blob"><Blob {symbol} units={medalUnits} uid="card-medal" /></span>
			</div>
		{:else}
			<div class="copy big">
				<strong class="title"><JellyText text={title} /></strong>
				<span class="won">{won}</span>
				<span class="total" class:counted><JellyText text={totalText} /></span>
			</div>
		{/if}
		{#if kind === 'mystery'}
			{#each sky as box, i}
				<img class="still sky" src={PURPLE} alt="" style={`${px(box)};--i:${i + 5};${away(box, i + 5)}`} />
			{/each}
		{/if}
	</div>
	{#if prompt}<p class="prompt" style={`top:${promptTop.toFixed(0)}px;font-size:${promptSize.toFixed(1)}px`}>{prompt}</p>{/if}
</div>

<style>
	/* Timeline (ms at pace 1): dim 0-300, badge zooms 0-650, its bubbles pop 300-800, cloud
	   drops 600-1250, CONGRATULATIONS 1150-1650, YOU WON 1300-1800, spins rise 1550-2150,
	   peekers from 1400, flyers from 500; App holds it until a press and fades it out. */
	.bonus-card {
		position: fixed;
		inset: 0;
		z-index: 45;
		cursor: pointer;
	}
	.dim {
		position: absolute;
		inset: 0;
		background: #000b;
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
	@media (prefers-reduced-motion: reduce) {
		.prompt {
			animation: none;
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
	.badge {
		animation: fs-zoom calc(650ms * var(--p)) cubic-bezier(0.3, 1.4, 0.5, 1) both;
	}
	@keyframes fs-zoom {
		from {
			opacity: 0;
			transform: scale(0.15);
		}
		30% {
			opacity: 1;
		}
	}
	/* The design's bubbles pop in on their spots, wobble a moment, then float up and away off
	   the stage (out past their own side, --ax/--ay), swaying as they rise, and stay gone; the
	   small flyers keep the air busy after them. */
	.still {
		animation:
			fs-pop calc(450ms * var(--p)) cubic-bezier(0.3, 1.6, 0.5, 1) calc((300ms + var(--i) * 90ms) * var(--p)) both,
			fs-squish calc(2.1s + var(--i) * 0.3s) ease-in-out calc(var(--i) * -0.9s) infinite,
			fs-sway calc(1.6s + var(--i) * 0.2s) ease-in-out calc(var(--i) * -0.7s) infinite,
			fs-away calc(3.4s + var(--i) * 0.25s) cubic-bezier(0.5, 0, 0.75, 0.6) calc((1500ms + var(--i) * 220ms) * var(--p)) both;
	}
	@keyframes fs-pop {
		from {
			scale: 0;
		}
	}
	/* One eased segment, so the rise never stalls between waypoints (each keyframe segment
	   would ease on its own); the sway is a separate rotate loop. */
	@keyframes fs-away {
		to {
			translate: var(--ax) var(--ay);
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
	/* The medallion's blob bobs in place. */
	@keyframes fs-bob {
		50% {
			translate: 0 -9px;
		}
	}
	@keyframes fs-squish {
		50% {
			transform: scale(1.06, 0.94);
		}
	}
	.cloud {
		animation: fs-drop calc(650ms * var(--p)) cubic-bezier(0.3, 1.3, 0.5, 1) calc(450ms * var(--p)) both;
	}
	/* Falls in from above the screen, lands with a jelly squash. */
	@keyframes fs-drop {
		0% {
			transform: translateY(-760px);
		}
		60% {
			transform: translateY(14px) scale(1.04, 0.94);
		}
		80% {
			transform: translateY(-4px) scale(0.98, 1.03);
		}
		100% {
			transform: none;
		}
	}
	/* The cloud's centre column is y 219-498; the copy sits in it. */
	.copy {
		left: 200px;
		top: 256px;
		width: 800px;
		display: grid;
		justify-items: center;
		font-family: 'Coiny', sans-serif;
		text-transform: uppercase;
		white-space: nowrap;
		color: #fff;
		pointer-events: none;
	}
	.copy > * {
		filter: drop-shadow(0 4px 0 #2a124f) drop-shadow(0 0 14px rgb(42 18 79 / 0.6));
	}
	/* The display lines (title, spins, bonus name, total) are JellyText, the win screens' jelly
	   lettering (user 2026-10-29: "improve the lettering in the Bonus screens"), so the parents
	   carry only size and motion. */
	.title {
		font-weight: 400;
		font-size: 56px;
		line-height: 1.1;
		animation: fs-from-top calc(500ms * var(--p)) cubic-bezier(0.3, 1.4, 0.5, 1) calc(700ms * var(--p)) both;
	}
	.won {
		margin-top: -2px;
		font-size: 30px;
		letter-spacing: 1px;
		animation: fs-from-top calc(500ms * var(--p)) cubic-bezier(0.3, 1.4, 0.5, 1) calc(800ms * var(--p)) both;
	}
	.spins {
		display: flex;
		align-items: center;
		gap: 14px;
		margin-top: 2px;
		font-size: 38px;
		letter-spacing: 1px;
		animation: fs-from-bottom calc(600ms * var(--p)) cubic-bezier(0.3, 1.4, 0.5, 1) calc(950ms * var(--p)) both;
	}
	.spins b {
		font-weight: 400;
		font-size: 92px;
		line-height: 1;
	}
	@keyframes fs-from-top {
		from {
			opacity: 0;
			transform: translateY(-260px);
		}
		40% {
			opacity: 1;
		}
	}
	@keyframes fs-from-bottom {
		from {
			opacity: 0;
			transform: translateY(320px);
		}
		40% {
			opacity: 1;
		}
	}
	/* Zero-size anchor at the hidden centre; the body peeks out, tilts its head one way then
	   the other like it is wondering what's going on, gives a little hop and ducks back. */
	.peeker {
		width: 0;
		height: 0;
	}
	.peek-body {
		position: absolute;
		left: calc(var(--size) / -2);
		top: calc(var(--size) / -2);
		width: var(--size);
		height: var(--size);
		transform-origin: 50% 85%;
		animation: fs-peek calc(2800ms * var(--p)) ease-in-out both;
	}
	/* Mirrored inside the lean, so a flipped blob still leans out, not back behind the badge. */
	.peek-flip {
		width: 100%;
		height: 100%;
		scale: var(--flip) 1;
	}
	@keyframes fs-peek {
		0%,
		100% {
			transform: none;
		}
		16% {
			transform: translate(calc(var(--dx) * 1.06), calc(var(--dy) * 1.06)) scale(0.95, 1.07) rotate(var(--lean));
		}
		24% {
			transform: translate(var(--dx), var(--dy)) rotate(var(--lean));
		}
		36%,
		44% {
			transform: translate(var(--dx), var(--dy)) rotate(calc(var(--lean) - 14deg));
		}
		56%,
		64% {
			transform: translate(var(--dx), var(--dy)) rotate(calc(var(--lean) + 13deg));
		}
		72% {
			transform: translate(var(--dx), calc(var(--dy) - 10px)) scale(1.04, 0.96) rotate(var(--lean));
		}
		80% {
			transform: translate(var(--dx), var(--dy)) rotate(var(--lean));
		}
		92% {
			transform: translate(calc(var(--dx) * 0.4), calc(var(--dy) * 0.4)) scale(1.03, 0.95);
		}
	}
	/* Grows out of nothing, drifts off wobbling, and pops at the end. */
	.flyer {
		height: auto;
		translate: -50% -50%;
		animation-name: fs-fly;
		animation-timing-function: linear;
		animation-fill-mode: both;
	}
	@keyframes fs-fly {
		0% {
			opacity: 0;
			transform: translate(0, 0) scale(0.2);
		}
		12% {
			opacity: 1;
			transform: translate(calc(var(--dx) * 0.1 + 10px), calc(var(--dy) * 0.1)) scale(1);
		}
		35% {
			transform: translate(calc(var(--dx) * 0.35 - 12px), calc(var(--dy) * 0.35)) scale(1.04, 0.97);
		}
		60% {
			transform: translate(calc(var(--dx) * 0.6 + 12px), calc(var(--dy) * 0.6)) scale(0.97, 1.04);
		}
		88% {
			opacity: 1;
			transform: translate(calc(var(--dx) * 0.88 - 6px), calc(var(--dy) * 0.88)) scale(1);
		}
		100% {
			opacity: 0;
			transform: translate(var(--dx), var(--dy)) scale(1.5);
		}
	}
	/* Mystery and end cards: Figma 11020:33167's copy, 683 wide, centred on x 605.5 from y 240. */
	.copy.big {
		left: 264px;
		top: 240px;
		width: 683px;
		gap: 7px;
	}
	.copy.big > * {
		filter: drop-shadow(0 2.78px 2.78px rgb(0 0 0 / 0.25));
	}
	.big .title {
		font-size: 48px;
		/* Coiny's own line box is ~1.6em; Figma's frame packs it tighter. */
		line-height: 1.2;
		letter-spacing: 1.44px;
	}
	.big .won {
		margin: 0;
		font: 700 max(24px, var(--min))/normal 'Poppins', sans-serif;
		letter-spacing: 0.72px;
	}
	.boxes {
		display: flex;
		gap: 15px;
		width: 100%;
		text-transform: none;
		white-space: normal;
		animation: fs-from-bottom calc(600ms * var(--p)) cubic-bezier(0.3, 1.4, 0.5, 1) calc(950ms * var(--p)) both;
	}
	.box {
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		min-height: 151px;
		padding: 14px 22px;
		border: 2px solid #7e58d7;
		border-radius: 24px;
		background: #492792;
		text-align: center;
	}
	.bonus-box {
		gap: 8px;
		width: 461px;
	}
	.bonus-box b {
		/* A size under the design's 36.45 (and the copy below), so long rule lines keep a margin. */
		font: 400 31px/normal 'Coiny', sans-serif;
		letter-spacing: 0.93px;
		color: #17d9ce;
	}
	.bonus-box p {
		margin: 0;
		font: 400 max(14px, var(--min))/1.3 'Poppins', sans-serif;
		letter-spacing: 0.42px;
	}
	.spins-box {
		flex: 1;
		border-color: #ac3fc1;
		color: #fa52e5;
	}
	.spins-box b {
		margin-bottom: -4px;
		font: 400 84px/1 'Coiny', sans-serif;
		letter-spacing: 2.5px;
	}
	.spins-box span {
		font: 700 max(20px, var(--min))/normal 'Poppins', sans-serif;
		letter-spacing: 0.6px;
		text-transform: uppercase;
	}
	.end .copy.big {
		top: 250px;
	}
	.total {
		font-size: 84px;
		line-height: 1.1;
		animation: fs-from-bottom calc(600ms * var(--p)) cubic-bezier(0.3, 1.4, 0.5, 1) calc(950ms * var(--p)) both;
	}
	/* Counted: one pop as it lands, then a slow, slight breath while it waits for the press. */
	.total.counted {
		animation:
			fs-total-pop 420ms cubic-bezier(0.3, 1.6, 0.5, 1) both,
			fs-total-breathe 1.6s ease-in-out 420ms infinite alternate;
	}
	@keyframes fs-total-pop {
		40% {
			transform: scale(1.12);
		}
	}
	@keyframes fs-total-breathe {
		to {
			transform: scale(1.04);
		}
	}
	/* Figma 11020:33179: the 170.6 ring centred on x 605.3 at y 29, the "Nx" pill at (539, 90)
	   and the art box (597, 74) 73×79, here the tile split into the starting blobs. */
	.medal {
		left: 520px;
		top: 29px;
		width: 170.6px;
		height: 170.6px;
		animation: fs-medal calc(600ms * var(--p)) cubic-bezier(0.3, 1.6, 0.5, 1) calc(800ms * var(--p)) both;
	}
	.medal img {
		display: block;
		width: 100%;
		height: 100%;
	}
	@keyframes fs-medal {
		from {
			opacity: 0;
			transform: scale(0.2) rotate(-25deg);
		}
		40% {
			opacity: 1;
		}
	}
	.medal-pill {
		position: absolute;
		left: 19.3px;
		top: 61.3px;
		padding: 6px 8.5px 4px;
		border: 1.42px solid #522ea1;
		border-radius: 12.78px;
		background: #17d9ce;
		font: 400 max(19.88px, var(--min))/normal 'Coiny', sans-serif;
		letter-spacing: 0.6px;
		color: #502da0;
	}
	.medal-blob {
		position: absolute;
		left: 75px;
		top: 45px;
		width: 79px;
		height: 79px;
		animation: fs-bob 2.4s ease-in-out infinite;
	}
	.sky {
		z-index: 1;
	}
	.medal-blob {
		--divide-ms: calc(1100ms * var(--p));
	}

	/* Each bonus tier opens in its own colours: the card's neon and bubbles hue-turned from the
	   art's magenta, its boxes and medal pill recoloured to match. Normal is lagoon blue, Super
	   sunset gold under turning rays (sepia first: the art mixes magenta and violet, which a
	   plain hue turn splits into two colours), Hidden stays magenta on a night sky with twinkling stars.
	   hue-rotate is a colour matrix, so it composites with the art's own transform animations. */
	.t-normal :is(.badge, .cloud, .still, .flyer) {
		filter: hue-rotate(-70deg) saturate(1.1);
	}
	.t-super :is(.badge, .cloud, .still, .flyer) {
		filter: sepia(1) saturate(3.4) hue-rotate(8deg) brightness(1.04);
	}
	.t-hidden :is(.badge, .cloud, .still, .flyer) {
		filter: saturate(1.15) brightness(0.92);
	}
	.t-normal .box {
		border-color: #6cc4ff;
		background: #12447f;
	}
	.t-super .box {
		border-color: #ffc062;
		background: #8a4a12;
	}
	.t-hidden .box {
		border-color: #c46bff;
		background: #3b1470;
	}
	.t-normal .bonus-box b {
		color: #eafffb;
	}
	.t-super .bonus-box b {
		color: #ffe9a8;
	}
	.t-normal .medal-pill {
		background: #5ff0df;
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
	.t-hidden .dim {
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
		.rays,
		.star {
			animation: fs-fade 300ms both;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.medal,
		.boxes,
		.total,
		.total.counted,
		.badge,
		.still,
		.cloud,
		.title,
		.won,
		.spins {
			animation: fs-fade 300ms both;
		}
	}
</style>
