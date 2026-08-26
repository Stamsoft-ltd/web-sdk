<script lang="ts" module>
	import { ap } from '../lib/preloadArt';
	import { SPLASH_CLOUDS } from '../game/splashClouds';

	// Splash art, Figma 7027:12708 (2026-08-19 redesign). Every piece is cut by
	// scripts/splash/build_splash_art.py. The background is shipped at the exposure the design
	// renders at — measured, not guessed: the splash applies no tint above y=530 and only the bottom
	// gradient `.vignette` already draws below it, and the LOADING screen is the same picture
	// multiplied by 0.4 (LoadingScreen's BACKDROP_LEVEL, Figma 7028:15400).
	const bgSrc = ap('/assets/theme-park/v2/splash/background.webp');
	/* Pre-blurred/darkened copy for the letterbox margins, 1.8 KB — see the note on .backdrop. */
	const bgBlurredSrc = ap('/assets/theme-park/v2/splash/background_backdrop.webp');
	const logoSrc = ap('/assets/theme-park/v2/splash/logo.webp');
	const pressPlaySrc = ap('/assets/theme-park/v2/splash/press_play_mark.svg');
	const arrowSrc = ap('/assets/theme-park/v2/splash/arrow.svg');
	// One purple feature panel. The design draws three of them as a single image, but they differ
	// only by generation noise (mean 2/255), so the middle one is cut out and drawn three times —
	// which is also what lets each panel arrive on its own beat.
	const cardSrc = ap('/assets/theme-park/v2/splash/feature-card.webp');
	/**
	 * The park's lamps, cut out of the background into three circuits by
	 * scripts/splash/build_splash_bulbs.py, so they can be blinked.
	 *
	 * They have to be IMAGES rather than positioned dots: `.bg` is `object-fit: cover`, so the box
	 * the browser gives that element is not the box the picture is painted in and there is no CSS
	 * unit for the difference. Another image of the same aspect, cover-fit the same way, lands
	 * exactly on top of it. See the script for why there are three of them and not one.
	 */
	const bulbSrcs = [1, 2, 3].map((circuit) =>
		ap(`/assets/theme-park/v2/splash/bulbs-${circuit}.webp`),
	);
	/**
	 * The drifting clouds, drawn straight over the park.
	 *
	 * They used to drift inside a cut-out of the sky, so the coaster and the wheel would occlude
	 * them. That looked worse than no occlusion at all: the coaster is a lattice, so the cut-out
	 * combed the cloud into a picket fence of vertical slivers wherever the two met. They are placed
	 * on open gradient instead, by scripts/splash/build_splash_clouds.py, which is what lets them sit
	 * on top of everything without ever landing on something they would need cutting around.
	 */
	const cloudSrc = (key: string) => ap(`/assets/theme-park/v2/splash/${key}.webp`);

	/**
	 * Where the clouds are this time round.
	 *
	 * A fresh sky on every load. The table gives each cloud a REGION rather than a spot — every point
	 * of which the builder has already proved clear of the rails, the treeline and the lockup at both
	 * ends of both of its drifts — so drawing from it freely is safe in a way that jittering a fixed
	 * position would not be. The two animation delays are drawn too, so the clouds are not merely
	 * somewhere else, they are also somewhere else in their travel.
	 *
	 * They can and do overlap. Four clouds whose combined span is wider than the sky they have to fit
	 * in cannot all miss each other, and two soft ones on top of each other read as a bank of cloud,
	 * which is what this stretch of sky wants anyway.
	 */
	const between = (lo: number, hi: number) => lo + Math.random() * (hi - lo);
	const scatter = () =>
		SPLASH_CLOUDS.map((cloud) => ({
			cloud,
			x: between(cloud.xMin, cloud.xMax),
			y: between(cloud.yMin, cloud.yMax),
			delay: -Math.random() * cloud.seconds,
			riseDelay: -Math.random() * cloud.riseSeconds,
		}));
</script>

