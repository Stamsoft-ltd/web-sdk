<script lang="ts">
	import { onMount } from 'svelte';
	import { ap } from '../lib/preloadArt';
	import { i18nDerived } from '../i18n/i18nDerived';
	import DustFx from './DustFx.svelte';
	import SauceFx from './SauceFx.svelte';

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
	// New desktop (wide) diner background; portrait/mobile keeps `bg` until the mobile art is supplied.
	const bgDesktop = ap('/assets/mcschmutzo/splash/bg-desktop.webp');
	const logo = ap('/assets/mcschmutzo/logo-v3.webp');
	/** Percent of a box dimension, for laying art-pixel geometry over fluid-sized layers. */
	const pct = (v: number, of: number) => `${((v / of) * 100).toFixed(3)}%`;

	// The chef is the board chef (Figma "Frame 427321577", 4× = 1304×1699) flipped horizontally so he
	// faces the cards from the left — the base is pre-mirrored with the nametag re-pasted readable.
	// Layers: base (pupils erased, bottle hand cut out) + the bottle hand, drawn BEHIND the body and
	// shaking about the wrist. Pupils and eyelids are drawn in CSS. Geometry is in the frame's px.
	const manBase = ap('/assets/mcschmutzo/splash/man-base-v4.webp');
	const manHand = ap('/assets/mcschmutzo/splash/man-hand-v1.webp'); // pointing hand, gestures about the wrist
	const manBottle = ap('/assets/mcschmutzo/splash/man-bottle-v3.webp');
	// The nametag plate (full-frame layer over its baked copy) jiggles on its pin, like the board chef.
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
		bottle: [0, 0, 1304, 1699] as Box, // full-frame layer
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
	// Card frames are now drip-FREE (the drip was cut out of the original art: clean frame = the
	// frame's own right corner mirrored over the left, drip = the difference). Each drip is a
	// full-card-size layer (drip-*.webp, same 470×690 box) so it lines up with the frame at any size.
	const cardRed = ap('/assets/mcschmutzo/splash/card-red.webp');
	const cardYellow = ap('/assets/mcschmutzo/splash/card-yellow.webp');
	const cardGreen = ap('/assets/mcschmutzo/splash/card-green.webp');
	const dripRed = ap('/assets/mcschmutzo/splash/drip-red.webp');
	const dripYellow = ap('/assets/mcschmutzo/splash/drip-yellow.webp');
	const dripGreen = ap('/assets/mcschmutzo/splash/drip-green.webp');

	// Live sauce: the drip renders as three copies of the same layer — the cap, plus the two long
	// hanging tendrils, each clipped to its own column below a `cut` row (chosen just under the sauce
	// valleys on either side, so the column holds nothing but that tendril) and stretched from that
	// row on its own phase. Because the cut row is the transform origin it never moves → no seam.
	// Columns/cuts are measured on the 470×690 art (px); cx is the tendril's centre for the squeeze.
	type Tendril = { x0: number; x1: number; cut: number; cx: number };
	const ART_W = 470;
	const ART_H = 690;
	// The tendril clip overlaps the cap by a few source px (OVERLAP) — with both clip edges on the
	// same pixel row their anti-aliased halves summed to a visible hairline. The origin stays on
	// the cut row, so the overlapping rows above it move by a sub-pixel at most.
	const OVERLAP = 3;
	const tendrilStyle = (t: Tendril) =>
		`clip-path:inset(${pct(t.cut - OVERLAP, ART_H)} ${pct(ART_W - t.x1 - OVERLAP, ART_W)} 0 ${pct(Math.max(0, t.x0 - OVERLAP), ART_W)});` +
		`transform-origin:${pct(t.cx, ART_W)} ${pct(t.cut, ART_H)};`;
	// The cap = everything except the two tendril rectangles (a comb-shaped polygon).
	const capStyle = (a: Tendril, b: Tendril) => {
		const [l, r] = a.x0 <= b.x0 ? [a, b] : [b, a];
		const P = (x: number, y: number) => `${pct(x, ART_W)} ${pct(y, ART_H)}`;
		return (
			`clip-path:polygon(${P(0, 0)},${P(ART_W, 0)},${P(ART_W, ART_H)},` +
			`${P(r.x1, ART_H)},${P(r.x1, r.cut)},${P(r.x0, r.cut)},${P(r.x0, ART_H)},` +
			`${P(l.x1, ART_H)},${P(l.x1, l.cut)},${P(l.x0, l.cut)},${P(l.x0, ART_H)},${P(0, ART_H)});`
		);
	};

	// Each card = an empty drip frame + HTML copy (so the text stays editable / localizable).
	// `pad` is the interior inset per frame — the red frame carries a baked drop-shadow margin, so it
	// needs a wider inset than the shadow-less yellow/green frames.
	// title/body entries are i18n keys (translated in the markup).
	const CARDS = [
		{
			cls: 'card--red',
			art: cardRed,
			drip: dripRed,
			tendrils: [
				{ x0: 0, x1: 63, cut: 84, cx: 44 },
				{ x0: 76, x1: 110, cut: 77, cx: 93 },
			] as [Tendril, Tendril],
			// Where the long tendril ends (art px) — the drop forms here.
			tip: { x: 42, y: 152 },
			sauce: 0xe11105,
			cycle: 3400,
			dripPhase: 1340, // |--phase| + 0.10·cycle → pinch-off lands at the tendril's full stretch
			title: 'SPLASH C1 TITLE',
			body: ['SPLASH C1 BODY'],
		},
		{
			cls: 'card--yellow',
			art: cardYellow,
			drip: dripYellow,
			tendrils: [
				{ x0: 0, x1: 58, cut: 75, cx: 36 },
				{ x0: 59, x1: 98, cut: 72, cx: 84 },
			] as [Tendril, Tendril],
			// Where the long tendril ends (art px) — the drop forms here.
			tip: { x: 39, y: 136 },
			sauce: 0xf0b800,
			cycle: 3800,
			dripPhase: 2680,
			title: 'SPLASH C2 TITLE',
			body: ['SPLASH C2 BODY 1', 'SPLASH C2 BODY 2', 'SPLASH C2 BODY 3'],
		},
		{
			cls: 'card--green',
			art: cardGreen,
			drip: dripGreen,
			tendrils: [
				{ x0: 0, x1: 54, cut: 79, cx: 33 },
				{ x0: 54, x1: 114, cut: 80, cx: 96 },
			] as [Tendril, Tendril],
			// Where the long tendril ends (art px) — the drop forms here.
			tip: { x: 33, y: 155 },
			sauce: 0x7fbf12,
			cycle: 4200,
			dripPhase: 3820,
			title: 'SPLASH C3 TITLE',
			body: ['SPLASH C3 BODY'],
		},
	];

	const press = () => props.onpress();
	const onKey = (e: KeyboardEvent) => {
		if (e.code === 'Space' || e.code === 'Enter') press();
	};

	// Portrait (mobile): show the feature cards one at a time and auto-advance every 3s, with dot
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
		const id = setInterval(() => (slide = (slide + 1) % SLIDE_COUNT), 3000);
		return () => clearInterval(id);
	});
