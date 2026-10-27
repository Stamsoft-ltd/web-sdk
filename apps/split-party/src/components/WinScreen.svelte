<script lang="ts" module>
	export type WinTier = 'sweet' | 'wild' | 'epic' | 'mythic' | 'legendary' | 'max';
	/** Centre-placed box, as the design places these layers: [cx, cy, w, h]. */
	type Box = [cx: number, cy: number, w: number, h: number];
	/** The image's crop inside its box, the design's img [left, top, width, height] %. */
	type Crop = [l: number, t: number, w: number, h: number];
	/** A blob peeking out: centre, rotation, its frame (clip radius, or null for no clip) and
	    the image's size centred in that frame. */
	type Peeker = { src: string; c: [number, number]; rot: number; frame: [number, number]; clip: number | null; img: [number, number] };
	/** A drip of slime hanging off the plate or the amount box: box (the design's unrotated
	    frame, centred), its rotation, and which art (drip-4 the long drip, drip-5 the splat). */
	type Drip = { src: 'drip-4' | 'drip-5'; box: Box; rot: number };
	type Tier = {
		color: string;
		text: string;
		/** The neon plate (win/hd/plate.webp); its image is cropped the same way on every tier. */
		plate: Box;
		/** The purple cloud on the plate (win/hd/cloud.webp); MAX has none. */
		cloud?: Box;
		/** The two big pink jelly bubbles behind the plaque (win/hd/jelly.webp); MAX has none. */
		jelly: Box[];
		drips: Drip[];
		title: Box;
		titleCrop?: Crop;
		win: Box;
		/** The amount box, where it isn't the design's usual "Button". */
		amount?: Box;
		peekers: Peeker[];
		/** Paint order, as the design stacks it (it differs by tier). */
		z: { amount: number; peekers: number; jelly: number; plaque: number; drips: number; title: number; win: number };
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
	// The right drip is the long drip turned on its side; the amount box's corner drip is the same art.
	const left = (box: Box): Drip => ({ src: 'drip-5', box, rot: 0 });
	const right = (box: Box): Drip => ({ src: 'drip-4', box, rot: 107.35 });
	const AMOUNT_DRIP: Drip = { src: 'drip-4', box: [778.49, 529.7, 93.94, 73.56], rot: 18.42 };
	// Bottom to top: amount box, its drip, jelly bubbles, blobs, plate + cloud, side drips, words.
	const STACK = { amount: 0, peekers: 3, jelly: 2, plaque: 4, drips: 6, title: 7, win: 8 };
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
			drips: [left([355.96, 372.57, 105.53, 102.01]), right([840.94, 381.73, 111.02, 86.94]), AMOUNT_DRIP],
			title: [599.88, 295.48, 311.75, 104.96],
			titleCrop: [0, -67.15, 100, 223],
			win: [600.08, 372.32, 243.03, 108.71],
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
			drips: [left([331.91, 374.98, 115.83, 111.97]), right([864.24, 385.04, 121.86, 95.43]), AMOUNT_DRIP],
			title: [599.63, 298.22, 373.26, 166.43],
			win: [602.05, 391.53, 287.62, 127.65],
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
			drips: [left([321, 380, 124, 120]), right([879.02, 375.37, 145.4, 113.87]), AMOUNT_DRIP],
			title: [604.5, 274.09, 347, 140.19],
			titleCrop: [0, -47.01, 100, 185.64],
			win: [611.96, 373.13, 331.92, 148.27],
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
			drips: [left([317.77, 396.53, 135.55, 131.07]), right([888.48, 382.2, 178.79, 140.01]), AMOUNT_DRIP],
			title: [603.98, 270.79, 567.95, 177.58],
			titleCrop: [-0.05, -41.32, 100.09, 180.17],
			win: [603.48, 396.8, 433.66, 193.71],
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
			drips: [left([258.64, 377.2, 147.27, 142.41]), right([895.57, 371.39, 194.26, 152.13]), AMOUNT_DRIP],
			title: [599.55, 246.52, 567.1, 189.03],
			win: [599.55, 363.61, 363.36, 162.78],
			peekers: [bare('sym-f4061', 600.5, 95.5, 0, 157), PINK(226.55, 199.96, -29.72), TEAL(1010.44, 212.25, 29.53)],
			// Here the blobs peek from behind the jelly bubbles.
			z: { ...STACK, peekers: 1 },
		},
		// MAX: the wide plate alone (no cloud, no jelly), the blobs behind everything, and the
		// drips hanging over the words.
		max: {
			color: '#9bf715',
			text: '#9bf715',
			plate: [600.5, 354, 1159, 512],
			jelly: [],
			drips: [
				left([199.64, 406.2, 147.27, 142.41]),
				right([1009.78, 389.22, 231, 180.9]),
				{ ...AMOUNT_DRIP, box: [780.18, 522.74, 93.94, 73.56] },
			],
			title: [598, 223, 590, 236],
			win: [597.5, 379.5, 561, 221],
			peekers: [
				bare('sym-f4061', 629.87, 77.87, 0, 197.74),
				PINK(203.24, 205.13, -30.5, [157.336, 139.736], 162.357, 18.824),
				TEAL(1022.37, 235.37, 45, [195.21, 150.91], 183.9, 21.32),
				bare('sym-9', 418.63, 116.63, -12.06, 176.32),
				bare('sym-7b', 894.36, 129.36, 30.9, 175.51),
			],
			z: { amount: 1, peekers: 0, jelly: 0, plaque: 3, drips: 6, title: 4, win: 5 },
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

	// Big-win screen: the scene dims, the neon plate (and its cloud) zooms out and pops into
	// place with the pink jelly bubbles swelling up behind it, the tier word drops in from the
	// top while WIN rises from the bottom, happy blobs climb out from behind and keep giggling,
	// the slime drips wobble, small jelly bubbles shower out (drawn live in Pixi,
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

	// Peekers rise out from toward the plate's middle.
	const [pcx, pcy] = t.plate;
	const peekers = t.peekers.map((p, i) => ({
		...p,
		dx: (pcx - p.c[0]) * 0.3,
		dy: (pcy - p.c[1]) * 0.3 + 30,
		giggle: (i * 0.37 + rand(0, 0.3)).toFixed(2),
	}));

	// The live bubbles (scene/WinFxView.ts) on a canvas just over the plate. The drips are the
	// design's own art now, so it draws none. Without WebGL the screen plays without bubbles.
	const drips = t.drips.map((d, i) => ({ ...d, wob: (i * 0.53 + rand(0, 0.4)).toFixed(2) }));
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
			<strong style={`font-size:${(AMOUNT[2] / 399) * Math.min(59.33, 330 / (0.62 * Math.max(1, final.length)))}px`}>{amount}</strong>
		</div>
		<!-- Behind the plaque: they climb out from behind it, then laugh. -->
		{#each peekers as p, i}
			<div class="peeker" style={`left:${p.c[0]}px;top:${p.c[1]}px;z-index:${t.z.peekers};--dx:${p.dx}px;--dy:${p.dy}px;--i:${i}`}>
				<div
					class="peek-frame"
					class:clip={p.clip !== null}
					style={`width:${p.frame[0]}px;height:${p.frame[1]}px;rotate:${p.rot}deg;border-radius:${p.clip ?? 0}px`}
				>
					<img src={`./win/hd/${p.src}.webp`} alt="" style={`width:${p.img[0]}px;height:${p.img[1]}px;--g:${p.giggle}s`} />
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
		{#each drips as d, i}
			<!-- The amount box's corner drip hangs with the box; the side drips hang off the plate. -->
			{@const onAmount = i === drips.length - 1}
			<div
				class="drip"
				class:on-amount={onAmount}
				style={`${box(d.box)};z-index:${onAmount ? amountZ + 1 : t.z.drips};--w:${d.wob}s`}
			>
				<img src={`./win/hd/${d.src}.webp`} alt="" style={`rotate:${d.rot}deg`} />
			</div>
		{/each}
		<div class="title" style={`${box(t.title)};z-index:${t.z.title}`}>
			<img src={`./win/hd/title-${tier}.webp`} alt="" style={crop(t.titleCrop)} />
		</div>
		{#if t.win}
			<div class="win-word" style={`${box(t.win)};z-index:${t.z.win}`}><img src={`./win/hd/win-${tier}.webp`} alt="" /></div>
		{/if}
	</div>
</div>

<style>
	/* Beats (ms at speed 1): dim 0-300, plaque 100-800, peekers from 350, title 450-1100,
	   WIN 650-1300, amount box 900-1400 (the count-up runs from App), drips 650-1250; the
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
	.win-word img {
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
	.jelly img,
	.drip img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	/* The pink jelly bubbles swell up behind the plate as it lands, then bob, out of step. */
	.jelly {
		animation:
			ws-swell calc(650ms * var(--spd)) calc((180ms + var(--i) * 70ms) * var(--spd)) both,
			ws-bob 3.2s ease-in-out calc(1s + var(--i) * 1.1s) infinite;
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
	@keyframes ws-bob {
		0%,
		100% {
			translate: 0 0;
			scale: 1;
		}
		50% {
			translate: 0 -6px;
			scale: 1.015 0.985;
		}
	}
	/* The drips ooze down off the plate once it has landed, then hang there wobbling. They
	   grow from their top edge, where they meet the slime. */
	.drip {
		transform-origin: 50% 15%;
		animation:
			ws-ooze calc(600ms * var(--spd)) calc(650ms * var(--spd)) both,
			ws-wobble 2.4s ease-in-out calc(1.4s + var(--w)) infinite;
	}
	.drip.on-amount {
		animation-delay: calc(900ms * var(--spd)), calc(1.6s + var(--w));
	}
	@keyframes ws-ooze {
		0% {
			opacity: 0;
			transform: scale(0.5, 0.2);
			animation-timing-function: cubic-bezier(0.3, 0.7, 0.4, 1);
		}
		60% {
			opacity: 1;
			transform: scale(0.94, 1.08);
		}
		100% {
			transform: none;
		}
	}
	@keyframes ws-wobble {
		0%,
		100% {
			scale: 1;
		}
		35% {
			scale: 0.97 1.05;
		}
		65% {
			scale: 1.02 0.98;
		}
	}
	/* The tier word falls in from the top, the WIN word shoots up from the bottom. */
	.title {
		animation: ws-from-top calc(650ms * var(--spd)) calc(220ms * var(--spd)) both;
	}
	.win-word {
		animation: ws-from-bottom calc(650ms * var(--spd)) calc(380ms * var(--spd)) both;
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
	.peek-frame img {
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
