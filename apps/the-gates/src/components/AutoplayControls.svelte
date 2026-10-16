<script lang="ts">
	import { stateBet, stateConfig } from 'state-shared';
	import { selectedSpeed, type Speed } from '../game/uiPolicy';
	import { speedChanged } from '../game/playback.svelte';
	import { autoplaySettings } from '../game/autoplaySettings.svelte';
	import { t } from '../i18n';
	import { AUTOPLAY_COUNTS, autoplayCountAt, validAutoplayCount } from '../game/autoplayCounts';
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
	<label class="autoplay-slider"
		><span>{t('ROUND COUNT')}</span><output>{count}</output><input
			aria-label={t('ROUND COUNT')}
			type="range"
			min="0"
			max={AUTOPLAY_COUNTS.length - 1}
			step="1"
			value={AUTOPLAY_COUNTS.indexOf(count)}
			aria-valuetext={String(count)}
			oninput={(event) => (count = autoplayCountAt(event.currentTarget.valueAsNumber))}
		/></label
	>
	<button
		class="gold-button autoplay-start"
		disabled={preview || !validAutoplayCount(count) || stateConfig.jurisdiction.disabledAutoplay}
		onclick={start}><ButtonLabel text={`${t('START AUTOPLAY')} (${count})`} /></button
	>
</div>
