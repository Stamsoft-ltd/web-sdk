<script lang="ts">
	import { onMount } from 'svelte';
	import { runtime, continuePresentation } from '../game/playback.svelte';
	import { t } from '../i18n';
	import CountUp from './CountUp.svelte';
	import WinCoins from './WinCoins.svelte';
	import CelebrationFlourish from './CelebrationFlourish.svelte';
	import SpineArt from './SpineArt.svelte';
	let spineReady = $state(false);
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
		format: (amount: number) => string;
	} = $props();
	const skin = $derived(tier === 'super' || tier === 'hidden' ? tier : 'normal');
	const summary = $derived(kind === 'summary');
	const title = $derived(t(summary ? 'BONUS COMPLETE' : skin.toUpperCase()));
	let dialog: HTMLDialogElement;
	onMount(() => {
		const prior = document.activeElement as HTMLElement | null;
		dialog.showModal();
		return () => {
			dialog.close();
			prior?.focus();
		};
	});
</script>

<dialog
	bind:this={dialog}
	class="bonus-dialog"
	class:reduced={runtime.reduced}
	data-bonus-stage={kind}
	data-bonus-tier={skin}
	aria-label={title}
	oncancel={(event) => {
		event.preventDefault();
		if (runtime.waiting) continuePresentation();
	}}
>
	{#if summary && amount > 0}<WinCoins tier={1} reduced={runtime.reduced} />{/if}
	<div class="bonus-body">
		<section class="bonus-stage">
			<div class="bonus-aura" aria-hidden="true"></div>
			<CelebrationFlourish reduced={runtime.reduced} />
			<h2 class:spine-ready={spineReady}>
				<img
					class="bonus-crest"
					src={`./assets/the-gates/presentations/${summary ? 'complete' : skin}-crest.png`}
					alt={title}
				/>
				<SpineArt
					rig={`bonus-${summary ? 'complete' : skin}`}
					atlas="presentations"
					intro="enter"
					reduced={runtime.reduced}
					onready={(value) => (spineReady = value)}
				/>
			</h2>
			<div class="bonus-award">
				{#if summary}
					<span class="award-label">{t('TOTAL WIN')}</span>
					<CountUp {amount} {format} />
				{:else}
					<strong class="spin-award">{spins}</strong>
					<span class="award-label">{t('FREE SPINS')}</span>
				{/if}
			</div>
			<p class="bonus-detail">{summary ? t(skin.toUpperCase()) : t('GATE HINT')}</p>
			<button class="gold-button" disabled={!runtime.waiting} onclick={continuePresentation}
				>{t('CONTINUE')}</button
			>
		</section>
	</div>
</dialog>

<style>
	.bonus-dialog {
		--bonus-color: #63e4ed;
		width: 100dvw;
		height: 100dvh;
		max-width: none;
		max-height: none;
		margin: 0;
		padding: 0;
		border: 0;
		border-radius: 0;
		background: transparent;
		box-shadow: none;
		color: #fff2c8;
		overflow-x: hidden;
		overflow-y: auto;
		overscroll-behavior: contain;
	}
	.bonus-dialog[data-bonus-tier='super'] {
		--bonus-color: #c38cff;
	}
	.bonus-dialog[data-bonus-tier='hidden'] {
		--bonus-color: #ffc55c;
	}
	.bonus-dialog::backdrop {
		background: #020910df;
		backdrop-filter: blur(5px);
	}
	.bonus-body {
		min-height: 100%;
		display: grid;
		place-items: center;
		padding: 24px 16px;
		box-sizing: border-box;
	}
	.bonus-stage {
		position: relative;
		isolation: isolate;
		width: min(780px, 100%);
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: clamp(10px, 2vh, 20px);
		text-align: center;
		animation: crest-arrive 420ms cubic-bezier(0.16, 1, 0.3, 1) both;
	}
	h2 {
		position: relative;
		margin: 0;
		width: 100%;
		line-height: 0;
	}
	.spine-ready .bonus-crest {
		opacity: 0;
	}
	.bonus-crest {
		display: block;
		width: 100%;
		height: auto;
		max-height: 44dvh;
		aspect-ratio: 2/1;
		object-fit: contain;
		filter: drop-shadow(0 8px 18px #0008);
	}
	.bonus-award {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 3px;
		max-width: 100%;
	}
	.spin-award,
	.bonus-award :global(.win-amount) {
		font: 800 clamp(42px, 8vw, 94px) / 1.05 var(--serif);
		color: #ffe9a9;
		text-shadow:
			0 3px 0 #704415,
			0 6px 0 #281709,
			0 0 30px var(--bonus-color);
		max-width: 100%;
		overflow-wrap: anywhere;
	}
	.award-label {
		font-size: clamp(12px, 2vw, 18px);
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: #ecdcbb;
	}
	.bonus-detail {
		margin: 0;
		font-size: clamp(12px, 1.7vw, 16px);
		color: #c8c5b9;
	}
	.gold-button {
		min-height: 44px;
		min-width: 168px;
		padding: 12px 36px;
	}
	.bonus-aura {
		position: absolute;
		z-index: -1;
		pointer-events: none;
		inset: 0 -10%;
		background: radial-gradient(
			ellipse,
			color-mix(in srgb, var(--bonus-color) 20%, transparent),
			transparent 65%
		);
		animation: aura-breathe 3s ease-in-out infinite alternate;
	}
	@keyframes crest-arrive {
		from {
			opacity: 0;
			transform: translateY(18px) scale(0.88);
		}
		to {
			opacity: 1;
			transform: none;
		}
	}
	@keyframes aura-breathe {
		to {
			opacity: 0.5;
			transform: scale(0.94);
		}
	}
	.reduced .bonus-stage,
	.reduced .bonus-aura {
		animation: none;
	}
	@media (max-height: 500px) {
		.bonus-body {
			padding: 12px 16px;
		}
		.bonus-stage {
			gap: 8px;
		}
		.bonus-crest {
			max-height: 43dvh;
		}
		.spin-award,
		.bonus-award :global(.win-amount) {
			font-size: clamp(30px, 10dvh, 48px);
		}
		.award-label {
			font-size: 11px;
		}
		.bonus-detail {
			font-size: 11px;
		}
		.gold-button {
			padding: 8px 28px;
		}
	}
</style>
