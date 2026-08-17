<script lang="ts">
	import { onMount } from 'svelte';
	import { Container, Graphics, Sprite, PIXI } from 'pixi-svelte';

	import type { Reel } from '../game/stateGame.svelte';
	import { CELL_W, BOARD_SIZES, BOARD_GRID_OFFSET_Y, getBoardCellCenterX } from '../game/constants';
	import { getContext } from '../game/context';

	type Props = { reel: Reel; oncomplete: () => void };
	type Point = { x: number; y: number };

	const props: Props = $props();
	const context = getContext();
	const board = $derived(context.stateGameDerived.boardLayout());

	const MAX_SCATTERS = 3;
	const FRAME_WIDTH = CELL_W * 1.02;
	const FRAME_HEIGHT = BOARD_SIZES.height * 1.015;
	const FADE_IN_S = 0.18;
	const FADE_OUT_S = 0.24;
	const PULSE_HZ = 0.28;
	const CHASE_SPEED = 0.075;
	const CHASE_COLOURS = [0x39ddff, 0xff4cdd, 0xffbe38, 0xffffff];

	let completed = false;
	const complete = () => {
		if (completed) return;
		completed = true;
		props.oncomplete();
	};

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
			props.reel.forceStop();
			complete();
			return;
		}
		stopAtScatterCap();
	});

	$effect(() => {
		if (stopAtScatterCap()) return;
		if (props.reel.reelState.motion === 'stopped') fading = 'out';
	});

	context.eventEmitter.subscribeOnMount({
		stopButtonClick: () => {
			context.stateGame.anticipationSkipped = true;
			props.reel.forceStop();
			complete();
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

	const pulse = $derived(0.5 + 0.5 * Math.sin(time * Math.PI * 2 * PULSE_HZ));
	const intro = $derived(Math.min(1, time / FADE_IN_S));
	const introEase = $derived(1 - Math.pow(1 - intro, 3));
	const baseHeight = $derived(FRAME_HEIGHT * (0.94 + introEase * 0.06));
	const glowWidth = $derived(FRAME_WIDTH * (1.012 + pulse * 0.016));
	const glowHeight = $derived(baseHeight * (1.006 + pulse * 0.01));
	const glowAlpha = $derived(0.08 + pulse * 0.14);

	const pointOnPerimeter = (progress: number): Point => {
		const left = -FRAME_WIDTH * 0.46;
		const right = FRAME_WIDTH * 0.46;
		const top = -FRAME_HEIGHT * 0.465;
		const bottom = FRAME_HEIGHT * 0.465;
		const width = right - left;
		const height = bottom - top;
		const total = 2 * (width + height);
		let distance = (((progress % 1) + 1) % 1) * total;

		if (distance <= width) return { x: left + distance, y: top };
		distance -= width;
		if (distance <= height) return { x: right, y: top + distance };
		distance -= height;
		if (distance <= width) return { x: right - distance, y: bottom };
		distance -= width;
		return { x: left, y: bottom - distance };
	};

	const drawMotion = $derived.by(() => {
		const now = time;
		const flare = 0.5 + 0.5 * Math.sin(now * Math.PI * 2 * 0.24);
		return (graphics: PIXI.Graphics) => {
			graphics.clear();

			// Bright bulbs chase around all four sides instead of blinking two static rails.
			for (let index = 0; index < 18; index += 1) {
				const position = pointOnPerimeter(index / 18 + now * CHASE_SPEED);
				const colour = CHASE_COLOURS[index % CHASE_COLOURS.length];
				graphics.circle(position.x, position.y, 4.8).fill({ color: colour, alpha: 0.12 });
				graphics.circle(position.x, position.y, 2.2).fill({ color: colour, alpha: 0.48 });
				graphics.circle(position.x, position.y, 0.9).fill({ color: 0xffffff, alpha: 0.95 });
			}

			// Independent ignition beats make the authored top and bottom caps feel alive.
			const top = -FRAME_HEIGHT * 0.458;
			const bottom = FRAME_HEIGHT * 0.458;
			graphics.circle(0, top, 11 + flare * 5).fill({ color: 0xffd45b, alpha: 0.08 + flare * 0.1 });
			graphics.circle(0, top, 3.3 + flare * 1.2).fill({ color: 0xffffff, alpha: 0.65 });
			graphics
				.circle(0, bottom, 14 + flare * 7)
				.fill({ color: 0xff38d4, alpha: 0.08 + flare * 0.11 });
			graphics.circle(0, bottom, 4 + flare * 1.5).fill({ color: 0xffffff, alpha: 0.72 });

			// Small upward sparks. Deterministic phases avoid allocation/random jitter every frame.
			for (let index = 0; index < 8; index += 1) {
				const phase = (now * 0.12 + index * 0.137) % 1;
				const side = index % 2 === 0 ? -1 : 1;
				const x = side * (FRAME_WIDTH * 0.48 + Math.sin(now * 1.8 + index) * 3);
				const y = FRAME_HEIGHT * (0.44 - phase * 0.88);
				const sparkAlpha = Math.sin(phase * Math.PI) * 0.7;
				graphics.circle(x, y, 0.8 + (index % 3) * 0.3).fill({
					color: index % 2 === 0 ? 0x48ddff : 0xffcf4a,
					alpha: sparkAlpha,
				});
			}
		};
	});
</script>

<Container
	x={board.x +
		(getBoardCellCenterX(props.reel.reelIndex) - BOARD_SIZES.width * 0.5) * board.boardScale}
	y={board.y + BOARD_GRID_OFFSET_Y}
	{alpha}
>
	<Sprite
		key="anticipationFrame"
		anchor={0.5}
		width={FRAME_WIDTH * board.boardScale}
		height={baseHeight * board.boardScale}
	/>
	<Sprite
		key="anticipationFrame"
		anchor={0.5}
		width={glowWidth * board.boardScale}
		height={glowHeight * board.boardScale}
		alpha={glowAlpha}
		blendMode="add"
	/>
	<Container scale={board.boardScale}>
		<Graphics blendMode="add" draw={drawMotion} />
	</Container>
</Container>
