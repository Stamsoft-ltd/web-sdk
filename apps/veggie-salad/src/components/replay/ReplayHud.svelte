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
	// Up to 4 decimals, trailing zeros dropped by Number: a clamp to 2 no longer multiplies back to
	// the win (lessons R-09).
	const payoutText = $derived(`${Number(payoutMultiplier.toFixed(4))}×`);
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
	let bar = $state<HTMLElement>();
	// The band the bar takes off the bottom of the viewport. Written straight to a CSS variable, never
	// to state: the scene's layout reads it, and a measurement that fed back into state would re-run
	// this on its own output (lessons R-10/R-12).
	$effect(() => {
		const el = bar;
		if (!el) return;
		const root = document.documentElement;
		const publish = () => root.style.setProperty('--replay-band', `${Math.ceil(el.getBoundingClientRect().height)}px`);
		const observer = new ResizeObserver(publish);
		observer.observe(el);
		publish();
		return () => {
			observer.disconnect();
			root.style.removeProperty('--replay-band');
		};
	});
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

<!-- A docked bar, not a modal (mock review 2026-09-25, R-12): the old full-screen card with its
     scrim covered every cell before and after playback, so the replayed result was never visible.
     The bar stays mounted while the replay runs, so the band it takes never changes height, and it
     publishes that band as --replay-band; the scene shrinks the board's box by it. -->
{#if veggieStakeDerived.isReplayMode()}
	<section class="replay-bar" bind:this={bar} aria-label={t('BET REPLAY')}>
		<header><span>{t('REPLAY')}</span><strong>{veggieStakeDerived.modeTitle()}</strong></header>
		<dl class="rows">
			<div><dt>{t('BASE BET')}</dt><dd style={valueStyle(betText)}>{betText}</dd></div>
			<div><dt>{t('COST MULTIPLIER')}</dt><dd>{veggieStakeDerived.modeCostMultiplier()}×</dd></div>
			<div><dt>{t('TOTAL BET COST')}</dt><dd style={valueStyle(costText)}>{costText}</dd></div>
			<div><dt>{t('PAYOUT MULTIPLIER')}</dt><dd>{payoutText}</dd></div>
			<div><dt>{t('TOTAL WIN')}</dt><dd style={valueStyle(winText)}>{winText}</dd></div>
		</dl>
		<div class="act">
			{#if replayError}
				<p class="error">{replayError}</p>
			{:else}
				<button
					type="button"
					disabled={!veggieStakeState.replaySnapshot || veggieStakeState.replayRunning}
					onclick={replay}
				>
					▶ {veggieStakeState.replayHasPlayed ? t('REPLAY EVENT') : t('START REPLAY')}
				</button>
			{/if}
			<small>{t('REPLAY DISCLAIMER')}</small>
		</div>
	</section>
{/if}

<style>
	.replay-bar {
		position: fixed;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 90;
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) minmax(170px, 22%);
		align-items: center;
		gap: 8px 16px;
		padding: 10px max(16px, env(safe-area-inset-right)) calc(10px + env(safe-area-inset-bottom))
			max(16px, env(safe-area-inset-left));
		border-top: 5px solid #3a1b05;
		background: #24380f;
		box-shadow: inset 0 3px 0 #d99a32;
		color: #fff;
		font-family: 'Jersey 10', monospace;
	}
	header {
		display: grid;
		gap: 2px;
		color: #ffe15b;
		line-height: 1;
	}
	header span {
		color: #cfe5aa;
		font-size: 13px;
		letter-spacing: 0.08em;
	}
	header strong {
		font-size: 22px;
		white-space: nowrap;
	}
	.rows {
		display: grid;
		grid-template-columns: repeat(5, minmax(0, 1fr));
		gap: 4px;
		margin: 0;
	}
	.rows div {
		min-width: 0;
		padding: 5px 8px;
		background: #172909;
	}
	/* Labels wrap rather than ellipsise: a clipped "PAYOUT MULTIP…" reads as broken. */
	dt {
		color: #cfe5aa;
		font-size: 13px;
		line-height: 1;
	}
	dd {
		margin: 0;
		overflow: hidden;
		color: #ffd55b;
		font-size: calc(20px * var(--value-scale, 1));
		letter-spacing: var(--value-spacing, 0);
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.act {
		display: grid;
		gap: 4px;
		justify-items: stretch;
	}
	button {
		padding: 8px 12px;
		border: 4px solid #6d390d;
		background: #ec9200;
		color: #fff;
		font:
			900 18px 'Jersey 10',
			monospace;
		cursor: pointer;
	}
	button:disabled {
		opacity: 0.5;
		cursor: default;
	}
	small {
		color: #d7e9b6;
		font-size: 11px;
		line-height: 1.1;
		text-align: center;
	}
	.error {
		margin: 0;
		color: #ffb5a8;
		font-size: 14px;
	}

	/* Phones in portrait: stacked, three values to a row. */
	@media (orientation: portrait) {
		.replay-bar {
			grid-template-columns: minmax(0, 1fr);
			gap: 6px;
			padding-top: 8px;
		}
		header {
			display: flex;
			align-items: baseline;
			justify-content: space-between;
		}
		header strong {
			font-size: 20px;
		}
		.rows {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
		dt {
			font-size: 12px;
		}
		dd {
			font-size: calc(18px * var(--value-scale, 1));
		}
	}

	/* Short landscape (phones, Popout L/S): one row, as low as it can read. */
	@media (orientation: landscape) and (max-height: 520px) {
		.replay-bar {
			grid-template-columns: auto minmax(0, 1fr) minmax(120px, 24%);
			gap: 4px 10px;
			padding-top: 5px;
			padding-bottom: calc(5px + env(safe-area-inset-bottom));
			border-top-width: 3px;
			box-shadow: inset 0 2px 0 #d99a32;
		}
		header span,
		dt {
			font-size: 11px;
		}
		header strong {
			font-size: 16px;
		}
		.rows div {
			padding: 3px 6px;
		}
		dd {
			font-size: calc(15px * var(--value-scale, 1));
		}
		button {
			padding: 4px 8px;
			border-width: 3px;
			font-size: 14px;
		}
		small {
			font-size: 9px;
		}
	}
	@media (orientation: landscape) and (max-height: 300px) {
		.replay-bar {
			grid-template-columns: minmax(0, 1fr) 30%;
			gap: 3px 6px;
			padding: 3px 6px calc(3px + env(safe-area-inset-bottom));
		}
		header {
			display: none;
		}
		.rows div {
			padding: 2px 4px;
		}
		header span,
		dt {
			font-size: 9px;
		}
		dd {
			font-size: calc(12px * var(--value-scale, 1));
		}
		button {
			padding: 2px 6px;
			border-width: 2px;
			font-size: 12px;
		}
		small {
			font-size: 8px;
		}
	}
</style>
