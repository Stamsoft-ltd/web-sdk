<script lang="ts">
	import { onMount } from 'svelte';
	import { runtime, continuePresentation } from '../game/playback.svelte';
	import { WIN_TIERS, winTier } from '../game/winPresentation';
	import { t } from '../i18n';
	import CountUp from './CountUp.svelte';
	import WinCoins from './WinCoins.svelte';
	import CelebrationFlourish from './CelebrationFlourish.svelte';
	import SpineArt from './SpineArt.svelte';
	let spineReady = $state(false);
	let {
		amount,
		countMs,
		format,
		capped = false,
	}: {
		amount: number;
		countMs: number;
		format: (n: number) => string;
		capped?: boolean;
	} = $props();
	const tier = $derived(winTier(amount) ?? WIN_TIERS[0]);
	const title = $derived(t(capped ? 'MAX WIN' : tier.title));
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
	class="win-tier-dialog"
	data-win-tier={tier.key}
	class:reduced={runtime.reduced}
	aria-label={title}
	oncancel={(event) => {
		event.preventDefault();
		if (runtime.waiting) continuePresentation();
	}}
>
	<WinCoins tier={WIN_TIERS.indexOf(tier)} reduced={runtime.reduced} />
	<div
		class="win-stage"
		style={`--tier-color:${['#62d9ff', '#83f59a', '#c792ff', '#ff8492', '#ffdc66'][WIN_TIERS.indexOf(tier)]}`}
	>
		<div class="win-rays" aria-hidden="true"></div>
		<CelebrationFlourish reduced={runtime.reduced} />
		<div class="win-tier-title" class:spine-ready={spineReady}>
			<img class="plaque" src={`./assets/the-gates/wins/${tier.key}-plaque.png`} alt="" />
			<h2>
				<img
					class="lettering"
					src={`./assets/the-gates/wins/${capped ? 'max' : tier.key}-title.png`}
					alt={title}
				/>
			</h2>
			<SpineArt
				rig={`win-${capped ? 'max' : tier.key}`}
				atlas={`win-${capped ? 'max' : tier.key}`}
				intro="enter"
				reduced={runtime.reduced}
				onready={(value) => (spineReady = value)}
			/>
		</div>
		<CountUp {amount} {format} duration={countMs} />
		<button class="gold-button" disabled={!runtime.waiting} onclick={continuePresentation}
			>{t('CONTINUE')}</button
		>
	</div>
</dialog>

<style>
	.win-tier-dialog {
		width: 100dvw;
		height: 100dvh;
		max-width: none;
		max-height: none;
		margin: 0;
		padding: 16px;
		border: 0;
		border-radius: 0;
		overflow: hidden;
		background: transparent;
		box-shadow: none;
		color: #fff4ce;
	}
	.win-tier-dialog[open] {
		display: grid;
		place-items: center;
	}
	.win-tier-dialog::backdrop {
		background: #020a10bb;
		backdrop-filter: blur(3px);
	}
	.win-stage {
		position: relative;
		width: min(850px, 94vw);
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: clamp(14px, 3vh, 28px);
		isolation: isolate;
		animation: win-arrive 450ms cubic-bezier(0.16, 1, 0.3, 1) both;
	}
	.win-tier-title {
		position: relative;
		width: 100%;
		aspect-ratio: 1942/809;
		display: grid;
		place-items: center;
	}
	.spine-ready .plaque,
	.spine-ready h2 {
		opacity: 0;
	}
	.plaque {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: contain;
		z-index: -1;
	}
	h2 {
		margin: 0;
		padding: 0;
		position: absolute;
		top: 55%;
		left: 16%;
		width: 68%;
		transform: translateY(-50%);
	}
	.lettering {
		display: block;
		width: 100%;
		height: auto;
		aspect-ratio: 3/1;
		object-fit: contain;
		filter: drop-shadow(0 4px 3px #0009);
	}
	[data-win-tier='legendary'] h2 {
		top: 60%;
	}
	.win-stage :global(.win-amount) {
		font: 700 clamp(30px, 7vw, 82px) / 1.15 var(--serif);
		max-width: 100%;
		overflow-wrap: anywhere;
		text-align: center;
		text-shadow:
			0 3px 0 #392509,
			0 0 30px var(--tier-color);
	}
	.gold-button {
		min-height: 44px;
		padding: 12px 36px;
	}
	.win-rays {
		position: absolute;
		z-index: -2;
		width: 110%;
		aspect-ratio: 1;
		top: 50%;
		left: 50%;
		background: repeating-conic-gradient(
			from 0deg,
			transparent 0deg 15deg,
			var(--tier-color) 18deg 20deg,
			transparent 25deg 40deg
		);
		mask-image: radial-gradient(circle, #0007, transparent 65%);
		opacity: 0.45;
		transform: translate(-50%, -50%);
		animation: rays-turn 28s linear infinite;
	}
	@keyframes win-arrive {
		from {
			transform: scale(0.7) translateY(30px);
			opacity: 0;
		}
		to {
			transform: none;
			opacity: 1;
		}
	}
	@keyframes rays-turn {
		to {
			transform: translate(-50%, -50%) rotate(360deg);
		}
	}
	.reduced .win-stage {
		animation: none;
	}
	.reduced .win-rays {
		display: none;
	}
	@media (max-height: 500px) {
		.win-stage {
			width: min(620px, 78vw);
			gap: 10px;
		}
		.win-tier-title {
			width: min(100%, 76vh);
			max-height: none;
		}
		.win-stage :global(.win-amount) {
			font-size: clamp(24px, 10vh, 48px);
		}
		.gold-button {
			padding: 8px 28px;
		}
	}
</style>
