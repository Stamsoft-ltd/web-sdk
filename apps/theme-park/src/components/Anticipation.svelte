<script lang="ts">
	/**
	 * The marquee that lights up around a reel still spinning while the board waits on a scatter.
	 *
	 * It is the design's "expand" sign (Figma 7142:29286): a gold rail with a purple band and a run
	 * of bulbs, cut and measured by scripts/anticipation/build_anticipation.py. It replaced a neon
	 * concept — two lightning rails with an ornate cap top and bottom, and a bespoke chase of
	 * coloured dots drawn over it here (design ask, 2026-08-24). Nothing on this sign is bespoke now:
	 * the bulbs are lit by <WinCardLights>, the same component that lights every other marquee in the
	 * game, off the generated table.
	 *
	 * The sign is sized by the REEL — one column wide — and takes its height from the art's aspect
	 * rather than from the board, so the bulbs can never be drawn as ovals.
	 */
	import { onMount } from 'svelte';
	import { Container, Sprite, PIXI } from 'pixi-svelte';

	import type { Reel } from '../game/stateGame.svelte';
	import { CELL_W, BOARD_SIZES, BOARD_GRID_OFFSET_Y, getBoardCellCenterX } from '../game/constants';
	import {
		ANTICIPATION_ASPECT,
		ANTICIPATION_BULB,
		ANTICIPATION_BULBS,
		ANTICIPATION_PLACES,
	} from '../game/anticipationFrame';
	import { boardShake } from '../game/boardShake.svelte';
	import { getContext } from '../game/context';
	import WinCardLights from './WinCardLights.svelte';

	type Props = { reel: Reel; oncomplete: () => void };

	const props: Props = $props();
	const context = getContext();
	const board = $derived(context.stateGameDerived.boardLayout());

	const MAX_SCATTERS = 3;
	/** A shade proud of the reel, so the rail sits outside the symbols rather than over them. */
	const FRAME_WIDTH = CELL_W * 1.02;
	const FADE_IN_S = 0.18;
	const FADE_OUT_S = 0.24;
	/** The chase: fronts running at once, laps a second, and how far a dark bulb drops. */
	const CHASE_CYCLES = 3;
	const CHASE_SPEED = 0.5;
	const CHASE_FLOOR = 0.12;
	/**
	 * The bulbs are painted GOLD, so the light over them is white-hot at the core with the amber
	 * spilling out around it — amber on amber leaves a bulb looking exactly as it did unlit.
	 */
	const LIGHT = 0xffbe38;
	const LIGHT_CORE = 0xfff4d0;
	const SPILL = 1.35;

	let completed = false;
	const complete = () => {
		if (completed) return;
		completed = true;
		props.oncomplete();
	};

	/**
	 * Never START a tease the board has already settled. Checked at mount only — a sign that is
	 * already up is not cut when the cap arrives, because the third scatter usually lands on the reel
	 * before the last one and cutting there killed the last reel's marquee 150ms after it appeared.
	 * A live sign ends the ordinary way instead: its reel lands, and it fades out. See <Anticipations>.
	 */
	const stopAtScatterCap = () => {
		if (context.stateGame.scatterCounter < MAX_SCATTERS) return false;
		complete();
		return true;
	};

	let fading = $state<'in' | 'out'>('in');
	let alpha = $state(0);
	let time = $state(0);

	onMount(() => {
		if (context.stateGame.anticipationSkipped) {
			complete();
			return;
		}
		stopAtScatterCap();
	});

	$effect(() => {
		if (props.reel.reelState.motion === 'stopped') fading = 'out';
	});

	context.eventEmitter.subscribeOnMount({
		stopButtonClick: () => {
			context.stateGame.anticipationSkipped = true;
			fading = 'out';
		},
	});

	$effect(() => {
		const app = context.stateApp.pixiApplication;
		if (!app) return;

		const tick = () => {
			const dt = app.ticker.deltaMS / 1000;
			time += dt;
			if (fading === 'in') {
				alpha = Math.min(1, alpha + dt / FADE_IN_S);
			} else {
				alpha = Math.max(0, alpha - dt / FADE_OUT_S);
				if (alpha === 0) complete();
			}
		};

		app.ticker.add(tick, null, PIXI.UPDATE_PRIORITY.HIGH);
		return () => app.ticker.remove(tick, null);
	});

	/** The sign drops onto the reel rather than appearing on it. */
	const intro = $derived(Math.min(1, time / FADE_IN_S));
	const introEase = $derived(1 - Math.pow(1 - intro, 3));
	const frameWidth = $derived(FRAME_WIDTH * (0.97 + introEase * 0.03) * board.boardScale);
	const frameHeight = $derived(frameWidth / ANTICIPATION_ASPECT);
</script>

<Container
	x={board.x +
		(getBoardCellCenterX(props.reel.reelIndex) - BOARD_SIZES.width * 0.5) * board.boardScale +
		boardShake.x}
	y={board.y + BOARD_GRID_OFFSET_Y + boardShake.y}
	{alpha}
>
	<Sprite key="anticipationFrame" anchor={0.5} width={frameWidth} height={frameHeight} />
	<WinCardLights
		bulbs={ANTICIPATION_BULBS}
		places={ANTICIPATION_PLACES}
		size={frameWidth}
		bulb={ANTICIPATION_BULB}
		colour={LIGHT}
		coreColour={LIGHT_CORE}
		cycles={CHASE_CYCLES}
		speed={CHASE_SPEED}
		floor={CHASE_FLOOR}
		spill={SPILL}
		intensity={introEase}
		elapsed={time}
	/>
</Container>
