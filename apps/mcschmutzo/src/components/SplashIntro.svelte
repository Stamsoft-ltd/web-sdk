<script lang="ts">
	import { onMount } from 'svelte';
	import { ap } from '../lib/preloadArt';

	type Props = { onpress: () => void };
	const props: Props = $props();

	const bg = ap('/assets/mcschmutzo/splash/bg.webp');
	const logo = ap('/assets/mcschmutzo/splash/logo.svg');
	const man = ap('/assets/mcschmutzo/splash/man.webp');
	const pressPlay = ap('/assets/mcschmutzo/press-play.svg');
	const cardRed = ap('/assets/mcschmutzo/splash/card-red.webp');
	const cardYellow = ap('/assets/mcschmutzo/splash/card-yellow.webp');
	const cardGreen = ap('/assets/mcschmutzo/splash/card-green.webp');

	// Each card = an empty drip frame + HTML copy (so the text stays editable / localizable).
	// `pad` is the interior inset per frame — the red frame carries a baked drop-shadow margin, so it
	// needs a wider inset than the shadow-less yellow/green frames.
	const CARDS = [
		{
			cls: 'card--red',
			art: cardRed,
			title: 'WELCOME TO SCHMUTZO',
			body: ['Bright lights, wild rides and big surprises around every corner.'],
		},
		{
			cls: 'card--yellow',
			art: cardYellow,
			title: '3 UNIQUE BONUSES',
			body: ['Pick the Ducks', 'Ride the Wilds', 'Survive the Coaster'],
		},
		{
			cls: 'card--green',
			art: cardGreen,
			title: 'MAX WIN OF 25,000×',
			body: ['THE ULTIMATE PARK PRIZE'],
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
	aria-label="Press to continue"
	onclick={press}
	onkeydown={onKey}
>
	<div class="stage" style={`background-image:url('${bg}')`}>
		<img class="logo" src={logo} alt="McSchmutzo" draggable="false" />
		<img class="man" src={man} alt="" draggable="false" />
		<!-- Mobile only: replaces the logo + character with the Press Play wordmark. -->
		<img class="pp-mark" src={pressPlay} alt="Press Play" draggable="false" />

		{#snippet cardEl(card: (typeof CARDS)[number])}
			<div class="card {card.cls}" style={`background-image:url('${card.art}')`}>
				<div class="card-inner">
					<h3 class="card-title">{card.title}</h3>
					<div class="card-body">
						{#each card.body as line (line)}<p>{line}</p>{/each}
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

		<p class="press-label">PRESS TO CONTINUE&nbsp;→</p>
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
		justify-content: flex-start;
		text-align: center;
		font-family: 'Poppins', sans-serif;
		/* Uniform now that every frame is the same box; top clears the drip on the red/yellow cards. */
		padding: 17% 15% 14%;
	}

	/* Titles = Bowlby One 32px @ design (cqh is a fraction of the CARD's height, so it scales with
	   the card in any orientation: a 367px-tall desktop card → ~32px). */
	.card-title {
		margin: 0;
		font-family: 'Bowlby One', sans-serif;
		font-weight: 400;
		line-height: 1.39;
		letter-spacing: 0.03em;
		/* cqw (card WIDTH) not cqh, so a wide word like "SCHMUTZO" fits the frame at any card size. */
		font-size: 10.5cqw;
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

	/* Description = Nunito 20px @ design. */
	.card-body {
		margin-top: 2.7cqh;
		font-family: 'Nunito', sans-serif;
		color: #232323;
		font-weight: 500;
		font-size: 5.45cqh;
		line-height: 1.4;
		letter-spacing: 0.03em;
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
