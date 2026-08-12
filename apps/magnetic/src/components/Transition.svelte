<script lang="ts" module>
	// `coins` is opt-in per broadcast because the SAME wipe runs in both directions: entering a
	// bonus (worth celebrating) and leaving it (a return to the base game, where a coin shower
	// reads as a second, phantom payout right after the total-win panel).
	export type EmitterEventTransition = { type: 'transition'; coins?: boolean };
</script>

<script lang="ts">
	import { Container, ParticleEmitter } from 'pixi-svelte';
	import { fountain as baseConfig } from 'constants-shared/particleConfig';
	import { waitForResolve } from 'utils-shared/wait';

	import TransitionAnimation from './TransitionAnimation.svelte';
	import { getContext } from '../game/context';

	const context = getContext();

	let transitioning = $state(false);
	let oncomplete = $state(() => {});

	// ── Coin eruption ──
	// The hand-off into a bonus — bought or triggered — used to be the wipe alone. It now erupts
	// coins across the FULL screen, not just over the board like the win fountain: this is the
	// moment the player has paid for (or waited for), and it wants the whole frame.
	//
	// The coins outlive the wipe on purpose. `emit` stops when the transition resolves, but the
	// layer stays mounted for one more arc so the last coins fall out of frame instead of being
	// deleted mid-air with the emitter.
	const COIN_TAIL_MS = 2600;
	let coinsMounted = $state(false);
	let coinsEmit = $state(false);
	let coinTimer = 0;

	const canvas = $derived(context.stateLayoutDerived.canvasSizes());

	// Coins RAIN rather than fountain: they spawn in a band above the top edge, spanning the whole
	// canvas width, and fall under gravity. `startRotation` is the launch direction in degrees with
	// +y downward, so 80-100 is straight down with just enough spread to break up the columns; the
	// speed spread gives near/far coins different fall rates, which is what stops a curtain of
	// identical drops.
	//
	// Speeds live in the emitter's own accelerated time base (ParticleEmitter advances by
	// deltaMS * emitSpeed), so they are tuned against the win fountain rather than derived from
	// real-world ballistics — at these values a coin clears a full screen height in ~2 of the
	// emitter's seconds, comfortably inside its lifetime.
	const config = $derived({
		...baseConfig,
		speed: { start: 280, end: 430, minimumSpeedMultiplier: 1 },
		acceleration: { x: 0, y: 340 },
		scale: { start: 0.34, end: 0.46, minimumScaleMultiplier: 1 },
		lifetime: { min: 3.2, max: 3.2 },
		frequency: 0.014,
		maxParticles: 240,
		startRotation: { min: 80, max: 100 },
		spawnRect: {
			x: -canvas.width * 0.5,
			y: -canvas.height * 0.5 - canvas.height * 0.12,
			w: canvas.width,
			h: canvas.height * 0.06,
		},
	});

	const stopCoins = () => {
		coinsEmit = false;
		clearTimeout(coinTimer);
		coinTimer = setTimeout(() => (coinsMounted = false), COIN_TAIL_MS) as unknown as number;
	};

	context.eventEmitter.subscribeOnMount({
		transition: async (emitterEvent) => {
			if (emitterEvent.coins) {
				clearTimeout(coinTimer);
				coinsMounted = true;
				coinsEmit = true;
			}
			transitioning = true;
			await waitForResolve((resolve) => (oncomplete = resolve));
		},
	});

	$effect(() => () => clearTimeout(coinTimer));
</script>

{#if coinsMounted}
	<Container x={canvas.width * 0.5} y={canvas.height * 0.5}>
		<ParticleEmitter {config} key="coins" emit={coinsEmit} />
	</Container>
{/if}

{#if transitioning}
	<TransitionAnimation
		oncomplete={() => {
			oncomplete();
			transitioning = false;
			stopCoins();
		}}
	/>
{/if}
