<script lang="ts">
	import { ap } from '../lib/preloadArt';

	type Props = { onpress: () => void };
	const props: Props = $props();

	const bg = ap('/assets/mcschmutzo/splash/bg.webp');
	const logo = ap('/assets/mcschmutzo/splash/logo.webp');
	const man = ap('/assets/mcschmutzo/splash/man.webp');
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
</script>

<svelte:window onkeydown={onKey} />

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

		<div class="cards">
			{#each CARDS as card (card.cls)}
				<div class="card {card.cls}" style={`background-image:url('${card.art}')`}>
					<div class="card-inner">
						<h3 class="card-title">{card.title}</h3>
						<div class="card-body">
							{#each card.body as line (line)}<p>{line}</p>{/each}
						</div>
					</div>
				</div>
			{/each}
		</div>

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

	/* Three cards centred in the lower half, clear of the character on the left. */
	.cards {
		position: absolute;
		left: 51%;
		top: 52%;
		transform: translate(-50%, -50%);
		height: 51%;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 4.2cqw;
	}

	.card {
		position: relative;
		height: 100%;
		background-size: 100% 100%;
		background-repeat: no-repeat;
		background-position: center;
		/* Each card is its own query container so the copy scales with the card in ANY orientation
		   (on portrait the row shrinks the cards, and the text has to follow). */
		container-type: size;
	}
	/* Aspect ratios come straight from the trimmed frame art. */
	.card--red {
		aspect-ratio: 629 / 700;
	}
	.card--yellow {
		aspect-ratio: 542 / 700;
	}
	.card--green {
		aspect-ratio: 474 / 700;
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
	}
	.card--red .card-inner {
		padding: 19% 19% 14%;
	}
	.card--yellow .card-inner {
		padding: 18% 17% 14%;
	}
	.card--green .card-inner {
		padding: 16% 16% 14%;
	}

	/* Titles = Bowlby One 32px @ design (cqh is a fraction of the CARD's height, so it scales with
	   the card in any orientation: a 367px-tall desktop card → ~32px). */
	.card-title {
		margin: 0;
		font-family: 'Bowlby One', sans-serif;
		font-weight: 400;
		line-height: 1.39;
		letter-spacing: 0.03em;
		font-size: 8.7cqh;
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
		.logo {
			top: 4%;
			width: 84%;
		}
		.cards {
			left: 50%;
			top: 44%;
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
