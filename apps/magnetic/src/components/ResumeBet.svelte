<script lang="ts">
	import { stateBet, stateUi } from 'state-shared';
	import { getContext } from '../game/context';
	import { onMount } from 'svelte';
	import { logMagneticDiagnostic } from '../utils/magneticDiagnostics';
	import { stateGame } from '../game/stateGame.svelte';
	import BonusResumeModal from './BonusResumeModal.svelte';

	const context = getContext();

	let showModal = $state(false);

	const isBonusMode = (mode?: string) => mode === 'SUPER' || mode === 'BONUS';

	const doResume = () => {
		showModal = false;
		if (stateBet.betToResume?.mode) {
			stateBet.activeBetModeKey = stateBet.betToResume.mode;
		}
		logMagneticDiagnostic('info', 'pending_round_resume', { mode: stateBet.betToResume?.mode });
		context.eventEmitter.broadcast({ type: 'resumeBet' });
	};

	const doEnd = () => {
		showModal = false;
		if (stateBet.betToResume?.mode) {
			stateBet.activeBetModeKey = stateBet.betToResume.mode;
		}
		logMagneticDiagnostic('info', 'pending_round_ended', { mode: stateBet.betToResume?.mode });
		// Route the end THROUGH the xstate machine: RESUME_BET → play (skipped via endRoundOnly) →
		// endGame, which calls requestEndRound and credits the balance. Ending the round outside the
		// machine (a direct requestEndRound) leaves the machine holding the round, so the next play
		// errors with "play has active round".
		stateGame.endRoundOnly = true;
		context.eventEmitter.broadcast({ type: 'resumeBet' });
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
