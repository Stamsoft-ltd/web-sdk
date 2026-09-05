<script lang="ts">
	import { untrack } from 'svelte';
	import { stateBet, stateUi } from 'state-shared';

	import { getContext } from '../../game/context';
	import { stateReplayViewport } from '../../game/replayViewport.svelte';
	import { templateStakeDerived, templateStakeState } from '../../state/templateStake.svelte';
	import { logDiagnostic } from '../../utils/diagnostics';

	const context = getContext();

	// Air left between the panel's top edge and the board's bottom rail.
	const REPLAY_PANEL_CLEARANCE = 8;
	// Ceiling on the band the panel may claim, as a share of the viewport height.
	const MAX_RESERVE_FRACTION = 0.42;

	let panelEl = $state<HTMLDivElement | null>(null);

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

	// Publish the band this panel occupies so boardLayout() can hold the reels off it. Replay renders
	// no control bar, so without this the board keeps its full play-mode size and the panel lands on
	// top of the bottom reel row — which is exactly what it did, invisibly to every check that only
	// asked whether the panel stayed inside the window. See game/replayViewport.svelte.ts.
	//
	// Measured, not derived: the height depends on the container breakpoint, the translated labels and
	// the currency string. Nothing here feeds back into the panel's own size (its width comes from the
	// stage, its height from its content), so observing it cannot loop.
	$effect(() => {
		const el = panelEl;
		if (!el) {
			untrack(() => (stateReplayViewport.bottomReservePx = 0));
			return;
		}
		// untrack, and not as a nicety: boardLayout() reads this number, so publishing it re-renders the
		// stage — and reading it back to compare would make this effect depend on its own write. It does
		// not settle. The page froze on the first measurement, which is the same failure mode as R-10's
		// latched fitter: what you measure must not be produced by the measurement.
		const measure = () =>
			untrack(() => {
				const rect = el.getBoundingClientRect();
				// A panel that is hidden or has not been laid out yet reports an all-zero rect. Reading
				// `top: 0` as "the panel starts at the top of the window" reserves the entire viewport and
				// collapses the board to a sliver — no measurement has to mean no reservation, not a
				// reservation of everything.
				const next =
					rect.height > 0
						? Math.min(
								// Backstop: nothing the panel can report may cost the board more than this. A
								// reservation is a claim on the play area, so it needs a ceiling that does not
								// depend on the panel being sane.
								window.innerHeight * MAX_RESERVE_FRACTION,
								Math.max(0, window.innerHeight - rect.top + REPLAY_PANEL_CLEARANCE),
							)
						: 0;
				if (Math.abs(next - stateReplayViewport.bottomReservePx) > 0.5)
					stateReplayViewport.bottomReservePx = next;
			});
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(el);
		window.addEventListener('resize', measure);
		return () => {
			observer.disconnect();
			window.removeEventListener('resize', measure);
			stateReplayViewport.bottomReservePx = 0;
		};
	});
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

		<div class="replay-panel" bind:this={panelEl}>
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
		/* The height lives on this slot, never on the button. The button is unmounted while the replay
		   is playing, and the panel's height is what the board reserves — a panel that shrank the
		   moment you pressed play would resize the board out from under the spinning reels. */
		min-height: 56px;
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
		min-height: 0;
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

	/* Order matters below: these blocks overlap, so the LAST matching one wins. Popout is authored
	   last on purpose — it is landscape at a width the narrow and portrait rules also match, and it
	   was those later rules that used to win and stack it into a 111px-tall two-row card. */

	/* Desktop shrinking towards tablet width: three columns instead of five. */
	@container (max-width: 720px) and (min-height: 561px) {
		.replay-topbar {
			top: calc(10px + env(safe-area-inset-top, 0px));
			right: 10px;
			gap: 8px;
		}

		.replay-panel {
			right: 10px;
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

	/* Phone portrait: the panel spans the full width and the button drops below the stats. */
	@container (orientation: portrait) {
		.replay-topbar {
			align-items: flex-start;
		}

		.replay-panel {
			left: 8px;
			right: 8px;
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
			grid-template-columns: repeat(3, minmax(0, 1fr));
			gap: 5px;
		}

		.replay-stat {
			padding: 5px 6px;
		}

		.replay-stat span {
			font-size: 7.5px;
		}

		.replay-stat strong {
			--replay-value-base-size: 14px;
		}

		/* Fixed, and matched by the button rather than the other way round — see .replay-action. */
		.replay-action {
			flex: none;
			min-height: 44px;
		}

		.replay-primary {
			padding: 6px;
			font-size: 10px;
			gap: 5px;
			flex-direction: row;
		}

		.replay-badge,
		.replay-chip {
			padding: 5px 9px;
			font-size: 9px;
		}
	}

	/* Popout S/L: short landscape, whatever its width. All five values and the button belong on ONE
	   row here — the band this costs is what the board gives up, so every extra row of panel is a reel
	   row the player loses. */
	@container (orientation: landscape) and (max-height: 560px) {
		.replay-topbar {
			top: calc(8px + env(safe-area-inset-top, 0px));
			right: 8px;
			gap: 6px;
		}

		.replay-badge,
		.replay-chip {
			padding: 4px 8px;
			font-size: 8px;
		}

		.replay-panel {
			left: 8px;
			right: 8px;
			bottom: calc(8px + env(safe-area-inset-bottom, 0px));
			width: auto;
			border-radius: 12px;
			padding: 6px;
		}

		.replay-body {
			display: flex;
			gap: 5px;
		}

		.replay-stats {
			grid-template-columns: repeat(5, minmax(0, 1fr));
			gap: 4px;
		}

		.replay-stat {
			padding: 4px 5px;
			gap: 1px;
		}

		.replay-stat span {
			font-size: 7px;
			letter-spacing: 0.03em;
		}

		.replay-stat strong {
			--replay-value-base-size: 13px;
		}

		.replay-action {
			flex: 0 0 104px;
			min-height: 0;
		}

		.replay-primary {
			padding: 4px 6px;
			font-size: 9px;
			gap: 4px;
		}

		.replay-play-icon {
			font-size: 11px;
		}
	}
</style>
