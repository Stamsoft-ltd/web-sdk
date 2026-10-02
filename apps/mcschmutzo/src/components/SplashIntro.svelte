<script lang="ts">
	import { onMount } from 'svelte';
	import { ap } from '../lib/preloadArt';
	import { i18nDerived } from '../i18n/i18nDerived';
	import SauceCorner from './SauceCorner.svelte';
	import { SAUCE } from '../lib/splashSauce';
	import {
		panoramaRect,
		PANORAMA_BASE_X,
		PANORAMA_SPLASH_X,
	} from '../game/panorama';
	import SauceFx from './SauceFx.svelte';
	import { createPointGesture } from '../game/pointGesture';

	type Props = { onpress: () => void };
	const props: Props = $props();

	// Shrink a wrapping card title DOWN to fit its card by reducing FONT-SIZE (via the `--fit`
	// multiplier), not a transform. A transform scales the already-overflowed layout, which shoves a
	// long single word (de "EINZIGARTIGE", tr "SCHMUTZO'YA") off-centre and past the frame rule.
	// Reducing the font makes the text reflow so it actually fits, and `text-align: center` then keeps
	// every line centred. Only ever scales down — English/short titles stay at full size.
	function fitFont(node: HTMLElement, _dep?: unknown) {
		const fit = () => {
			const slot = node.parentElement;
			if (!slot) return;
			// Measure at FULL size: reset --fit to 1 so the line widths below are the real full-font
			// metrics (no extrapolation error). The parent's size is independent of --fit, so this
			// never re-triggers the observer below → no feedback loop.
			node.style.setProperty('--fit', '1');
			const cs = getComputedStyle(slot);
			const availW = slot.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
			const availH = slot.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
			// Widest actual LINE (getClientRects = the rendered text extent, incl. a single long word's
			// overflow). Using the line width — not scrollWidth — keeps short titles at full size: a
			// title only shrinks when a line genuinely can't fit, matching English's current look.
			const range = document.createRange();
			range.selectNodeContents(node);
			const widest = Math.max(0, ...Array.from(range.getClientRects(), (r) => r.width));
			const height = node.scrollHeight;
			let scale = 1;
			if (widest > availW && availW > 0) scale = Math.min(scale, availW / widest);
			if (height > availH && availH > 0) scale = Math.min(scale, availH / height);
			node.style.setProperty('--fit', scale < 1 ? String(scale) : '1');
		};
		const schedule = () => requestAnimationFrame(fit);
		const ro = new ResizeObserver(schedule);
		// Observe the CARD (parent), whose size is independent of --fit → resizing the viewport re-fits
		// but our own font change never re-triggers (no feedback loop).
		if (node.parentElement) ro.observe(node.parentElement);
		schedule();
		// The first pass runs in the fallback font (narrower); re-fit once the real font (Bowlby One SC)
		// has actually loaded. document.fonts.load resolves reliably even if `ready` already fired.
		if (typeof document !== 'undefined' && document.fonts) {
			try {
				const c = getComputedStyle(node);
				document.fonts
					.load(`${c.fontStyle} ${c.fontWeight} 40px ${c.fontFamily}`)
					.then(schedule)
					.catch(() => {});
			} catch {
				/* ignore an unparseable font shorthand — the timers below still cover the swap */
			}
			document.fonts.ready.then(schedule).catch(() => {});
		}
		const timers = [setTimeout(schedule, 200), setTimeout(schedule, 700)];
		return {
			update: schedule,
			destroy: () => {
				ro.disconnect();
				timers.forEach(clearTimeout);
			},
		};
	}

	const bg = ap('/assets/mcschmutzo/splash/bg.webp');
	// Wide screens: the LEFT end of the connected diner panorama (door, lamp, awning). Leaving the
	// splash pans the camera right to the panorama's base-game view, where the game's own background
	// takes over (same framing, see game/panorama.ts). Portrait keeps `bg` until mobile art exists.
	const panoArt = ap('/assets/mcschmutzo/background-panorama.webp');
	const logo = ap('/assets/mcschmutzo/logo-v3.webp');
	/** Percent of a box dimension, for laying art-pixel geometry over fluid-sized layers. */
	const pct = (v: number, of: number) => `${((v / of) * 100).toFixed(3)}%`;

	// The chef is the board chef (Figma "Frame 427321577", 4× = 1304×1699) flipped horizontally so he
	// faces the cards from the left — the base is pre-mirrored with the nametag re-pasted readable.
	// Layers: base (pupils erased, bottle hand cut out) + the bottle hand, drawn BEHIND the body and
	// shaking about the wrist. Pupils and eyelids are drawn in CSS. Geometry is in the frame's px.
	const manBase = ap('/assets/mcschmutzo/splash/man-base-v5.webp');
	const manHand = ap('/assets/mcschmutzo/splash/man-hand-v1.webp'); // pointing hand, gestures about the wrist

	// The pointing hand is JS-driven (not a CSS loop) so its "point-point" lands at random 3–6 s
	// intervals: breath drift + anticipation lift, jab, rebound, smaller jab, damped settle (shared
	// with the pixi chefs, game/pointGesture). The fingertip is RIGHT of the wrist here, so the
	// gesture's "+ = fingertip down" is a plain clockwise CSS rotate. The layer is cropped to the hand
	// (MAN.hand, 524 px wide), so a slide of `along` hand-lengths is along × (516 / 524) of its width.
	let manHandEl = $state<HTMLImageElement>();
	const HAND_LEN = 516 / 524;
	$effect(() => {
		const el = manHandEl;
		if (!el) return;
		const hand = createPointGesture();
		let raf = 0;
		let t0 = 0;
		const loop = (ts: number) => {
			if (!t0) t0 = ts;
			const t = ts - t0;
			// .man's chef-breathe runs 5 s ease-in-out alternate from exhaled: approximate it.
			const breath = -Math.cos((Math.PI * t) / 5000);
			const p = hand.pose(t, breath);
			const stretch = 1 + (1 - p.squash) * 0.4;
			el.style.transform = `translateX(${(p.along * HAND_LEN * 100).toFixed(3)}%) rotate(${p.angle.toFixed(3)}deg) scale(${p.squash.toFixed(4)}, ${stretch.toFixed(4)})`;
			raf = requestAnimationFrame(loop);
		};
		raf = requestAnimationFrame(loop);
		return () => cancelAnimationFrame(raf);
	});
	const manBottle = ap('/assets/mcschmutzo/splash/man-bottle-v3.webp');
	// The nametag plate (cropped layer over its baked copy) jiggles on its pin, like the board chef.
	const manLabel = ap('/assets/mcschmutzo/splash/man-label-v3.webp');
	// Mirrored board-chef nozzle (frame fractions) + squirt direction (up, leaning toward the cards).
	const NOZZLE = { x: 1 - 0.1438, y: 0.3773, dir: Math.atan2(-0.979, 0.204) };
	const manBrows = ap('/assets/mcschmutzo/splash/man-brows-v3.webp'); // above the lids
	const MAN_W = 1304;
	const MAN_H = 1699;
	type Box = [number, number, number, number];
	const MAN = {
		// Pupils: the board chef's (a touch smaller than the art, the far one nudged up to clear its
		// lower-lid line), mirrored.
		pupilL: [783, 462, 834, 513] as Box,
		pupilR: [625, 430, 689, 494] as Box,
		// Eye openings (outline bbox): the lids are clipped to these so a blink never paints outside the eye.
		eyeL: [782, 425, 872, 520] as Box,
		eyeR: [617, 395, 717, 512] as Box,
		bottle: [0, 0, 1304, 1699] as Box, // full-frame layer (its squirt is placed in frame fractions)
		// Hand / nametag / brows are cropped to their visible bounds (they were mostly-transparent
		// full-frame canvases); these boxes put each crop back exactly where it sat in the frame.
		hand: [16, 925, 540, 1370] as Box,
		label: [368, 1023, 624, 1160] as Box,
		brows: [574, 326, 907, 470] as Box,
		bottlePivot: [926, 951] as [number, number], // the wrist, tucked behind the body
		skin: '#ee9c58', // face skin right around the eyes (lid colour)
	};
	const manBox = ([x0, y0, x1, y1]: Box) =>
		`left:${pct(x0, MAN_W)};top:${pct(y0, MAN_H)};width:${pct(x1 - x0, MAN_W)};height:${pct(y1 - y0, MAN_H)};`;
	const bottleStyle =
		manBox(MAN.bottle) +
		`transform-origin:${pct(MAN.bottlePivot[0] - MAN.bottle[0], MAN.bottle[2] - MAN.bottle[0])} ` +
		`${pct(MAN.bottlePivot[1] - MAN.bottle[1], MAN.bottle[3] - MAN.bottle[1])};`;
	const pressPlay = ap('/assets/mcschmutzo/press-play.svg');
	// Card frames are drip-FREE; the corner sauce is drawn in code on top (SauceCorner + lib/splashSauce).
	const cardRed = ap('/assets/mcschmutzo/splash/card-red.webp');
	const cardYellow = ap('/assets/mcschmutzo/splash/card-yellow.webp');
	const cardGreen = ap('/assets/mcschmutzo/splash/card-green.webp');

	// Each card = an empty drip frame + HTML copy (so the text stays editable / localizable).
	// `pad` is the interior inset per frame — the red frame carries a baked drop-shadow margin, so it
	// needs a wider inset than the shadow-less yellow/green frames.
	// title/body entries are i18n keys (translated in the markup).
	const CARDS = [
		{
			cls: 'card--red',
			sauce: SAUCE.red,
			art: cardRed,
			title: 'SPLASH C1 TITLE',
			body: ['SPLASH C1 BODY'],
		},
		{
			cls: 'card--yellow',
			sauce: SAUCE.yellow,
			art: cardYellow,
			title: 'SPLASH C2 TITLE',
			body: ['SPLASH C2 BODY 1', 'SPLASH C2 BODY 2', 'SPLASH C2 BODY 3'],
		},
		{
			cls: 'card--green',
			sauce: SAUCE.green,
			art: cardGreen,
			title: 'SPLASH C3 TITLE',
			body: ['SPLASH C3 BODY'],
		},
	];

	// Leaving: the cards, logo and chef exit while the camera pans right across the panorama (and
	// the base game's 16% dim fades in), then the host fades the splash out over the game.
	const PAN_MS = 1700;
	let exiting = $state(false);
	let vw = $state(0);
	let vh = $state(0);
	const press = () => {
		if (exiting) return;
		if (isPortrait || matchMedia('(prefers-reduced-motion: reduce)').matches) {
			props.onpress();
			return;
		}
		exiting = true;
		setTimeout(() => props.onpress(), PAN_MS + 40);
	};
	const onKey = (e: KeyboardEvent) => {
		if (e.code === 'Space' || e.code === 'Enter') press();
	};
	const panoStyle = $derived.by(() => {
		const r = panoramaRect(vw, vh, PANORAMA_SPLASH_X);
		const pan = exiting ? (PANORAMA_BASE_X - PANORAMA_SPLASH_X) * r.k : 0;
		return `left:${r.x}px;top:${r.y}px;width:${r.width}px;height:${r.height}px;transform:translateX(${-pan}px);--pan-ms:${PAN_MS}ms`;
	});

	// Portrait (mobile): show the feature cards one at a time and auto-advance every 4.5s, with dot
	// indicators — matching the other games. Landscape/desktop keeps all three cards in a row.
	let isPortrait = $state(false);
	let slide = $state(0);
	const SLIDE_COUNT = CARDS.length;
	const currentCard = $derived(CARDS[slide]);
	const updateOrientation = () => (isPortrait = window.innerWidth < window.innerHeight);
	onMount(updateOrientation);
	$effect(() => {
		if (!isPortrait) {
			slide = 0;
			return;
		}
		const id = setInterval(() => (slide = (slide + 1) % SLIDE_COUNT), 4500);
		return () => clearInterval(id);
	});
