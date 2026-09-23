<script lang="ts">
	let { reduced = false }: { reduced?: boolean } = $props();
</script>

{#if !reduced}
	<div class="celebration-flourish" aria-hidden="true">
		<span class="halo"></span>
		{#each Array(12) as _, i}<i
				style={`--angle:${i * 30}deg;--delay:${(i % 4) * 90}ms;--cycle:${2200 + (i % 3) * 450}ms`}
			></i>{/each}
	</div>
{/if}

<style>
	.celebration-flourish {
		position: absolute;
		inset: 0;
		pointer-events: none;
		z-index: -1;
		color: var(--tier-color, var(--bonus-color, #ffdb83));
	}
	.halo {
		position: absolute;
		top: 30%;
		left: 50%;
		width: 65%;
		aspect-ratio: 1;
		border: 2px solid currentColor;
		border-radius: 50%;
		opacity: 0;
		animation: halo-bloom 850ms ease-out both;
	}
	i {
		position: absolute;
		top: 35%;
		left: 50%;
		width: 4px;
		height: 4px;
		border-radius: 50%;
		background: #fff2bf;
		box-shadow: 0 0 8px currentColor;
		opacity: 0;
		animation: crest-mote var(--cycle) ease-out var(--delay) infinite;
	}
	@keyframes halo-bloom {
		from {
			opacity: 0.5;
			transform: translate(-50%, -50%) scale(0.45);
		}
		to {
			opacity: 0;
			transform: translate(-50%, -50%) scale(1.5);
		}
	}
	@keyframes crest-mote {
		0% {
			opacity: 0;
			transform: rotate(var(--angle)) translateX(55px) scale(0.3);
		}
		20% {
			opacity: 0.75;
		}
		100% {
			opacity: 0;
			transform: rotate(var(--angle)) translateX(clamp(140px, 32vw, 440px)) scale(0.2);
		}
	}
</style>
