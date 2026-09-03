<script lang="ts">
	import { stateBet } from 'state-shared';

	import { getContext } from '../../game/context';
	import { veggieStakeDerived, veggieStakeState } from '../../state/veggieStake.svelte';

	const context = getContext();
	const t = veggieStakeDerived.t;
	const bet = $derived(veggieStakeDerived.replayBetAmount());
	const cost = $derived(veggieStakeDerived.replayCostAmount());
	const payoutMultiplier = $derived(veggieStakeDerived.replayPayoutMultiplier());
	const betText = $derived(veggieStakeDerived.formatAmount(bet));
	const costText = $derived(veggieStakeDerived.formatAmount(cost));
	const winText = $derived(veggieStakeDerived.formatWin(veggieStakeDerived.replayWinAmount()));
	const replayError = $derived(
		veggieStakeState.bootStatus === 'error' ? veggieStakeState.bootError : '',
	);
	const valueStyle = (value: string) => {
		const length = value.replace(/\s+/g, '').length;
		const scale =
			length >= 18 ? 0.56 : length >= 16 ? 0.66 : length >= 14 ? 0.76 : length >= 12 ? 0.84 : 1;
		const spacing = length >= 18 ? -0.065 : length >= 16 ? -0.05 : length >= 14 ? -0.032 : 0;
		return `--value-scale:${scale};--value-spacing:${spacing}em`;
	};
	const replay = () => {
		if (!veggieStakeDerived.requestReplayStart()) return;
		const snapshot = veggieStakeDerived.cloneReplayBet(veggieStakeState.replaySnapshot);
		if (!snapshot) {
			veggieStakeDerived.setBootError(t('REPLAY ERROR GENERIC'));
			return;
		}
		stateBet.betToResume = snapshot;
		context.eventEmitter.broadcast({ type: 'resumeBet' });
	};
</script>

{#if veggieStakeDerived.isReplayMode() && !veggieStakeState.replayRunning}
	<div class="replay-shell">
		<section class="replay-card" role="dialog" aria-modal="true" aria-label={t('BET REPLAY')}>
			<header><span>{t('REPLAY')}</span><strong>{veggieStakeDerived.modeTitle()}</strong></header>
			{#if veggieStakeState.replayEventId}
				<p class="event">{t('EVENT')} {veggieStakeState.replayEventId}</p>
			{/if}
			<div class="rows">
				<p><span>{t('MODE')}</span><strong>{veggieStakeDerived.modeTitle()}</strong></p>
				<p><span>{t('BASE BET')}</span><strong style={valueStyle(betText)}>{betText}</strong></p>
				<p>
					<span>{t('COST MULTIPLIER')}</span><strong
						>{veggieStakeDerived.modeCostMultiplier()}×</strong
					>
				</p>
				<p>
					<span>{t('TOTAL BET COST')}</span><strong style={valueStyle(costText)}>{costText}</strong>
				</p>
				<p>
					<span>{t('PAYOUT MULTIPLIER')}</span><strong
						>{payoutMultiplier.toFixed(2).replace(/\.?0+$/, '')}×</strong
					>
				</p>
				<p>
					<span>{t('TOTAL WIN')}</span><strong style={valueStyle(winText)}>{winText}</strong>
				</p>
			</div>
			{#if replayError}<p class="error">{replayError}</p>{/if}
			{#if !replayError}
				<button type="button" disabled={!veggieStakeState.replaySnapshot} onclick={replay}>
					▶ {veggieStakeState.replayHasPlayed ? t('REPLAY EVENT') : t('START REPLAY')}
				</button>
			{/if}
			<small>{t('REPLAY DISCLAIMER')}</small>
		</section>
	</div>
{/if}

<style>
	.replay-shell {
		position: fixed;
		inset: 0;
		z-index: 90;
		display: grid;
		place-items: center;
		padding: 14px;
		background: rgb(4 18 12 / 72%);
	}
	.replay-card {
		width: min(430px, 96vw);
		max-height: 94vh;
		overflow: auto;
		padding: 20px;
		border: 6px solid #3a1b05;
		background: #24380f;
		box-shadow:
			inset 0 0 0 3px #d99a32,
			7px 7px 0 #140b04;
		color: #fff;
		font-family: ui-monospace, monospace;
	}
	header {
		display: flex;
		justify-content: space-between;
		gap: 12px;
		color: #ffe15b;
		font-weight: 900;
	}
	.event,
	small {
		color: #d7e9b6;
		font-size: 11px;
		text-align: center;
	}
	.rows {
		display: grid;
		gap: 4px;
		margin: 14px 0;
	}
	.rows p {
		display: flex;
		justify-content: space-between;
		gap: 12px;
		margin: 0;
		padding: 8px;
		background: #172909;
	}
	.rows span {
		color: #cfe5aa;
		font-size: 11px;
	}
	.rows strong {
		color: #ffd55b;
		max-width: 58%;
		overflow: hidden;
		font-size: calc(1em * var(--value-scale, 1));
		letter-spacing: var(--value-spacing, 0);
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	button {
		width: 100%;
		margin: 10px 0;
		padding: 13px;
		border: 4px solid #6d390d;
		background: #ec9200;
		color: #fff;
		font:
			900 14px ui-monospace,
			monospace;
		cursor: pointer;
	}
	button:disabled {
		opacity: 0.5;
	}
	.error {
		color: #ffb5a8;
	}

	@media (max-width: 520px) and (max-height: 300px) and (orientation: landscape) {
		.replay-shell {
			padding: 4px;
		}
		.replay-card {
			width: min(380px, calc(100vw - 8px));
			max-height: calc(100dvh - 8px);
			padding: 7px 10px;
			border-width: 4px;
			box-shadow:
				inset 0 0 0 2px #d99a32,
				3px 3px 0 #140b04;
		}
		header {
			gap: 5px;
			font-size: 9px;
		}
		.event,
		small {
			margin: 3px 0;
			font-size: 6px;
			line-height: 1.1;
		}
		.rows {
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: 2px;
			margin: 4px 0;
		}
		.rows p {
			gap: 4px;
			padding: 3px 4px;
			font-size: 7px;
		}
		.rows span {
			font-size: 6px;
		}
		button {
			margin: 4px 0;
			padding: 5px;
			border-width: 2px;
			font-size: 8px;
		}
	}
</style>
