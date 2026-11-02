<script lang="ts" module>
	export type WinTier = 'sweet' | 'wild' | 'epic' | 'mythic' | 'legendary' | 'max';
	/** Centre-placed box, as the design places these layers: [cx, cy, w, h]. */
	type Box = [cx: number, cy: number, w: number, h: number];
	/** The image's crop inside its box, the design's img [left, top, width, height] %. */
	type Crop = [l: number, t: number, w: number, h: number];
	/** A blob peeking out: centre, rotation, its frame (clip radius, or null for no clip) and
	    the image's size centred in that frame. */
	type Peeker = { src: string; c: [number, number]; rot: number; frame: [number, number]; clip: number | null; img: [number, number] };
	type Tier = {
		color: string;
		text: string;
		/** The neon plate (win/hd/plate.webp); its image is cropped the same way on every tier. */
		plate: Box;
		/** The purple cloud on the plate (win/hd/cloud.webp); MAX has none. */
		cloud?: Box;
		/** The two big pink jelly bubbles behind the plaque (win/hd/jelly.webp); MAX has none. */
		jelly: Box[];
		/** The tier word and the WIN word: the design's 2026-10-27 glossy lettering (win/hd/
		    title2-*, win2-*), boxes from Figma 11324:47859…47882. */
		title: Box;
		titleCrop?: Crop;
		win: Box;
		/** The amount box, where it isn't the design's usual "Button". */
		amount?: Box;
		peekers: Peeker[];
		/** Paint order, as the design stacks it (it differs by tier). */
		z: { amount: number; peekers: number; jelly: number; plaque: number; title: number; win: number };
	};
	const P = (src: string, cx: number, cy: number, rot: number, frame: [number, number], clip: number | null, img: [number, number]): Peeker => ({
		src,
		c: [cx, cy],
		rot,
		frame,
		clip,
		img,
	});
	// The pink "premium" blob and the teal wild sit in clipping symbol frames; the rest are bare.
	const PINK = (cx: number, cy: number, rot: number, f = [124.627, 110.686] as [number, number], i = 142.046, clip = 16.469) =>
		P('sym-5', cx, cy, rot, f, clip, [i, i]);
	const TEAL = (cx: number, cy: number, rot: number, f = [144.579, 111.769] as [number, number], i = 150.436, clip = 17.442) =>
		P('sym-2', cx, cy, rot, f, clip, [i, i]);
	const bare = (src: string, cx: number, cy: number, rot: number, w: number, h = w) => P(src, cx, cy, rot, [w, h], null, [w, h]);
	// The plate's image fill (Figma CROP): its top 13.14% is cut off.
	const PLATE_CROP: Crop = [0, -13.14, 100, 113.14];
	// Bottom to top: amount box, jelly bubbles, blobs, plate + cloud, words. (The design's slime
	// drips were removed on request, 2026-10-27.)
	const STACK = { amount: 0, peekers: 3, jelly: 2, plaque: 4, title: 7, win: 8 };
	// From the Figma screens (1200×670), measured with the plugin API (rotations are the
	// design's, flipped to CSS's clockwise): sweet 11271:5808, wild 11271:5476, epic 11271:5211,
	// mythic 11008:29144, legendary 11008:29646, max 11008:30148.
	export const TIERS: Record<WinTier, Tier> = {
		sweet: {
			color: '#33c5fd',
			text: '#4ad3fd',
			plate: [602.26, 349.83, 614.53, 271.58],
			cloud: [603.56, 326.75, 466.79, 233.39],
			jelly: [
				[407.22, 275, 342.43, 343.34],
				[800.33, 275, 343.34, 343.34],
			],
			title: [602.5, 293.5, 439, 137],
			titleCrop: [0, -14.71, 100, 126.51],
			win: [599, 387, 264, 198],
			peekers: [
				bare('sym-5', 331.77, 289.41, -43.58, 122.75),
				bare('sym-7', 608, 185.5, 0, 157),
				TEAL(866.72, 297.92, 29.53, [124.94, 96.59], 130, 15.07),
			],
			z: STACK,
		},
		wild: {
			color: '#9bf715',
			text: '#9bf715',
			plate: [602.26, 350.02, 674.53, 298.1],
			cloud: [603.69, 324.69, 512.36, 256.18],
			jelly: [
				[388.5, 275, 375, 376],
				[819, 275, 376, 376],
			],
			title: [601.5, 281.5, 361, 161],
			titleCrop: [-0.05, -33.54, 100.09, 168.32],
			win: [600.5, 393, 327, 146],
			peekers: [bare('sym-5', 290.41, 289.41, -43.58, 142.05), bare('sym-7b', 609, 174.5, 0, 157), TEAL(909.44, 299.25, 29.53)],
			z: STACK,
		},
		epic: {
			color: '#ff3a3b',
			text: '#ff3a3b',
			plate: [602.26, 350.22, 734.53, 324.62],
			cloud: [603.82, 322.63, 557.94, 278.97],
			jelly: [
				[383.7, 248.32, 379.41, 379.41],
				[818.93, 248.32, 379.41, 379.41],
			],
			title: [600.5, 271.5, 433, 171],
			win: [602, 400.5, 342, 153],
			peekers: [bare('sym-5', 273.41, 275.41, -43.58, 142.05), bare('sym-4b774', 609, 163.5, 0, 157), TEAL(934.44, 276.25, 29.53)],
			z: STACK,
		},
		mythic: {
			color: '#fc56d9',
			text: '#fc56d9',
			plate: [602.26, 350.64, 864.53, 382.07],
			cloud: [604.09, 318.17, 656.68, 328.34],
			jelly: [
				[354.32, 248.32, 430.64, 430.64],
				[848.32, 248.32, 430.64, 430.64],
			],
			title: [600.5, 262.5, 571, 205],
			win: [600.5, 401.5, 383, 171],
			peekers: [bare('sym-5', 239.83, 247.83, -24.1, 142.05), bare('sym-9', 609, 131.5, 0, 168, 169), TEAL(938.44, 244.25, 29.53)],
			z: STACK,
		},
		legendary: {
			color: '#fdd008',
			text: '#fdd008',
			plate: [601.35, 325.12, 939.33, 415.13],
			cloud: [603.33, 289.84, 713.5, 356.75],
			jelly: [
				[331.95, 213.95, 467.9, 467.9],
				[868.69, 213.95, 467.9, 467.9],
			],
			title: [613, 257.5, 700, 233],
			win: [600, 393.5, 418, 187],
			peekers: [bare('sym-f4061', 600.5, 95.5, 0, 157), PINK(226.55, 199.96, -29.72), TEAL(1010.44, 212.25, 29.53)],
			// The design has the blobs behind the jelly bubbles here, but the right bubble hid the
			// teal one almost whole (user 2026-11-02: "this blob is not seen well"): in front, as
			// on the other tiers.
			z: STACK,
		},
		// MAX: the wide plate alone (no cloud, no jelly), the blobs behind everything.
		max: {
			color: '#9bf715',
			text: '#9bf715',
			plate: [600.5, 354, 1159, 512],
			jelly: [],
			title: [600, 208.5, 578, 259],
			win: [599.5, 388.5, 491, 219],
			peekers: [
				bare('sym-f4061', 629.87, 77.87, 0, 197.74),
				PINK(203.24, 205.13, -30.5, [157.336, 139.736], 162.357, 18.824),
				TEAL(1022.37, 235.37, 45, [195.21, 150.91], 183.9, 21.32),
				bare('sym-9', 418.63, 116.63, -12.06, 176.32),
				bare('sym-7b', 894.36, 129.36, 30.9, 175.51),
			],
			z: { amount: 1, peekers: 0, jelly: 0, plaque: 3, title: 4, win: 5 },
		},
	};
	// Jelly bubbles: the opening fountain, then per second (WinFxView). A few for the smallest
	// big win, more with every tier.
	const BUBBLES: Record<WinTier, [burst: number, rate: number]> = {
		sweet: [3, 0.6],
		wild: [6, 1.2],
		epic: [10, 2],
		mythic: [15, 3.2],
		legendary: [22, 5],
		max: [32, 8],
	};
