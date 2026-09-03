<script lang="ts">
	import { stateBet, stateI18nDerived } from 'state-shared';

	import { getContext } from '../game/context';
	import { veggieStakeState } from '../state/veggieStake.svelte';

	const context = getContext();
	const t = (key: string) => stateI18nDerived.translate(key);
	const show = $derived(
		veggieStakeState.pendingRoundDetected && veggieStakeState.bootStatus === 'error',
	);
	const retry = () => {
		if (!stateBet.betToResume?.active) return;
		if (stateBet.betToResume.mode) stateBet.activeBetModeKey = stateBet.betToResume.mode;
		veggieStakeState.bootStatus = 'booting';
		veggieStakeState.bootError = '';
		context.eventEmitter.broadcast({ type: 'resumeBet' });
	};
</script>

{#if show}
	<div class="recovery-overlay">
		<section class="recovery-card" role="alertdialog" aria-modal="true">
			<h2>{t('RECOVERY TITLE')}</h2>
			<p>{t('RECOVERY BODY')}</p>
			{#if veggieStakeState.bootError}<p class="error">{veggieStakeState.bootError}</p>{/if}
			<button type="button" onclick={retry}>{t('RETRY RESUME')}</button>
		</section>
	</div>
{/if}

<style>
	.recovery-overlay {
		position: fixed;
		inset: 0;
		z-index: 10000;
		display: grid;
		place-items: center;
		padding: 18px;
		background: rgb(4 14 7 / 80%);
	}
	.recovery-card {
		width: min(520px, 94vw);
		padding: 30px;
		border: 7px solid #351703;
		background: #294817;
		box-shadow:
			inset 0 0 0 4px #d99a32,
			8px 8px 0 #130701;
		color: #fff;
		font-family: ui-monospace, monospace;
		text-align: center;
	}
	h2 {
		margin: 0 0 14px;
		color: #ffd052;
	}
	p {
		line-height: 1.45;
	}
	.error {
		color: #ffc8bd;
		overflow-wrap: anywhere;
	}
	button {
		width: 100%;
		min-height: 50px;
		border: 4px solid #54280b;
		background: #ed9300;
		color: #fff;
		font:
			900 15px ui-monospace,
			monospace;
		cursor: pointer;
	}

	@media (max-width: 520px) and (max-height: 300px) and (orientation: landscape) {
		.recovery-overlay {
			padding: 4px;
		}
		.recovery-card {
			width: min(360px, calc(100vw - 8px));
			max-height: calc(100dvh - 8px);
			padding: 10px 12px;
			border-width: 4px;
			box-shadow:
				inset 0 0 0 2px #d99a32,
				3px 3px 0 #130701;
			overflow: auto;
		}
		h2 {
			margin-bottom: 5px;
			font-size: 16px;
			line-height: 1;
		}
		p {
			margin: 4px 0;
			font-size: 8px;
			line-height: 1.2;
		}
		button {
			min-height: 28px;
			padding: 3px 6px;
			border-width: 2px;
			font-size: 8px;
		}
	}
</style>
