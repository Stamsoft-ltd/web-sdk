<script lang="ts">
	import { stateBet } from 'state-shared';

	import { getContext } from '../game/context';
	import { i18nDerived } from '../i18n/i18nDerived';
	import { templateStakeState } from '../state/templateStake.svelte';
	import { logDiagnostic } from '../utils/diagnostics';

	const context = getContext();

	const showRecovery = $derived(
		templateStakeState.pendingRoundDetected && templateStakeState.bootStatus === 'error',
	);

	const retryResume = () => {
		if (!stateBet.betToResume?.active) return;
		if (stateBet.betToResume.mode) {
			stateBet.activeBetModeKey = stateBet.betToResume.mode;
		}
		templateStakeState.bootStatus = 'booting';
		templateStakeState.bootError = '';
		logDiagnostic('warn', 'pending_round_retry', {
			mode: stateBet.betToResume.mode,
		});
		context.eventEmitter.broadcast({ type: 'resumeBet' });
	};
</script>

{#if showRecovery}
	<div class="recovery-overlay">
		<div class="recovery-card">
			<h2>{i18nDerived.recoveryTitle()}</h2>
			<p>{i18nDerived.recoveryBody()}</p>
			{#if templateStakeState.bootError}
				<p class="recovery-error">{templateStakeState.bootError}</p>
			{/if}
			<button type="button" onclick={retryResume}>{i18nDerived.retryResume()}</button>
		</div>
	</div>
{/if}

<style>
	/* Same neon language as the other popups (Figma 6094-4364). This one is a boot-failure notice
	   rather than a designed screen, so it keeps its own simple card sizing and only adopts the
	   palette, scrim and button treatment. */
	.recovery-overlay {
		position: fixed;
		inset: 0;
		z-index: 70;
		display: grid;
		place-items: center;
		padding: 20px;
		background: rgba(0, 0, 0, 0.7);
	}

	.recovery-card {
		width: min(480px, 100%);
		border-radius: 22px;
		padding: 26px 24px;
		background: linear-gradient(0deg, #1a0535 0%, #05010c 100%);
		border: 1px solid #d836fc;
		box-shadow: 0 20px 44px rgba(0, 0, 0, 0.55);
		color: #fff;
		font-family: Helvetica, Arial, sans-serif;
		text-align: center;
	}

	.recovery-card h2 {
		margin: 0 0 10px;
		font-size: 1.4rem;
		font-weight: 700;
		letter-spacing: 0.03em;
		text-transform: uppercase;
		background-image: linear-gradient(173.06deg, #d836fc 0%, #272fdd 100%);
		background-clip: text;
		-webkit-background-clip: text;
		color: transparent;
	}

	.recovery-card p {
		margin: 0 0 12px;
		line-height: 1.35;
		letter-spacing: 0.03em;
	}

	.recovery-error {
		color: #ff9ab5;
		word-break: break-word;
	}

	.recovery-card button {
		width: 100%;
		border: 1px solid #b65df3;
		border-radius: 12px;
		padding: 12px 24px;
		background-image: linear-gradient(167.38deg, #d836fc 0%, #272fdd 100%);
		filter: drop-shadow(0 4px 2px rgba(0, 0, 0, 0.25));
		color: #fff;
		font-family: Helvetica, Arial, sans-serif;
		font-size: 0.875rem;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		cursor: pointer;
		transition: filter 0.12s ease;
	}

	.recovery-card button:hover {
		filter: brightness(1.12) drop-shadow(0 4px 2px rgba(0, 0, 0, 0.25));
	}
</style>
