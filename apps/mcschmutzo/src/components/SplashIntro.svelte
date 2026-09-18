<script lang="ts">
	import { onMount } from 'svelte';
	import { ap } from '../lib/preloadArt';
	import { i18nDerived } from '../i18n/i18nDerived';

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
				document.fonts.load(`${c.fontStyle} ${c.fontWeight} 40px ${c.fontFamily}`).then(schedule).catch(() => {});
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
	const logo = ap('/assets/mcschmutzo/splash/logo.svg');
	const man = ap('/assets/mcschmutzo/splash/man.webp');
	const pressPlay = ap('/assets/mcschmutzo/press-play.svg');
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
			art: cardRed,
			title: 'SPLASH C1 TITLE',
			body: ['SPLASH C1 BODY'],
		},
		{
			cls: 'card--yellow',
			art: cardYellow,
			title: 'SPLASH C2 TITLE',
			body: ['SPLASH C2 BODY 1', 'SPLASH C2 BODY 2', 'SPLASH C2 BODY 3'],
		},
		{
			cls: 'card--green',
			art: cardGreen,
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
		<img class="logo" src={logo} alt="McSchmutzo" draggable="false" />
		<img class="man" src={man} alt="" draggable="false" />
		<!-- Mobile only: replaces the logo + character with the Press Play wordmark. -->
		<img class="pp-mark" src={pressPlay} alt="Press Play" draggable="false" />

		{#snippet cardEl(card: (typeof CARDS)[number])}
			<div class="card {card.cls}" style={`background-image:url('${card.art}')`}>
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

	.logo {
		position: absolute;
		left: 50%;
		top: 4.5%;
		transform: translateX(-50%);
		width: 39%;
		height: auto;
		object-fit: contain;
		filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.35));
	}

	.man {
		position: absolute;
		left: 0.5%;
		bottom: 0;
		height: 63%;
		width: auto;
		object-fit: contain;
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
