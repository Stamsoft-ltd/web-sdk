<script lang="ts">
	import { stateBet, stateUi } from 'state-shared';

	import { getContext } from '../../game/context';
	import { templateStakeDerived, templateStakeState } from '../../state/templateStake.svelte';
	import { logDiagnostic } from '../../utils/diagnostics';

	const context = getContext();

	const isReplayMode = $derived(stateUi.config.mode === 'replay');
	const layoutType = $derived(context.stateLayoutDerived.layoutType());
	const mobileUi = $derived(['portrait', 'landscape'].includes(layoutType));
	const selectedMode = $derived(templateStakeDerived.selectedModeLabel());
	const replayReady = $derived(Boolean(templateStakeState.replaySnapshot));
	const replayRunning = $derived(templateStakeState.replayRunning);
	const replayHasPlayed = $derived(templateStakeState.replayHasPlayed);
	const replayError = $derived(
		templateStakeState.bootStatus === 'error' ? templateStakeState.bootError : '',
	);
	const replayBetText = $derived(
		templateStakeDerived.formatWallet(templateStakeDerived.replayBetAmount()),
	);
	const replayCostText = $derived(
		templateStakeDerived.formatWallet(templateStakeDerived.replayCostAmount()),
	);
	const replayCostMultiplierText = $derived(`${templateStakeDerived.replayCostMultiplier()}x`);
	// Replay payout multipliers are supplied with at most two meaningful fractional digits. Keep the
	// display to that contract and let Number drop trailing zeros (50 -> "50x", not "50.00x").
	const replayPayoutMultiplierText = $derived(
		`${Number(templateStakeDerived.replayPayoutMultiplier().toFixed(2))}x`,
	);
	const replayWinText = $derived(
		templateStakeDerived.formatWin(templateStakeDerived.replayWinAmount()),
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
		if (!templateStakeState.replaySnapshot) return false;
		const snapshot = templateStakeDerived.cloneReplayBet(templateStakeState.replaySnapshot);
		if (!snapshot) return false;
		stateBet.betToResume = snapshot;
		return true;
	};

	const startReplay = () => {
		if (!templateStakeDerived.requestReplayStart() || !setReplayBetToResume()) return;
		context.eventEmitter.broadcast({ type: 'resumeBet' });
	};

	const replayAgain = () => {
		if (!templateStakeDerived.requestReplayStart() || !setReplayBetToResume()) return;
		logDiagnostic('info', 'replay_again_pressed', {
			eventId: templateStakeState.replayEventId,
		});
		context.eventEmitter.broadcast({ type: 'resumeBet' });
	};
</script>

