<script lang="ts">
	import { fade } from 'svelte/transition';

	import { i18nDerived } from '../i18n/i18nDerived';
	import { mcschmutzoStakeDerived } from '../state/mcschmutzoStake.svelte';
	import {
		replayBaseBetAmount,
		replayCostAmount,
		replayModeKey,
		replayPayoutMultiplier,
		replayWinAmount,
		roundFlowState,
	} from '../state/roundFlow.svelte';

	// Replay summary window (Stake review, 2026-10-10: "ensure that all required information is
	// displayed in the replay window", with Stake's own Bet Replay card as the reference). Shown while
	// a replay is idle — before the first play and again after it ends — and gone while it plays, so
	// it never covers the board. Every figure reconciles: cost = base bet x cost multiplier, win =
	// base bet x payout multiplier (STAKE_REVIEW_LESSONS R-09).
	type Props = { onstart: () => void };
	const props: Props = $props();

	const MODE_LABEL_KEYS: Record<string, string> = {
		base: 'REPLAY MODE BASE',
		enhancer1: 'REPLAY MODE CHANCE',
		featurespin: 'REPLAY MODE FEATURE',
		bonus1: 'REPLAY MODE NORMAL BONUS',
		bonus2: 'REPLAY MODE SUPER BONUS',
	};
	const modeLabel = $derived.by(() => {
		const key = String(replayModeKey());
		const labelKey = MODE_LABEL_KEYS[key.toLowerCase()];
		return labelKey ? i18nDerived.translate(labelKey) : key;
	});

	// Exact multipliers print exact (2 -> "2x", 0.1 -> "0.1x"); never clamped to 2 decimals first.
	const formatMultiplier = (value: number) => `${Number((Number.isFinite(value) ? value : 0).toFixed(4))}x`;

	const baseBetText = $derived(mcschmutzoStakeDerived.formatCurrencyAmount(replayBaseBetAmount()));
	const costMultiplierText = $derived(formatMultiplier(roundFlowState.replayCostMultiplier));
	const totalCostText = $derived(mcschmutzoStakeDerived.formatCurrencyAmount(replayCostAmount()));
	const payoutMultiplierText = $derived(formatMultiplier(replayPayoutMultiplier()));
	const totalWinText = $derived(mcschmutzoStakeDerived.formatWinCurrencyAmount(replayWinAmount()));
</script>

<div class="rw-backdrop" transition:fade|global={{ duration: 180 }}></div>

<div class="rw-root" transition:fade|global={{ duration: 180 }}>
	<div class="rw-card" role="dialog" aria-modal="true" aria-label={i18nDerived.translate('BET REPLAY')}>
		<header class="rw-head">
			<span class="rw-badge">{i18nDerived.replay()}</span>
			<h2 class="rw-title">{i18nDerived.translate('BET REPLAY')}</h2>
		</header>

		<div class="rw-stats">
			<div class="rw-row rw-row--mode">
				<span>{i18nDerived.mode()}</span>
				<strong>{modeLabel}</strong>
			</div>

			<hr class="rw-rule" />

			<div class="rw-row">
				<span>{i18nDerived.translate('BASE BET')}</span>
				<strong>{baseBetText}</strong>
			</div>
			<div class="rw-row">
				<span>{i18nDerived.translate('COST MULTIPLIER')}</span>
				<strong>{costMultiplierText}</strong>
			</div>
			<div class="rw-row rw-row--total">
				<span>{i18nDerived.translate('TOTAL BET COST')}</span>
				<strong>{totalCostText}</strong>
			</div>

			<hr class="rw-rule" />

			<div class="rw-row">
				<span>{i18nDerived.translate('PAYOUT MULTIPLIER')}</span>
				<strong class="rw-win">{payoutMultiplierText}</strong>
			</div>
			<div class="rw-row rw-row--total">
				<span>{i18nDerived.translate('TOTAL WIN')}</span>
				<strong class="rw-win">{totalWinText}</strong>
			</div>
		</div>

		<div class="rw-foot">
			<button
				class="rw-start"
				type="button"
				disabled={roundFlowState.replayLoading}
				onclick={props.onstart}
			>
				<span class="rw-play" aria-hidden="true">▶</span>
				<span>{i18nDerived.startReplay()}</span>
			</button>
			<p class="rw-note">{i18nDerived.translate('REPLAY DISCLAIMER')}</p>
		</div>
	</div>
</div>

