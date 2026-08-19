<script lang="ts">
	import { stateBet, stateUi } from 'state-shared';

	import { getContext } from '../../game/context';
	import { magneticStakeDerived, magneticStakeState } from '../../state/magneticStake.svelte';
	import { formatReplayMultiplier } from '../../state/replay';
	import { logMagneticDiagnostic } from '../../utils/magneticDiagnostics';

	const context = getContext();

	const isReplayMode = $derived(stateUi.config.mode === 'replay');
	const layoutType = $derived(context.stateLayoutDerived.layoutType());
	const mobileUi = $derived(['portrait', 'landscape'].includes(layoutType));
	const selectedMode = $derived(magneticStakeDerived.selectedModeLabel());
	const replayReady = $derived(Boolean(magneticStakeState.replaySnapshot));
	const replayRunning = $derived(magneticStakeState.replayRunning);
	const replayHasPlayed = $derived(magneticStakeState.replayHasPlayed);
	const replayError = $derived(
		magneticStakeState.bootStatus === 'error' ? magneticStakeState.bootError : '',
	);
	const replayBetText = $derived(
		magneticStakeDerived.formatCurrencyAmount(magneticStakeDerived.replayBetAmount()),
	);
	const replayCostText = $derived(
		magneticStakeDerived.formatCurrencyAmount(magneticStakeDerived.replayCostAmount()),
	);
	const replayCostMultiplierText = $derived(`${magneticStakeDerived.replayCostMultiplier()}x`);
	const replayPayoutMultiplierText = $derived(
		`${formatReplayMultiplier(magneticStakeDerived.replayPayoutMultiplier())}x`,
	);
	const replayWinText = $derived(
		magneticStakeDerived.formatCurrencyAmount(magneticStakeDerived.replayWinAmount()),
	);

	const replayValueStyle = (text: string) => {
		if (!mobileUi) return '';
		const visibleLength = String(text ?? '').replace(/\s+/g, '').length;
		let scale = 1;
		let letterSpacing = 0;
		if (visibleLength >= 18) {
			scale = 0.56;
			letterSpacing = -0.065;
		} else if (visibleLength >= 16) {
			scale = 0.66;
			letterSpacing = -0.05;
		} else if (visibleLength >= 14) {
			scale = 0.76;
			letterSpacing = -0.032;
		} else if (visibleLength >= 12) {
			scale = 0.83;
			letterSpacing = -0.02;
		}
		return `--replay-value-scale:${scale};--replay-value-letter-spacing:${letterSpacing}em;`;
	};

	const setReplayBetToResume = () => {
		if (!magneticStakeState.replaySnapshot) return false;
		const snapshot = magneticStakeDerived.cloneReplayBet(magneticStakeState.replaySnapshot);
		if (!snapshot) return false;
		stateBet.betToResume = snapshot;
		return true;
	};

	const startReplay = () => {
		if (!magneticStakeDerived.requestReplayStart() || !setReplayBetToResume()) return;
		context.eventEmitter.broadcast({ type: 'resumeBet' });
	};

	const replayAgain = () => {
		if (!magneticStakeDerived.requestReplayStart() || !setReplayBetToResume()) return;
		logMagneticDiagnostic('info', 'replay_again_pressed', {
			eventId: magneticStakeState.replayEventId,
		});
		context.eventEmitter.broadcast({ type: 'resumeBet' });
	};
</script>

