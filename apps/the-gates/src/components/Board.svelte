<script lang="ts">
	import { t } from '../i18n';
	import { runtime } from '../game/playback.svelte';
	import { presentedReward } from '../game/rewardDelivery';
	import { posKey } from '../game/contract';
	import { artTier } from '../game/art';
	import { stateBet } from 'state-shared';
	import { formatExactWinAmount as formatWinAmount } from 'utils-shared/currency';
	import { useGpu } from '../game/gpuContext';
	import type { createGpuBoard } from '../game/gpuBoard';
	let { paused = false, mobile = false }: { paused?: boolean; mobile?: boolean } = $props();
	const gpu = useGpu();
	let host = $state<HTMLElement>(),
		ready = $state(false);
	let renderer = $state.raw<ReturnType<typeof createGpuBoard>>();
	$effect(() => {
		const engine = gpu.engine,
			element = host;
		if (!engine || !element) return;
		let dead = false,
			owned: ReturnType<typeof createGpuBoard> | undefined;
		void import('../game/gpuBoard')
			.then(({ createGpuBoard }) => {
				if (dead) return;
				owned = createGpuBoard(
					engine,
					element,
					(value) => {
						ready = value;
					},
					(error) => {
						gpu.error = String(error);
					},
				);
				renderer = owned;
			})
			.catch((error) => {
				if (!dead) gpu.error = String(error);
			});
		const observer = new ResizeObserver(() => {
			owned?.resize();
		});
		observer.observe(element);
		return () => {
			dead = true;
			observer.disconnect();
			owned?.destroy();
			renderer = undefined;
		};
	});
	$effect(() => {
		const target = renderer;
		if (!target) return;
		const shown = presentedReward(runtime.game, runtime.rewardDelivery);
		target.update({
			scatterCelebration: runtime.scatterCelebration
				? { ...runtime.scatterCelebration, keys: [...runtime.scatterCelebration.keys] }
				: null,
			wins: $state.snapshot(runtime.game.wins),
			multiplier: shown.multiplier,
			multiplierActive: shown.multiplierActive,
			formatAmount: (amount: number) =>
				formatWinAmount(stateBet.currency, (stateBet.wageredBetAmount * amount) / 100),
			board: $state.snapshot(shown.board),
			offsets: $state.snapshot(runtime.game.fallOffsets),
			sticky: shown.sticky.map(posKey),
			winning: runtime.game.wins.flatMap((w) => w.positions.map(posKey)),
			removed: runtime.removed.map(posKey),
			phase: runtime.phase,
			wave: { ...runtime.wave },
			startedAt: runtime.waveStartedAt,
			roundId: runtime.roundId,
			revealId: runtime.game.revealId,
			palette: artTier(
				runtime.sceneTierOverride ? runtime.sceneTierOverride.tier : runtime.game.tier,
			),
			reduced: runtime.reduced,
			paused: paused || (gpu.presenting && !runtime.scatterCelebration),
			mobile,
		});
	});
</script>

<!-- One layout/accessibility host only. Frame, reels, pads and symbols are Pixi nodes. -->
<div
	class="gpu-board-host"
	bind:this={host}
	role="img"
	aria-label={t('BOARD DESCRIPTION')}
	aria-busy={!ready}
	data-testid="board"
	data-phase={runtime.phase}
	data-renderer={ready ? 'pixi-webgl' : 'loading'}
	data-gpu-tiles={ready ? 30 : 0}
></div>

<style>
	.gpu-board-host {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
	}
</style>