</script>

<svelte:window onkeydown={onKey} onresize={updateOrientation} />

<div
	class="splash-intro"
	class:exiting
	role="button"
	tabindex="0"
	aria-label={i18nDerived.translate('PRESS TO CONTINUE')}
	onclick={press}
	onkeydown={onKey}
	bind:clientWidth={vw}
	bind:clientHeight={vh}
>
	{#if !isPortrait && vw > 0}
		<img class="pano" src={panoArt} alt="" draggable="false" style={panoStyle} />
		<div class="pano-dim" style={`--pan-ms:${PAN_MS}ms`}></div>
	{/if}
	<div class="stage" style={`--sbg-mobile:url('${bg}')`}>
		<!-- The board's "freshly polished" gleam: a tilted light band sweeps across the diner every 13s
		     (over the background, behind the logo / cards / chef). -->
		<div class="shine" aria-hidden="true"><div class="shine__band"></div></div>
		<img class="logo" src={logo} alt="McSchmutzo" draggable="false" />
		<div class="man" style={`--skin:${MAN.skin}`}>
			<div class="bottle" style={bottleStyle}>
				<img src={manBottle} alt="" draggable="false" />
				<!-- Now and then he squeezes the bottle: the board chef's ketchup squirt (it rides the bottle
				     layer, so it follows the shake). Fires in the calm part of the 9s shake loop. -->
				<SauceFx
					bleed={0.6}
					splashes={[
						{ x: NOZZLE.x, y: NOZZLE.y, dir: NOZZLE.dir, color: 0xb3160d, jets: 1, size: 1.2, delay: 1050, period: 9000, skip: 0.3 },
					]}
				/>
			</div>
			<img class="man-base" src={manBase} alt="" draggable="false" />
			<!-- Nametag under the pointing hand. -->
			<img class="man-label" src={manLabel} alt="" draggable="false" style={manBox(MAN.label)} />
			<img class="man-hand" bind:this={manHandEl} src={manHand} alt="" draggable="false" style={manBox(MAN.hand)} />
			<span class="man-sparkle" aria-hidden="true"></span>
			<div class="pupil" style={manBox(MAN.pupilL)}><span class="glint"></span></div>
			<div class="pupil" style={manBox(MAN.pupilR)}><span class="glint"></span></div>
			<div class="eye" style={manBox(MAN.eyeL)}><div class="lid"></div></div>
			<div class="eye" style={manBox(MAN.eyeR)}><div class="lid"></div></div>
			<!-- Brows over the lids, so a blink closes under the brow. -->
			<img class="man-brows" src={manBrows} alt="" draggable="false" style={manBox(MAN.brows)} />
		</div>
		<!-- Mobile only: replaces the logo + character with the Press Play wordmark. -->
		<img class="pp-mark" src={pressPlay} alt="Press Play" draggable="false" />

		{#snippet cardEl(card: (typeof CARDS)[number])}
			<div class="card {card.cls}" style={`background-image:url('${card.art}')`}>
				<!-- Corner sauce, drawn in code: the blob + both tendrils dripping. Sits under the copy like the
				     old baked-in drip did; the wrap sags as a whole. -->
				<div class="drip-wrap">
					<SauceCorner spec={card.sauce} />
				</div>
				<div class="card-inner">
					<h3 class="card-title" use:fitFont={i18nDerived.translate(card.title)}>
						{i18nDerived.translate(card.title)}
					</h3>
					<div class="card-body">
						{#each card.body as line (line)}<p>{i18nDerived.translate(line)}</p>{/each}
					</div>
				</div>
			</div>
		{/snippet}

		<div class="cards" class:cards--single={isPortrait}>
			{#if isPortrait}
				{@render cardEl(currentCard)}
			{:else}
				{#each CARDS as card (card.cls)}
					{@render cardEl(card)}
				{/each}
			{/if}
		</div>

		{#if isPortrait}
			<div class="dots">
				{#each CARDS as _, i (i)}
					<span class="dot" class:dot--on={slide === i}></span>
				{/each}
			</div>
		{/if}

		<p class="press-label">{i18nDerived.translate('PRESS TO CONTINUE')}&nbsp;→</p>
	</div>
</div>

<style>
	.splash-intro {
		position: absolute;
		inset: 0;
		z-index: 10;
		cursor: pointer;
		outline: none;
		user-select: none;
		overflow: hidden;
		background: #f0bd7f;
	}

	/* Cover-scaled 16:9 stage — the artwork keeps its aspect and the long axis overhangs. */
	.stage {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		width: max(100vw, calc(100vh * 16 / 9));
		height: max(100vh, calc(100vw * 9 / 16));
		/* Wide screens draw the panorama (.pano) behind the stage; portrait uses the mobile bg (below). */
		background-repeat: no-repeat;
		container-type: size;
	}

	/* The diner panorama, positioned in px from panoramaRect (same maths as the game's background).
	   The camera pan is a translateX to the base-game view. */
	.pano {
		position: absolute;
		max-width: none;
		transition: transform var(--pan-ms) cubic-bezier(0.65, 0, 0.35, 1);
		will-change: transform;
		pointer-events: none;
	}
	/* The base game's background carries a 16% dark wash — fade it in during the pan so the handover
	   to the game background is seamless. */
	.pano-dim {
		position: absolute;
		inset: 0;
		background: #180903;
		opacity: 0;
		transition: opacity var(--pan-ms) ease-in-out;
		pointer-events: none;
	}
	.exiting .pano-dim {
		opacity: 0.16;
	}

	/* Same as the board's shine (Background.svelte): wide band at 11% white + a narrow core (4% of the
	   width) on top, tilted 0.32 rad, sweeping −20% → 120% over 2.8s of every 10s with a sine fade. */
	.shine {
		position: absolute;
		inset: 0;
		overflow: hidden;
		pointer-events: none;
	}
	.shine__band {
		position: absolute;
		top: -35%;
		left: -20%;
		width: 11%;
		height: 170%;
		transform: translateX(-50%) rotate(18.3deg);
		background: linear-gradient(
			to right,
			rgba(255, 255, 255, 0.11) 0 31.8%,
			rgba(255, 255, 255, 0.25) 31.8% 68.2%,
			rgba(255, 255, 255, 0.11) 68.2%
		);
		opacity: 0;
		animation: shine-sweep 13s linear 2.5s infinite;
	}
	@keyframes shine-sweep {
		0% {
			left: -20%;
			opacity: 0;
		}
		7% {
			opacity: 0.71;
		}
		14% {
			opacity: 1;
		}
		21% {
			opacity: 0.71;
		}
		28% {
			left: 120%;
			opacity: 0;
		}
		100% {
			left: 120%;
			opacity: 0;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.shine {
			display: none;
		}
	}
	.logo {
		position: absolute;
		left: 50%;
		top: 4.5%;
		transform: translateX(-50%);
		width: 39%;
		height: auto;
		object-fit: contain;
		filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.35));
		/* Entrance: once the cards are in, it drops in from the top and bounces to rest, then stays put. */
		animation: logo-in 1.1s linear 1.75s both;
	}

	.man {
		position: absolute;
		left: -1.5%;
		/* Sunk below the stage edge so the art's curved apron cut-off is never visible — the screen
		   edge crops his lower torso (the stage is a 16:9 cover box, so its bottom is always at or
		   below the viewport's). */
		bottom: -5%;
		height: 58%;
		aspect-ratio: 1304 / 1699;
		/* The real art's frame includes the raised bottle on its right, so the figure is wider than
		   the old cut — sit him IN FRONT of the card stack (a foreground character) so the bottle
		   isn't swallowed behind the first card. */
		z-index: 3;
		/* Alive: a slow breath on the whole figure; the eyes glance around and blink, and the ketchup
		   bottle gets a little shake — each its own layer (see the script constants). */
		transform-origin: 50% 100%;
		animation:
			chef-breathe 5s ease-in-out infinite alternate,
			man-in 1.1s cubic-bezier(0.22, 1, 0.36, 1) 2.7s both;
	}
	.man-base,
	.bottle img {
		display: block;
		width: 100%;
		height: 100%;
	}
	.man-base {
		position: absolute;
		inset: 0;
	}
	.pupil,
	.eye,
	.bottle {
		position: absolute;
	}
	/* Pupils: dark disc + a glint, sitting where the erased ones were; they dart around now and then. */
	.pupil {
		border-radius: 50%;
		background: radial-gradient(circle at 50% 50%, #1a1512 0 62%, #0d0a08 100%);
		animation: eyes-look 13s ease-in-out infinite;
	}
	.pupil .glint {
		position: absolute;
		left: 28%;
		top: 20%;
		width: 34%;
		height: 32%;
		border-radius: 50%;
		background: #fff;
	}
	/* Eyelids: each eye opening is a clipped ellipse and its skin-coloured lid slides down inside it
	   for a blink — mid-blink it reads as a lid over the eye, never as a bar on the forehead. */
	.eye {
		border-radius: 50%;
		overflow: hidden;
		pointer-events: none;
	}
	.lid {
		position: absolute;
		inset: 0;
		background: var(--skin);
		box-shadow: inset 0 -2px 0 #2b1a10;
		transform: translateY(-101%);
		animation: eyes-blink 7s linear infinite;
	}
	.bottle {
		animation: bottle-shake 9s ease-in-out infinite;
	}
		.man-brows {
		position: absolute;
	}
	/* Pointing hand: pivots about the wrist (sleeve cuff, frame 4.9% / 69.45%); the script's rAF loop
	   writes its transform (breath drift + random "point-point"). */
	.man-hand {
		position: absolute;
		transform-origin: 9.14% 57.29%; /* the wrist: frame 4.9% / 69.45% */
		will-change: transform;
	}
	/* Nametag jiggles on its pin (pin = top-centre of the plate: 38.04% / 60.45% of the frame). */
	.man-label {
		position: absolute;
		transform-origin: 50.02% 2.95%; /* the pin: frame 38.04% / 60.45% */
		animation: label-jiggle 2.2s ease-in-out infinite alternate;
	}
	@keyframes label-jiggle {
		from {
			transform: rotate(-1.6deg);
		}
		to {
			transform: rotate(1.6deg);
		}
	}
	/* Tooth *ding*: a 4-point sparkle that flashes on his grin now and then (board chef's, mirrored). */
	.man-sparkle {
		position: absolute;
		left: 54%;
		top: 37.6%;
		width: 7.5%;
		aspect-ratio: 1;
		transform: translate(-50%, -50%) scale(0);
		background:
			linear-gradient(#fff, #fff) center / 15% 100% no-repeat,
			linear-gradient(#fff, #fff) center / 100% 15% no-repeat,
			radial-gradient(circle, #fff 0 20%, transparent 21%);
		border-radius: 2px;
		pointer-events: none;
		animation: tooth-ding 6s ease-out 2.5s infinite;
	}
	@keyframes tooth-ding {
		0%,
		86%,
		100% {
			transform: translate(-50%, -50%) scale(0) rotate(0deg);
			opacity: 0;
		}
		90% {
			transform: translate(-50%, -50%) scale(1.1) rotate(20deg);
			opacity: 1;
		}
		95% {
			transform: translate(-50%, -50%) scale(0.7) rotate(40deg);
			opacity: 0.8;
		}
	}

	/* Press Play wordmark — mobile only (see portrait media query); hidden on desktop. */
	.pp-mark {
		display: none;
	}

	/* Three cards centred in the lower half, clear of the character on the left. */
	.cards {
		position: absolute;
		left: 51%;
		top: 52%;
		transform: translate(-50%, -50%);
		height: 58%;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.6cqw;
	}

	.card {
		position: relative;
		height: 100%;
		/* All three frames are cropped to the same 470×690 box, so one aspect ratio → equal width &
		   height for every card (and the gap between them stays equal). */
		aspect-ratio: 470 / 690;
		background-size: 100% 100%;
		background-repeat: no-repeat;
		background-position: center;
		filter: drop-shadow(0 6px 12px rgba(0, 0, 0, 0.22));
		/* Each card is its own query container so the copy scales with the card in ANY orientation
		   (on portrait the row shrinks the cards, and the text has to follow). */
		container-type: size;
		/* Entrance choreography: the cards fly in from three sides — left card from the left, right
		   card from the right, centre card up from the bottom — while the logo drops in from the top.
		   Both flat rows keep the position rules above (transform is only used by the entrance). */
		/* Slow, one after another: left, centre, right. */
		animation: card-in-bottom 1.15s cubic-bezier(0.22, 1, 0.36, 1) both;
		animation-delay: 0.25s;
	}
	/* Staggered arrival (logo first, then left → centre → right) so the eye can follow each one. */
	.cards:not(.cards--single) .card:nth-child(1) {
		animation-name: card-in-left;
		animation-delay: 0.45s;
	}
	.cards:not(.cards--single) .card:nth-child(2) {
		animation-delay: 0.6s;
	}
	.cards:not(.cards--single) .card:nth-child(3) {
		animation-name: card-in-right;
		animation-delay: 0.95s;
	}

	/* Leaving (camera pan): everything clears out the way it came, quickly, as the view moves on. */
	.exiting .card {
		animation: card-out-bottom 0.65s cubic-bezier(0.55, 0, 0.9, 0.4) forwards;
	}
	.exiting .cards:not(.cards--single) .card:nth-child(1) {
		animation-name: card-out-left;
	}
	.exiting .cards:not(.cards--single) .card:nth-child(2) {
		animation-delay: 0.06s;
	}
	.exiting .cards:not(.cards--single) .card:nth-child(3) {
		animation-name: card-out-right;
		animation-delay: 0.12s;
	}
	.exiting .logo {
		animation: logo-out 0.55s cubic-bezier(0.55, 0, 0.9, 0.4) forwards;
	}
	.exiting .man {
		animation: man-out 0.6s cubic-bezier(0.55, 0, 0.9, 0.4) forwards;
	}
	.exiting .press-label,
	.exiting .shine {
		animation: none;
		opacity: 0;
		transition: opacity 0.25s ease;
	}

	/* The corner sauce fills the card box exactly like the frame. The wrap sags as a whole (slow). */
	.drip-wrap {
		position: absolute;
		inset: 0;
		transform-origin: 0 0;
		animation: sauce-sag 9.5s ease-in-out infinite alternate;
	}
	.card--yellow .drip-wrap {
		animation-delay: -2.2s;
	}
	.card--green .drip-wrap {
		animation-delay: -4.4s;
	}

	/* Copy sits inside the cream interior; insets tuned per frame (red carries the shadow margin). */
	.card-inner {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		/* Centre the title+body block so it fills the card (title upper, description mid-lower with a
		   gap) instead of clustering at the top and leaving the lower half empty. */
		justify-content: center;
		text-align: center;
		font-family: 'Poppins', sans-serif;
		/* Insets clear the drip on the red/yellow cards; trimmed so longer localized titles/bodies
		   (pt, ru, fi, id) still fit inside the cream area. */
		padding: 15.5% 12.5% 12%;
	}

	/* Titles = Bowlby One 32px @ design (cqh is a fraction of the CARD's height, so it scales with
	   the card in any orientation: a 367px-tall desktop card → ~32px). */
	.card-title {
		margin: 0;
		max-width: 100%;
		/* Titles may carry explicit line breaks (card 2: the number on its own line, as designed). */
		white-space: pre-line;
		/* A big base size (matches the design); the `fitFont` action multiplies it by `--fit` (≤1) per
		   card so long localized words (fi "AINUTLAATUISTA", de "EINZIGARTIGE", tr) shrink to fit the
		   frame — reflowing (so they stay centred) instead of breaking mid-word or spilling past it. */
		font-family: 'Bowlby One SC', 'Bowlby One', sans-serif;
		font-weight: 400;
		line-height: 1.16;
		letter-spacing: 0.03em;
		/* cqw (card WIDTH) not cqh, so a wide word like "SCHMUTZO" fits the frame at any card size.
		   Sized so the title reads big (wraps to ~3 lines) yet long localized titles still fit. */
		font-size: calc(11.5cqw * var(--fit, 1));
	}
	.card--red .card-title {
		color: #c41e0a;
	}
	.card--yellow .card-title {
		color: #e2b700;
	}
	.card--green .card-title {
		color: #75ac10;
	}

	/* Description = Nunito 20px @ design. A clear gap below the title (mid-lower placement). */
	.card-body {
		margin-top: 5cqh;
		font-family: 'Nunito', sans-serif;
		color: #232323;
		font-weight: 500;
		font-size: 4.5cqh;
		line-height: 1.3;
		letter-spacing: 0.02em;
	}
	.card-body p {
		margin: 0;
	}

	/* Carousel dot indicators (portrait only). */
	.dots {
		position: absolute;
		left: 50%;
		bottom: 8.5%;
		transform: translateX(-50%);
		z-index: 2;
		display: flex;
		gap: 10px;
	}
	.dot {
		width: 9px;
		height: 9px;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.4);
		transition: background 0.2s ease;
	}
	.dot--on {
		background: #ffffff;
	}

	.press-label {
		position: absolute;
		left: 50%;
		bottom: 3.2%;
		transform: translateX(-50%);
		margin: 0;
		white-space: nowrap;
		font-family: 'Poppins', sans-serif;
		font-weight: 700;
		font-size: clamp(13px, 2.1cqh, 24px);
		letter-spacing: 0.08em;
		color: #fff;
		text-shadow: 0 2px 5px rgba(0, 0, 0, 0.55);
		animation: blink 2.4s ease-in-out infinite;
	}

	/* Portrait: the 16:9 scene can't cover-scale without cropping the cards off, so let the background
	   cover the viewport and lay the three cards in a row that fits the width. Card text scales with
	   the (smaller) cards via their own container, bumped up here so it stays legible. */
	@media (max-aspect-ratio: 1 / 1) {
		.stage {
			top: 0;
			left: 0;
			transform: none;
			width: 100%;
			height: 100%;
			/* Portrait keeps the original mobile bg until the new mobile art is supplied. */
			background-image: var(--sbg-mobile);
			background-size: cover;
			background-position: center 22%;
		}
		/* Mobile: drop the character + big logo, show just the Press Play wordmark at the top. */
		.logo,
		.man {
			display: none;
		}
		.pp-mark {
			display: block;
			position: absolute;
			left: 50%;
			top: 5.5%;
			transform: translateX(-50%);
			width: min(38%, 150px);
			height: auto;
			object-fit: contain;
			filter: drop-shadow(0 2px 6px rgba(0, 0, 0, 0.3));
		}
		.cards {
			left: 50%;
			top: 46%;
			transform: translate(-50%, -50%);
			width: 98%;
			height: auto;
			gap: 4%;
		}
		.card {
			height: auto;
			flex: 1 1 0;
			min-width: 0;
		}
		/* One card at a time on mobile: a single, larger centred card. */
		.cards--single {
			width: auto;
		}
		.cards--single .card {
			flex: 0 0 auto;
			width: min(66vw, 340px);
		}
		.man {
			height: 30%;
			left: -7%;
		}
		.press-label {
			bottom: 3%;
			font-size: clamp(12px, 4.2vw, 20px);
		}
	}

	/* Offsets are in stage container units (cqw/cqh of `.stage`), so every start point is fully
	   off-screen at any viewport size. */
	@keyframes card-in-left {
		from {
			transform: translateX(-90cqw);
		}
		to {
			transform: translateX(0);
		}
	}
	@keyframes card-in-right {
		from {
			transform: translateX(90cqw);
		}
		to {
			transform: translateX(0);
		}
	}
	@keyframes card-in-bottom {
		from {
			transform: translateY(110cqh);
		}
		to {
			transform: translateY(0);
		}
	}
	/* Drop from above the stage, land, two settling bounces. */
	@keyframes logo-in {
		0% {
			transform: translate(-50%, -70cqh);
			animation-timing-function: cubic-bezier(0.55, 0, 1, 0.45); /* falling: accelerate */
		}
		55% {
			transform: translate(-50%, 0);
			animation-timing-function: cubic-bezier(0, 0.55, 0.45, 1); /* rebound: decelerate */
		}
		72% {
			transform: translate(-50%, -4.5cqh);
			animation-timing-function: cubic-bezier(0.55, 0, 1, 0.45);
		}
		86% {
			transform: translate(-50%, 0);
			animation-timing-function: cubic-bezier(0, 0.55, 0.45, 1);
		}
		93% {
			transform: translate(-50%, -1.2cqh);
			animation-timing-function: cubic-bezier(0.55, 0, 1, 0.45);
		}
		100% {
			transform: translate(-50%, 0);
		}
	}
	@keyframes logo-out {
		from {
			transform: translate(-50%, 0);
		}
		to {
			transform: translate(-50%, -80cqh);
		}
	}
	@keyframes man-in {
		from {
			translate: -120% 0;
		}
		to {
			translate: 0 0;
		}
	}
	@keyframes man-out {
		from {
			translate: 0 0;
		}
		to {
			translate: -130% 0;
		}
	}
	@keyframes card-out-left {
		to {
			transform: translateX(-90cqw);
		}
	}
	@keyframes card-out-right {
		to {
			transform: translateX(90cqw);
		}
	}
	@keyframes card-out-bottom {
		to {
			transform: translateY(110cqh);
		}
	}

	/* A tendril slowly lengthens (and thins a touch, like sauce does), then eases back. */
	@keyframes sauce-sag {
		from {
			transform: scaleY(1);
		}
		to {
			transform: scaleY(1.02);
		}
	}
	@keyframes eyes-look {
		0%,
		38%,
		78%,
		100% {
			transform: translate(0, 0);
		}
		41%,
		56% {
			transform: translate(-13%, 5%);
		}
		59%,
		75% {
			transform: translate(11%, -3%);
		}
	}
	@keyframes eyes-blink {
		0%,
		90%,
		100% {
			transform: translateY(-101%);
		}
		92.5% {
			transform: translateY(0);
		}
		95% {
			transform: translateY(-101%);
		}
	}
	@keyframes bottle-shake {
		0%,
		48%,
		66%,
		100% {
			transform: rotate(0deg);
		}
		51% {
			transform: rotate(-3.2deg);
		}
		54% {
			transform: rotate(2.6deg);
		}
		57% {
			transform: rotate(-2deg);
		}
		60% {
			transform: rotate(1.2deg);
		}
		63% {
			transform: rotate(-0.5deg);
		}
	}
	@keyframes chef-breathe {
		from {
			scale: 1 1;
		}
		to {
			scale: 1.008 1.018;
		}
	}

	@keyframes blink {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.55;
		}
	}
</style>