</script>

<script lang="ts">
	import { onMount } from 'svelte';
	import Blob from './Blob.svelte';

	// Big-win screen: the scene dims, the neon plate (and its cloud) zooms out and pops into
	// place with the pink jelly bubbles swelling up behind it, the tier word drops in from the
	// top while WIN rises from the bottom, happy blobs climb out from behind and keep giggling,
	// small jelly bubbles shower out (drawn live in Pixi,
	// scene/WinFxView.ts), and the amount box pops up and counts.
	// Art from scripts/build-win-screens.py. `speed` scales every beat (turbo).
	let {
		tier,
		amount,
		final = amount,
		speed = 1,
		onskip,
	}: { tier: WinTier; amount: string; final?: string; speed?: number; onskip?: () => void } = $props();

	const t = TIERS[tier];
	const AMOUNT: Box = t.amount ?? [600.5, 558.07, 399, 120.145];
	let vw = $state(1200);
	let vh = $state(670);
	// On a tall screen the 1200-wide stage would leave the plate a strip across the middle:
	// the plate fills ~94% of the width instead (the peekers may reach the edges, and the
	// whole stage's height still has to fit).
	const reach = Math.max(
		t.plate[2] / 2,
		AMOUNT[2] / 2,
		...t.peekers.map((p) => Math.abs(p.c[0] - 600) + Math.max(...p.frame) / 2),
	);
	let fit = $derived(
		vw < vh ? Math.min((0.94 * vw) / t.plate[2], vw / (2 * reach), vh / 670) : Math.min(vw / 1200, vh / 670),
	);

	const rand = (a: number, b: number) => a + Math.random() * (b - a);
	const box = ([cx, cy, w, h]: Box) => `left:${cx - w / 2}px;top:${cy - h / 2}px;width:${w}px;height:${h}px`;
	const crop = (c?: Crop) => (c ? `left:${c[0]}%;top:${c[1]}%;width:${c[2]}%;height:${c[3]}%` : '');

	// The design's peekers are the board's blobs in happy poses; they're drawn live (Blob) so the
	// faces laugh with the giggle instead of hopping as painted pictures.
	const PEEK_SYMBOL: Record<string, string> = {
		'sym-2': 'KIWI',
		'sym-4b774': 'CHERRIES',
		'sym-5': 'STRAWBERRY',
		'sym-7': 'BLUEBERRY',
		'sym-7b': 'WATERMELON',
		'sym-9': 'GRAPES',
		'sym-f4061': 'LEMON',
	};
	// Peekers rise out from toward the plate's middle.
	const [pcx, pcy] = t.plate;
	const peekers = t.peekers.map((p, i) => ({
		...p,
		dx: (pcx - p.c[0]) * 0.3,
		dy: (pcy - p.c[1]) * 0.3 + 30,
		giggle: (i * 0.37 + rand(0, 0.3)).toFixed(2),
	}));

	// The live bubbles (scene/WinFxView.ts) on a canvas just over the plate (no drips: anchors
	// stay empty). Without WebGL the screen plays without bubbles.
	// Over the live bubbles, so they pass behind the number.
	const amountZ = Math.max(t.z.amount, t.z.plaque + 1);
	let fxHost = $state<HTMLDivElement>();
	onMount(() => {
		let dead = false;
		let view: { destroy(): void } | null = null;
		const drop = (e: unknown) => {
			console.error('[WinFx]', e);
			view?.destroy();
			view = null;
		};
		import('../scene/WinFxView')
			.then(async ({ WinFxView }) => {
				if (dead || !fxHost) return;
				const [burst, rate] = BUBBLES[tier];
				const v = new WinFxView({ anchors: [], outline: 0, plaque: t.plate, burst, rate, speed });
				v.onfail = drop;
				view = v;
				// A tall screen shows stage above and below the 670 band: the canvas reaches into it.
				const pad = Math.min(500, Math.max(0, vh / 2 / fit - 335));
				await v.init(fxHost, Math.min(2, devicePixelRatio * fit), pad);
			})
			.catch(drop);
		return () => {
			dead = true;
			view?.destroy();
		};
	});
