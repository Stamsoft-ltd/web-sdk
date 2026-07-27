<script lang="ts">
	import { stateBet, stateModal, stateUi } from 'state-shared';
	import { onMount } from 'svelte';

	import { getContext } from '../game/context';
	import { forestStakeDerived, forestStakeState } from '../state/forestStake.svelte';
	import { logForestDiagnostic } from '../utils/forestDiagnostics';

	const context = getContext();
	let lastPendingRoundMode = '';

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

		// Surface otherwise-silent promise rejections (e.g. the fire-and-forget end-event/end-round
		// RGS calls) to diagnostics instead of letting them vanish as unhandled rejections.
		const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
			logForestDiagnostic('error', 'unhandled_rejection', {
				reason: String((event.reason as { message?: string })?.message ?? event.reason),
			});
		};

		window.addEventListener('error', handleAssetError, true);
		window.addEventListener('unhandledrejection', handleUnhandledRejection);

		return () => {
			window.removeEventListener('error', handleAssetError, true);
			window.removeEventListener('unhandledrejection', handleUnhandledRejection);
		};
	});
</script>
