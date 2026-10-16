<script lang="ts">
	import { onMount } from 'svelte';
	import ButtonLabel from './ButtonLabel.svelte';
	import FitNumber from './FitNumber.svelte';
	import { installModalFocus } from '../game/modalFocus';
	import { fitReplaySummary } from '../game/replayLayout';
	import { t } from '../i18n';
	let {
		mode,
		eventId,
		gameId = '',
		version = '',
		bet,
		cost,
		costMultiplier,
		payoutMultiplier,
		win,
		played = false,
		ready,
		play,
	}: {
		mode: string;
		eventId: string;
		gameId?: string;
		version?: string;
		bet: string;
		cost: string;
		costMultiplier: string;
		payoutMultiplier: string;
		win: string;
		played?: boolean;
		ready: boolean;
		play: () => void;
	} = $props();
	let width = $state(1200),
		height = $state(680),
		overlay: HTMLDivElement;
	const fit = $derived(fitReplaySummary(width, height));
	onMount(() => installModalFocus(overlay, { close: () => {}, locked: true }));
</script>

<svelte:window bind:innerWidth={width} bind:innerHeight={height} />
<div
	class="replay-shell"
	bind:this={overlay}
	role="dialog"
	aria-modal="true"
	aria-label={t('REPLAY')}
	tabindex="-1"
	data-pixi-overlay
