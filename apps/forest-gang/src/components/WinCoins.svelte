<script lang="ts">
	import { untrack } from 'svelte';
	import { Container, ParticleEmitter } from 'pixi-svelte';
	import { MainContainer } from 'components-layout';
	import { fountain as baseConfig } from 'constants-shared/particleConfig';
	import { LEVEL_PARTICLE_COIN_MAP } from 'constants-shared/particleCoin';

	import { getContext } from '../game/context';
	import type { WinLevelAlias } from '../game/winLevelMap';

	type Props = {
		emit?: boolean;
		levelAlias?: WinLevelAlias;
		boardMode?: boolean;
	};

	const props: Props = $props();
	const context = getContext();
	const bs = $derived(context.stateGameDerived.boardLayout().boardScale);
	const boardH = $derived(
		context.stateGameDerived.boardLayout().height *
		context.stateGameDerived.boardLayout().boardScale * 0.5,
	);

	// Each slot is one ParticleEmitter instance. When the tier changes, old slots keep
	// emit=false so in-flight particles coast to their natural end (lifetime.max = 6s),
	// while a new slot starts emitting the upgraded config — no restart flash.
	type Slot = { id: number; config: object; active: boolean };
	let slots = $state<Slot[]>([]);
	let nextId = 0;
	const PARTICLE_LIFETIME_MS = 7000; // fountain lifetime.max is 6s; add 1s buffer

	$effect(() => {
		const alias = props.levelAlias; // tracked — re-runs when tier changes
		const emitting = props.emit;    // tracked — re-runs when win starts/ends

		untrack(() => {
			// Collect IDs being deactivated so the cleanup timeout knows what to remove.
			const deactivatedIds = new Set(slots.map(s => s.id));
			const prevSlots = slots.map(s => ({ ...s, active: false }));

			if (deactivatedIds.size > 0) {
				setTimeout(() => {
					slots = slots.filter(s => !deactivatedIds.has(s.id));
				}, PARTICLE_LIFETIME_MS);
			}

			if (!emitting || !alias) {
				slots = prevSlots;
				return;
			}

			const tierExtra = LEVEL_PARTICLE_COIN_MAP[alias];
			if (!tierExtra) {
				slots = prevSlots;
				return;
			}

			const slotConfig = {
				...baseConfig,
				...tierExtra,
				spawnRect: props.boardMode
					? { x: -(bs * 280), y: -boardH * 0.55, w: bs * 560, h: bs * 20 }
					: { x: -(bs * 300), y: -(bs * 250), w: bs * 600, h: bs * 50 },
			};

			slots = [...prevSlots, { id: nextId++, config: slotConfig, active: true }];
		});
	});
</script>

{#if slots.length > 0}
	<MainContainer>
		<Container
			x={context.stateGameDerived.boardLayout().x}
			y={context.stateGameDerived.boardLayout().y}
		>
			{#each slots as slot (slot.id)}
				<ParticleEmitter config={slot.config} key="coins" emit={slot.active} />
			{/each}
		</Container>
	</MainContainer>
{/if}