<script lang="ts">
	import { stateI18nDerived } from 'state-shared';
	import { innerWidth, innerHeight } from 'svelte/reactivity/window';

	// Drawn once, when the splash mounts, and deliberately NOT reactive: the sky is allowed to be
	// different every time the game loads, but not to rearrange itself under someone reading the
	// cards because the window was resized.
	const clouds = scatter();

	import { fitFont } from '../lib/fitLabel';

	type Props = { onpress: () => void };
	const props: Props = $props();

	const t = (key: string) => stateI18nDerived.translate(key);

	// The 1200×670 landscape composition can't fill a tall phone (contain-fit leaves it a small band
	// with big blurred margins). On portrait we render a dedicated vertical layout instead: cover
	// background, logo up top, the three feature cards stacked, press row at the bottom. Threshold
	// mirrors the game's own 'portrait' layoutType (canvas ratio ≤ 0.8).
	const isPortrait = $derived((innerWidth.current ?? 1) / (innerHeight.current ?? 1) <= 0.8);

	// Portrait shows ONE feature card at a time (Expanding Reels → Mega Chain → Epic Wins) in a
	// panel, auto-advancing with pagination dots — a carousel rather than a stack.
	let slide = $state(0);
	$effect(() => {
		if (!isPortrait) return;
		const id = setInterval(() => (slide = (slide + 1) % 3), 2600);
		return () => clearInterval(id);
	});

	// Not translated — a numeral, and it is the same figure on all three cards in the design.
	/** The headline number on the third card (Figma 7027:12760). */
	const MAX_WIN = '25,000x';

	// One entry per feature card. The copy is Figma 7027:12755-12761: two cards are a headline over a
	// blurb, and only the third carries a number — so `big` is optional rather than every card
	// repeating the same "with up to <x> multiplier" block the first design had.
	//
	// Each `*Y` is the vertical CENTRE of that text node's box on the 1200x670 design frame.
	// Anchoring by centre rather than by top is what lets a title wrap to an extra line (in any
	// locale) without shoving the blurb down into it. There is no `cx`: the three cards are evenly
	// spaced and the copy is centred in each, so the column comes from the card geometry below.
	const CARDS = [
		{
			key: 'SPLASH FEATURE 1',
			tone: 'blue',
			titleY: 385,
			bodyY: 494,
			big: false,
		},
		{
			key: 'SPLASH FEATURE 2',
			tone: 'candy',
			titleY: 392.5,
			bodyY: 490,
			big: false,
		},
		{
			key: 'SPLASH FEATURE 3',
			tone: 'blue',
			titleY: 387,
			bigY: 448.5,
			bodyY: 510,
			big: true,
		},
	] as const;

	// Design-frame coordinates -> percentages of the stage.
	const px = (x: number) => `${(x / 1200) * 100}%`;
	const py = (y: number) => `${(y / 670) * 100}%`;

	// === THE CARDS ===
	// Fitted against the design render rather than read off the node box: the panels are one AI
	// render with soft edges, so the Figma node is padding around the ink. The strip's trimmed art
	// lands at (221, 287) 755x293, which puts the three panels on a 256.5px pitch starting at 340.9.
	const CARD_W = 242;
	const CARD_H = (CARD_W * 716) / 590;
	const CARD_CY = 433.5;
	const CARD_X0 = 340.9;
	const CARD_STEP = 256.5;
	const CARD_TOP = CARD_CY - CARD_H / 2;

	/** Design-frame y -> percentage down the card box. */
	const inCard = (y: number) => `${((y - CARD_TOP) / CARD_H) * 100}%`;

	// ENTRANCE. The logo's own drop runs 0-900ms and thumps the stage at 414ms; the cards start
	// after that thump so they read as being shaken into place rather than racing the logo down.
	const CARD_IN_AT = 520;
	const CARD_IN_STEP = 150;

	function handlePress() {
		props.onpress();
	}
	function handleKey(e: KeyboardEvent) {
		if (e.code === 'Space' || e.code === 'Enter') handlePress();
	}
</script>

<svelte:window onkeydown={handleKey} />

