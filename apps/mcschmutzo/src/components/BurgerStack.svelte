<script lang="ts">
	import { ap } from '../lib/preloadArt';

	// The board burger (H1) rebuilt from its part images so it can ASSEMBLE / DISASSEMBLE in HTML the
	// same way it does on the reels: every slice slides out along its own dy (bun up, bottom bun down,
	// fillings fan out) then settles back, on a loop. Geometry mirrors SYMBOL_PARTS.H1.
	const P = '/assets/mcschmutzo/symbols/parts/burger/';
	const PARTS = [
		{ src: ap(P + 'bun_bottom.webp'), nx: 0.5, ny: 0.8587, nw: 0.9453, dy: 0.2 },
		{ src: ap(P + 'patty.webp'), nx: 0.5, ny: 0.7389, nw: 1.0, dy: 0.1 },
		{ src: ap(P + 'cheese.webp'), nx: 0.5, ny: 0.662, nw: 0.9435, dy: 0.03 },
		{ src: ap(P + 'onion.webp'), nx: 0.5, ny: 0.6191, nw: 0.7322, dy: -0.03 },
		{ src: ap(P + 'tomato.webp'), nx: 0.5, ny: 0.5921, nw: 0.8276, dy: -0.09 },
		{ src: ap(P + 'lettuce.webp'), nx: 0.5, ny: 0.5092, nw: 0.8981, dy: -0.16 },
		{ src: ap(P + 'bun_top.webp'), nx: 0.5, ny: 0.2396, nw: 0.9685, dy: -0.26 },
	];
</script>

<div class="burger-stack">
	{#each PARTS as p, i (i)}
		<!-- Each layer sits in a full-box wrapper so translateY(dy*100%) = dy * the burger's height,
		     matching the reels' dy*symbolHeight separation regardless of the slice's own size. -->
		<div class="burger-layer" style={`z-index:${i}; --dy:${p.dy};`}>
			<img
				src={p.src}
				alt=""
				draggable="false"
				style={`left:${p.nx * 100}%; top:${p.ny * 100}%; width:${p.nw * 100}%;`}
			/>
		</div>
	{/each}
</div>

<style>
	.burger-stack {
		/* Fills its holder, which sizes it and enforces the board cell's ~1.077 aspect so the slice
		   geometry (0..1 in both axes) lands correctly. */
		position: relative;
		width: 100%;
		height: 100%;
		filter: drop-shadow(0 3px 5px rgba(0, 0, 0, 0.4));
	}
	.burger-layer {
		position: absolute;
		inset: 0;
		will-change: transform;
		/* Out-and-back over one loop; ease-in-out approximates the reels' cosine. */
		animation: burger-sep 1.8s ease-in-out infinite;
	}
	.burger-layer img {
		position: absolute;
		height: auto;
		transform: translate(-50%, -50%);
	}
	@keyframes burger-sep {
		0%,
		100% {
			transform: translateY(0);
		}
		50% {
			/* --sep scales the reels' full dy*height throw so callers can keep the burst inside a small
			   card (default = the reels' full separation). */
			transform: translateY(calc(var(--dy) * var(--sep, 1) * 100%));
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.burger-layer {
			animation: none;
		}
	}
</style>
