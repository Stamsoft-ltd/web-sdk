<script lang="ts">
	import { runtime } from '../game/playback.svelte';
	import { gateDustParticles } from '../game/visualRandom';
	const seed = $derived(`${runtime.roundId}:${runtime.game.gateEventId}`);
	const particles = $derived(gateDustParticles(seed));
</script>

{#if runtime.game.gateOpen && !runtime.reduced}
	{#key seed}
		<div class="gate-dust" aria-hidden="true" data-event-seed={seed}>
			{#each particles as p}<i
					style={`--x:${p.x}%;--y:${p.y}vh;--drift:${p.drift}vw;--delay:${p.delay}ms;--duration:${p.duration}ms;--distance:${p.distance}vh;--size:${p.size}px;--rotation:${p.rotation}deg;--opacity:${p.opacity}`}
				></i>{/each}
		</div>
	{/key}
{/if}

<style>
	.gate-dust {
		position: absolute;
		inset: 0;
		overflow: hidden;
		pointer-events: none;
		z-index: 15;
	}
	i {
		position: absolute;
		top: var(--y);
		left: var(--x);
		width: var(--size);
		height: calc(var(--size) * 0.7);
		border-radius: 30%;
		background: #ad9670;
		opacity: 0;
		box-shadow: 0 0 8px #c5b48b55;
		animation: dust-fall var(--duration) cubic-bezier(0.3, 0, 0.7, 1) var(--delay) both;
	}
	@keyframes dust-fall {
		5% {
			opacity: var(--opacity);
		}
		65% {
			opacity: 0.35;
		}
		100% {
			opacity: 0;
			transform: translate(var(--drift), var(--distance)) rotate(var(--rotation));
		}
	}
</style>