</script>

<svelte:window onkeydown={onKey} onresize={updateOrientation} />

<div
	class="splash-intro"
	role="button"
	tabindex="0"
	aria-label={i18nDerived.translate('PRESS TO CONTINUE')}
	onclick={press}
	onkeydown={onKey}
>
	<div class="stage" style={`--sbg-desktop:url('${bgDesktop}');--sbg-mobile:url('${bg}')`}>
		<!-- The board's "freshly polished" gleam: a tilted light band sweeps across the diner every 10s
		     (over the background, behind the logo / cards / chef). -->
		<div class="shine" aria-hidden="true"><div class="shine__band"></div></div>
		<!-- Warm dust floating in the diner air (brighter in the sunlit window area, top-left/right),
		     with the odd draft — behind the logo / cards / chef. -->
		<DustFx count={90} color="255,255,255" boost={1.6} lights={[{ x: 0.12, y: 0.25, r: 0.45 }, { x: 0.88, y: 0.2, r: 0.4 }]} />
		<img class="logo" src={logo} alt="McSchmutzo" draggable="false" />
		<div class="man" style={`--skin:${MAN.skin}`}>
			<div class="bottle" style={bottleStyle}>
				<img src={manBottle} alt="" draggable="false" />
				<!-- Now and then he squeezes the bottle: the board chef's ketchup squirt (it rides the bottle
				     layer, so it follows the shake). Fires in the calm part of the 6s shake loop. -->
				<SauceFx
					bleed={0.6}
					splashes={[
						{ x: NOZZLE.x, y: NOZZLE.y, dir: NOZZLE.dir, color: 0xb3160d, jets: 1, size: 1.2, delay: 700, period: 6000, skip: 0.3 },
					]}
				/>
			</div>
			<img class="man-base" src={manBase} alt="" draggable="false" />
			<!-- Nametag under the pointing hand. -->
			<img class="man-label" src={manLabel} alt="" draggable="false" />
			<img class="man-hand" src={manHand} alt="" draggable="false" />
			<span class="man-sparkle" aria-hidden="true"></span>
			<div class="pupil" style={manBox(MAN.pupilL)}><span class="glint"></span></div>
			<div class="pupil" style={manBox(MAN.pupilR)}><span class="glint"></span></div>
			<div class="eye" style={manBox(MAN.eyeL)}><div class="lid"></div></div>
			<div class="eye" style={manBox(MAN.eyeR)}><div class="lid"></div></div>
			<!-- Brows over the lids, so a blink closes under the brow. -->
			<img class="man-base" src={manBrows} alt="" draggable="false" />
		</div>
		<!-- Mobile only: replaces the logo + character with the Press Play wordmark. -->
		<img class="pp-mark" src={pressPlay} alt="Press Play" draggable="false" />

		{#snippet cardEl(card: (typeof CARDS)[number])}
			<div class="card {card.cls}" style={`background-image:url('${card.art}')`}>
				<!-- Sauce drip: cap + two independently oozing tendrils (same image, clipped). Sits under
				     the copy like the old baked-in drip did. -->
				<div class="drip-wrap" style={`--drip:url('${card.drip}')`}>
					<div class="drip drip--cap" style={capStyle(card.tendrils[0], card.tendrils[1])}></div>
					<div class="drip drip--t drip--t1" style={tendrilStyle(card.tendrils[0])}></div>
					<div class="drip drip--t drip--t2" style={tendrilStyle(card.tendrils[1])}></div>
					<!-- The drop: a real viscous drip (SauceFx) off the long tendril's tip — a bead oozes out,
					     pinches off as the tendril hits full stretch, and falls down the card (behind the
					     copy). Same period as the tendril's CSS cycle so the two stay in step. -->
					<SauceFx
						bleed={0}
						drips={[
							{
								x: card.tip.x / ART_W,
								y: (card.tip.y - 4) / ART_H,
								color: card.sauce,
								size: 0.016,
								period: card.cycle,
								phase: card.dripPhase,
								fall: 0.55,
								steady: true,
							},
						]}
					/>
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
		/* Desktop / wide = new bg; portrait swaps to the mobile bg (below). */
		background-image: var(--sbg-desktop);
		background-size: 100% 100%;
		background-position: center;
		background-repeat: no-repeat;
		container-type: size;
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
		animation: shine-sweep 10s linear 1.5s infinite;
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
		/* Entrance: drops in from above the stage (see the card sweeps below). */
		animation: logo-in 0.7s cubic-bezier(0.22, 1, 0.36, 1) both;
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
		animation: chef-breathe 3.4s ease-in-out infinite alternate;
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
		animation: eyes-look 9s ease-in-out infinite;
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
		animation: eyes-blink 5.5s linear infinite;
	}
	.bottle {
		animation: bottle-shake 6s ease-in-out infinite;
	}
	/* Pointing hand: a slow, subtle sway about the wrist (sleeve cuff, 4.9% / 69.45% of the frame). */
	.man-hand {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		transform-origin: 4.9% 69.45%;
		animation: hand-sway 4.4s ease-in-out 0.6s infinite alternate;
	}
	@keyframes hand-sway {
		from {
			transform: rotate(1.3deg);
		}
		to {
			transform: rotate(-1.3deg);
		}
	}
	/* Nametag jiggles on its pin (pin = top-centre of the plate: 38.04% / 60.45% of the frame). */
	.man-label {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		transform-origin: 38.04% 60.45%;
		animation: label-jiggle 0.64s ease-in-out infinite alternate;
	}
	@keyframes label-jiggle {
		from {
			transform: rotate(-2deg);
		}
		to {
			transform: rotate(2deg);
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
		animation: tooth-ding 3.4s ease-out 1.2s infinite;
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
		animation: card-in-bottom 0.7s cubic-bezier(0.22, 1, 0.36, 1) both;
		animation-delay: 0.1s;
	}
	.cards:not(.cards--single) .card:nth-child(1) {
		animation-name: card-in-left;
	}
	.cards:not(.cards--single) .card:nth-child(3) {
		animation-name: card-in-right;
	}

	/* Sauce layers: every copy fills the card box exactly like the frame, so the drip lands where it
	   was baked in. The wrap sags as a whole (slow), the tendrils ooze on top of that. */
	.drip-wrap {
		position: absolute;
		inset: 0;
		transform-origin: 0 0;
		animation: sauce-sag 6.5s ease-in-out infinite alternate;
	}
	.drip {
		position: absolute;
		inset: 0;
		background: var(--drip) center / 100% 100% no-repeat;
		will-change: transform;
	}
	/* The long tendril and its drop share one cycle (--cycle/--phase, per card) so the drop lets go
	   exactly when the tendril is at full stretch and the sauce recoils. */
	.drip--t1 {
		animation: sauce-drip var(--cycle) ease-in-out infinite;
		animation-delay: var(--phase);
	}
	.drip--t2 {
		animation: sauce-ooze 4.8s ease-in-out infinite;
		animation-delay: calc(var(--phase) - 1.7s);
	}
	/* Each card gets its own cycle length + phase so the three never pulse in unison. */
	.card--red {
		--cycle: 3.4s;
		--phase: -1s;
		--sauce: #e11105;
		--sauce-hi: #ff9d8a;
		--sauce-dk: #890702;
	}
	.card--yellow {
		--cycle: 3.8s;
		--phase: -2.3s;
		--sauce: #fbcb07;
		--sauce-hi: #fff0b0;
		--sauce-dk: #a86a06;
	}
	.card--green {
		--cycle: 4.2s;
		--phase: -3.4s;
		--sauce: #8ccc18;
		--sauce-hi: #e2f9a6;
		--sauce-dk: #4a6f06;
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
		animation: blink 1.6s ease-in-out infinite;
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
	@keyframes logo-in {
		from {
			transform: translate(-50%, -70cqh);
		}
		to {
			transform: translate(-50%, 0);
		}
	}

	/* A tendril slowly lengthens (and thins a touch, like sauce does), then eases back. */
	@keyframes sauce-ooze {
		0%,
		100% {
			transform: scale(1, 1);
		}
		55% {
			transform: scale(0.955, 1.16);
		}
	}
	/* The long tendril: stretches while the drop forms, lets go at 52%, recoils, settles. */
	@keyframes sauce-drip {
		0%,
		78%,
		100% {
			transform: scale(1, 1);
		}
		44% {
			transform: scale(0.95, 1.24);
		}
		52% {
			transform: scale(0.94, 1.28);
		}
		60% {
			transform: scale(1.015, 0.985);
		}
	}
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
