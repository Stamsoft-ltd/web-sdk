<script lang="ts">
	type Props = { onpress: () => void };
	const props: Props = $props();

	const bgSrc = './assets/theme-park/v2/background.png';
	const logoSrc = './assets/theme-park/v2/logo.png';

	function handlePress() {
		props.onpress();
	}
	function handleKey(e: KeyboardEvent) {
		if (e.code === 'Space' || e.code === 'Enter') handlePress();
	}
</script>

<svelte:window onkeydown={handleKey} />

<div class="splash-intro" role="button" tabindex="0" onclick={handlePress} onkeydown={handleKey}>
	<!-- 16:9 stage that cover-scales the artwork; overlays are positioned within it -->
	<div class="stage" style={`background-image: url('${bgSrc}')`}>
		<img class="logo" src={logoSrc} alt="Theme Park" />

		<p class="press-label">PRESS TO CONTINUE</p>
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
		background: #060a06;
	}

	/* Cover-scaled 16:9 stage */
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
	}

	.logo {
		position: absolute;
		left: 50%;
		top: 7%;
		transform: translateX(-50%);
		width: min(48%, 720px);
		height: auto;
		margin: 0;
		filter: drop-shadow(0 4px 14px rgba(0, 0, 0, 0.7));
		animation: logo-float 3.2s ease-in-out infinite;
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

	@keyframes blink {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.5;
		}
	}

	@keyframes logo-float {
		0%,
		100% {
			transform: translate(-50%, 0) scale(1);
			filter: drop-shadow(0 4px 14px rgba(0, 0, 0, 0.7));
		}
		50% {
			transform: translate(-50%, -5px) scale(1.025);
			filter: drop-shadow(0 4px 20px rgba(255, 67, 220, 0.58));
		}
	}
</style>
