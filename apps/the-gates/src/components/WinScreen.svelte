<script lang="ts">
	import { onMount } from 'svelte';
	import { installModalFocus } from '../game/modalFocus';
	import { runtime, continuePresentation } from '../game/playback.svelte';
	import { WIN_TIERS, winTier, WIN_ART_VIEW } from '../game/winPresentation';
	import { t } from '../i18n';
	import GpuWinArt from './GpuWinArt.svelte';
	import WinCoins from './WinCoins.svelte';
	let {
		amount,
		countMs,
		format,
		capped = false,
	}: {
		amount: number;
		countMs: number;
		format: (n: number, target?: number) => string;
		capped?: boolean;
	} = $props();
	const tier = $derived(winTier(amount) ?? WIN_TIERS[0]);
	const art = $derived(capped ? 'legendary' : tier.key);
	const title = $derived(t(capped ? 'MAX WIN' : tier.title));
	let ready = $state(false);
	let winArt = $state<HTMLDivElement>();
	let dialog: HTMLDivElement;
	onMount(() =>
		installModalFocus(dialog, {
			close: () => {
				if (runtime.waiting) continuePresentation();
			},
		}),
	);
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions: fullscreen win dialog owns Enter/Space/tap dismissal; no separate Continue control -->
<div
	bind:this={dialog}
	class="win-tier-dialog"
	data-pixi-shade="true"
	data-pixi-overlay
	role="dialog"
	aria-modal="true"
	tabindex="0"
	onclick={() => {
		if (runtime.waiting) continuePresentation();
	}}
	onkeydown={(event) => {
		if (['Enter', ' '].includes(event.key)) {
			event.preventDefault();
			if (runtime.waiting) continuePresentation();
		}
	}}
	data-win-tier={art}
	class:reduced={runtime.reduced}
	aria-label={title}
>
	<WinCoins origin={winArt} tier={WIN_TIERS.indexOf(tier)} reduced={runtime.reduced} />
	<div class="win-body">
		<section class="win-stage">
			{#if capped}<h2 class="celebration-label">{t('MAX WIN')}</h2>{/if}
			<div class="win-art" bind:this={winArt} class:spine-ready={ready}>
				<GpuWinArt
					{art}
					{amount}
					{countMs}
					{format}
					viewBox={WIN_ART_VIEW}
					reduced={runtime.reduced}
					onready={(value) => (ready = value)}
				/>
			</div>
		</section>
	</div>
</div>

<style>
	.win-tier-dialog {
		position: fixed;
		inset: 0;
		z-index: 80;
		outline: none;
		width: 100dvw;
		height: 100dvh;
		max-width: none;
		max-height: none;
		margin: 0;
		padding: 0;
		border: 0;
		border-radius: 0;
		background: transparent;
		isolation: isolate;
		box-shadow: none;
		color: #fff;
		overflow-x: hidden;
		overflow-y: auto;
		overscroll-behavior: contain;
	}
	.win-body {
		position: relative;
		z-index: 1;
		min-height: 100%;
		display: grid;
		place-items: center;
		padding: 20px 12px;
		box-sizing: border-box;
	}
	.win-stage {
		width: min(1000px, 100%);
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
		isolation: isolate;
	}
	.win-art {
		position: relative;
		width: min(100%, 106dvh);
		aspect-ratio: 860/600;
		container-type: inline-size;
	}
	.celebration-label {
		font:
			clamp(24px, 4vw, 42px) / 1.2 GatesCartoon,
			system-ui;
		margin: 0;
		text-align: center;
		color: #ffdd52;
		text-shadow: 0 3px #572231;
	}
	@media (max-height: 500px) {
		.win-art {
			width: min(100%, 116dvh);
		}
		.win-body {
			position: relative;
			z-index: 1;
			padding: 10px 12px;
		}
	}
</style>
