<script lang="ts">
	// The move between worlds (App swapWorld): it covers the screen, the world is switched
	// underneath at once, then it uncovers on the new one. Each bonus tier has its own:
	//   normal  a wave of blue jelly floods up over the screen and carries on off the top
	//   super   a golden sun bursts out of the middle, its rays turning, then melts away
	//   hidden  a neon iris closes to black and opens again on the cavern
	//   base    (back from a bonus) a pink jelly flood, the game's own colour
	// `cover`, `hold` and `reveal` are ms; App waits cover (+ hold) before switching.
	let { style, cover, hold, reveal }: { style: 'normal' | 'super' | 'hidden' | 'base'; cover: number; hold: number; reveal: number } = $props();
	const BUBBLES = [
		[12, 30, 46],
		[26, 58, 30],
		[41, 22, 60],
		[57, 64, 38],
		[70, 34, 52],
		[84, 52, 34],
		[93, 20, 26],
		[6, 74, 36],
		[48, 80, 28],
		[78, 82, 44],
	] as const;
</script>

<div class={`swap ${style}`} style={`--in:${cover}ms;--hold:${hold}ms;--out:${reveal}ms`} aria-hidden="true">
	{#if style === 'super'}
		<div class="rays"></div>
		<div class="sun"></div>
	{:else if style === 'hidden'}
		<div class="iris"></div>
	{:else}
		<div class="sheet back"></div>
		<div class="sheet">
			{#each BUBBLES as [x, y, s], i}
				<span class="bubble" style={`left:${x}%;top:${y}%;width:${s}px;height:${s}px;--i:${i}`}></span>
			{/each}
		</div>
	{/if}
</div>

<style>
	/* The reveal fills only forwards: filled backwards it would win over the cover from the
	   first frame (the later animation in the list wins). */
	.swap {
		position: fixed;
		inset: 0;
		z-index: 44;
		overflow: hidden;
		pointer-events: none;
		--c0: #7fd8ff;
		--c1: #3b8bff;
		--c2: #2a4fd6;
	}
	.base {
		--c0: #ffb3e6;
		--c1: #ff5fc4;
		--c2: #c42a9a;
	}

	/* Jelly flood: a sheet 170vh tall with domed ends rises from below the screen. At the
	   cover point its body spans the whole screen; on the reveal it carries on off the top. */
	.sheet {
		position: absolute;
		left: -10%;
		width: 120%;
		top: 100%;
		height: 170vh;
		border-radius: 50% 50% 50% 50% / 14vh 14vh 14vh 14vh;
		background:
			radial-gradient(40% 6vh at 50% 5vh, #ffffff8c, #fff0),
			linear-gradient(var(--c0), var(--c1) 12%, var(--c2));
		box-shadow:
			inset 0 6px 0 #ffffff59,
			inset 0 -10px 30px #0003;
		animation:
			swap-flood-in var(--in) cubic-bezier(0.3, 0.1, 0.45, 1) both,
			swap-flood-out var(--out) cubic-bezier(0.55, 0, 0.7, 0.9) calc(var(--in) + var(--hold)) forwards;
	}
	/* A lighter layer a beat behind, for depth. */
	.sheet.back {
		opacity: 0.55;
		filter: brightness(1.25);
		animation-delay: 0s, calc(var(--in) + var(--hold) - 60ms);
		margin-top: 4vh;
	}
	@keyframes swap-flood-in {
		from {
			transform: translateY(0) scaleX(0.92);
		}
		70% {
			transform: translateY(-122vh) scaleX(1.03);
		}
		to {
			transform: translateY(-135vh) scaleX(1);
		}
	}
	@keyframes swap-flood-out {
		from {
			transform: translateY(-135vh);
		}
		to {
			transform: translateY(-285vh) scaleX(0.94);
		}
	}
	.bubble {
		position: absolute;
		border-radius: 50%;
		background: radial-gradient(circle at 32% 30%, #fff 0 12%, #ffffff40 22%, #ffffff14 60%, #ffffff33);
		box-shadow: inset 0 0 0 1.5px #ffffff59;
		animation: swap-bubble 1.4s ease-in-out calc(var(--i) * -0.17s) infinite alternate;
	}
	@keyframes swap-bubble {
		to {
			transform: translateY(-3vh) scale(1.08);
		}
	}

	/* Golden burst: rays turn up out of the middle, the sun swells over the screen, then the
	   sun melts away and the rays fade as they keep turning. */
	.rays,
	.sun {
		position: absolute;
		left: 50%;
		top: 50%;
		width: 220vmax;
		height: 220vmax;
		margin: -110vmax 0 0 -110vmax;
		border-radius: 50%;
	}
	.rays {
		background: repeating-conic-gradient(#ffe46b 0 7deg, #ffb52e00 7deg 15deg);
		-webkit-mask: radial-gradient(closest-side, #000 20%, #0000);
		mask: radial-gradient(closest-side, #000 20%, #0000);
		opacity: 0.6;
		animation:
			swap-rays-in var(--in) ease-out both,
			swap-rays-out calc(var(--out) * 0.55) ease-in calc(var(--in) + var(--hold)) forwards;
	}
	@keyframes swap-rays-in {
		from {
			opacity: 0;
			transform: scale(0.2) rotate(-40deg);
		}
		to {
			opacity: 0.6;
			transform: scale(1) rotate(0deg);
		}
	}
	@keyframes swap-rays-out {
		from {
			opacity: 0.6;
			transform: scale(1) rotate(0deg);
		}
		to {
			opacity: 0;
			transform: scale(1.3) rotate(30deg);
		}
	}
	.sun {
		width: 160vmax;
		height: 160vmax;
		margin: -80vmax 0 0 -80vmax;
		background: radial-gradient(closest-side, #fffbe8, #ffe56b 35%, #ffb12e 75%, #ff9418);
		animation:
			swap-sun-in var(--in) cubic-bezier(0.5, 0, 0.75, 0.6) both,
			swap-sun-out var(--out) ease-out calc(var(--in) + var(--hold)) forwards;
	}
	@keyframes swap-sun-in {
		from {
			transform: scale(0);
		}
		to {
			transform: scale(1);
		}
	}
	@keyframes swap-sun-out {
		from {
			opacity: 1;
			transform: scale(1);
		}
		to {
			opacity: 0;
			transform: scale(1.15);
		}
	}

	/* Neon iris: a ringed hole in the dark closes to nothing, then opens on the new world. It
	   starts just past the screen's corners (130vmax), so the ring shows from the first frame. */
	.iris {
		position: absolute;
		left: 50%;
		top: 50%;
		width: 130vmax;
		height: 130vmax;
		transform: translate(-50%, -50%);
		border-radius: 50%;
		border: 6px solid #ff6af2;
		box-shadow:
			inset 0 0 26px #04dafd,
			0 0 30px 8px #ff4df0b3,
			0 0 0 300vmax #0d0624;
		animation:
			swap-iris-in var(--in) cubic-bezier(0.55, 0, 0.8, 0.5) both,
			swap-iris-out var(--out) cubic-bezier(0.2, 0.5, 0.45, 1) calc(var(--in) + var(--hold)) forwards;
	}
	@keyframes swap-iris-in {
		to {
			width: 0;
			height: 0;
			border-width: 0;
		}
	}
	@keyframes swap-iris-out {
		from {
			width: 0;
			height: 0;
			border-width: 0;
		}
		to {
			width: 130vmax;
			height: 130vmax;
		}
	}
</style>