<div class="splash-intro" role="button" tabindex="0" onclick={handlePress} onkeydown={handleKey}>
	<!-- Cover-scaled, blurred copy of the same art. It only shows in the letterbox margins the
	     contain-fit stage leaves on narrow viewports, so those bars read as part of the scene
	     instead of as dead space. -->
	<div class="backdrop" style={`background-image:url('${bgBlurredSrc}')`}></div>

	{#if !isPortrait}
		<div class="stage">
			<img class="bg" src={bgSrc} alt="" />

			<!-- Landscape only. The portrait splash crops the same art hard to the central path, so a
			     percentage inside this box would not land where the picture is; the lamp circuits below are
			     full-frame images and so are correct in both. -->
			{#each clouds as { cloud, x, y, delay, riseDelay } (cloud.key)}
				<img
					class="cloud"
					style={`left:${x * 100}%;top:${y * 100}%;width:${cloud.width * 100}%;` +
						`--drift:${(cloud.drift / cloud.width) * 100}%;` +
						`--rise:${(cloud.rise / cloud.height) * 100}%;` +
						`animation-duration:${cloud.seconds}s,${cloud.riseSeconds}s;` +
						`animation-delay:${delay}s,${riseDelay}s`}
					src={cloudSrc(cloud.key)}
					alt=""
				/>
			{/each}

			{#each bulbSrcs as src, circuit (src)}
				<img class="bg bulbs" style={`animation-delay:${circuit * -0.9}s`} {src} alt="" />
			{/each}

			<img class="press-play" src={pressPlaySrc} alt="Press Play" />

			<!-- The cards arrive one at a time, left to right, after the logo has landed. Panel and copy
			     are one element so they stage as a unit. -->
			{#each CARDS as card, i (card.key)}
				<div
					class="card"
					style={`left:${px(CARD_X0 + i * CARD_STEP)};top:${py(CARD_CY)};--card-in:${CARD_IN_AT + i * CARD_IN_STEP}ms`}
				>
					<img class="card-art" src={cardSrc} alt="" />
					<p
						class="title title--{card.tone}"
						style={`top:${inCard(card.titleY)}`}
						use:fitFont={t(card.key)}
					>
						{t(card.key)}
					</p>
					{#if card.big}
						<p class="big" style={`top:${inCard(card.bigY)}`}>{MAX_WIN}</p>
					{/if}
					<p class="body" style={`top:${inCard(card.bodyY)}`}>
						{t(`${card.key} BODY`)}
					</p>
				</div>
			{/each}

			<!-- Drawn AFTER the cards: the design overlaps the logo's coaster rails onto their top
			     edge, which is what ties the lockup to the row instead of leaving it floating above. -->
			<img class="logo" src={logoSrc} alt={t('GAME TITLE')} />
		</div>

		<!-- Outside .stage, and deliberately. Past ~1.2:1 the stage switches to cover and is TALLER
		     than the viewport, so anything anchored near its bottom edge — the design's dark fade and
		     the prompt that has to stay legible over it — is cropped away on a wide window. Both are
		     screen furniture rather than part of the 1200x670 composition, so they hang off the
		     splash box and are always where the eye expects them. -->
		<div class="vignette"></div>

		<div class="press-row">
			<span class="press-label">{t('PRESS TO CONTINUE')}</span>
			<img class="press-arrow" src={arrowSrc} alt="" />
		</div>
	{:else}
		<!-- PORTRAIT splash: dedicated vertical layout that fills the phone screen. -->
		<div class="splash-pt">
			<img class="pt-bg" src={bgSrc} alt="" />
			{#each bulbSrcs as src, circuit (src)}
				<img class="pt-bg bulbs" style={`animation-delay:${circuit * -0.9}s`} {src} alt="" />
			{/each}
			<div class="pt-scrim"></div>
			<img class="pt-pp" src={pressPlaySrc} alt="Press Play" />
			<img class="pt-logo" src={logoSrc} alt={t('GAME TITLE')} />

			<div class="pt-carousel">
				<div class="pt-frame">
					<img class="pt-frame-art" src={cardSrc} alt="" />
					{#each CARDS as card, i (card.key)}
						<div class="pt-slide" class:is-active={i === slide} aria-hidden={i !== slide}>
							<p class="pt-feat-title title--{card.tone}" use:fitFont={t(card.key)}>{t(card.key)}</p>
							{#if card.big}
								<p class="pt-feat-big">{MAX_WIN}</p>
							{/if}
							<p class="pt-feat-sub">{t(`${card.key} BODY`)}</p>
						</div>
					{/each}
				</div>

				<div class="pt-dots">
					{#each CARDS as card, i (card.key)}
						<button
							class="pt-dot"
							class:is-active={i === slide}
							type="button"
							aria-label={`Slide ${i + 1}`}
							onclick={(e) => {
								e.stopPropagation();
								slide = i;
							}}
						></button>
					{/each}
				</div>
			</div>

			<div class="pt-press">
				<span class="pt-press-label">{t('PRESS TO CONTINUE')}</span>
				<img class="pt-press-arrow" src={arrowSrc} alt="" />
			</div>
		</div>
	{/if}
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
		/* End stop of the design's own bottom gradient — the letterbox colour before the blurred
		   backdrop paints. */
		background: #27002c;
		/* Makes the cq units on .stage resolve against the splash box rather than the viewport: this
		   overlay lives inside .game-stage, so vw/vh are the wrong reference frame. */
		container-type: size;
	}

	.backdrop {
		position: absolute;
		inset: 0;
		background-position: center;
		background-size: cover;
		background-repeat: no-repeat;
		/* Baked into the image (scripts/backdrop/build_backdrop.py) rather than filtered here: a
		   viewport-sized large-radius blur is one of the few things WebKit is markedly slower at
		   than Blink, and this one sits under the splash's own animation. */
		transform: scale(1.12);
	}

	/* The 1200x670 design frame. Contain-fit by default: the three cards span x 220..975 of 1200, so
	   a cover-fit on a portrait phone would crop two of them off-screen entirely. */
	.stage {
		position: absolute;
		left: 50%;
		top: 50%;
		transform: translate(-50%, -50%);
		width: min(100cqw, calc(100cqh * 1200 / 670));
		height: min(100cqh, calc(100cqw * 670 / 1200));
		overflow: hidden;
		/* Every font size below is a fraction of this box, so the whole composition scales as one. */
		container-type: size;
		/* Kicked once, on the frame the logo lands (900ms x 46% = 414ms). This is what sells the
		   weight — the logo alone squashing reads as rubber, the scene recoiling reads as stone. */
		animation: stage-jolt 320ms ease-out 414ms both;
	}

	/* Past ~1.2:1 the horizontal crop can no longer reach the outer cards (at exactly 1.2:1 the
	   visible window is design x 198..1002 against cards at 220..975), so switch to cover and drop
	   the letterbox entirely. */
	@media (min-aspect-ratio: 6 / 5) {
		.stage {
			width: max(100cqw, calc(100cqh * 1200 / 670));
			height: max(100cqh, calc(100cqw * 670 / 1200));
		}
	}

	/* The art (1680x936) is within a rounding error of this box, so `cover` neither crops nor
	   letterboxes it in any meaningful way. */
	.bg {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	/*
	 * Two animations per cloud, on two different periods, and that is the whole reason these read as
	 * weather rather than as a carousel: sideways on `seconds`, sinking on `riseSeconds`. One period
	 * would retrace the same line for ever. Two that do not divide into each other never close, so no
	 * pass is quite like the last one and the four clouds never fall into step with each other.
	 *
	 * They are separate CSS properties on purpose — `transform` and `translate` are independent, and
	 * both composite, so this stays off the layout path. Two animations can't both drive `transform`.
	 *
	 * Both amounts are percentages of the CLOUD, not of the frame, because that is what a translate
	 * percentage resolves against; the table's frame-relative numbers are divided by the cloud's own
	 * width and height where they are set. Each duration is one full there-and-back, which is why the
	 * keyframes turn round at 50%.
	 */
	.cloud {
		position: absolute;
		height: auto;
		pointer-events: none;
		animation-name: splash-cloud-x, splash-cloud-y;
		animation-timing-function: ease-in-out;
		animation-iteration-count: infinite;
		will-change: transform, translate;
	}

	@keyframes splash-cloud-x {
		0%,
		100% {
			transform: translateX(0);
		}
		50% {
			transform: translateX(var(--drift));
		}
	}

	@keyframes splash-cloud-y {
		0%,
		100% {
			translate: 0 0;
		}
		50% {
			translate: 0 var(--rise);
		}
	}

	/* The clouds stay where they are painted — they are part of the picture, the drift is not. */
	@media (prefers-reduced-motion: reduce) {
		.cloud {
			animation: none;
		}
	}

	/*
	 * The lamps. Each circuit rides on top of the background it was cut from, sharing its class so it
	 * is laid out and cropped identically — that is the whole reason this works.
	 *
	 * `screen` and not plain alpha: these are LIGHT. Screened, a circuit at low opacity leaves the
	 * lamp looking exactly as the artist painted it and can only ever brighten from there, so the
	 * bottom of the breath is the artwork rather than a grey wash over it.
	 *
	 * The three peak 0.9s apart on a 2.7s cycle, which is one full turn of the chase per cycle. Slow
	 * enough to be a park at dusk rather than a fruit machine.
	 */
	.bulbs {
		mix-blend-mode: screen;
		pointer-events: none;
		animation: splash-bulbs 2.7s ease-in-out infinite;
		will-change: opacity;
	}

	@keyframes splash-bulbs {
		0%,
		100% {
			opacity: 0.18;
		}
		50% {
			opacity: 1;
		}
	}

	/* Still lit, just not blinking: the park with the lights on is the picture, the chase is the
	   flourish. Held at the middle of the breath rather than at either end. */
	@media (prefers-reduced-motion: reduce) {
		.bulbs {
			animation: none;
			opacity: 0.6;
		}
	}

	/* Press Play studio mark — group box 112.5181 x 36.4013, centred at (600.3, 96.2). */
	.press-play {
		position: absolute;
		left: 50.02167%;
		top: 14.35821%;
		transform: translate(-50%, -50%);
		width: 9.37651%;
		height: auto;
	}

	/* THEME PARK logo. The rect is the trimmed ARTWORK's, fitted against the design render (649x193
	   at (276,114)) rather than taken from the Figma node, whose box is padding around the ink. */
	.logo {
		position: absolute;
		left: 50.04167%;
		top: 31.41791%;
		transform: translate(-50%, -50%);
		width: 54.08333%;
		height: auto;
		display: block;
		/* Falls in from off-screen and lands hard. -170% of its own height clears the stage top from a
		   centre at 31.42% (needs 210.5 + 96.5 = 307 design px = 159% of the 193px art). */
		--drop-from: -170%;
		animation: logo-drop 900ms linear both;
	}

	/* One feature card: the purple panel and its copy, positioned and staged as a unit. No
	   `container-type` here on purpose — every font size below is in cqw and has to keep resolving
	   against .stage so the whole composition still scales as one. */
	.card {
		position: absolute;
		width: 20.16667%; /* 242 / 1200 */
		height: 43.83085%; /* 293.7 / 670 */
		transform: translate(-50%, -50%);
		/* Staged per card; `--card-in` is set inline. `both` holds the 0% frame during the delay,
		   which is what keeps the card off screen until its turn. */
		animation: card-in 460ms cubic-bezier(0.2, 0.8, 0.3, 1) var(--card-in, 0ms) both;
	}

	.card-art {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		/* `fill`: the box is the art's own aspect to within a rounding error, and letterboxing would
		   pull the panel off the column the copy is placed against. */
		object-fit: fill;
	}

	.title,
	.body,
	.big {
		position: absolute;
		/* The panel's interior is centred to within half a percent (measured off the art: x
		   0.053..0.944, y 0.043..0.947), so the copy simply centres on the card. */
		left: 50%;
		transform: translate(-50%, -50%);
		margin: 0;
		text-align: center;
		letter-spacing: 0.03em;
		/* The design's 179px copy box. Absolutely positioned text has to be given this explicitly:
		   with only `left:50%` set, shrink-to-fit measures against the space LEFT of the right edge,
		   so the blurb wrapped at half the card. */
		width: 73.96694%; /* 179 / 242 */
	}

	/* The design sets the copy off the flat panel with a soft shadow. It has to be a filter on the
	   gradient headlines, not a text-shadow: those are painted through `background-clip: text` with
	   a transparent fill, and a text-shadow draws BEHIND that transparent fill — i.e. straight
	   through the glyphs, greying out the gradient instead of sitting under it. */
	.title,
	.big {
		filter: drop-shadow(0 0.15cqw 0.3cqw rgba(10, 0, 16, 0.75));
	}
	.body {
		text-shadow: 0 0.12cqw 0.3cqw rgba(10, 0, 16, 0.7);
	}

	/* A short rise into place. The centring lives in the same transform, so every frame has to
	   repeat translate(-50%, -50%) or the card is flung half a box off while it plays — the same
	   trap as logo-drop below. */
	@keyframes card-in {
		0% {
			opacity: 0;
			transform: translate(-50%, -50%) translateY(14%) scale(0.94);
		}
		100% {
			opacity: 1;
			transform: translate(-50%, -50%) translateY(0) scale(1);
		}
	}

	/* Lilita One, 32px on a 1200 frame. The shared 179px box above is what makes the headlines break
	   where they are drawn, and what makes a long translation wrap instead of running out over the
	   panel's rail. */
	.title {
		font-family: 'Lilita One', sans-serif;
		font-weight: 400;
		font-size: 2.66667cqw;
		line-height: 1.05;
		white-space: pre-line;
		background-clip: text;
		-webkit-background-clip: text;
		color: transparent;
	}
	.title--blue {
		background-image: linear-gradient(
			179.92deg,
			#448af9 0.46%,
			#81b9f8 24.86%,
			#80bff5 49.26%,
			#60a4ec 73.66%,
			#005fe1 98.06%
		);
	}
	.title--candy {
		background-image: linear-gradient(
			179.32deg,
			#ebabdf 14.3%,
			#c5aae8 26.13%,
			#9fa8f1 36.84%,
			#afb6f6 48.67%,
			#b64f8e 65.3%,
			#d9335c 79.71%,
			#fb1629 88.21%
		);
	}

	/* Nunito Sans SemiBold 16px, plain white (node 7027:12755). */
	.body {
		font-family: 'Nunito Sans', sans-serif;
		font-weight: 600;
		font-size: 1.33333cqw;
		line-height: 1.35;
		color: #fff;
		white-space: pre-line;
	}

	/* Lilita One 42px, gold (node 7027:12760). */
	.big {
		font-family: 'Lilita One', sans-serif;
		font-weight: 400;
		font-size: 3.5cqw;
		line-height: 1;
		white-space: nowrap;
		background-image: linear-gradient(
			181.3deg,
			#f1eea5 7.45%,
			#e79a17 28.07%,
			#d7880c 63.58%,
			#a16202 93.75%
		);
		background-clip: text;
		-webkit-background-clip: text;
		color: transparent;
	}

	/* Measured off the design render: no tint at all above y=530, then a ramp to solid #27002c by
	   y=651. */
	.vignette {
		position: absolute;
		inset: 0;
		background: linear-gradient(
			180deg,
			rgba(39, 0, 44, 0) 0%,
			rgba(19, 0, 22, 0) 79.13%,
			#27002c 97.2%
		);
		pointer-events: none;
	}

	/* Design row: 223 x 21 centred at (600.5, 633.5) of 670, i.e. 5.45% up from the bottom edge. Both
	   this and the sizes below are expressed against the SPLASH box, not the stage, because the row
	   no longer lives in the stage — `min(cqw, cqh)` tracks the stage's own scale (its width is
	   `min(100cqw, 100cqh * 1200/670)`) so the row still grows and shrinks with the composition. */
	.press-row {
		position: absolute;
		left: 50%;
		bottom: 5.45%;
		transform: translate(-50%, 50%);
		display: flex;
		align-items: center;
		gap: min(0.58333cqw, 1.04478cqh);
		white-space: nowrap;
		/* The design's row is static; the pulse is the affordance that it is a tap target, and was
		   already on the screen this replaces. It fades in LAST, once the three cards have landed —
		   the prompt to continue arriving before the thing it is prompting you past reads as an
		   invitation to skip. */
		animation:
			press-in 420ms ease-out 1350ms both,
			blink 1.6s ease-in-out 1770ms infinite;
	}

	@keyframes press-in {
		0% {
			opacity: 0;
			transform: translate(-50%, 50%) translateY(30%);
		}
		100% {
			opacity: 1;
			transform: translate(-50%, 50%) translateY(0);
		}
	}
	.press-label {
		/* Figma specifies Helvetica Bold. It is a system face on Apple platforms and Arial is a
		   metric-compatible stand-in everywhere else, so this needs no webfont download. */
		font-family: Helvetica, Arial, sans-serif;
		font-weight: 700;
		font-size: min(1.5cqw, 2.68657cqh);
		letter-spacing: 0.03em;
		line-height: 1;
		color: #fff;
	}
	.press-arrow {
		width: min(1.5cqw, 2.68657cqh); /* 18 / 1200 and 18 / 670 */
		height: auto;
		display: block;
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

	/* Stone drop. Accelerating fall (gravity) to the 46% impact frame, then a hard squash, one small
	   bounce, and a settle. Every frame has to repeat translate(-50%, -50%) — the centring lives in
	   the same transform, so omitting it would fling the logo a half-box off during the animation.
	   The timing function is switched per keyframe rather than set once on the animation. */
	@keyframes logo-drop {
		0% {
			transform: translate(-50%, -50%) translateY(var(--drop-from)) scale(0.94, 1.09);
			animation-timing-function: cubic-bezier(0.55, 0, 0.95, 0.42);
		}
		46% {
			transform: translate(-50%, -50%) scale(0.94, 1.09);
			animation-timing-function: cubic-bezier(0.18, 0.7, 0.35, 1);
		}
		57% {
			transform: translate(-50%, -50%) translateY(2.5%) scale(1.13, 0.85);
			animation-timing-function: ease-out;
		}
		72% {
			transform: translate(-50%, -50%) translateY(-5%) scale(0.985, 1.03);
			animation-timing-function: ease-in;
		}
		86% {
			transform: translate(-50%, -50%) translateY(0.8%) scale(1.02, 0.98);
		}
		100% {
			transform: translate(-50%, -50%) scale(1, 1);
		}
	}

	/* The impact recoil, in the same shared-transform situation as above. Deviations are tiny on
	   purpose: this should register as a thud, not as a camera shake. */
	@keyframes stage-jolt {
		0% {
			transform: translate(-50%, -50%);
		}
		22% {
			transform: translate(-50%, -49.45%);
		}
		48% {
			transform: translate(-50%, -50.28%);
		}
		74% {
			transform: translate(-50%, -49.88%);
		}
		100% {
			transform: translate(-50%, -50%);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.press-row,
		.logo,
		.stage,
		.card {
			animation: none;
		}
	}

	/* ===== PORTRAIT SPLASH — vertical layout, fills the phone ===== */
	.splash-pt {
		position: absolute;
		inset: 0;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		align-items: center;
	}
	.pt-bg {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
		/* The same dusk park as landscape — cover crops the 1.79:1 art to the central
		   path/coaster/wheel. It used to be the bright daytime in-game background, which read as a
		   different game once the panels went dark purple. */
		object-position: center center;
	}
	/* Lighter than it was: the art is dusk now, so this only has to seat the copy and the press row,
	   not turn a midday sky into evening. */
	.pt-scrim {
		position: absolute;
		inset: 0;
		background: linear-gradient(
			180deg,
			rgba(20, 0, 30, 0.4) 0%,
			rgba(20, 0, 30, 0.05) 30%,
			rgba(20, 0, 30, 0.2) 62%,
			rgba(20, 0, 30, 0.75) 100%
		);
	}
	.pt-pp {
		position: relative;
		z-index: 1;
		width: 30cqw;
		height: auto;
		margin-top: 7cqh;
		filter: drop-shadow(0 0.5cqh 1cqh rgba(0, 0, 0, 0.5));
	}
	/* The game's own lockup. Landscape has always carried it and portrait never did, which left the
	   phone splash introducing the studio and not the game. */
	.pt-logo {
		position: relative;
		z-index: 1;
		width: 88cqw;
		max-width: 420px;
		height: auto;
		margin-top: 2cqh;
		filter: drop-shadow(0 1cqh 1.6cqh rgba(0, 0, 0, 0.55));
	}
	/* --- Feature carousel: one panel, copy cross-fades, dots below --- */
	.pt-carousel {
		position: relative;
		z-index: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		margin-top: 2.5cqh;
	}
	.pt-frame {
		position: relative;
		width: 80cqw;
		max-width: 360px;
		aspect-ratio: 590 / 716;
	}
	.pt-frame-art {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: fill;
		filter: drop-shadow(0 1.4cqh 2cqh rgba(0, 0, 0, 0.55));
	}
	/* Each slide's copy sits inside the panel interior; only the active one is visible. The panel's
	   rail is a thin even band (~5% of the art), so this is a symmetric inset with room to breathe. */
	.pt-slide {
		position: absolute;
		inset: 9%;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		text-align: center;
		opacity: 0;
		transform: scale(0.96);
		transition:
			opacity 0.45s ease,
			transform 0.45s ease;
		pointer-events: none;
	}
	.pt-slide.is-active {
		opacity: 1;
		transform: scale(1);
	}
	/* Same trap as the landscape headlines: a text-shadow would draw through the transparent fill. */
	.pt-feat-title,
	.pt-feat-big {
		filter: drop-shadow(0 0.4cqw 0.8cqw rgba(10, 0, 16, 0.7));
	}
	.pt-feat-sub {
		text-shadow: 0 0.3cqw 0.7cqw rgba(10, 0, 16, 0.7);
	}
	.pt-feat-title {
		margin: 0 0 1.2cqh;
		font-family: 'Lilita One', sans-serif;
		font-weight: 400;
		font-size: 9.6cqw;
		white-space: pre-line;
		line-height: 1.04;
		letter-spacing: 0.02em;
		/* Bigger title is allowed to wrap onto two lines inside the panel. */
		max-width: 100%;
		background-clip: text;
		-webkit-background-clip: text;
		color: transparent;
	}
	.pt-feat-sub {
		margin: 0;
		font-family: 'Nunito Sans', sans-serif;
		font-weight: 600;
		font-size: 4.6cqw;
		white-space: pre-line;
		line-height: 1.2;
		color: #fff;
	}
	.pt-feat-big {
		margin: 0.6cqh 0;
		font-family: 'Lilita One', sans-serif;
		font-weight: 400;
		/* "25,000x" is seven glyphs of Lilita — at 16cqw it ran into both rails of the panel. */
		font-size: 13cqw;
		line-height: 1;
		background-image: linear-gradient(
			181.3deg,
			#f1eea5 7.45%,
			#e79a17 28.07%,
			#d7880c 63.58%,
			#a16202 93.75%
		);
		background-clip: text;
		-webkit-background-clip: text;
		color: transparent;
	}
	.pt-dots {
		display: flex;
		align-items: center;
		gap: 2.6cqw;
		margin-top: 3.5cqh;
	}
	.pt-dot {
		width: 2.4cqw;
		height: 2.4cqw;
		padding: 0;
		border: 0;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.4);
		cursor: pointer;
		transition:
			width 0.25s ease,
			background 0.25s ease;
	}
	.pt-dot.is-active {
		width: 6.5cqw;
		border-radius: 1.2cqw;
		background: #f0c24a;
	}
	.pt-press {
		position: relative;
		z-index: 1;
		margin-top: auto;
		margin-bottom: calc(4cqh + env(safe-area-inset-bottom, 0px));
		display: flex;
		align-items: center;
		gap: 2cqw;
		animation: blink 1.6s ease-in-out infinite;
	}
	.pt-press-label {
		font-family: Helvetica, Arial, sans-serif;
		font-weight: 700;
		font-size: 4cqw;
		letter-spacing: 0.03em;
		color: #fff;
	}
	.pt-press-arrow {
		width: 4cqw;
		height: auto;
		display: block;
	}

	@media (prefers-reduced-motion: reduce) {
		.pt-press {
			animation: none;
		}
	}
</style>
