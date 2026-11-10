<script lang="ts">
	import { stateBet, stateConfig } from 'state-shared';
	import { selectedSpeed, type Speed } from '../game/uiPolicy';
	import { speedChanged } from '../game/playback.svelte';
	import { autoplaySettings } from '../game/autoplaySettings.svelte';
	import { t } from '../i18n';
	import { AUTOPLAY_COUNTS, autoplayCountAt, validAutoplayCount } from '../game/autoplayCounts';
	import { ART_ROOT, UI_ART_ROOT } from '../game/art';
	import ButtonLabel from './ButtonLabel.svelte';
	let {
		count = $bindable(100),
		start,
		preview = false,
	}: {
		count?: number;
		start: () => void;
		preview?: boolean;
	} = $props();
	const countIndex = $derived(AUTOPLAY_COUNTS.indexOf(count));
	function stepCount(direction: number) {
		count = autoplayCountAt(Math.max(0, countIndex) + direction);
	}
	const speed = $derived(selectedSpeed(stateBet, stateConfig.jurisdiction));
	function toggleSpeed(next: Speed) {
		if (
			stateConfig.jurisdiction.disabledTurbo ||
			(next === 'turbo' && stateConfig.jurisdiction.disabledSuperTurbo)
		)
			return;
		const previous = speed;
		const selected = speed === next ? 'normal' : next;
		stateBet.isTurbo = selected === 'fast';
		stateBet.isSuperTurbo = selected === 'turbo';
		speedChanged(previous);
	}
</script>

<div class="autoplay-controls">
	<div class="autoplay-switches">
		{#if !stateConfig.jurisdiction.disabledTurbo}<label
				><span>{t('FAST SPIN')}</span><input
					type="checkbox"
					checked={speed === 'fast'}
					onchange={() => toggleSpeed('fast')}
				/></label
			>{/if}
		{#if !stateConfig.jurisdiction.disabledTurbo && !stateConfig.jurisdiction.disabledSuperTurbo}<label
				><span>{t('INSTANT SPIN')}</span><input
					type="checkbox"
					checked={speed === 'turbo'}
					onchange={() => toggleSpeed('turbo')}
				/></label
			>{/if}
		<label
			><span>{t('AUTOPLAY BONUS')}</span><input
				type="checkbox"
				bind:checked={autoplaySettings.continueOnBonus}
				aria-describedby="autoplay-bonus-note"
			/></label
		>
	</div>
	<p id="autoplay-bonus-note" class="autoplay-policy">
		{t(autoplaySettings.continueOnBonus ? 'AUTO BONUS CONTINUE' : 'AUTO BONUS STOP')}
	</p>
	<div class="autoplay-count-picker" role="group" aria-label={t('ROUND COUNT')}>
		<span class="autoplay-count-title">{t('ROUND COUNT')}</span>
		<div class="autoplay-count-stepper">
			<button
				type="button"
				class="autoplay-count-button"
				aria-label={`${t('ROUND COUNT')} −`}
				disabled={countIndex <= 0}
				onclick={() => stepCount(-1)}
			>
				<img draggable="false" src={`${ART_ROOT}hud/bet-decrease.png`} alt="" />
			</button>
			<output aria-live="polite" aria-atomic="true">{count}</output>
			<button
				type="button"
				class="autoplay-count-button"
				aria-label={`${t('ROUND COUNT')} +`}
				disabled={countIndex >= AUTOPLAY_COUNTS.length - 1}
				onclick={() => stepCount(1)}
			>
				<img draggable="false" src={`${UI_ART_ROOT}bet-plus.svg`} alt="" />
			</button>
		</div>
	</div>
	<button
		class="gold-button autoplay-start"
		disabled={preview || !validAutoplayCount(count) || stateConfig.jurisdiction.disabledAutoplay}
		onclick={start}><ButtonLabel text={t('START AUTOPLAY')} /></button
	>
</div>
