<script lang="ts">
	import { ap } from '../lib/preloadArt';

	// The board SCATTER symbol (S) — crossed spatula + chef's knife — rebuilt from its two layers so the
	// buy-bonus cards play the same animation as the reels: both swing open from their handle ends,
	// hold, then slam shut into the cross (with a small rebound). Geometry mirrors SYMBOL_PARTS.S (a
	// 96×93 box; each layer's box + its handle pivot).
	type Props = { delay?: number };
	const { delay = 0 }: Props = $props();

	const P = '/assets/mcschmutzo/symbols/parts/scatter2/';
	const spatula = ap(P + 'spatula.webp');
	const knife = ap(P + 'knife.webp');
</script>

<div class="scatter-stack" style={`--d:${delay}s`}>
	<div class="ss-box">
		<img class="ss-spatula" src={spatula} alt="" draggable="false" />
		<img class="ss-knife" src={knife} alt="" draggable="false" />
		<span class="ss-clash" aria-hidden="true"></span>
	</div>
</div>

<style>
	.scatter-stack {
		position: relative;
		width: 100%;
		height: 100%;
		display: grid;
		place-items: center;
	}
	.ss-box {
		position: relative;
		width: 86%;
		aspect-ratio: 96 / 93;
		filter: drop-shadow(0 3px 5px rgba(0, 0, 0, 0.4));
	}
	.ss-box img {
		position: absolute;
		animation: 2.6s linear var(--d, 0s) infinite;
	}
	/* layer boxes in the 96×93 group: spatula (0, 0, 80.85×90.87), knife (16, 3, 80×90) */
	.ss-spatula {
		left: 0;
		top: 0;
		width: 84.24%;
		height: 97.72%;
		transform-origin: 84% 92%;
		animation-name: ss-spatula;
	}
	.ss-knife {
		left: 16.67%;
		top: 3.23%;
		width: 83.33%;
		height: 96.77%;
		transform-origin: 11% 95%;
		animation-name: ss-knife;
	}
	/* open (ease-out) → hold → slam shut past the cross → rebound → rest; same timing as the reel */
	@keyframes ss-spatula {
		0% {
			rotate: 0deg;
			animation-timing-function: cubic-bezier(0.2, 0.7, 0.4, 1);
		}
		42%,
		56% {
			rotate: -11deg;
			animation-timing-function: cubic-bezier(0.6, 0, 1, 0.6);
		}
		64% {
			rotate: 3deg;
			animation-timing-function: ease-out;
		}
		74% {
			rotate: -1.5deg;
		}
		86%,
		100% {
			rotate: 0deg;
		}
	}
	@keyframes ss-knife {
		0% {
			rotate: 0deg;
			animation-timing-function: cubic-bezier(0.2, 0.7, 0.4, 1);
		}
		42%,
		56% {
			rotate: 11deg;
			animation-timing-function: cubic-bezier(0.6, 0, 1, 0.6);
		}
		64% {
			rotate: -3deg;
			animation-timing-function: ease-out;
		}
		74% {
			rotate: 1.5deg;
		}
		86%,
		100% {
			rotate: 0deg;
		}
	}
	/* clash flash at the crossing as they slam shut */
	.ss-clash {
		position: absolute;
		left: 50%;
		top: 50%;
		width: 30%;
		aspect-ratio: 1;
		translate: -50% -50%;
		border-radius: 50%;
		background: radial-gradient(circle, #fffbe0 0 22%, rgba(255, 214, 80, 0.7) 40%, rgba(255, 180, 40, 0) 70%);
		opacity: 0;
		animation: ss-clash 2.6s linear var(--d, 0s) infinite;
	}
	@keyframes ss-clash {
		0%,
		62% {
			opacity: 0;
			scale: 0.4;
		}
		64% {
			opacity: 1;
			scale: 0.9;
		}
		74%,
		100% {
			opacity: 0;
			scale: 1.4;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.ss-box img,
		.ss-clash {
			animation: none;
		}
	}
</style>
