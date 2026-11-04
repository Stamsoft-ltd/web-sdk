<script lang="ts" module>
	export type WinTier = 'sweet' | 'wild' | 'epic' | 'mythic' | 'legendary' | 'max';
	/** A layer's box as the design places it on the 1200×670 stage: [left, top, width, height]. */
	type Rect = [x: number, y: number, w: number, h: number];
	type Tier = {
		/** The pink jelly cloud (win/v3/cloud.svg, one vector stretched to each tier's box). */
		cloud: Rect;
		/** The tier word (win/v3/title-<tier>.svg) and the WIN word (win/v3/win.svg). */
		title: Rect;
		win: Rect;
	};
	// From the Figma "Types of wins" screens (1200×670), every part a vector group: sweet
	// 11433:25489, wild 11433:25995, epic 11433:26902, mythic 11433:26434, legendary 11433:27342,
	// max 11008:30148. No blobs (user 2026-11-03: "Dont add blobs use as reference wild win").
	// MAX's cloud is a raster in the design; the vector cloud sits on its opaque bounds.
	export const TIERS: Record<WinTier, Tier> = {
		sweet: {
			cloud: [257.57, 155.69, 685.44, 290.52],
			title: [388, 189, 431.5, 145.29],
			win: [456.87, 333.77, 292.73, 128.23],
		},
		wild: {
			cloud: [235.96, 147.13, 728.91, 308.94],
			title: [384, 158, 429, 165],
			win: [429.13, 322.87, 338.94, 148.47],
		},
		epic: {
			cloud: [187.44, 122.88, 824.55, 349.48],
			title: [382, 146, 436.18, 171.83],
			win: [406.72, 312.18, 385.49, 168.86],
		},
		mythic: {
			cloud: [223, 142, 755, 320],
			title: [320, 168, 560.29, 178.94],
			win: [398.35, 325.2, 385.49, 168.86],
		},
		legendary: {
			cloud: [165.97, 119.42, 869.76, 368.64],
			title: [253.72, 165.29, 695.73, 205.2],
			win: [424.72, 341.29, 367.82, 161.12],
		},
		max: {
			cloud: [167.3, 125.5, 846.9, 367.2],
			title: [359, 125, 474, 214.83],
			win: [391.62, 323.62, 416.19, 182.31],
		},
	};
	// The amount box ("Frame 427321543", 400×93.85). The design has it at x 417 (393 on MAX),
	// a little off the stage's centre line; it is centred here.
	const AMOUNT: Rect = [400, 524, 400, 93.85];
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
	import { onMount, untrack } from 'svelte';

	// Big-win screen: the scene dims, the pink jelly cloud zooms out and pops into place, the
	// tier word drops in from the top while WIN rises from the bottom, small jelly bubbles shower
	// out (drawn live in Pixi, scene/WinFxView.ts), and the amount box pops up and counts.
	// All lettering and the cloud are vectors, sharp at any zoom. `speed` scales every beat (turbo).
	// `tier` steps up while the screen is open (App counts SWEET -> WILD -> ... as the amount
	// passes each threshold): the boxes grow to the new tier's, the new word stamps down, the
	// cloud and WIN jelly-bump and the bubbles fountain again at the new tier's rate.
	let {
		tier,
		amount,
		final = amount,
		speed = 1,
		onskip,
	}: { tier: WinTier; amount: string; final?: string; speed?: number; onskip?: () => void } = $props();

	let t = $derived(TIERS[tier]);
	let vw = $state(1200);
	let vh = $state(670);
	// On a tall screen the 1200-wide stage would leave the cloud a strip across the middle:
	// it fills ~94% of the width instead (and the whole stage's height still has to fit).
	let fit = $derived(vw < vh ? Math.min((0.94 * vw) / t.cloud[2], vh / 670) : Math.min(vw / 1200, vh / 670));

	const box = ([x, y, w, h]: Rect) => `left:${x}px;top:${y}px;width:${w}px;height:${h}px`;
	const plaque = (c: Rect): [number, number, number, number] => [c[0] + c[2] / 2, c[1] + c[3] / 2, c[2], c[3]];
	let title = $derived(`./win/v3/title-${tier}.svg`);
	const win = './win/v3/win.svg';

	let view: { destroy(): void; levelUp(burst: number, rate: number, plaque: [number, number, number, number]): void } | null = null;
	let cloudEl = $state<HTMLDivElement>();
	let titleEl = $state<HTMLDivElement>();
	let winEl = $state<HTMLDivElement>();
	let amountEl = $state<HTMLDivElement>();
	// The step-up beat. Scripted (element.animate) so it plays over the CSS entrance and idle
	// loops without restarting them; the reduced-motion CSS doesn't reach it, so it checks itself.
	const STAMP: Keyframe[] = [
		{ transform: 'scale(1.9)', opacity: 0.35, easing: 'cubic-bezier(0.5, 0, 0.9, 0.6)' },
		{ transform: 'scale(0.86, 0.9)', opacity: 1, offset: 0.4, easing: 'cubic-bezier(0.2, 0.7, 0.4, 1)' },
		{ transform: 'scale(1.08, 1.04)', offset: 0.65 },
		{ transform: 'scale(0.98, 1.01)', offset: 0.85 },
		{ transform: 'none' },
	];
	const BUMP: Keyframe[] = [
		{ transform: 'none', easing: 'cubic-bezier(0.3, 0.7, 0.5, 1)' },
		{ transform: 'scale(1.12, 0.9)', offset: 0.25 },
		{ transform: 'scale(0.95, 1.06)', offset: 0.5 },
		{ transform: 'scale(1.02, 0.98)', offset: 0.75 },
		{ transform: 'none' },
	];
	let shownTier = untrack(() => tier);
	$effect(() => {
		const now = tier;
		if (now === shownTier) return;
		shownTier = now;
		const [burst, rate] = BUBBLES[now];
		view?.levelUp(burst, rate, plaque(TIERS[now].cloud));
		if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		const ms = 560 * speed;
		titleEl?.animate(STAMP, { duration: ms });
		cloudEl?.animate(BUMP, { duration: ms });
		winEl?.animate(BUMP, { duration: ms, delay: 70 * speed });
		amountEl?.animate(BUMP, { duration: ms * 0.8, delay: 120 * speed });
	});

	// The live bubbles (scene/WinFxView.ts) on a canvas over the cloud, under the words. Without
	// WebGL the screen plays without bubbles.
	let fxHost = $state<HTMLDivElement>();
	onMount(() => {
		let dead = false;
		// The higher tiers' words decoded up front, so a step-up never shows a blank title.
		for (const k of Object.keys(TIERS)) {
			const img = new Image();
			img.src = `./win/v3/title-${k}.svg`;
			img.decode().catch(() => {});
		}
		const drop = (e: unknown) => {
			console.error('[WinFx]', e);
			view?.destroy();
			view = null;
		};
		import('../scene/WinFxView')
			.then(async ({ WinFxView }) => {
				if (dead || !fxHost) return;
				const [burst, rate] = BUBBLES[tier];
				const v = new WinFxView({ anchors: [], outline: 0, plaque: plaque(t.cloud), burst, rate, speed });
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
<div class={`win-screen ${tier}`} style={`--spd:${speed}`} onclick={onskip}>
	<div class="dim"></div>
	<div class="frame" style={`transform:translate(-50%,-50%) scale(${fit})`}>
		<div class="cloud" bind:this={cloudEl} style={box(t.cloud)}><img src="./win/v3/cloud.svg" alt="" /></div>
		<div class="fx" bind:this={fxHost}></div>
		<div class="title" bind:this={titleEl} style={box(t.title)}>
			<img src={title} alt="" />
			<span class="shine" style={`--src:url(${title})`}></span>
		</div>
		<div class="win-word" bind:this={winEl} style={box(t.win)}>
			<img src={win} alt="" />
			<span class="shine" style={`--src:url(${win})`}></span>
		</div>
		<!-- Over the live bubbles, so they pass behind the number. -->
		<div class="amount" bind:this={amountEl} style={box(AMOUNT)}>
			<!-- Sized for the final amount, so the count-up doesn't shrink as it grows. -->
			<strong class:landed={amount === final} style={`font-size:${Math.min(48.86, 330 / (0.62 * Math.max(1, final.length)))}px`}>{amount}</strong>
		</div>
	</div>
</div>

<style>
	/* Beats (ms at speed 1): dim 0-300, cloud 100-800, title 220-870, WIN 380-1030, amount box
	   560-1060 (the count-up runs from App); the bubbles (WinFxView) fountain from the cloud's
	   landing on. Paint order is the design's: cloud, bubbles, words, amount. */
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
	/* A step-up grows the boxes to the new tier's with a little overshoot (and the frame, whose
	   fit on a tall screen follows the cloud's width). */
	.frame,
	.cloud,
	.title,
	.win-word {
		transition-property: left, top, width, height, transform;
		transition-duration: calc(420ms * var(--spd));
		transition-timing-function: cubic-bezier(0.34, 1.5, 0.6, 1);
	}
	.cloud img,
	.title img,
	.win-word img,
	.win-word .shine,
	.title .shine {
		position: absolute;
		left: 0;
		top: 0;
		width: 100%;
		height: 100%;
	}
	/* The cloud zooms out from close up and pops into place with a jelly settle, then keeps
	   breathing like a jelly balloon (on `scale`, so it composes with the entrance). */
	.cloud {
		pointer-events: none;
		animation:
			ws-plaque calc(700ms * var(--spd)) calc(100ms * var(--spd)) both,
			ws-breath 3.4s ease-in-out calc(800ms * var(--spd)) infinite;
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
	@keyframes ws-breath {
		0%,
		100% {
			scale: 1;
		}
		30% {
			scale: 1.025 0.975;
		}
		65% {
			scale: 0.985 1.02;
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
	/* Amount box (the design's "Frame 427321543"): pops up after the titles. */
	.amount {
		display: grid;
		place-items: center;
		background: #fb73b1;
		border-radius: 18.46px;
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
		letter-spacing: 1.47px;
		color: #fff;
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
			transition-duration: 0s !important;
		}
	}
</style>
