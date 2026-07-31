<script lang="ts" module>
	import { ap } from '../lib/preloadArt';

	// Splash art (Figma 6102-1129). The park scene is NOT the in-game background: the three gold
	// marquee frames the feature copy sits inside are painted into this image, so the text layer
	// below is positioned against it and the two must scale as one unit.
	const bgSrc = ap('/assets/theme-park/v2/splash/background.webp');
	const logoSrc = ap('/assets/theme-park/v2/splash/logo.webp');
	const pressPlaySrc = ap('/assets/theme-park/v2/splash/press_play_mark.svg');
	const arrowSrc = ap('/assets/theme-park/v2/splash/arrow.svg');
</script>

<script lang="ts">
	import { stateI18nDerived } from 'state-shared';

	type Props = { onpress: () => void };
	const props: Props = $props();

	const t = (key: string) => stateI18nDerived.translate(key);

	// Not translated — a numeral, and it is the same figure on all three cards in the design.
	const MULTIPLIER = '1024x';

	// One entry per marquee frame. Every number is the Figma node's own geometry expressed against
	// the 1200x670 design frame: `cx` is the column centre and each `*Y` is the vertical CENTRE of
	// that text node's box. Anchoring by centre rather than by top is what lets card 1's title wrap
	// to two lines (and any locale's title wrap to two) without shoving "with up to" down into it.
	const CARDS = [
		{
			key: 'SPLASH FEATURE 1',
			tone: 'blue',
			cx: 337,
			titleY: 385, // box 353..417 — two lines at 32px, leading-none
			upToY: 435,
			bigY: 480.5,
			multY: 527,
		},
		{
			key: 'SPLASH FEATURE 2',
			tone: 'candy',
			cx: 603,
			titleY: 381, // box 360..402
			upToY: 422,
			bigY: 467.5,
			multY: 514,
		},
		{
			key: 'SPLASH FEATURE 3',
			tone: 'blue',
			cx: 863,
			titleY: 380, // box 359..401
			upToY: 423,
			bigY: 468.5,
			multY: 515,
		},
	] as const;

	// Design-frame coordinates -> percentages of the stage.
	const px = (x: number) => `${(x / 1200) * 100}%`;
	const py = (y: number) => `${(y / 670) * 100}%`;

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
	<div class="backdrop" style={`background-image:url('${bgSrc}')`}></div>

	<div class="stage">
		<!-- The background node is placed at (-19,-6) at 1239x697 in a 1200x670 frame, i.e. it
		     deliberately bleeds past every edge. Reproduced exactly so the marquee frames land under
		     the text at the coordinates below. -->
		<img class="bg" src={bgSrc} alt="" />

		<img class="press-play" src={pressPlaySrc} alt="Press Play" />

		<div class="logo-box">
			<img class="logo" src={logoSrc} alt={t('GAME TITLE')} />
		</div>

		{#each CARDS as card (card.key)}
			<p class="title title--{card.tone}" style={`left:${px(card.cx)};top:${py(card.titleY)}`}>
				{t(card.key)}
			</p>
			<p class="body" style={`left:${px(card.cx)};top:${py(card.upToY)}`}>
				{t('SPLASH WITH UP TO')}
			</p>
			<p class="big" style={`left:${px(card.cx)};top:${py(card.bigY)}`}>{MULTIPLIER}</p>
			<p class="body" style={`left:${px(card.cx)};top:${py(card.multY)}`}>
				{t('SPLASH MULTIPLIER')}
			</p>
		{/each}

		<!-- Sits ABOVE the cards so its dark stop deepens the paving at the bottom of the scene, but
		     the press row is drawn after it and so stays legible. -->
		<div class="vignette"></div>

		<div class="press-row">
			<span class="press-label">{t('PRESS TO CONTINUE')}</span>
			<img class="press-arrow" src={arrowSrc} alt="" />
		</div>
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
		filter: blur(26px) brightness(0.42) saturate(0.85);
		transform: scale(1.12);
	}

	/* The 1200x670 design frame. Contain-fit by default: the three marquee frames span x 248..944 of
	   1200, so a cover-fit on a portrait phone would crop two of them off-screen entirely. */
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

	/* Past ~1.2:1 the horizontal crop can no longer reach the outer marquee frames (at exactly 1.2:1
	   the visible window is design x 198..1002 against cards at 248..944), so switch to cover and
	   drop the letterbox entirely. */
	@media (min-aspect-ratio: 6 / 5) {
		.stage {
			width: max(100cqw, calc(100cqh * 1200 / 670));
			height: max(100cqh, calc(100cqw * 670 / 1200));
		}
	}

	.bg {
		position: absolute;
		left: -1.58333%; /* -19 / 1200 */
		top: -0.89552%; /* -6 / 670 */
		width: 103.25%; /* 1239 / 1200 */
		height: 104.02985%; /* 697 / 670 */
		object-fit: cover;
	}

	/* Press Play studio mark — group box 112.5181 x 36.4013, centred at (601.3, 164.2) in the design.
	   Lifted to y 116 on request: the design tucks it right against the logo plate, and once the
	   logo drops into place the two read as one crowded block. */
	.press-play {
		position: absolute;
		left: 50.10832%;
		top: 17.31343%; /* 116 / 670 */
		transform: translate(-50%, -50%);
		width: 9.37651%;
		height: auto;
	}

	/* Theme Park logo — 517 x 178 box centred at (589.5, 271). The artwork is 3:1, slightly wider
	   than the box, and the design crops it horizontally rather than letterboxing it, so the wrapper
	   keeps the designed box and the image covers it. */
	.logo-box {
		position: absolute;
		left: 49.125%;
		top: 40.44776%;
		transform: translate(-50%, -50%);
		width: 43.08333%;
		aspect-ratio: 517 / 178;
		overflow: hidden;
		/* Falls in from off-screen and lands hard. -210% of its own height clears the stage top from
		   a centre at 40.45% (needs 271 + 89 = 360 design px = 202% of the 178px box). */
		--drop-from: -210%;
		animation: logo-drop 900ms linear both;
	}
	.logo {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	.title,
	.body,
	.big {
		position: absolute;
		transform: translate(-50%, -50%);
		margin: 0;
		text-align: center;
		letter-spacing: 0.03em;
	}

	/* IBM Plex Sans Condensed Bold, 32px on a 1200 frame. Constrained to the 216px title box from
	   the design so "EXPANDING REELS" wraps to two lines exactly as drawn — and so a long
	   translation wraps instead of running out over the marquee frame. */
	.title {
		width: 18%;
		font-family: 'IBM Plex Sans Condensed', 'Poppins', sans-serif;
		font-weight: 700;
		font-size: 2.66667cqw;
		line-height: 1;
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

	/* Poppins Regular 16px, plain white. */
	.body {
		font-family: 'Poppins', sans-serif;
		font-weight: 400;
		font-size: 1.33333cqw;
		line-height: 1;
		color: #fff;
		white-space: nowrap;
	}

	/* IBM Plex Sans Condensed Bold 58px, gold. */
	.big {
		font-family: 'IBM Plex Sans Condensed', 'Poppins', sans-serif;
		font-weight: 700;
		font-size: 4.83333cqw;
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

	/* Row box 223 x 21 centred at (600.5, 633.5); 7px gap between label and arrow. */
	.press-row {
		position: absolute;
		left: 50.04167%;
		top: 94.55224%;
		transform: translate(-50%, -50%);
		display: flex;
		align-items: center;
		gap: 0.58333cqw;
		white-space: nowrap;
		/* The design's row is static; the pulse is the affordance that it is a tap target, and was
		   already on the screen this replaces. */
		animation: blink 1.6s ease-in-out infinite;
	}
	.press-label {
		/* Figma specifies Helvetica Bold. It is a system face on Apple platforms and Arial is a
		   metric-compatible stand-in everywhere else, so this needs no webfont download. */
		font-family: Helvetica, Arial, sans-serif;
		font-weight: 700;
		font-size: 1.5cqw;
		letter-spacing: 0.03em;
		line-height: 1;
		color: #fff;
	}
	.press-arrow {
		width: 1.5cqw; /* 18 / 1200 */
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
		.logo-box,
		.stage {
			animation: none;
		}
	}
</style>