{#if isReplayMode}
	<div class="replay-hud">
		<!-- Nothing may sit over the board while the round plays: in small popout windows the reels
		     fill the viewport, so any persistent chrome covers symbols. Mode and event are on the
		     summary card, which is up whenever the replay is not running. -->
		<div class="replay-topbar" class:replay-topbar--hidden={replayRunning}>
			<div class="replay-meta">
				<span class="replay-badge">{magneticStakeDerived.t('REPLAY')}</span>
				{#if selectedMode}
					<span class="replay-chip">{selectedMode}</span>
				{/if}
				{#if magneticStakeState.replayEventId}
					<span class="replay-chip"
						>{magneticStakeDerived.t('EVENT')} {magneticStakeState.replayEventId}</span
					>
				{/if}
			</div>
		</div>

		<!-- Full round summary while the replay is idle (before the first play and again after it
		     finishes). Hidden during playback so the board stays visible. -->
		{#if !replayRunning && (replayReady || replayError)}
			<div class="replay-card" role="dialog" aria-label={magneticStakeDerived.t('BET REPLAY')}>
				<h2 class="replay-title">{magneticStakeDerived.t('BET REPLAY')}</h2>

				<div class="replay-rows">
					<div class="replay-row">
						<span>{magneticStakeDerived.t('MODE')}</span>
						<strong>{selectedMode}</strong>
					</div>
					{#if magneticStakeState.replayEventId}
						<div class="replay-row">
							<span>{magneticStakeDerived.t('EVENT')}</span>
							<strong>{magneticStakeState.replayEventId}</strong>
						</div>
					{/if}

					<hr class="replay-rule" />

					<div class="replay-row">
						<span>{magneticStakeDerived.t('BASE BET')}</span>
						<strong class="replay-amount" style={replayValueStyle(replayBetText)}
							>{replayBetText}</strong
						>
					</div>
					<div class="replay-row">
						<span>{magneticStakeDerived.t('COST MULTIPLIER')}</span>
						<strong>{replayCostMultiplierText}</strong>
					</div>
					<div class="replay-row replay-row--total">
						<span>{magneticStakeDerived.t('TOTAL BET COST')}</span>
						<strong class="replay-amount" style={replayValueStyle(replayCostText)}
							>{replayCostText}</strong
						>
					</div>

					<hr class="replay-rule" />

					<div class="replay-row">
						<span>{magneticStakeDerived.t('PAYOUT MULTIPLIER')}</span>
						<strong class="replay-win">{replayPayoutMultiplierText}</strong>
					</div>
					<div class="replay-row replay-row--total">
						<span>{magneticStakeDerived.t('TOTAL WIN')}</span>
						<strong class="replay-amount" style={replayValueStyle(replayWinText)}
							>{replayWinText}</strong
						>
					</div>
				</div>

				{#if replayError}
					<div class="replay-error-block">
						<p>{replayError}</p>
					</div>
				{:else if replayReady}
					<button
						class="replay-primary"
						type="button"
						onclick={replayHasPlayed ? replayAgain : startReplay}
					>
						<span class="replay-play-icon">▶</span>
						<span
							>{replayHasPlayed
								? magneticStakeDerived.t('REPLAY EVENT')
								: magneticStakeDerived.t('START REPLAY')}</span
						>
					</button>
				{/if}

				<p class="replay-disclaimer">{magneticStakeDerived.t('REPLAY DISCLAIMER')}</p>
			</div>
		{/if}
	</div>
{/if}

<style>
	.replay-hud {
		position: fixed;
		inset: 0;
		pointer-events: none;
		z-index: 80;
		color: #e8f5ff;
		font-family: 'Chakra Petch', 'Inter', sans-serif;
	}

	.replay-topbar {
		position: absolute;
		top: calc(12px + env(safe-area-inset-top, 0px));
		right: 12px;
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 10px;
		pointer-events: none;
	}

	.replay-topbar--hidden {
		display: none;
	}

	.replay-meta {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 8px;
		flex-wrap: wrap;
	}

	.replay-badge,
	.replay-chip {
		border-radius: 999px;
		border: 1px solid rgba(35, 145, 193, 0.58);
		background: rgba(12, 30, 59, 0.9);
		padding: 6px 10px;
		font-size: 10px;
		font-weight: 900;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.replay-badge {
		background: rgba(30, 76, 132, 0.94);
		color: #00fcff;
	}

	/* Percentages, not vw/vh: the HUD renders inside the CSS-scaled game container, so viewport
	   units do not map to what the player actually sees. */
	.replay-card {
		position: absolute;
		left: 50%;
		top: 50%;
		transform: translate(-50%, -50%);
		width: min(430px, 92%);
		max-height: 94%;
		overflow: auto;
		border-radius: 20px;
		border: 1px solid rgba(35, 145, 193, 0.62);
		background:
			linear-gradient(180deg, rgba(41, 67, 119, 0.97), rgba(8, 20, 45, 0.98)), rgba(8, 20, 45, 0.98);
		backdrop-filter: blur(14px);
		padding: 22px 22px 18px;
		pointer-events: auto;
		box-shadow:
			0 18px 44px rgba(0, 0, 0, 0.52),
			0 0 28px rgba(13, 137, 198, 0.2),
			inset 0 0 0 1px rgba(96, 165, 250, 0.12);
	}

	.replay-title {
		margin: 0 0 18px;
		text-align: center;
		font-size: 24px;
		font-weight: 900;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: #00fcff;
		text-shadow: 0 0 12px rgba(0, 252, 255, 0.4);
	}

	.replay-rows {
		display: grid;
		gap: 2px;
	}

	.replay-row {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 12px;
		padding: 7px 10px;
		border-radius: 10px;
		min-width: 0;
	}

	.replay-row--total {
		background: rgba(78, 120, 184, 0.18);
	}

	/* The shared keys mix conventions (MODE is uppercase, 'Base Bet' is title case) — normalise
	   here so the card reads consistently without forking the i18n strings. */
	.replay-row span {
		font-size: 12px;
		font-weight: 700;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: rgba(207, 224, 245, 0.8);
	}

	.replay-row strong {
		--replay-value-base-size: 16px;
		font-size: calc(var(--replay-value-base-size) * var(--replay-value-scale, 1));
		line-height: 1.15;
		letter-spacing: var(--replay-value-letter-spacing, 0);
		font-weight: 900;
		color: #ffffff;
		white-space: nowrap;
		text-align: right;
		min-width: 0;
	}

	.replay-amount {
		color: #f5c84f !important;
	}

	.replay-rule {
		height: 1px;
		margin: 8px 10px;
		border: none;
		background: rgba(35, 145, 193, 0.34);
	}

	.replay-win {
		color: #00fcff !important;
	}

	.replay-primary {
		width: 100%;
		margin-top: 20px;
		border: none;
		border-radius: 999px;
		padding: 14px 16px;
		background: linear-gradient(180deg, #00fcff 0%, #2391c1 100%);
		color: #061426;
		font-size: 15px;
		font-weight: 900;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		cursor: pointer;
		box-shadow: 0 0 18px rgba(0, 252, 255, 0.26);
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
	}

	.replay-play-icon {
		font-size: 15px;
		line-height: 1;
	}

	.replay-disclaimer {
		margin: 14px 0 0;
		text-align: center;
		font-size: 11px;
		line-height: 1.45;
		color: rgba(207, 224, 245, 0.64);
	}

	.replay-error-block {
		margin-top: 16px;
		display: grid;
		gap: 8px;
	}

	.replay-error-block p {
		margin: 0;
		color: #ffd2d2;
		font-size: 12px;
		line-height: 1.45;
		word-break: break-word;
	}

	@media (max-width: 720px) {
		.replay-topbar {
			top: calc(10px + env(safe-area-inset-top, 0px));
			right: 10px;
			gap: 8px;
		}

		.replay-meta {
			max-width: 68%;
			justify-content: flex-end;
		}
	}

	@media (max-width: 540px), (orientation: portrait) and (max-width: 768px) {
		.replay-topbar {
			align-items: flex-start;
		}

		.replay-card {
			width: min(430px, 94%);
			padding: 18px 16px 14px;
		}

		.replay-title {
			font-size: 20px;
			margin-bottom: 14px;
		}

		.replay-row {
			padding: 6px 8px;
		}

		.replay-row span {
			font-size: 12px;
		}

		.replay-row strong {
			--replay-value-base-size: 15px;
		}

		.replay-primary {
			margin-top: 16px;
			padding: 12px 14px;
			font-size: 13px;
		}

		.replay-badge,
		.replay-chip {
			padding: 5px 9px;
			font-size: 9px;
		}
	}

	/* Short popout windows (Stake's "Popout S" and similar). The card must fit without an inner
	   scrollbar — a summary you have to scroll is what made the old bottom bar unreadable. */
	@media (max-height: 620px) {
		.replay-card {
			padding: 14px 16px 12px;
		}

		.replay-title {
			font-size: 18px;
			margin-bottom: 10px;
		}

		.replay-row {
			padding: 4px 8px;
		}

		.replay-row span {
			font-size: 11px;
		}

		.replay-row strong {
			--replay-value-base-size: 14px;
		}

		.replay-rule {
			margin: 5px 8px;
		}

		.replay-primary {
			margin-top: 12px;
			padding: 10px 14px;
			font-size: 13px;
		}

		.replay-disclaimer {
			margin-top: 9px;
			font-size: 10px;
		}
	}

	@media (max-height: 440px) {
		.replay-card {
			width: min(430px, 96%);
			padding: 10px 12px 9px;
			border-radius: 14px;
		}

		.replay-title {
			font-size: 15px;
			margin-bottom: 7px;
		}

		.replay-row {
			padding: 2px 7px;
		}

		.replay-row span {
			font-size: 10px;
			letter-spacing: 0.03em;
		}

		.replay-row strong {
			--replay-value-base-size: 12px;
		}

		.replay-rule {
			margin: 3px 7px;
		}

		.replay-primary {
			margin-top: 8px;
			padding: 8px 12px;
			font-size: 11px;
		}

		.replay-disclaimer {
			margin-top: 6px;
			font-size: 9px;
			line-height: 1.35;
		}
	}
</style>
