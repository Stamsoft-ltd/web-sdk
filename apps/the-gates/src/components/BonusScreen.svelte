<script lang="ts">
	import { onMount } from 'svelte';
	import { installModalFocus } from '../game/modalFocus';
	import { runtime, continuePresentation } from '../game/playback.svelte';
	import { artTier } from '../game/art';
	import { t } from '../i18n';
	import WinCoins from './WinCoins.svelte';
	import GpuBonusArt from './GpuBonusArt.svelte';
	let {
		kind,
		tier,
		spins = 0,
		amount = 0,
		format,
	}: {
		kind: 'bonus' | 'summary';
		tier: string;
		spins?: number;
		amount?: number;
		format: (n: number, target?: number) => string;
	} = $props();
	const skin = $derived(artTier(tier)),
		summary = $derived(kind === 'summary'),
		title = $derived(t(summary ? 'BONUS COMPLETE' : skin.toUpperCase()));
	const canContinue = $derived(runtime.waiting && !runtime.bonusTransition);
	let overlay: HTMLDivElement;
	onMount(() =>
		installModalFocus(overlay, {
			close: () => {
				if (runtime.waiting) continuePresentation();
			},
		}),
	);
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions: full-screen presentation supports tap and keyboard acknowledgement after transition guard -->
<div
	bind:this={overlay}
	class="bonus-dialog"
	data-pixi-shade="true"
	data-pixi-overlay
	data-bonus-stage={kind}
	data-bonus-tier={skin}
	role="dialog"
	aria-modal="true"
	aria-label={title}
	tabindex="-1"
	onclick={() => {
		if (runtime.waiting && !runtime.bonusTransition) continuePresentation();
	}}
	onkeydown={(event) => {
		if (['Enter', ' '].includes(event.key)) {
			event.preventDefault();
			if (runtime.waiting && !runtime.bonusTransition) continuePresentation();
		}
	}}
>
	{#if summary && amount > 0 && runtime.bonusTransition?.kind !== 'exit'}<WinCoins
			tier={1}
			reduced={runtime.reduced}
		/>{/if}
	<div class="bonus-body">
		<section class="bonus-stage">
			<div class="bonus-art">
				<GpuBonusArt {skin} {summary} {spins} {amount} {format} reduced={runtime.reduced} />
			</div>
			<p
				class="bonus-continue"
				class:ready={canContinue}
				class:reduced={runtime.reduced}
				aria-hidden={!canContinue}
			>
				{t('TAP ANYWHERE TO CONTINUE')}
			</p>
		</section>
	</div>
</div>

<style>
	.bonus-dialog {
		position: fixed;
		inset: 0;
		z-index: 80;
		margin: 0;
		padding: 0;
		border: 0;
		background: transparent;
		color: #fff;
		pointer-events: auto;
		outline: none;
		overflow: hidden;
	}
	.bonus-body {
		height: 100%;
		display: grid;
		place-items: center;
		box-sizing: border-box;
		padding: 12px;
	}
	.bonus-stage {
		width: min(850px, 100%);
	}
	.bonus-art {
		position: relative;
		width: min(100%, calc((100dvh - 76px) * 4 / 3));
		aspect-ratio: 800/600;
		margin: auto;
	}
	.bonus-continue {
		/* Reserve the hint line during entry/exit: acknowledgement must not move the art. */
		visibility: hidden;
		margin: 12px 0 0;
		padding: 0 8px;
		color: #fff;
		font:
			700 clamp(12px, 2.1vmin, 20px) / 1.35 GatesBody,
			sans-serif;
		text-align: center;
		text-shadow: 0 2px 4px #000;
		pointer-events: none;
	}
	.bonus-continue.ready {
		visibility: visible;
		animation: bonus-continue-pulse 2s ease-in-out infinite;
	}
	@keyframes bonus-continue-pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.35;
		}
	}
	.bonus-continue.reduced {
		animation: none;
	}
	@media (prefers-reduced-motion: reduce) {
		.bonus-continue {
			animation: none;
		}
	}
</style>
