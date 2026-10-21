<script lang="ts">
	// The scatter eggs that trigger a bonus hatch on the board (App's cheerEggs): each wobbles,
	// cracks along the Mystery egg's crack line, and pops its top off in a flash of shell bits;
	// the bottom half stays on its lit pad until the next spin. Same art as MysteryEgg.svelte.
	// Drawn over both boards (Pixi and DOM), which hide their own egg meanwhile (`hatched`).
	import { CELL_W, GAP, CELL_H, BORDER } from '../board/geometry';

	let { cells, pace = 1 }: { cells: string[]; pace?: number } = $props();

	// The egg sits in a 74.08px art box at the top of its pad, filling y 22-206 and x 29-195 of
	// its 224px symbol (scripts/build-scatter-egg.py); the hatch layers frame exactly that egg.
	const BOX = 74.08;
	const EGG_W = (166 / 224) * BOX;
	const EGG_H = (184 / 224) * BOX;
	const EGG_TOP = BORDER + (22 / 224) * BOX;
	const at = (key: string) => {
		const [col, row] = key.split(',').map(Number);
		return {
			x: col * (CELL_W + GAP) + CELL_W / 2,
			y: row * (CELL_H + GAP) + EGG_TOP,
			// Neighbours don't move in lockstep, and the top flies off to either side.
			delay: ((col * 3 + row * 5) % 4) * 60,
			side: (col + row) % 2 ? 1 : -1,
		};
	};
	const BITS = [-150, -110, -70, -30, 15, 60];
</script>

{#each cells as key (key)}
	{@const e = at(key)}
	<div
		class="hatch"
		aria-hidden="true"
		style={`left:${e.x.toFixed(2)}px;top:${e.y.toFixed(2)}px;width:${EGG_W.toFixed(2)}px;height:${EGG_H.toFixed(2)}px;--p:${pace};--d:${(e.delay * pace).toFixed(0)}ms;--side:${e.side}`}
	>
		<span class="flash"></span>
		{#each BITS as a, i}<span class="bit" style={`--a:${a}deg;--r:${22 + (i % 3) * 8}px;--spin:${(i % 2 ? 1 : -1) * 220}deg`}></span>{/each}
		<div class="shell">
			<img class="whole" src="./mystery/egg.webp" alt="" />
			<img class="crack" src="./mystery/egg-crack.webp" alt="" />
			<img class="bottom" src="./mystery/egg-bottom.webp" alt="" />
			<img class="top" src="./mystery/egg-top.webp" alt="" />
		</div>
	</div>
{/each}

<style>
	/* Timeline (×--p, after --d): wobble 0-520ms, crack 260-560ms, burst at 560ms. */
	.hatch {
		position: absolute;
		z-index: 5;
		translate: -50% 0;
		pointer-events: none;
	}
	.shell,
	.shell img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
	}
	.shell {
		transform-origin: 50% 100%;
		animation: wobble calc(520ms * var(--p)) var(--d) both;
	}
	@keyframes wobble {
		0%,
		100% {
			transform: none;
		}
		20% {
			transform: rotate(-9deg) scale(1.04, 0.96);
		}
		45% {
			transform: rotate(8deg);
		}
		70% {
			transform: rotate(-5deg) scale(0.97, 1.05);
		}
		88% {
			transform: rotate(3deg) scale(1.08, 0.92);
		}
	}
	/* Whole until it bursts; then the halves take over (they fill forwards only, so they never
	   show on the whole egg before the burst). */
	.whole {
		animation: hide 1ms calc(var(--d) + 560ms * var(--p)) both;
	}
	@keyframes hide {
		to {
			opacity: 0;
		}
	}
	/* The crack lands in jolts (opacity steps; a clip-path wipe repainted every step). */
	.crack {
		opacity: 0;
		animation:
			crack-run calc(300ms * var(--p)) calc(var(--d) + 260ms * var(--p)) steps(3, jump-start) forwards,
			hide 1ms calc(var(--d) + 560ms * var(--p)) forwards;
	}
	@keyframes crack-run {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}
	.top,
	.bottom {
		opacity: 0;
	}
	.top {
		animation: top-fly calc(760ms * var(--p)) calc(var(--d) + 560ms * var(--p)) cubic-bezier(0.2, 0.7, 0.4, 1) forwards;
	}
	@keyframes top-fly {
		0% {
			opacity: 1;
			transform: none;
		}
		45% {
			opacity: 1;
			transform: translate(calc(var(--side) * 18px), -46px) rotate(calc(var(--side) * 40deg));
		}
		100% {
			opacity: 0;
			transform: translate(calc(var(--side) * 40px), -22px) rotate(calc(var(--side) * 110deg)) scale(0.8);
		}
	}
	.bottom {
		transform-origin: 50% 100%;
		animation: bottom-land calc(420ms * var(--p)) calc(var(--d) + 560ms * var(--p)) forwards;
	}
	@keyframes bottom-land {
		0% {
			opacity: 1;
			transform: scale(1.12, 0.88);
		}
		45% {
			opacity: 1;
			transform: scale(0.96, 1.05);
		}
		100% {
			opacity: 1;
			transform: none;
		}
	}
	.flash {
		position: absolute;
		left: 50%;
		top: 46%;
		width: 120px;
		height: 120px;
		margin: -60px 0 0 -60px;
		border-radius: 50%;
		background: radial-gradient(closest-side, #fff, #fffbe0b0 35%, #ffd84a55 60%, #fff0);
		opacity: 0;
		animation: flash calc(560ms * var(--p)) calc(var(--d) + 540ms * var(--p)) ease-out both;
	}
	@keyframes flash {
		0% {
			opacity: 0;
			transform: scale(0.2);
		}
		25% {
			opacity: 1;
		}
		100% {
			opacity: 0;
			transform: scale(1.15);
		}
	}
	.bit {
		position: absolute;
		left: 50%;
		top: 46%;
		width: 9px;
		height: 8px;
		background: #fff4d6;
		border: 2px solid #f7b733;
		box-sizing: border-box;
		clip-path: polygon(0 30%, 45% 0, 100% 40%, 70% 100%, 15% 85%);
		opacity: 0;
		animation: bit-fly calc(640ms * var(--p)) calc(var(--d) + 560ms * var(--p)) cubic-bezier(0.15, 0.7, 0.4, 1) forwards;
	}
	@keyframes bit-fly {
		0% {
			opacity: 1;
			transform: translate(-50%, -50%) rotate(var(--a)) translateX(6px);
		}
		70% {
			opacity: 1;
		}
		100% {
			opacity: 0;
			transform: translate(-50%, -50%) rotate(var(--a)) translateX(var(--r)) translateY(18px) rotate(var(--spin));
		}
	}
	/* Reduced motion: no wobble or flying shell; the eggs simply show opened. */
	@media (prefers-reduced-motion: reduce) {
		.hatch * {
			animation-duration: 1ms !important;
			animation-delay: 0ms !important;
		}
		.flash,
		.bit {
			display: none;
		}
	}
</style>
