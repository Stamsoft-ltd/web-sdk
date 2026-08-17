<script lang="ts" module>
	export type EmitterEventBoardFrame =
		| { type: 'boardFrameGlowShow' }
		| { type: 'boardFrameGlowHide' };
</script>

<script lang="ts">
	import { Container, Graphics, PIXI, Sprite } from 'pixi-svelte';
	import { onMount } from 'svelte';

	import {
		FRAME_OVER_GRID_X,
		FRAME_OVER_GRID_Y,
		GRID_OFFSET_X,
		GRID_OFFSET_Y,
	} from '../game/boardArt';
	import { BOARD_CORNER_RADIUS } from '../game/constants';
	import { BOARD_BULBS } from '../game/boardBulbs';
	import { getContext } from '../game/context';

	type Props = { layer?: 'base' | 'border' };
	const props: Props = $props();
	const layer = $derived(props.layer ?? 'base');

	const context = getContext();
	const board = $derived(context.stateGameDerived.boardLayout());
	let glowVisible = $state(false);

	context.eventEmitter.subscribeOnMount({
		boardFrameGlowShow: () => (glowVisible = true),
		boardFrameGlowHide: () => (glowVisible = false),
	});

	const frameW = $derived(board.width * board.boardScale * FRAME_OVER_GRID_X);
	const frameH = $derived(board.height * board.boardScale * FRAME_OVER_GRID_Y);
	const gridW = $derived(board.width * board.boardScale);
	const gridH = $derived(board.height * board.boardScale);
	const gridRadius = $derived(BOARD_CORNER_RADIUS * board.boardScale);

	// Restore the original alternating marquee halo. Geometry is built only on resize; animation
	// changes two container alphas, avoiding per-frame Graphics rebuilds.
	const GLOW_MOOD = {
		basegame: { cycleSeconds: 2, brightness: 0.62, snap: 1.35 },
		bonus: { cycleSeconds: 0.85, brightness: 1, snap: 2.6 },
	};
	const GLOW_RINGS = [
		{ scale: 5.4, alpha: 0.24 },
		{ scale: 2.9, alpha: 0.4 },
		{ scale: 1.7, alpha: 0.62 },
	];
	// build-board-border-layer.py reprojects only the two edge cells while pinning every internal
	// divider. Apply that same transform to procedural halo centres so they remain on the bulbs.
	const BORDER_ART_WIDTH = 1462;
	const LIGHT_PATH_LEFT = 33.8404;
	const LIGHT_PATH_RIGHT = 1411.7267;
	const LEFT_DIVIDER = 300;
	const RIGHT_DIVIDER = 1152;
	const TARGET_GRID_LEFT = 16;
	const TARGET_GRID_RIGHT = 1436;
	const mapBorderX = (normalizedX: number) => {
		const sourceX = normalizedX * BORDER_ART_WIDTH;
		if (sourceX < LEFT_DIVIDER) {
			const scale = (LEFT_DIVIDER - TARGET_GRID_LEFT) / (LEFT_DIVIDER - LIGHT_PATH_LEFT);
			return (TARGET_GRID_LEFT + (sourceX - LIGHT_PATH_LEFT) * scale) / BORDER_ART_WIDTH;
		}
		if (sourceX <= RIGHT_DIVIDER) return normalizedX;
		const scale = (TARGET_GRID_RIGHT - RIGHT_DIVIDER) / (LIGHT_PATH_RIGHT - RIGHT_DIVIDER);
		return (RIGHT_DIVIDER + (sourceX - RIGHT_DIVIDER) * scale) / BORDER_ART_WIDTH;
	};
	const inBonus = $derived(
		context.stateGame.gameType === 'freegame' || !!context.stateGame.duckPicks,
	);
	let glowPhase = $state(0);

	onMount(() => {
		if (layer !== 'border') return;
		let handle = 0;
		let previous = performance.now();
		const tick = (now: number) => {
			const delta = Math.min((now - previous) / 1000, 0.1);
			previous = now;
			const seconds = inBonus ? GLOW_MOOD.bonus.cycleSeconds : GLOW_MOOD.basegame.cycleSeconds;
			glowPhase = (glowPhase + (delta / seconds) * Math.PI * 2) % (Math.PI * 2);
			handle = requestAnimationFrame(tick);
		};
		handle = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(handle);
	});

	const glowLevel = (offset: number) => {
		const mood = inBonus ? GLOW_MOOD.bonus : GLOW_MOOD.basegame;
		return (
			Math.min(1, Math.max(0, Math.cos(glowPhase + offset) * mood.snap + 0.55)) *
			mood.brightness
		);
	};
	const hotGlowAlpha = $derived(glowLevel(0));
	const coolGlowAlpha = $derived(glowLevel(Math.PI));
	const glowPainter = (groupWanted: 0 | 1, width: number, height: number) =>
		(graphics: PIXI.Graphics) => {
			for (const [x, y, radius, group, colour] of BOARD_BULBS) {
				if (group !== groupWanted) continue;
				const cx = (mapBorderX(x) - 0.5) * width;
				const cy = (y - 0.5) * height;
				const r = radius * width;
				for (const ring of GLOW_RINGS) {
					graphics.circle(cx, cy, r * ring.scale).fill({ color: colour, alpha: ring.alpha });
				}
			}
		};
	const drawHotGlow = $derived(glowPainter(0, frameW, frameH));
	const drawCoolGlow = $derived(glowPainter(1, frameW, frameH));
</script>

{#if layer === 'base'}
	<!-- Dark frame is an underlay. It may extend past the gameplay rect but cannot cover reels. -->
	<Container x={board.x + frameW * GRID_OFFSET_X} y={board.y + frameH * GRID_OFFSET_Y}>
		<Sprite key="themeBoardBorderBackdrop" anchor={0.5} width={frameW} height={frameH} />
	</Container>
	<!-- Exact grid crop. Its size is the gameplay contract and never changes with border styling. -->
	<Container x={board.x} y={board.y}>
		<Graphics
			isMask
			draw={(graphics) =>
				graphics
					.roundRect(-gridW * 0.5, -gridH * 0.5, gridW, gridH, gridRadius)
					.fill(0xffffff)}
		/>
		<Sprite key="themeBoardGrid" anchor={0.5} width={gridW} height={gridH} />
	</Container>
{:else}
	<!-- Alpha-only bulbs/glow above feature art. No opaque frame pixels can trim edge reels. -->
	<Container x={board.x + frameW * GRID_OFFSET_X} y={board.y + frameH * GRID_OFFSET_Y}>
		<Sprite
			key="themeBoardBorderExpanded"
			anchor={0.5}
			width={frameW}
			height={frameH}
			tint={glowVisible ? 0xffc4ff : 0xffffff}
		/>
		<Graphics blendMode="add" alpha={hotGlowAlpha} draw={drawHotGlow} />
		<Graphics blendMode="add" alpha={coolGlowAlpha} draw={drawCoolGlow} />
	</Container>
{/if}
