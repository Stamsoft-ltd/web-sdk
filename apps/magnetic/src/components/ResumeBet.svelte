<script lang="ts">
	import { stateBet, stateUi, stateUrlDerived } from 'state-shared';
	import { requestEndRound } from 'rgs-requests';
	import { API_AMOUNT_MULTIPLIER } from 'constants-shared/bet';
	import { getContext } from '../game/context';
	import { onMount } from 'svelte';
	import { logMagneticDiagnostic } from '../utils/magneticDiagnostics';
	import BonusResumeModal from './BonusResumeModal.svelte';

	const context = getContext();

	let showModal = $state(false);
	let endingRound = $state(false);

	const isBonusMode = (mode?: string) => mode === 'SUPER' || mode === 'BONUS';

	const doResume = () => {
		showModal = false;
		if (stateBet.betToResume?.mode) {
			stateBet.activeBetModeKey = stateBet.betToResume.mode;
		}
		logMagneticDiagnostic('info', 'pending_round_resume', { mode: stateBet.betToResume?.mode });
		context.eventEmitter.broadcast({ type: 'resumeBet' });
	};

	const doEnd = async () => {
		if (endingRound) return;
		endingRound = true;
		logMagneticDiagnostic('info', 'pending_round_ended', { mode: stateBet.betToResume?.mode });
		try {
			const data = await requestEndRound({
				sessionID: stateUrlDerived.sessionID(),
				rgsUrl: stateUrlDerived.rgsUrl(),
			});
			if (data?.balance?.amount !== undefined) {
				stateBet.balanceAmount = data.balance.amount / API_AMOUNT_MULTIPLIER;
			}
		} catch (err) {
			console.error('[ResumeBet] end round failed', err);
		}
		stateBet.betToResume = null;
		showModal = false;
		endingRound = false;
	};

	onMount(() => {
		if (stateUi.config.mode === 'replay') {
			logMagneticDiagnostic('info', 'replay_waiting_for_start');
			return;
		}
		if (!stateBet.betToResume?.active) return;

		if (isBonusMode(stateBet.betToResume?.mode)) {
			// Show modal so player can choose to replay or end
			showModal = true;
		} else {
			// Non-bonus: auto-resume as before
			doResume();
		}
	});
</script>

{#if showModal}
	<BonusResumeModal onPlay={doResume} onEnd={doEnd} />
{/if}
