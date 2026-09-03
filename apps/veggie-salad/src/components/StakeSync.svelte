<script lang="ts">
	import { stateBet, stateModal, stateUi } from 'state-shared';

	import { getContext } from '../game/context';
	import { veggieStakeDerived, veggieStakeState } from '../state/veggieStake.svelte';

	const context = getContext();

	$effect(() => {
		if (
			veggieStakeDerived.isReplayMode() &&
			stateBet.betToResume &&
			!veggieStakeState.replaySnapshot
		)
			veggieStakeDerived.captureReplaySnapshot(stateBet.betToResume);
	});

	$effect(() => {
		veggieStakeState.pendingRoundDetected =
			stateUi.config.mode !== 'replay' && Boolean(stateBet.betToResume?.active);
	});

	$effect(() => veggieStakeDerived.syncReplayStatus(context.stateXstateDerived.isIdle()));
	$effect(() => veggieStakeDerived.syncModalError());
	$effect(() => {
		if (veggieStakeState.bootStatus === 'booting' && stateModal.modal?.name !== 'error')
			veggieStakeDerived.bootReady();
	});
</script>
