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
		// Final win multiplier (× bet) — drives the coin count so it scales with the win the player
		// actually sees (same thresholds as the board tiers), independent of the backend win level.
		winMult?: number;
	};

	const props: Props = $props();
	const context = getContext();
	// Fountain origin = centre of the slot board, so the coins spring up from the middle of the reels.
	const board = $derived(context.stateGameDerived.boardLayout());
	const extraConfig = $derived(
		props?.levelAlias ? LEVEL_PARTICLE_COIN_MAP[props.levelAlias] : null,
	);

	// Coin count by win multiplier (× bet), matching the board tiers. `freq` (seconds between spawns)
	// is low enough that each tier actually fills to `max` concurrent coins, so `max` is what you SEE.
	//   <20 tiny · 20 SWEET · 50 WILD · 100 EPIC · 200 MYTHIC · 500 LEGENDARY · 1000+ MAX
	const TIERS: Record<string, { max: number; freq: number }> = {
		max: { max: 76, freq: 0.012 }, // MAX WIN — densest of all
		legendary: { max: 48, freq: 0.018 },
		mythic: { max: 31, freq: 0.024 },
		epic: { max: 20, freq: 0.03 },
		wild: { max: 13, freq: 0.04 },
		sweet: { max: 7, freq: 0.05 }, // very small
		medium: { max: 4, freq: 0.06 },
		small: { max: 2, freq: 0.08 },
	};
	// winMult is the LIVE count-up multiplier, so the fountain grows as the win climbs tiers. Reduce
	// it to a discrete tier key first so the emitter only re-inits when the tier actually changes
	// (not every frame of the count-up).
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

	// Gold P-coin FOUNTAIN (coin cutouts from the Magnific rain video, tumbling through 12 angles):
	// coins erupt from a focused point at the bottom-centre, spray upward in a fanned plume (varied
	// speeds → varied heights → fountain shape), tumble, and cascade back down under gravity.
	// Because it erupts from one point it reads as an intentional fountain, not a scattered storm.
	// The base/level configs are spread first; the V1 keys below are overridden last so they always
	// win (upgradeConfig reads them).
	const config = $derived({
		...baseConfig,
		...extraConfig,
		alpha: { start: 1, end: 1 },
		// p_coin frames are 176px (the old SD2 coin was ~228) — scaled up to render the same size
		scale: { start: 0.57, end: 0.49, minimumScaleMultiplier: 1 },
		// strong upward burst with a wide speed range so the plume has depth (near + far coins)
		speed: { start: 1000, end: 1500, minimumSpeedMultiplier: 0.7 },
		// strong gravity pulls the plume back down into a fountain arc
		acceleration: { x: 0, y: 1250 },
		// emit around straight-up (270°) with a fan so coins spray outward as they rise
		startRotation: { min: 242, max: 298 },
		// gentle tumble — the frame cycle already flips the coin face
		noRotation: false,
		rotationSpeed: { min: -35, max: 35 },
		lifetime: { min: 2.2, max: 3.0 },
		// count/density scale with the win level (see INTENSITY above)
		frequency: intensity.freq,
		maxParticles: intensity.max,
		spawnType: 'rect',
		// narrow origin at the bottom-centre → the coins all launch from one spot
		spawnRect: { x: -70, y: 0, w: 140, h: 8 },
	});
</script>

<MainContainer>
	<!-- Emitter pinned to the centre of the slot board; coins spring up from the middle. -->
	<Container x={board.x} y={board.y}>
		<ParticleEmitter {config} key="pCoins" emit={props.emit} />
	</Container>
</MainContainer>