<style>
	.rw-backdrop {
		position: fixed;
		inset: 0;
		z-index: 66;
		background: rgba(0, 0, 0, 0.55);
		pointer-events: auto;
	}

	/* Laid out at a 420px design width and scaled by it: --u is one design px. The width is also
	   capped by the height, so the whole card fits a short window without scrolling. */
	.rw-root {
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		z-index: 67;
		width: min(420px, 92vw, calc(94dvh * 420 / 560));
		container-type: inline-size;
		font-family: 'Nunito', sans-serif;
		pointer-events: auto;
	}
	.rw-card {
		--u: calc(100cqw / 420);
		display: flex;
		flex-direction: column;
		gap: calc(16 * var(--u));
		padding: calc(22 * var(--u)) calc(22 * var(--u)) calc(16 * var(--u));
		border-radius: calc(18 * var(--u));
		border: calc(2 * var(--u)) solid #605554;
		background: linear-gradient(180deg, #2a2523 0%, #1f1f1f 100%);
		box-shadow: 0 calc(14 * var(--u)) calc(30 * var(--u)) rgba(0, 0, 0, 0.6);
		color: #f9dca6;
	}

	.rw-head {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: calc(8 * var(--u));
	}
	.rw-badge {
		padding: calc(5 * var(--u)) calc(18 * var(--u));
		border-radius: 999px;
		background: #b1190a;
		color: #fff;
		font-size: calc(14 * var(--u));
		font-weight: 900;
		letter-spacing: 0.18em;
		line-height: 1.1;
	}
	.rw-title {
		margin: 0;
		font-family: var(--font-brush, 'Nunito'), sans-serif;
		font-size: calc(32 * var(--u));
		font-weight: 900;
		line-height: 1.1;
		color: #f9dca6;
		text-align: center;
	}

	.rw-stats {
		display: flex;
		flex-direction: column;
		gap: calc(6 * var(--u));
		padding: calc(12 * var(--u));
		border-radius: calc(12 * var(--u));
		background: rgba(0, 0, 0, 0.35);
	}
	.rw-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: calc(12 * var(--u));
		padding: calc(5 * var(--u)) calc(10 * var(--u));
		min-height: calc(30 * var(--u));
	}
	.rw-row span {
		min-width: 0;
		font-size: calc(14 * var(--u));
		font-weight: 800;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: rgba(249, 220, 166, 0.72);
	}
	.rw-row strong {
		flex: none;
		font-size: calc(18 * var(--u));
		font-weight: 900;
		color: #ffd36b;
		white-space: nowrap;
		font-variant-numeric: tabular-nums;
	}
	.rw-row--mode strong {
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}
	.rw-row--total {
		border-radius: calc(10 * var(--u));
		background: rgba(249, 220, 166, 0.08);
		padding-block: calc(10 * var(--u));
	}
	.rw-row--total strong {
		font-size: calc(22 * var(--u));
	}
	.rw-row strong.rw-win {
		color: #5cd17c;
	}
	.rw-rule {
		margin: calc(2 * var(--u)) calc(10 * var(--u));
		border: none;
		border-top: calc(1 * var(--u)) solid rgba(249, 220, 166, 0.16);
	}

	.rw-foot {
		display: flex;
		flex-direction: column;
		align-items: stretch;
		gap: calc(10 * var(--u));
	}
	.rw-start {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: calc(10 * var(--u));
		min-height: calc(56 * var(--u));
		border: none;
		border-radius: calc(14 * var(--u));
		background: linear-gradient(180deg, #d7321e 0%, #b1190a 100%);
		box-shadow: inset 0 calc(-3 * var(--u)) 0 rgba(0, 0, 0, 0.25);
		color: #fff;
		font-family: inherit;
		font-size: calc(22 * var(--u));
		font-weight: 900;
		letter-spacing: 0.04em;
		cursor: pointer;
	}
	.rw-start:hover:not(:disabled) {
		filter: brightness(1.08);
	}
	.rw-start:disabled {
		opacity: 0.6;
		cursor: default;
	}
	.rw-play {
		font-size: 0.8em;
	}
	.rw-note {
		margin: 0;
		font-size: calc(13 * var(--u));
		line-height: 1.35;
		text-align: center;
		color: rgba(249, 220, 166, 0.55);
	}

	/* Short landscape windows (phone landscape, Popout S/L): the stats beside the header + button,
	   so the card keeps readable type instead of shrinking to the window's height. */
	@media (orientation: landscape) and (max-height: 520px) {
		.rw-root {
			width: min(720px, 94vw, calc(96dvh * 720 / 330));
		}
		.rw-card {
			--u: calc(100cqw / 720);
			display: grid;
			grid-template-columns: minmax(0, 1fr) minmax(0, 1.25fr);
			grid-template-rows: auto 1fr;
			column-gap: calc(18 * var(--u));
			row-gap: calc(12 * var(--u));
			padding: calc(18 * var(--u));
		}
		.rw-head {
			grid-column: 1;
			grid-row: 1;
			align-self: end;
		}
		.rw-foot {
			grid-column: 1;
			grid-row: 2;
			justify-content: flex-start;
		}
		.rw-stats {
			grid-column: 2;
			grid-row: 1 / span 2;
			gap: calc(3 * var(--u));
			padding: calc(10 * var(--u));
		}
		.rw-row {
			min-height: calc(26 * var(--u));
			padding-block: calc(3 * var(--u));
		}
		.rw-row--total {
			padding-block: calc(6 * var(--u));
		}
	}
</style>
