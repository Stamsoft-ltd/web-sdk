<script lang="ts">
	import { ap } from '../lib/preloadArt';

	// The board SCATTER symbol (S) rebuilt from its parts so the buy-bonus card plays the real reel
	// animation: the whole stand gives a gentle bob/squash while the golden SCATTER sign sways like a
	// hanging shingle. Geometry mirrors SYMBOL_PARTS.S (banner at nx .485, ny .132, nw .68).
	type Props = { delay?: number };
	const { delay = 0 }: Props = $props();

	const P = '/assets/mcschmutzo/symbols/parts/scatter/';
	const stand = ap(P + 'stand.webp');
	const banner = ap(P + 'banner.webp');
</script>

<div class="scatter-stack" style={`--d:${delay}s`}>
	<img class="ss-stand" src={stand} alt="" draggable="false" />
	<img class="ss-banner" src={banner} alt="" draggable="false" />
</div>

<style>
	.scatter-stack {
		/* The whole stand bobs; children ride it so the sign bobs with the stand and sways on top. */
		position: relative;
		width: 100%;
		height: 100%;
		transform-origin: 50% 100%;
		animation: ss-bob 2.7s ease-in-out var(--d, 0s) infinite;
	}
	.scatter-stack img {
		position: absolute;
		height: auto;
		transform: translate(-50%, -50%);
	}
	.ss-stand {
		left: 50%;
		top: 50%;
		width: 100%;
		filter: drop-shadow(0 3px 5px rgba(0, 0, 0, 0.4));
	}
	.ss-banner {
		left: 48.5%;
		top: 13.2%;
		width: 68%;
		transform-origin: 50% 50%;
		animation: ss-sway 2.7s ease-in-out var(--d, 0s) infinite;
	}
	@keyframes ss-bob {
		0%,
		100% {
			transform: scale(1, 1) translateY(0);
		}
		50% {
			transform: scale(0.99, 1.015) translateY(-1.5%);
		}
	}
	@keyframes ss-sway {
		0%,
		100% {
			transform: translate(-50%, -50%) rotate(-3.5deg);
		}
		50% {
			transform: translate(-50%, -50%) rotate(3.5deg);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.scatter-stack,
		.ss-banner {
			animation: none;
		}
	}
</style>