>
	<section
		class="replay-summary"
		class:portrait={fit.portrait}
		class:compact={fit.compact}
		style={`width:${fit.width}px;height:${fit.height}px;zoom:${fit.scale}`}
	>
		<header>
			<span class="replay-brand">{t('THE GATES')}</span>
			<h2>{t('REPLAY')}</h2>
		</header>
		<dl class="replay-meta">
			<div>
				<dt>{t('MODE')}</dt>
				<dd>{mode}</dd>
			</div>
			<div>
				<dt>{t('EVENT')}</dt>
				<dd class="replay-id">{eventId || '—'}</dd>
			</div>
		</dl>
		<dl class="replay-stats">
			<div>
				<dt>{t('BASE BET')}</dt>
				<dd><FitNumber text={bet} /></dd>
				<small>{t('REPLAY BASE UNIT')}</small>
			</div>
			<div>
				<dt>{t('TOTAL COST')}</dt>
				<dd><FitNumber text={cost} /></dd>
				<small>{t('COST MULTIPLIER')} <strong>{costMultiplier}</strong></small>
			</div>
			<div>
				<dt>{t('PAYOUT MULTIPLIER')}</dt>
				<dd><FitNumber text={payoutMultiplier} /></dd>
				<small>{t('REPLAY BASE UNIT')}</small>
			</div>
			<div class="replay-win">
				<dt>{t('TOTAL WIN')}</dt>
				<dd><FitNumber text={win} /></dd>
				<small>{t('REPLAY RESULT')}</small>
			</div>
		</dl>
		{#if gameId || version}<div class="replay-version">
				{#if gameId}<span>{t('GAME')} <b>{gameId}</b></span>{/if}{#if version}<span
						>{t('VERSION')} <b>{version}</b></span
					>{/if}
			</div>{/if}
		<button class="gold-button" disabled={!ready} onclick={play}
			><ButtonLabel text={t(played ? 'PLAY AGAIN' : 'START REPLAY')} /></button
		>
		<p class="replay-notice">{t('REPLAY DISCLAIMER')}</p>
	</section>
</div>

<style>
	.replay-shell {
		position: fixed;
		inset: 0;
		z-index: 95;
		display: grid;
		place-items: center;
		background: rgb(2 16 38 / 66%);
		padding: 12px;
		color: #fff;
	}
	.replay-summary {
		box-sizing: border-box;
		flex: none;
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 22px 28px 18px;
		border: 6px solid transparent;
		border-radius: 28px;
		background:
			linear-gradient(145deg, #123b70, #061e40) padding-box,
			linear-gradient(#fff18a, #ffd000 40%, #f48600) border-box;
		box-shadow:
			0 0 0 5px #021d42,
			inset 0 0 0 2px #2373d2,
			0 12px 36px #0008;
		text-align: center;
	}
	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
	}
	.replay-brand {
		font-family: GatesCartoon, sans-serif;
		color: #fff4be;
		font-size: 20px;
	}
	h2 {
		margin: 0;
		font-family: GatesCartoon, sans-serif;
		font-size: 32px;
		line-height: 1;
		color: #ffdc16;
		text-shadow: 0 3px #021d42;
	}
	dl,
	dd {
		margin: 0;
		min-width: 0;
	}
	.replay-meta {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 12px;
		text-align: start;
	}
	.replay-meta > div {
		min-width: 0;
	}
	dt {
		font:
			700 12px/1.25 system-ui,
			sans-serif;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: #c4daf3;
	}
	.replay-meta dd {
		font:
			700 17px/1.2 GatesCartoon,
			sans-serif;
		margin-top: 5px;
		overflow-wrap: anywhere;
	}
	.replay-meta .replay-id {
		font:
			600 12px/1.3 ui-monospace,
			monospace;
	}
	.replay-stats {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		grid-template-rows: repeat(2, minmax(0, 1fr));
		gap: 10px;
		flex: 1;
		min-height: 0;
	}
	.replay-stats > div {
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 6px;
		min-width: 0;
		padding: 8px 12px;
		border: 1px solid #2c619b;
		border-radius: 12px;
		background: #031a36b3;
	}
	.replay-stats dd {
		font:
			28px/1.1 GatesCartoon,
			sans-serif;
	}
	.replay-stats small {
		font:
			600 11px/1.25 system-ui,
			sans-serif;
		color: #bbd0e7;
	}
	.replay-stats strong {
		color: #ffe467;
	}
	.replay-stats .replay-win {
		border-color: #e9b83e;
		background: linear-gradient(135deg, #124d7d, #102c54);
	}
	.replay-win dd {
		color: #ffdf49;
	}
	.replay-version {
		display: flex;
		justify-content: center;
		gap: 14px;
		font:
			10px/1.2 system-ui,
			sans-serif;
		color: #bbd0e7;
		overflow-wrap: anywhere;
	}
	.replay-version span {
		min-width: 0;
	}
	.replay-version b {
		font-weight: 600;
		color: #fff;
	}
	.replay-summary > button {
		align-self: center;
		width: 72%;
		min-height: 48px;
		margin: 0;
		flex-shrink: 0;
	}
	.replay-notice {
		margin: 0;
		color: #bbd0e7;
		font:
			11px/1.3 system-ui,
			sans-serif;
	}
	.portrait {
		padding: 24px 18px 20px;
		gap: 14px;
	}
	.portrait header {
		flex-direction: column;
		gap: 7px;
	}
	.portrait h2 {
		font-size: 30px;
	}
	.portrait .replay-brand {
		font-size: 17px;
	}
	.portrait .replay-meta {
		gap: 10px;
	}
	.portrait .replay-meta dd {
		font-size: 16px;
	}
	.portrait .replay-meta .replay-id {
		font-size: 11px;
	}
	.portrait .replay-stats > div {
		padding: 8px;
	}
	.portrait .replay-stats dd {
		font-size: 25px;
	}
	.portrait > button {
		width: 88%;
	}
	.compact {
		padding: 16px 20px;
		gap: 10px;
	}
	.compact h2 {
		font-size: 28px;
	}
	.compact .replay-meta dd {
		font-size: 16px;
	}
	.compact .replay-meta .replay-id {
		font-size: 12px;
	}
	.compact .replay-stats {
		grid-template-columns: repeat(4, minmax(0, 1fr));
		grid-template-rows: minmax(0, 1fr);
		gap: 8px;
	}
	.compact .replay-stats > div {
		padding: 8px;
		gap: 5px;
	}
	.compact .replay-stats dd {
		font-size: 25px;
	}
	.compact .replay-stats dt {
		font-size: 10px;
	}
	.compact .replay-stats small {
		font-size: 10px;
	}
	.compact > button {
		min-height: 44px;
		width: 60%;
	}
</style>
