<script lang="ts">
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
		winMult?: number;
	};

	type Slot = {
		id: number;
		key: string;
		config: object;
		active: boolean;
		lifetimeMs: number;
		deactivatedAt: number;
	};

	const props: Props = $props();
	const context = getContext();
	const board = $derived(context.stateGameDerived.boardLayout());
	const extraConfig = $derived(props.levelAlias ? LEVEL_PARTICLE_COIN_MAP[props.levelAlias] : null);

	const TIERS: Record<string, { max: number; freq: number }> = {
		max: { max: 76, freq: 0.012 },
		legendary: { max: 48, freq: 0.018 },
		mythic: { max: 31, freq: 0.024 },
		epic: { max: 20, freq: 0.03 },
		wild: { max: 13, freq: 0.04 },
		sweet: { max: 7, freq: 0.05 },
		medium: { max: 4, freq: 0.06 },
		small: { max: 2, freq: 0.08 },
	};

	const tierKey = $derived.by(() => {
		const m = props.winMult ?? 0;
		if (m >= 25000) return 'max';
		if (m >= 500) return 'legendary';
		if (m >= 200) return 'mythic';
		if (m >= 100) return 'epic';
		if (m >= 50) return 'wild';
		if (m >= 20) return 'sweet';
		if (m >= 5) return 'medium';
		return 'small';
	});

	const intensity = $derived(TIERS[tierKey]);
	const emitterConfig = $derived(
		extraConfig
			? {
				...baseConfig,
				...extraConfig,
				alpha: { start: 1, end: 1 },
				scale: { start: 0.44, end: 0.38, minimumScaleMultiplier: 1 },
				speed: { start: 1000, end: 1500, minimumSpeedMultiplier: 0.7 },
				acceleration: { x: 0, y: 1250 },
				startRotation: { min: 242, max: 298 },
				noRotation: false,
				rotationSpeed: { min: -35, max: 35 },
				lifetime: { min: 2.2, max: 3.0 },
				frequency: intensity.freq,
				maxParticles: intensity.max,
				spawnType: 'rect',
				spawnRect: { x: -70, y: 0, w: 140, h: 8 },
			}
			: null,
	);

	const activeKey = $derived(`${props.levelAlias ?? 'none'}:${tierKey}:${props.boardMode ? 'board' : 'screen'}`);

	let slots = $state<Slot[]>([]);
	let nextId = 0;

	$effect(() => {
		const emitting = !!props.emit;
		const config = emitterConfig;
		const key = activeKey;

		untrack(() => {
			const now = Date.now();

			if (!emitting || !config) {
				slots = slots.map((slot) => slot.active ? { ...slot, active: false, deactivatedAt: now } : slot);
				return;
			}

			const lifetimeMs = (((config as { lifetime?: { max?: number } }).lifetime?.max ?? 3.0) * 1000);
			const kept = slots.filter((slot) => slot.active || (now - slot.deactivatedAt) < slot.lifetimeMs + 200);
			const currentActive = [...kept].reverse().find((slot) => slot.active);

			if (currentActive?.key === key) {
				slots = kept;
				return;
			}

			const deactivated = kept.map((slot) => slot.active ? { ...slot, active: false, deactivatedAt: now } : slot);
			slots = [
				...deactivated,
				{ id: nextId++, key, config, active: true, lifetimeMs, deactivatedAt: 0 },
			];
		});
	});
</script>

<MainContainer>
	<Container x={board.x} y={board.y}>
		{#each slots as slot (slot.id)}
			<ParticleEmitter config={slot.config} key={`coins-${slot.id}`} emit={slot.active} />
		{/each}
	</Container>
</MainContainer>
