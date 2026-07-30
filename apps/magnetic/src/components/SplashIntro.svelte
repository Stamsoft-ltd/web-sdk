<script lang="ts">
	import { onMount } from 'svelte';
	import { stateI18nDerived } from 'state-shared';
	import { i18nDerived } from '../i18n/i18nDerived';

	type Props = { onpress: () => void };
	const props: Props = $props();

	const t = (key: string) => stateI18nDerived.translate(key);

	// Titles are fixed-size with `white-space: pre` (no wrapping), so long words in some languages
	// (e.g. Russian "РАСШИРЯЮЩИЕСЯ") overflow the card. Shrink the font to fit the card width.
	function fitTitle(node: HTMLElement, _dep?: unknown) {
		const apply = () => {
			const parent = node.parentElement;
			if (!parent) return;
			node.style.fontSize = '';
			// Target ~90% of the card width so long titles (e.g. Russian "РАСШИРЯЮЩИЕСЯ") shrink to leave
			// a side margin instead of pressing right up against the frame edges.
			const target = parent.clientWidth * 0.9;
			const natural = node.scrollWidth;
			if (target > 0 && natural > target) {
				const base = parseFloat(getComputedStyle(node).fontSize);
				node.style.fontSize = `${Math.max(6, (base * target) / natural)}px`;
			}
		};
		const ro = new ResizeObserver(apply);
		if (node.parentElement) ro.observe(node.parentElement);
		requestAnimationFrame(apply);
		(document as Document).fonts?.ready.then(apply);
		return { update: apply, destroy: () => ro.disconnect() };
	}

	// splash_intro.jpg = industrial magnet room with three empty metal frames (no logo, no text).
	const bgSrc = './assets/components/backgrounds/splash_intro.jpg?v=20260708';
	// Portrait artwork: a single central metal frame baked in (for the mobile carousel).
	const bgMobileSrc = './assets/components/backgrounds/splash_intro_mobile.jpg?v=20260708b';
	const logoSrc = './assets/components/ui/magnetic_logo.webp?v=20260708';
	const brandSrc = './assets/components/ui/press_play_logo.webp?v=20260708';

	// Three feature panels (BONUS GAMES / MEGA CHAIN / MAX WIN), rendered by index via the `panel`
	// snippet in the markup below — desktop shows all three, portrait cycles through them one at a time.

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
	<!-- Per-panel content by index (0 = BONUS GAMES, 1 = MEGA CHAIN, 2 = MAX WIN). Coloured feature
	     keywords sit on their own lines so each is a single translatable string with a colour class. -->
	{#snippet panel(i: number)}
		{#if i === 0}
			<div class="f-title f-blue" use:fitTitle={t('SPLASH BONUS TITLE')}>{t('SPLASH BONUS TITLE')}</div>
			<div class="f-sub">{i18nDerived.translateVars('SPLASH SCATTERS FOR', { count: 3 })}</div>
			<div class="f-key f-blue">{t('SPLASH MEGA TITLE')}</div>
			<div class="f-sub">{i18nDerived.translateVars('SPLASH SCATTERS FOR', { count: 4 })}</div>
			<div class="f-key f-mega">{t('SPLASH MMC')}</div>
		{:else if i === 1}
			<div class="f-title f-mega" use:fitTitle={t('SPLASH MEGA TITLE')}>{t('SPLASH MEGA TITLE')}</div>
			<div class="f-sub">{t('SPLASH MEGA BUILD')}</div>
			<div class="f-key f-blue">{t('SPLASH MEGA CHAIN')}</div>
			<div class="f-sub">{t('SPLASH MEGA REST')}</div>
		{:else}
			<div class="f-title f-blue" use:fitTitle={t('SPLASH MAX TITLE')}>{t('SPLASH MAX TITLE')}</div>
			<div class="f-sub">{t('SPLASH UP TO')}</div>
			<div class="f-value f-mega">20'000<span class="f-x">X</span></div>
			<div class="f-sub">{t('SPLASH MULTIPLIER')}</div>
		{/if}
	{/snippet}
	{#if isPortrait}
		<!-- Mobile / portrait: single central frame, one feature block at a time. -->
		<div class="stage stage--mobile" style={`background-image: url('${bgMobileSrc}')`}>
			<img class="brand brand--m" src={brandSrc} alt="Press Play" draggable="false" />
			<img class="logo logo--m" src={logoSrc} alt="Magnetic" draggable="false" />

			<div class="feat feat-m">
				{@render panel(slide)}
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
			<img class="logo" src={logoSrc} alt="Magnetic" draggable="false" />

			{#each [0, 1, 2] as i}
				<div class="feat feat-{i}">
					{@render panel(i)}
				</div>
			{/each}

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
		background: #05070f;
	}

	/* Height-fit 16:9 stage, sized to the splash CONTAINER (not the viewport) so overlays stay locked
	   to the artwork even when the game area is smaller than the browser window. */
	.stage {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		height: 100%;
		aspect-ratio: 16 / 9;
		background-size: 100% 100%;
		background-position: center;
		background-repeat: no-repeat;
		container-type: size;
		/* The ground shake that sells the logo's impact. Delay = the logo's touchdown moment
		   (46% of its 900ms drop), so the jolt fires on the frame the two make contact. */
		animation: stage-jolt 320ms ease-out 414ms both;
	}

	/* Portrait stage: a fixed-aspect box matching the artwork (852×1846) that fills the viewport
	   width; the bg fills the box exactly so overlays stay locked to the frame regardless of
	   viewport aspect (the height overflows slightly and is centre-cropped). */
	.stage--mobile {
		width: 100vw;
		height: calc(100vw * 1846 / 852);
	}

	/* Studio logo, centred at the very top, above the game logo. */
	.brand {
		position: absolute;
		left: 50%;
		top: 2%;
		transform: translateX(-50%);
		width: 9.4%;
		object-fit: contain;
		filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.7));
	}

	/* Game logo, centred below the studio logo. Anchored by its CENTRE (translate -50%,-50%) so the
	   logo art sits at `top` regardless of the transparent glow padding baked into the PNG. */
	.logo {
		position: absolute;
		left: 50%;
		top: 26%;
		transform: translate(-50%, -50%);
		width: 52%;
		object-fit: contain;
		filter: drop-shadow(0 4px 18px rgba(0, 0, 0, 0.75));
		/* Entrance: the logo falls in from above the stage and lands like a dropped stone.
		   --drop-from is the start offset in stage-height units (the stage is the container), tuned
		   per layout so the art starts fully clear of the top edge: at width 52% the 1400x1098 logo
		   is ~0.73 stage-heights tall on desktop and already overhangs the top at rest, so it needs
		   to travel much further up there than on the tall portrait stage. No fade is needed —
		   .splash-intro is overflow:hidden, so anything above the stage top is simply clipped. */
		--drop-from: -68cqh;
		animation: logo-drop 900ms linear both;
	}

	/* Mobile logo sizing/placement (wider % since the stage is narrow). The portrait stage is a tall
	   fixed-aspect box centred in the viewport, so on short phones it overflows and is cropped
	   top+bottom — which pushes the logo stack against the top edge. Anchor the stack a fixed
	   distance below the *viewport* top once the crop exceeds the artwork-relative %:
	   `crop-per-side + margin`, where crop-per-side = (stageHeight − viewportHeight) / 2. */
	.brand--m {
		top: max(11%, calc((100vw * 1846 / 852 - 100vh) / 2 + 4vh));
		width: 24%;
	}
	.logo--m {
		top: max(15.5%, calc((100vw * 1846 / 852 - 100vh) / 2 + 7.5vh));
		width: 52%;
		/* Portrait stage is ~2.17x as tall as it is wide, so the same 52% width is only ~0.19
		   stage-heights of logo — a much shorter trip to clear the top edge. */
		--drop-from: -32cqh;
	}

	/* Feature text blocks — positioned by their centre over each metal frame. The width is matched to
	   the frame's BLACK INTERIOR (~17.5% of the stage), not the outer frame, so long translations wrap
	   onto multiple rows INSIDE the window instead of spilling across the metal border. */
	.feat {
		position: absolute;
		transform: translate(-50%, -50%);
		width: 17.5%;
		height: 34%;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.5cqw;
		text-align: center;
		pointer-events: none;
	}

	/* Frame interior centres, measured from the artwork: 26.3 / 49.1 / 71.9% (symmetric about 49.1%). */
	.feat-0 {
		left: 26.3%;
		top: 65%;
	}
	.feat-1 {
		left: 49.1%;
		top: 65%;
	}
	.feat-2 {
		left: 71.9%;
		top: 65%;
	}

	/* Mobile: single feature block centred on the baked frame (interior centre ≈ 54% of the art). Width
	   matched to that frame's BLACK INTERIOR (~60% of the stage), so long keyword lines wrap inside the
	   window instead of spilling over the metal border. */
	.feat-m {
		left: 50%;
		top: 54%;
		width: 60%;
		height: 34%;
		gap: 1.4cqw;
	}

	/* Titles — condensed sci-fi caps, gradient-filled with a soft dark glow. */
	.f-title {
		font-family: 'IBM Plex Sans Condensed', 'Poppins', sans-serif;
		font-weight: 700;
		font-size: 2.3cqw;
		line-height: 1;
		letter-spacing: 0.02em;
		text-transform: uppercase;
		white-space: pre; /* honour the explicit line break, never auto-wrap */
		filter: drop-shadow(0 0 0.55em rgba(0, 0, 0, 0.9));
	}

	/* Descriptive lines ("with up to" / "multiplier") — Figma: Poppins 400, #FFFFFF, 16px,
	   letter-spacing 0.48px (= 0.03em). Sized in cqw so it scales with the artwork (16px ≈ 1.33cqw). */
	.f-sub {
		font-family: 'Poppins', sans-serif;
		font-weight: 400;
		font-size: 1.33cqw;
		line-height: normal;
		color: #ffffff;
		text-align: center;
		letter-spacing: 0.03em;
		text-shadow: 0 2px 5px rgba(0, 0, 0, 0.8);
		/* Never wider than the frame — long translations wrap onto multiple rows. */
		max-width: 100%;
		overflow-wrap: break-word;
	}

	/* Coloured feature-keyword lines (MEGA CHAIN, MAGNETIC MEGA CHAIN, chain) — bolder/bigger than the
	   plain description lines; a .f-blue / .f-mega gradient class is applied alongside. */
	.f-key {
		font-family: 'IBM Plex Sans Condensed', 'Poppins', sans-serif;
		font-weight: 700;
		font-size: 1.75cqw;
		line-height: 1.08;
		text-align: center;
		letter-spacing: 0.02em;
		filter: drop-shadow(0 0 0.4em rgba(0, 0, 0, 0.85));
		/* Never wider than the frame — long keywords (e.g. de "MAGNETISCHE MEGA-KETTE") wrap to two rows
		   instead of spilling past the card edges. */
		max-width: 100%;
		overflow-wrap: break-word;
	}

	/* Big multiplier value — gold gradient, condensed bold, with a trailing smaller "x". */
	.f-value {
		font-family: 'IBM Plex Sans Condensed', 'Poppins', sans-serif;
		font-weight: 700;
		font-size: 3.6cqw;
		line-height: 1;
		letter-spacing: 0.01em;
		filter: drop-shadow(0 0 0.35em rgba(0, 0, 0, 0.85));
	}
	.f-x {
		font-size: 0.6em;
		margin-left: 0.06em;
	}

	/* Colour fills (Figma feature gradients) */
	.f-blue {
		background: linear-gradient(180deg, #d3ecff 0%, #6bb0ff 42%, #2f7ee0 78%, #1c5cc4 100%);
		-webkit-background-clip: text;
		background-clip: text;
		-webkit-text-fill-color: transparent;
		color: transparent;
	}
	.f-mega {
		background: linear-gradient(
			179deg,
			#ebabdf 14%,
			#c5aae8 26%,
			#9fa8f1 37%,
			#afb6f6 49%,
			#b64f8e 65%,
			#d9335c 80%,
			#fb1629 88%
		);
		-webkit-background-clip: text;
		background-clip: text;
		-webkit-text-fill-color: transparent;
		color: transparent;
	}
	.f-gold {
		background: var(
			--gold-splash,
			linear-gradient(183deg, #f1eea5 -7.45%, #e79a17 28.07%, #d7880c 63.58%, #a16202 93.75%)
		);
		-webkit-background-clip: text;
		background-clip: text;
		-webkit-text-fill-color: transparent;
		color: transparent;
	}

	/* Mobile feature sizes — Figma (360-wide): title 30px, value 54px, sub 16px. cqw = % stage width. */
	.feat-m .f-title {
		font-size: 8.3cqw;
	}
	.feat-m .f-sub {
		font-size: 4.44cqw;
	}
	.feat-m .f-key {
		font-size: 5.6cqw;
	}
	.feat-m .f-value {
		font-size: 15cqw;
	}

	/* Slide indicator dots (mobile) — just below the frame. */
	.dots {
		position: absolute;
		left: 50%;
		top: 75%;
		transform: translateX(-50%);
		display: flex;
		gap: 3cqw;
		pointer-events: none;
	}
	.dot {
		width: 2.2cqw;
		height: 2.2cqw;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.35);
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.6);
	}
	.dot--on {
		background: #4aa8ff;
	}

	.press-label {
		position: absolute;
		left: 50%;
		top: 93%;
		transform: translate(-50%, -50%);
		margin: 0;
		white-space: nowrap;
		font-family: 'Poppins', sans-serif;
		font-weight: 700;
		font-size: clamp(14px, 1.55vw, 22px);
		letter-spacing: 0.08em;
		color: #ffffff;
		text-shadow: 0 2px 8px rgba(0, 0, 0, 0.85);
		animation: blink 1.6s ease-in-out infinite;
	}

	/* Mobile press label sits below the dots. */
	.press-label--m {
		top: 79%;
		font-size: clamp(15px, 4.44cqw, 26px);
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

	/* Every keyframe repeats translate(-50%, -50%) because that is what centres the logo on its
	   anchor point — dropping it from one frame would snap the logo a full half-size sideways. */
	@keyframes logo-drop {
		0% {
			transform: translate(-50%, -50%) translateY(var(--drop-from)) scale(0.94, 1.09);
			/* Gravity: barely moves at first, hits the floor at full speed. */
			animation-timing-function: cubic-bezier(0.55, 0, 0.95, 0.42);
		}
		46% {
			/* Touchdown, still stretched thin from the fall. */
			transform: translate(-50%, -50%) scale(0.94, 1.09);
			animation-timing-function: cubic-bezier(0.18, 0.7, 0.35, 1);
		}
		57% {
			/* The impact flattens it hard against the ground. */
			transform: translate(-50%, -50%) translateY(2.5%) scale(1.13, 0.85);
			animation-timing-function: ease-out;
		}
		72% {
			/* A stone barely bounces — keep the rebound low, and short. */
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

	/* Same rule as above: the stage is centred by its own translate(-50%, -50%), so the shake is
	   written as small deviations around those values rather than as offsets from zero. */
	@keyframes stage-jolt {
		0% {
			transform: translate(-50%, -50%);
		}
		22% {
			transform: translate(-50%, -49.15%);
		}
		48% {
			transform: translate(-50.3%, -50.45%);
		}
		74% {
			transform: translate(-49.85%, -49.85%);
		}
		100% {
			transform: translate(-50%, -50%);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.logo,
		.stage {
			animation: none;
		}
	}
</style>
