<script lang="ts">
	import { COSTS } from '../game/contract';
	import { t } from '../i18n';
	const modes = [
		{ name: 'NORMAL', key: 'NORMAL RULES', cost: COSTS.BONUS },
		{ name: 'SUPER', key: 'SUPER RULES', cost: COSTS.SUPER },
		{ name: 'HIDDEN', key: 'HIDDEN RULES', cost: null },
		{ name: 'MYSTERY', key: 'MYSTERY RULES', cost: COSTS.MYSTERY },
		{ name: 'CHANCE', key: 'CHANCE RULES', cost: COSTS.CHANCE },
		{ name: 'FEATURE', key: 'FEATURE RULES', cost: COSTS.FEATURE },
	];
</script>

<section class="bonus-rules" aria-labelledby="bonus-rules-heading">
	<h3 id="bonus-rules-heading">{t('BONUS MODES')}</h3>
	<p>{t('BONUS SHARED RULES')}</p>
	{#each modes as mode}
		<section class="mode-rule" data-info-mode={mode.name}>
			<header>
				<h4>{t(mode.name)}</h4>
				{#if mode.cost !== null}<span>{t('COST')}: {mode.cost}× {t('BET').toLowerCase()}</span>{/if}
			</header>
			<p>{t(mode.key)}</p>
		</section>
	{/each}
	<p>{t('BONUS PURCHASE RULES')}</p>
</section>

<style>
	.bonus-rules {
		margin-block: 24px;
	}
	h3 {
		color: #f8dfa3;
		font: 700 21px var(--serif);
	}
	.mode-rule {
		padding: 16px 0;
		border-bottom: 1px solid #e6c5782e;
	}
	header {
		display: flex;
		align-items: baseline;
		flex-wrap: wrap;
		gap: 8px 16px;
	}
	h4 {
		margin: 0;
		color: #f8dfa3;
		font: 700 17px var(--serif);
	}
	span {
		font-size: 12px;
		color: #b9c9c7;
	}
	p {
		line-height: 1.65;
		overflow-wrap: anywhere;
	}
	.mode-rule p {
		margin-bottom: 0;
	}
</style>
