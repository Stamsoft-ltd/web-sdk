<script lang="ts">
	import { stateBet, stateConfig, stateModal, stateUi } from 'state-shared';
	import { onMount } from 'svelte';

	import { getContext } from '../game/context';
	import { forestStakeDerived, forestStakeState } from '../state/forestStake.svelte';
	import { logForestDiagnostic } from '../utils/forestDiagnostics';

	const context = getContext();
	let lastPendingRoundMode = '';

	// Forest Gang bet ladder (currency units) — overrides the shared default for this game only.
	const FOREST_BET_OPTIONS = [
		0.1, 0.2, 0.4, 0.6, 0.8, 1, 1.2, 1.4, 1.6, 1.8, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14, 16, 18,
		20, 30, 40, 50, 75, 100, 150, 200, 250, 300, 350, 400, 450, 500, 750, 1000,
	];
	stateConfig.betAmountOptions = FOREST_BET_OPTIONS;
	stateConfig.betMenuOptions = FOREST_BET_OPTIONS;

	$effect(() => {
		if (stateUi.config.mode === 'replay' && stateBet.betToResume && !forestStakeState.replaySnapshot) {
			forestStakeDerived.captureReplaySnapshot(stateBet.betToResume);
		}
	});

	$effect(() => {
		forestStakeState.pendingRoundDetected =
			stateUi.config.mode !== 'replay' && Boolean(stateBet.betToResume?.active);
	});

	$effect(() => {
		if (!forestStakeState.pendingRoundDetected) return;
		const nextMode = String(stateBet.betToResume?.mode || '');
		if (lastPendingRoundMode === nextMode) return;
		lastPendingRoundMode = nextMode;
		logForestDiagnostic('info', 'pending_round_detected', {
			mode: nextMode,
		});
	});

	$effect(() => {
		forestStakeDerived.syncReplayStatus({ idle: context.stateXstateDerived.isIdle() });
	});

	$effect(() => {
		forestStakeDerived.syncModalError();
	});

	$effect(() => {
		if (forestStakeState.bootStatus === 'booting' && stateModal.modal?.name !== 'error') {
			forestStakeDerived.bootReady();
		}
	});

	onMount(() => {
		const handleAssetError = (event: Event) => {
			const target = event.target as HTMLImageElement | HTMLScriptElement | HTMLLinkElement | null;
			if (!target) return;
			const source =
				'src' in target && target.src
					? target.src
					: 'href' in target && target.href
						? target.href
						: '';
			if (!source) return;
			logForestDiagnostic('error', 'asset_load_failure', {
				source,
				tagName: target.tagName,
			});
		};

		window.addEventListener('error', handleAssetError, true);

		return () => window.removeEventListener('error', handleAssetError, true);
	});
</script>