{#if isReplayMode}
	<div class="replay-hud">
		<div class="replay-topbar">
			<div class="replay-meta">
				<span class="replay-badge">{templateStakeDerived.t('REPLAY')}</span>
				{#if selectedMode}
					<span class="replay-chip">{selectedMode}</span>
				{/if}
				{#if templateStakeState.replayEventId}
					<span class="replay-chip"
						>{templateStakeDerived.t('EVENT')} {templateStakeState.replayEventId}</span
					>
				{/if}
			</div>
		</div>

		<div class="replay-panel">
			<div class="replay-body">
				<div class="replay-stats">
					<div class="replay-stat">
						<span>{templateStakeDerived.t('BASE BET')}</span>
						<strong style={replayValueStyle(replayBetText)}>{replayBetText}</strong>
					</div>
					<div class="replay-stat">
						<span>{templateStakeDerived.t('TOTAL BET COST')}</span>
						<strong style={replayValueStyle(replayCostText)}>{replayCostText}</strong>
					</div>
					<div class="replay-stat">
						<span>{templateStakeDerived.t('COST MULTIPLIER')}</span>
						<strong>{replayCostMultiplierText}</strong>
					</div>
					<div class="replay-stat">
						<span>{templateStakeDerived.t('PAYOUT MULTIPLIER')}</span>
						<strong class="replay-win">{replayPayoutMultiplierText}</strong>
					</div>
					<div class="replay-stat">
						<span>{templateStakeDerived.t('TOTAL WIN')}</span>
						<strong class="replay-win" style={replayValueStyle(replayWinText)}
							>{replayWinText}</strong
						>
					</div>
				</div>

				<div class="replay-action">
					{#if replayError}
						<div class="replay-error-block">
							<p>{replayError}</p>
						</div>
					{:else if replayReady && !replayRunning}
						<button
							class="replay-primary"
							type="button"
							onclick={replayHasPlayed ? replayAgain : startReplay}
						>
							<span class="replay-play-icon">▶</span>
							<span
								>{replayHasPlayed
									? templateStakeDerived.t('REPLAY EVENT')
									: templateStakeDerived.t('START REPLAY')}</span
							>
						</button>
					{/if}
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	.replay-hud {
		/* Absolute, not fixed: the host scales/resizes .game-stage for popout previews. A fixed child
		   escapes that box and keeps desktop dimensions, which is why Popout S/L overflowed. */
		position: absolute;
		inset: 0;
		container-type: size;
		overflow: hidden;
		pointer-events: none;
		z-index: 80;
		color: #f9f1d2;
		font-family: 'Poppins', sans-serif;
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
		border: 1px solid rgba(231, 196, 112, 0.34);
		background: rgba(18, 23, 12, 0.82);
		padding: 6px 10px;
		font-size: 10px;
		font-weight: 900;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.replay-badge {
		background: rgba(80, 48, 16, 0.88);
	}

	.replay-panel {
		position: absolute;
		left: auto;
		right: 18px;
		top: auto;
		bottom: calc(18px + env(safe-area-inset-bottom, 0px));
		width: min(860px, calc(100% - 36px));
		max-width: calc(100% - 16px);
		max-height: calc(100% - 16px);
		max-height: none;
		box-sizing: border-box;
		border-radius: 18px;
		border: 1px solid rgba(231, 196, 112, 0.32);
		background:
			linear-gradient(180deg, rgba(57, 42, 16, 0.94), rgba(18, 23, 12, 0.94)),
			rgba(18, 23, 12, 0.96);
		backdrop-filter: blur(12px);
		padding: 10px;
		pointer-events: auto;
		box-shadow:
			0 14px 34px rgba(0, 0, 0, 0.36),
			inset 0 0 0 1px rgba(255, 235, 170, 0.06);
		overflow: hidden;
	}

	.replay-body {
		display: flex;
		align-items: stretch;
		gap: 10px;
	}

	.replay-stats {
		display: grid;
		grid-template-columns: repeat(5, minmax(0, 1fr));
		gap: 8px;
		flex: 1 1 auto;
		min-width: 0;
	}

	.replay-stat {
		display: grid;
		gap: 4px;
		border-radius: 12px;
		background: rgba(255, 255, 255, 0.05);
		padding: 8px 9px;
	}

	.replay-stat span {
		font-size: 9px;
		font-weight: 900;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: rgba(249, 241, 210, 0.72);
	}

	.replay-stat strong {
		--replay-value-base-size: 17px;
		font-size: calc(var(--replay-value-base-size) * var(--replay-value-scale, 1));
		line-height: 1.1;
		letter-spacing: var(--replay-value-letter-spacing, 0);
		color: #fff8df;
		white-space: nowrap;
		min-width: 0;
	}

	.replay-win {
		color: #20d878 !important;
	}

	.replay-action {
		display: flex;
		align-items: stretch;
		justify-content: center;
		flex: 0 0 160px;
	}

	.replay-primary {
		width: 100%;
		border: none;
		border-radius: 14px;
		padding: 10px 12px;
		background: linear-gradient(180deg, #f0d068 0%, #c09224 100%);
		color: #17200f;
		font-size: 13px;
		font-weight: 900;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		min-height: 62px;
	}

	.replay-play-icon {
		font-size: 16px;
		line-height: 1;
	}

	.replay-error-block {
		margin-top: 8px;
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

	/* Popout S/L are short landscape, not desktop. Keep the panel compact and let all five values plus
	   the action button fit in one readable two-row composition. */
	@container (orientation: landscape) and (max-height: 520px) {
		.replay-panel {
			right: 12px;
			bottom: calc(12px + env(safe-area-inset-bottom, 0px));
			width: min(760px, calc(100% - 32px));
			padding: 8px;
		}

		.replay-body {
			gap: 8px;
		}

		.replay-stats {
			grid-template-columns: repeat(3, minmax(0, 1fr));
			gap: 6px;
		}

		.replay-stat {
			padding: 6px 7px;
			gap: 2px;
		}

		.replay-stat span {
			font-size: 8px;
		}

		.replay-stat strong {
			--replay-value-base-size: 15px;
		}

		.replay-action {
			flex-basis: 132px;
		}

		.replay-primary {
			padding: 8px;
			font-size: 11px;
			min-height: 0;
		}
	}

	@container (max-width: 720px) {
		.replay-topbar {
			top: calc(10px + env(safe-area-inset-top, 0px));
			right: 10px;
			gap: 8px;
		}

		.replay-panel {
			left: auto;
			right: 10px;
			top: auto;
			bottom: calc(10px + env(safe-area-inset-bottom, 0px));
			width: min(760px, calc(100% - 20px));
			padding: 9px;
		}

		.replay-stats {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}

		.replay-action {
			flex-basis: 142px;
		}

		.replay-meta {
			max-width: 68%;
			justify-content: flex-end;
		}
	}

	@container (max-width: 540px), (orientation: portrait) and (max-width: 768px) {
		.replay-topbar {
			align-items: flex-start;
		}

		.replay-panel {
			left: 8px;
			right: 8px;
			top: auto;
			bottom: calc(8px + env(safe-area-inset-bottom, 0px));
			width: auto;
			padding: 7px 7px 6px;
		}

		.replay-body {
			display: grid;
			grid-template-columns: 1fr;
			gap: 6px;
		}

		.replay-stats {
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: 6px;
		}

		.replay-action {
			min-height: 52px;
		}

		.replay-stat {
			padding: 6px 7px;
		}

		.replay-stat span {
			font-size: 8px;
		}

		.replay-stat strong {
			--replay-value-base-size: 16px;
		}

		.replay-primary {
			padding: 8px 8px;
			font-size: 10px;
			min-height: 58px;
			flex-direction: column;
			gap: 4px;
		}

		.replay-badge,
		.replay-chip {
			padding: 5px 9px;
			font-size: 9px;
		}
	}

	/* Popout S can match the mobile-width breakpoint while still being landscape. Keep its compact
	   landscape composition; the portrait stack is too tall and pushes the panel above the viewport. */
	@container (orientation: landscape) and (max-width: 540px) {
		.replay-panel {
			left: 8px;
			right: 8px;
			bottom: calc(8px + env(safe-area-inset-bottom, 0px));
			width: auto;
			max-height: calc(100% - 16px);
			padding: 5px;
		}

		.replay-body {
			display: flex;
			gap: 4px;
		}

		.replay-stats {
			grid-template-columns: repeat(3, minmax(0, 1fr));
			gap: 3px;
		}

		.replay-stat {
			padding: 4px 5px;
			gap: 1px;
		}

		.replay-stat span {
			font-size: 6.5px;
			letter-spacing: 0.04em;
		}

		.replay-stat strong {
			--replay-value-base-size: 12px;
		}

		.replay-action {
			flex: 0 0 92px;
			min-height: 0;
		}

		.replay-primary {
			padding: 5px;
			font-size: 8px;
			gap: 3px;
			min-height: 40px;
		}

		.replay-play-icon {
			font-size: 11px;
		}
	}
</style>