</script>

<svelte:window bind:innerWidth={vw} bind:innerHeight={vh} />

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class={`win-screen ${tier}`} style={`--c:${t.color};--tc:${t.text};--spd:${speed}`} onclick={onskip}>
	<div class="dim"></div>
	<div class="frame" style={`transform:translate(-50%,-50%) scale(${fit})`}>
		<!-- Over the slime canvas, so falling drops and bubbles pass behind the number. -->
		<div class="amount" style={`${box(AMOUNT)};z-index:${amountZ}`}>
			<!-- Sized for the final amount, so the count-up doesn't shrink as it grows. -->
			<strong class:landed={amount === final} style={`font-size:${(AMOUNT[2] / 399) * Math.min(59.33, 330 / (0.62 * Math.max(1, final.length)))}px`}>{amount}</strong>
		</div>
		<!-- Behind the plaque: they climb out from behind it, then laugh. -->
		{#each peekers as p, i}
			<div class="peeker" style={`left:${p.c[0]}px;top:${p.c[1]}px;z-index:${t.z.peekers};--dx:${p.dx}px;--dy:${p.dy}px;--i:${i}`}>
				<div
					class="peek-frame"
					class:clip={p.clip !== null}
					style={`width:${p.frame[0]}px;height:${p.frame[1]}px;rotate:${p.rot}deg;border-radius:${p.clip ?? 0}px`}
				>
					<span
						class="peek-blob"
						style={`width:${p.img[0]}px;height:${p.img[1]}px;--g:${p.giggle}s;--cheer-delay:calc(1s + ${p.giggle}s)`}
						><Blob symbol={PEEK_SYMBOL[p.src] ?? 'KIWI'} uid={`win-peek-${i}`} cheer /></span
					>
				</div>
			</div>
		{/each}
		{#each t.jelly as j, i}
			<div class="jelly" style={`${box(j)};z-index:${t.z.jelly};--i:${i}`}><img src="./win/hd/jelly.webp" alt="" /></div>
		{/each}
		<div class="plaque" style={`z-index:${t.z.plaque};transform-origin:${t.plate[0]}px ${t.plate[1]}px`}>
			<div class="plate" style={box(t.plate)}><img src="./win/hd/plate.webp" alt="" style={crop(PLATE_CROP)} /></div>
			{#if t.cloud}
				<div class="cloud" style={box(t.cloud)}><img src="./win/hd/cloud.webp" alt="" /></div>
			{/if}
		</div>
		<!-- Same layer as the plate, after it: over the plate and cloud, under the words and amount. -->
		<div class="fx" bind:this={fxHost} style={`z-index:${t.z.plaque}`}></div>
		<div class="title" style={`${box(t.title)};z-index:${t.z.title}`}>
			<img src={`./win/hd/title2-${tier}.webp`} alt="" style={crop(t.titleCrop)} />
			<span class="shine" style={`${crop(t.titleCrop)};--src:url(./win/hd/title2-${tier}.webp)`}></span>
		</div>
		{#if t.win}
			<div class="win-word" style={`${box(t.win)};z-index:${t.z.win}`}>
				<img src={`./win/hd/win2-${tier}.webp`} alt="" />
				<span class="shine" style={`--src:url(./win/hd/win2-${tier}.webp)`}></span>
			</div>
		{/if}
	</div>
</div>

<style>
	/* Beats (ms at speed 1): dim 0-300, plaque 100-800, peekers from 350, title 450-1100,
	   WIN 650-1300, amount box 900-1400 (the count-up runs from App); the
	   bubbles (WinFxView) fountain from the plate's landing on. */
	.win-screen {
		position: fixed;
		inset: 0;
		z-index: 45;
		cursor: pointer;
	}
	.dim {
		position: absolute;
		inset: 0;
		background: #000b;
		animation: ws-fade calc(300ms * var(--spd)) both;
	}
	@keyframes ws-fade {
		from {
			opacity: 0;
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
	/* The plate and its cloud zoom in as one layer the size of the stage. Nothing clips: the
	   words' crops only add transparent margin, and clipping them can cut the lettering flat
	   (LEGENDARY did); the plate's crop overhangs its box only above, in transparent margin. */
	.plaque {
		left: 0;
		top: 0;
		width: 1200px;
		height: 670px;
		pointer-events: none;
	}
	.plate,
	.cloud {
		position: absolute;
	}
	.plate img,
	.title img,
	.win-word img,
	.win-word .shine {
		position: absolute;
		left: 0;
		top: 0;
		width: 100%;
		height: 100%;
	}
	/* Zooms out from close up and pops into place with a jelly settle. */
	.plaque {
		animation: ws-plaque calc(700ms * var(--spd)) calc(100ms * var(--spd)) both;
	}
	@keyframes ws-plaque {
		0% {
			opacity: 0;
			transform: scale(2.4);
			animation-timing-function: cubic-bezier(0.2, 0.6, 0.35, 1);
		}
		45% {
			opacity: 1;
			transform: scale(0.9, 0.94);
		}
		65% {
			transform: scale(1.06, 1.03);
		}
		82% {
			transform: scale(0.98, 1.01);
		}
		100% {
			transform: none;
		}
	}
	.cloud img,
	.jelly img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	/* The pink jelly bubbles swell up behind the plate as it lands, wobble like jelly balloons,
	   then let go and float up off the screen swaying, and a fresh one swells back in behind the
	   plate (user 2026-11-02: "make those balloons fly away"). Each on its own beat. */
	.jelly {
		transform-origin: 50% 90%;
		animation:
			ws-swell calc(650ms * var(--spd)) calc((180ms + var(--i) * 70ms) * var(--spd)) both,
			ws-bob calc(3.6s + var(--i) * 0.7s) linear calc((830ms + var(--i) * 70ms) * var(--spd)) infinite;
	}
	@keyframes ws-swell {
		0% {
			opacity: 0;
			transform: scale(0.2);
			animation-timing-function: cubic-bezier(0.3, 0.7, 0.4, 1);
		}
		55% {
			opacity: 1;
			transform: scale(1.08, 0.95);
		}
		78% {
			transform: scale(0.97, 1.03);
		}
		100% {
			transform: none;
		}
	}
	/* 0-22% a jelly wobble in place; 22-76% released: it rises faster and faster, swaying, and
	   leaves the top; 76-100% a new one swells up from the plate. Translate % is the bubble's own
	   size, so it clears the screen at every stage scale. */
	@keyframes ws-bob {
		0%,
		100% {
			translate: 0 0;
			scale: 1;
			rotate: 0deg;
			opacity: 1;
			animation-timing-function: ease-in-out;
		}
		8% {
			translate: 0 2px;
			scale: 1.07 0.92;
			rotate: -2deg;
			animation-timing-function: ease-in-out;
		}
		16% {
			translate: 0 -10px;
			scale: 0.95 1.07;
			rotate: 2deg;
			animation-timing-function: ease-in-out;
		}
		22% {
			translate: 0 0;
			scale: 1.05 0.95;
			rotate: 0deg;
			animation-timing-function: cubic-bezier(0.5, 0, 0.9, 0.6);
		}
		38% {
			translate: 6% -22%;
			scale: 0.96 1.05;
			rotate: 5deg;
			animation-timing-function: linear;
		}
		56% {
			translate: -5% -70%;
			scale: 1.02 0.98;
			rotate: -4deg;
			animation-timing-function: linear;
		}
		76% {
			translate: 4% -150%;
			scale: 0.94 1.04;
			rotate: 3deg;
			opacity: 1;
		}
		76.1% {
			translate: 0 0;
			scale: 0.2;
			rotate: 0deg;
			opacity: 0;
			animation-timing-function: cubic-bezier(0.3, 0.7, 0.4, 1);
		}
		90% {
			translate: 0 0;
			scale: 1.08 0.95;
			opacity: 1;
			animation-timing-function: ease-in-out;
		}
	}
	/* The tier word falls in from the top, the WIN word shoots up from the bottom. */
	/* Once landed they stay alive: a slow jelly wobble (on `scale`/`rotate`, so it composes with
	   the entrance's `transform`), out of step between the two words, and a shine sweeping
	   across the lettering now and then. */
	.title {
		animation:
			ws-from-top calc(650ms * var(--spd)) calc(220ms * var(--spd)) both,
			ws-wobble 2.6s ease-in-out calc(900ms * var(--spd)) infinite;
	}
	.win-word {
		animation:
			ws-from-bottom calc(650ms * var(--spd)) calc(380ms * var(--spd)) both,
			ws-wobble 2.6s ease-in-out calc(900ms * var(--spd) + 0.65s) infinite reverse;
	}
	@keyframes ws-wobble {
		0%,
		100% {
			scale: 1;
			rotate: 0deg;
		}
		25% {
			scale: 1.045 0.965;
			rotate: -1.3deg;
		}
		50% {
			scale: 0.985 1.03;
			rotate: 0deg;
		}
		75% {
			scale: 1.035 0.975;
			rotate: 1.3deg;
		}
	}
	/* The word's own alpha masks a white band that sweeps left to right. */
	.shine {
		position: absolute;
		pointer-events: none;
		-webkit-mask: var(--src) center / 100% 100% no-repeat;
		mask: var(--src) center / 100% 100% no-repeat;
		background: linear-gradient(105deg, #fff0 45%, #fff9 50%, #fff0 55%) no-repeat;
		background-size: 300% 100%;
		background-position: 150% 0;
		animation: ws-shine 3.2s ease-in-out calc(1.2s * var(--spd)) infinite;
	}
	.win-word .shine {
		animation-delay: calc(1.2s * var(--spd) + 0.35s);
	}
	@keyframes ws-shine {
		0% {
			background-position: 150% 0;
		}
		35%,
		100% {
			background-position: -50% 0;
		}
	}
	@keyframes ws-from-top {
		0% {
			opacity: 0;
			transform: translateY(-700px) scale(0.9, 1.15);
			animation-timing-function: cubic-bezier(0.5, 0, 0.9, 0.6);
		}
		55% {
			opacity: 1;
			transform: translateY(0) scale(1.18, 0.8);
			animation-timing-function: cubic-bezier(0.2, 0.7, 0.4, 1);
		}
		75% {
			transform: translateY(-14px) scale(0.95, 1.06);
		}
		100% {
			opacity: 1;
			transform: none;
		}
	}
	@keyframes ws-from-bottom {
		0% {
			opacity: 0;
			transform: translateY(700px) scale(0.9, 1.15);
			animation-timing-function: cubic-bezier(0.5, 0, 0.9, 0.6);
		}
		55% {
			opacity: 1;
			transform: translateY(0) scale(1.18, 0.8);
			animation-timing-function: cubic-bezier(0.2, 0.7, 0.4, 1);
		}
		75% {
			transform: translateY(12px) scale(0.95, 1.06);
		}
		100% {
			opacity: 1;
			transform: none;
		}
	}
	/* Climb out from behind the plaque (from toward its middle), then giggle. The wrapper sits
	   on the design's centre point; the frame is the design's rotated symbol frame. */
	.peeker {
		width: 0;
		height: 0;
		animation: ws-peek calc(600ms * var(--spd)) calc((350ms + var(--i) * 110ms) * var(--spd)) both;
	}
	.peek-frame {
		position: absolute;
		left: 0;
		top: 0;
		translate: -50% -50%;
		display: grid;
		place-items: center;
	}
	.peek-frame.clip {
		overflow: hidden;
	}
	.peek-blob {
		display: block;
		flex: none;
		transform-origin: 50% 90%;
		animation: ws-giggle 0.9s ease-in-out calc(1s + var(--g)) infinite;
	}
	@keyframes ws-peek {
		0% {
			transform: translate(var(--dx), var(--dy)) scale(0.5);
			animation-timing-function: cubic-bezier(0.3, 0.7, 0.4, 1);
		}
		60% {
			transform: translate(calc(var(--dx) * -0.08), calc(var(--dy) * -0.08)) scale(1.06, 0.95);
		}
		100% {
			transform: none;
		}
	}
	/* Laughing: quick hops with a squash, a tilt one way then the other, and a rest. */
	@keyframes ws-giggle {
		0%,
		100% {
			transform: none;
		}
		12% {
			transform: translateY(-5%) rotate(-4deg) scale(0.97, 1.04);
		}
		24% {
			transform: translateY(0) rotate(-2deg) scale(1.05, 0.95);
		}
		36% {
			transform: translateY(-5%) rotate(4deg) scale(0.97, 1.04);
		}
		48% {
			transform: translateY(0) rotate(2deg) scale(1.05, 0.95);
		}
		60% {
			transform: none;
		}
	}
	/* Amount box (the design's "Button"): pops up after the titles. */
	.amount {
		display: grid;
		place-items: center;
		box-sizing: border-box;
		background: #512ea0;
		border: 4px solid var(--c);
		border-radius: 17.8px;
		animation: ws-pop calc(500ms * var(--spd)) calc(560ms * var(--spd)) both;
	}
	/* The count-up done: the number gives one jelly beat, then a slow slight breath. */
	.amount strong.landed {
		animation:
			ws-beat 450ms cubic-bezier(0.3, 1.6, 0.5, 1) both,
			ws-breathe 1.5s ease-in-out 450ms infinite alternate;
	}
	@keyframes ws-beat {
		40% {
			transform: scale(1.14, 1.08);
		}
	}
	@keyframes ws-breathe {
		to {
			transform: scale(1.04);
		}
	}
	.amount strong {
		font-family: 'Coiny', sans-serif;
		line-height: 1;
		letter-spacing: 2.08px;
		color: var(--tc);
		white-space: nowrap;
	}
	@keyframes ws-pop {
		0% {
			opacity: 0;
			transform: scale(0.3);
		}
		60% {
			opacity: 1;
			transform: scale(1.1, 0.94);
		}
		80% {
			transform: scale(0.97, 1.03);
		}
		100% {
			transform: none;
		}
	}
	.fx {
		left: 0;
		top: 0;
		width: 1200px;
		height: 670px;
		pointer-events: none;
	}
	@media (prefers-reduced-motion: reduce) {
		.win-screen *,
		.dim {
			animation-duration: 1ms !important;
			animation-iteration-count: 1 !important;
		}
	}
</style>
