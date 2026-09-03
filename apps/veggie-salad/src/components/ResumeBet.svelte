<script lang="ts">
	import { stateBet, stateUi } from 'state-shared';
	import { getContext } from '../game/context';
	import { stateGame } from '../game/stateGame.svelte';
	import { onMount } from 'svelte';
	import BonusResumeModal from './BonusResumeModal.svelte';

	const context = getContext();
	let showModal = $state(false);
	const isBonusMode = (mode?: string) => ['BONUS', 'MYSTERY', 'SUPER'].includes(mode ?? '');
	const resume = () => {
		showModal = false;
		if (stateBet.betToResume?.mode) stateBet.activeBetModeKey = stateBet.betToResume.mode;
		context.eventEmitter.broadcast({ type: 'resumeBet' });
	};
	const end = () => {
		showModal = false;
		if (stateBet.betToResume?.mode) stateBet.activeBetModeKey = stateBet.betToResume.mode;
		stateGame.endRoundOnly = true;
		context.eventEmitter.broadcast({ type: 'resumeBet' });
	};

	onMount(() => {
		// Replay must wait for the explicit Start Replay action. StakeSync keeps an immutable copy.
		if (stateUi.config.mode === 'replay') return;
		if (!stateBet.betToResume?.active) return;
		if (isBonusMode(stateBet.betToResume.mode)) showModal = true;
		else resume();
	});
</script>

{#if showModal}
	<BonusResumeModal onPlay={resume} onEnd={end} />
{/if}
