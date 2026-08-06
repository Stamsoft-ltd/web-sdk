<script lang="ts" module>
	// Module scope so the splash art preloads during the loading screen — the splash is the
	// very next thing on screen, so it must not pop in image-by-image.
	import { ap } from '../lib/preloadArt';

	// splash.jpg = forest + 5 characters holding 3 empty wooden boards (no logo, no text).
	const bgSrc = ap('/assets/components/backgrounds/splash.jpg?v=20260630');
	// Portrait artwork: the gang holding a single central board (for the mobile carousel).
	const bgMobileSrc = ap('/assets/components/backgrounds/splash_mobile.jpg?v=20260630');
	const logoSrc = ap('/assets/components/ui/forest_gang_logo.webp');
	const brandSrc = ap('/assets/components/ui/press_play_logo.webp?v=20260630');
</script>

<script lang="ts">
	import { onMount } from 'svelte';
	import { stateI18nDerived } from 'state-shared';
	import { fitLabel } from '../lib/fitLabel';

	type Props = { onpress: () => void };
	const props: Props = $props();

	const t = (key: string) => stateI18nDerived.translate(key);

	// Split a leading number ("3 scatters…") so it can be coloured gold.
	const splitNum = (s: string): [string, string] => {
		const m = s.match(/^(\s*\d[\d.,']*)([\s\S]*)$/);
		return m ? [m[1], m[2]] : ['', s];
	};
	const bonusTop = $derived(splitNum(t('SPLASH BONUS TOP')));
	const bonusMid = $derived(splitNum(t('SPLASH BONUS MID')));

	// Mobile = portrait viewport: show the three feature blocks one at a time, 3s each.
	let isPortrait = $state(false);
	let slide = $state(0);
	const SLIDE_COUNT = 3;
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

	function handlePress() {
		props.onpress();
	}
	function handleKey(e: KeyboardEvent) {
		if (e.code === 'Space' || e.code === 'Enter') handlePress();
	}
</script>

<svelte:window onkeydown={handleKey} onresize={updateOrientation} />

<div class="splash-intro" role="button" tabindex="0" onclick={handlePress} onkeydown={handleKey}>
	{#if isPortrait}
		<!-- Mobile / portrait: single central board, one feature block at a time. -->
		<div class="stage stage--mobile" style={`background-image: url('${bgMobileSrc}')`}>
			<img class="brand brand--m" src={brandSrc} alt="Press Play" draggable="false" />
			<img class="logo logo--m" src={logoSrc} alt="Forest Gang" draggable="false" />

			<!-- All three stay mounted and stacked, cross-fading on `slide`. A {#if} chain here was a
			     bare block swap — the first motion a player sees was a hard cut. Keeping them mounted
			     also stops `fitLabel` from re-measuring every text block every 3s. -->
			<div class="feat feat-m">
				<!-- EPIC WIN -->
				<div class="f-slide" class:f-slide--on={slide === 0}>
					<div class="f-title f-purple" use:fitLabel={{ dep: t('SPLASH EPIC TITLE'), maxFraction: isPortrait ? 0.68 : 0.82 }}>{t('SPLASH EPIC TITLE')}</div>
					<div class="f-sub f-sub--fit f-pre">{t('SPLASH EPIC TOP')}</div>
					<div class="f-value-num f-gold">25'000x</div>
					<div class="f-hl f-gold" use:fitLabel={{ dep: t('SPLASH EPIC BOTTOM'), maxFraction: isPortrait ? 0.68 : 0.82 }}>{t('SPLASH EPIC BOTTOM')}</div>
				</div>
				<!-- BONUS GAME -->
				<div class="f-slide" class:f-slide--on={slide === 1}>
					<div class="f-title f-gold" use:fitLabel={{ dep: t('SPLASH BONUS TITLE'), maxFraction: isPortrait ? 0.68 : 0.82 }}>{t('SPLASH BONUS TITLE')}</div>
					<div class="f-sub f-pre"><span class="f-num f-gold">{bonusTop[0]}</span>{bonusTop[1]}</div>
					<div class="f-divider"></div>
					<div class="f-sub"><span class="f-num f-gold">{bonusMid[0]}</span>{bonusMid[1]}</div>
					<div class="f-hl f-gold" use:fitLabel={{ dep: t('SPLASH BONUS HL'), maxFraction: isPortrait ? 0.68 : 0.82 }}>{t('SPLASH BONUS HL')}</div>
				</div>
				<!-- EXPANDING REELS -->
				<div class="f-slide" class:f-slide--on={slide === 2}>
					<div class="f-title f-green" use:fitLabel={{ dep: t('SPLASH EXP TITLE'), maxFraction: isPortrait ? 0.68 : 0.82 }}>{t('SPLASH EXP TITLE')}</div>
					<div class="f-sub">{t('SPLASH EXP TOP')}</div>
					<div class="f-value-num f-gold">1024x</div>
					<div class="f-sub">{t('SPLASH EXP BOTTOM')}</div>
				</div>
			</div>

			<div class="dots">
				{#each Array(SLIDE_COUNT) as _, i}
					<span class="dot" class:dot--on={slide === i}></span>
				{/each}
			</div>

			<p class="press-label press-label--m">{t('SPLASH PRESS')} →</p>
		</div>
	{:else}
		<!-- Desktop / landscape: 16:9 stage with all three boards. -->
		<div class="stage" style={`background-image: url('${bgSrc}')`}>
			<img class="brand" src={brandSrc} alt="Press Play" draggable="false" />
			<img class="logo" src={logoSrc} alt="Forest Gang" draggable="false" />

			<!-- EXPANDING REELS -->
			<div class="feat feat-left">
				<div class="f-title f-green" use:fitLabel={{ dep: t('SPLASH EXP TITLE'), maxFraction: isPortrait ? 0.68 : 0.82 }}>{t('SPLASH EXP TITLE')}</div>
				<div class="f-sub">{t('SPLASH EXP TOP')}</div>
				<div class="f-value-num f-gold">1024x</div>
				<div class="f-sub">{t('SPLASH EXP BOTTOM')}</div>
			</div>

			<!-- BONUS GAME -->
			<div class="feat feat-center">
				<div class="f-title f-gold" use:fitLabel={{ dep: t('SPLASH BONUS TITLE'), maxFraction: isPortrait ? 0.68 : 0.82 }}>{t('SPLASH BONUS TITLE')}</div>
				<div class="f-sub f-pre"><span class="f-num f-gold">{bonusTop[0]}</span>{bonusTop[1]}</div>
				<div class="f-divider"></div>
				<div class="f-sub"><span class="f-num f-gold">{bonusMid[0]}</span>{bonusMid[1]}</div>
				<div class="f-hl f-gold" use:fitLabel={{ dep: t('SPLASH BONUS HL'), maxFraction: isPortrait ? 0.68 : 0.82 }}>{t('SPLASH BONUS HL')}</div>
			</div>

			<!-- EPIC WIN -->
			<div class="feat feat-right">
				<div class="f-title f-purple" use:fitLabel={{ dep: t('SPLASH EPIC TITLE'), maxFraction: isPortrait ? 0.68 : 0.82 }}>{t('SPLASH EPIC TITLE')}</div>
				<div class="f-sub f-sub--fit f-pre">{t('SPLASH EPIC TOP')}</div>
				<div class="f-value-num f-gold">25'000x</div>
				<div class="f-hl f-gold f-hl-sm" use:fitLabel={{ dep: t('SPLASH EPIC BOTTOM'), maxFraction: isPortrait ? 0.68 : 0.82 }}>{t('SPLASH EPIC BOTTOM')}</div>
			</div>

			<p class="press-label">{t('SPLASH PRESS')} →</p>
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
		background: #060a06;
	}

	/* Height-fit 16:9 stage (full artwork height always visible; width follows). */
	.stage {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		height: 100vh;
		width: calc(100vh * 16 / 9);
		background-size: 100% 100%;
		background-position: center;
		background-repeat: no-repeat;
		container-type: size;
	}

	/* Portrait stage: a fixed-aspect box matching the artwork (1080×2400) that fills the viewport
	   width; the bg fills the box exactly (100% 100%, inherited) so overlays stay locked to the
	   board regardless of viewport aspect (the height overflows slightly and is centre-cropped). */
	.stage--mobile {
		width: 100vw;
		height: calc(100vw * 2400 / 1080);
	}

	/* Studio logo, centred at the very top, above the game logo. */
	.brand {
		position: absolute;
		left: 50%;
		top: 2.5%;
		transform: translateX(-50%);
		width: 11%;
		object-fit: contain;
		filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.7));
	}

	.logo {
		position: absolute;
		left: 50%;
		top: 9.5%;
		transform: translateX(-50%);
		width: 19.8%;
		object-fit: contain;
		filter: drop-shadow(0 4px 14px rgba(0, 0, 0, 0.7));
	}

	/* Mobile logo sizing/placement (wider % since the stage is narrow).
	   The portrait stage is a tall fixed-aspect box (1080×2400) centred in the viewport, so on
	   short / squat phones it overflows and is cropped top+bottom — which pushes the logo stack
	   up against the top edge. Anchor the stack a fixed distance below the *viewport* top once the
	   crop exceeds the artwork-relative %: `crop-per-side + margin`, where crop-per-side =
	   (stageHeight − viewportHeight) / 2. Tall phones (little/no crop) keep the original %. */
	.brand--m {
		top: max(8.5%, calc((100vw * 2400 / 1080 - 100vh) / 2 + 7.5vh));
		width: 30%;
	}
	.logo--m {
		top: max(13%, calc((100vw * 2400 / 1080 - 100vh) / 2 + 12vh));
		width: 52%;
	}

	/* Feature text blocks — positioned by their centre over each board. */
	.feat {
		position: absolute;
		transform: translateX(-50%);
		width: 15%;
		height: 20%;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: space-between;
		text-align: center;
		pointer-events: none;
		font-family: 'Cinzel', serif;
	}

	/* Top-anchored so the titles line up across all three boards. */
	.feat-left {
		left: 28.2%;
		top: 59%;
	}
	.feat-center {
		left: 49.8%;
		top: 59%;
	}
	.feat-right {
		left: 70.7%;
		top: 59%;
	}

	/* Mobile: single feature block centred on the lower board (board centre ≈ 49.4% of the art). */
	.feat-m {
		left: 49.4%;
		top: 51%;
		width: 60%;
		height: 22%;
		justify-content: center;
		gap: 1.5cqw;
	}
	/* Stacked so the outgoing and incoming block occupy the same box and cross-fade in place.
	   Each slide carries the column layout `.feat` gave the blocks when they were direct children. */
	.feat-m .f-slide {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 1.5cqw;
		opacity: 0;
		transition: opacity 450ms ease;
	}
	.feat-m .f-slide--on {
		opacity: 1;
	}

	/* Titles */
	.f-title {
		font-weight: 900;
		font-size: 1.9cqw;
		line-height: 1.05;
		letter-spacing: 0.03em; /* 0.66px @ 22px */
		text-transform: uppercase;
		white-space: pre; /* honour the explicit line break, never auto-wrap */
		/* Figma: text-shadow 0 0 17px #000 — on gradient-clipped text this is a drop-shadow glow
		   (em-based so it scales with the title on both desktop and mobile). */
		filter: drop-shadow(0 0 0.7em #000);
	}

	/* Descriptive / multiplier lines — Poppins per Figma (color #D7D7D7, letter-spacing 0.42px@14px) */
	.f-sub {
		font-family: 'Poppins', sans-serif;
		font-weight: 400;
		font-size: 1.15cqw;
		line-height: normal;
		color: #d7d7d7;
		letter-spacing: 0.03em;
		text-shadow: 0 2px 5px rgba(0, 0, 0, 0.75);
	}
	.f-pre {
		white-space: pre-line;
	}
	/* Epic board's top line is longer ("become the king of the forest with") — shrink it a touch
	   so it stays on two lines without shrinking the other boards' text. */
	.f-sub.f-sub--fit {
		font-size: 1.08cqw;
	}

	/* Gold leading numbers in the scatter lines (3 / 4) — Cinzel Black, gold gradient (Figma 2473-1629).
	   17px number vs 12px surrounding Poppins text = 1.42×; letter-spacing 0.51px@17px = 0.03em. */
	.f-num {
		font-family: 'Cinzel', serif;
		font-weight: 900;
		font-size: 1.28em;
		letter-spacing: 0.03em;
		/* inline-block + a tight line-height hug the glyph's cap height so background-clip:text maps
		   the gold gradient onto the glyph itself (a taller box offsets the gradient and the number
		   looks pale/whitish at the top). Matches the title / 25000x rendering. */
		display: inline-block;
		vertical-align: baseline;
		line-height: 0.86;
		text-shadow: none;
		filter: drop-shadow(0 0 0.28em rgba(0, 0, 0, 0.7));
	}

	/* Gold highlight sub-labels (SUPER BONUS / MAX WIN) */
	.f-hl {
		font-weight: 900;
		font-size: 1.4cqw;
		letter-spacing: 0.03em;
		text-transform: uppercase;
		white-space: nowrap;
		filter: drop-shadow(0 2px 5px rgba(0, 0, 0, 0.7));
	}
	.f-hl-sm {
		font-size: 1.15cqw;
	}

	/* Big gold value images */
	.f-value {
		width: 64%;
		object-fit: contain;
		margin: 0.1cqw 0;
		filter: drop-shadow(0 3px 8px rgba(0, 0, 0, 0.55));
	}

	/* Big gold value as text (Cinzel Black gold gradient) — e.g. the 1024x expanding value.
	   Figma: 37px / letter-spacing 1.11px / text-shadow 0 0 17px #000 (em-based so it scales). */
	.f-value-num {
		font-family: 'Cinzel', serif;
		font-weight: 900;
		font-size: 3.2cqw;
		line-height: 1;
		letter-spacing: 0.03em;
		text-align: center;
		margin: 0.2cqw 0;
		filter: drop-shadow(0 0 0.46em #000);
	}
	.feat-m .f-value-num {
		font-size: 8.5cqw;
	}

	/* Thin divider on the bonus board — negative margin pulls the two scatter text blocks
	   closer to it (space-between otherwise spreads the gaps too wide). */
	.f-divider {
		width: 55%;
		height: 2px;
		margin: -1cqw 0;
		background: linear-gradient(90deg, transparent, rgba(251, 197, 11, 0.7), transparent);
	}

	/* Mobile feature scale-up (cqw is % of the narrow portrait stage). */
	.feat-m .f-title {
		font-size: 5cqw;
	}
	.feat-m .f-sub {
		font-size: 3.8cqw;
	}
	.feat-m .f-sub.f-sub--fit {
		font-size: 3.15cqw;
	}
	.feat-m .f-hl {
		font-size: 4.2cqw;
	}
	.feat-m .f-value {
		width: 46%;
		margin: 1cqw 0;
	}
	.feat-m .f-divider {
		margin: 1cqw 0;
	}

	/* Colour fills (Figma feature gradients) */
	.f-green {
		background: linear-gradient(195deg, #a1cd03 17.75%, #9fca03 58.89%, #658000 100.04%);
		-webkit-background-clip: text;
		background-clip: text;
		-webkit-text-fill-color: transparent;
		color: transparent;
	}
	.f-gold {
		background: linear-gradient(184deg, #ffa90e 15.26%, #ee960b 69.74%, #d18005 92.88%);
		-webkit-background-clip: text;
		background-clip: text;
		-webkit-text-fill-color: transparent;
		color: transparent;
	}
	.f-purple {
		background: linear-gradient(201deg, #cf53f6 20.98%, #d561fa 41.39%, #bd39e7 61.81%);
		-webkit-background-clip: text;
		background-clip: text;
		-webkit-text-fill-color: transparent;
		color: transparent;
	}

	/* Slide indicator dots (mobile) */
	.dots {
		position: absolute;
		left: 49.4%;
		top: 80%;
		transform: translateX(-50%);
		display: flex;
		gap: 2.4cqw;
		pointer-events: none;
	}
	.dot {
		width: 2cqw;
		height: 2cqw;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.35);
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.6);
	}
	.dot--on {
		background: #fbc503;
	}

	.press-label {
		position: absolute;
		left: 50%;
		top: 91%;
		transform: translate(-50%, -50%);
		margin: 0;
		white-space: nowrap;
		font-family: 'Cinzel', serif;
		font-weight: 900;
		font-size: clamp(15px, 1.9vw, 26px);
		letter-spacing: 0.06em;
		background: linear-gradient(180deg, #ece96d 18%, #fbc503 55%, #d97e03 92%);
		-webkit-background-clip: text;
		background-clip: text;
		-webkit-text-fill-color: transparent;
		filter: drop-shadow(0 2px 6px rgba(0, 0, 0, 0.8));
		animation: blink 1.6s ease-in-out infinite;
	}

	/* Mobile press label sits below the dots. */
	.press-label--m {
		top: 87%;
		font-size: clamp(16px, 4.4cqw, 30px);
	}

	@keyframes blink {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.5;
		}
	}
</style>
