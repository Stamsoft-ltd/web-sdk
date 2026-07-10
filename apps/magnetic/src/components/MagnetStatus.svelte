<script lang="ts">
	const ap = (p: string) => `./${p.startsWith('/') ? p.slice(1) : p}`;
	import { getContext } from '../game/context';
	const context = getContext();
	const labels = {
		H1: 'Horseshoe',
		H2: 'Plasma Drill',
		H3: 'Core Cube',
		H4: 'EM Device',
		L1: 'Bolt',
		L2: 'Nut',
		L3: 'Washer',
		L4: 'Energy Screw',
	} as const;
	const target = $derived(context.stateGame.magnetTargetSymbol);
	const series = $derived(context.stateGame.activeSeries);
	const persistent = $derived(context.stateGame.persistentSeries);
	const totalMultiplier = $derived(context.stateGame.seriesTotalMultiplier || context.stateGame.globalMultiplier || 1);
	const totalLocked = $derived(series.reduce((sum, entry) => sum + entry.lockedPositions.length, 0));
	const targetLabel = $derived(target ? labels[target] : null);
	const hint = $derived(
		persistent
			? 'Target + cluster stay active for all 10 spins. Final super award pays at feature end.'
			: target
				? 'Only the selected target can join on respins. Extra magnets keep the same target.'
				: 'Locked natural clusters respin the rest of the grid until no new touching symbols join.',
	);
	const title = $derived(persistent ? 'SUPER SERIES' : target ? 'MAGNET SERIES' : 'CLUSTER SERIES');
	const visible = $derived(Boolean(target || series.length));
	const icon = ap('/assets/components/ui/magnet_win.png?v=20260709');
</script>

{#if visible}
	<div class="magnet-status">
		<div class="magnet-status__head">
			<img src={icon} alt="" />
			<span>{title}</span>
		</div>
		<div class="magnet-status__body">
			{#if targetLabel}<span>TARGET: {targetLabel}</span>{/if}
			<span>LOCKED: {totalLocked}</span>
			<span>MULT: {totalMultiplier}X</span>
			<span class="magnet-status__hint">{hint}</span>
		</div>
	</div>
{/if}

<style>
	.magnet-status {
		position: absolute;
		top: 1rem;
		left: 1rem;
		z-index: 12;
		padding: 0.75rem 0.9rem;
		border-radius: 0.9rem;
		background: rgba(10, 14, 10, 0.82);
		border: 1px solid rgba(246, 203, 82, 0.45);
		box-shadow: 0 10px 28px rgba(0, 0, 0, 0.35);
		color: #fff3bf;
		font-family: 'Cinzel', serif;
		min-width: 13rem;
	}
	.magnet-status__head {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		font-size: 0.82rem;
		margin-bottom: 0.5rem;
	}
	.magnet-status__head img { width: 1.35rem; height: 1.35rem; object-fit: contain; }
	.magnet-status__body {
		display: grid;
		gap: 0.22rem;
		font-size: 0.74rem;
		letter-spacing: 0.03em;
	}
	.magnet-status__hint {
		margin-top: 0.2rem;
		max-width: 18rem;
		line-height: 1.35;
		color: rgba(255, 245, 200, 0.88);
		letter-spacing: 0.015em;
	}
	@media (max-width: 900px) {
		.magnet-status {
			left: auto;
			right: 0.75rem;
			top: 0.75rem;
			min-width: 10.5rem;
			padding: 0.6rem 0.75rem;
		}
		.magnet-status__hint { max-width: 11rem; }
	}
</style>
