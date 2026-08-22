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
		GRID_RADIUS,
	} from '../game/boardArt';
	import { boardShake } from '../game/boardShake.svelte';
	import { getContext } from '../game/context';

	/**
	 * The board, in two layers with the reels between them: the grid goes down, then everything the
	 * game draws, then the rail on top. The rail can be opaque up there because it is, by
	 * construction, everything OUTSIDE the opening in the art — and that opening is the gameplay
	 * rect — so it cannot trim an edge reel or the top of a full-reel feature symbol.
	 *
	 * Both are cut from one drawing by scripts/board/build_board_frame.py, which also writes the
	 * geometry in game/boardArt.ts.
	 */

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
	const gridRadius = $derived(GRID_RADIUS * gridW);

	// The neon pulse. The rail it replaces carried 60 painted bulbs and lit them in two alternating
	// groups; a continuous line has no groups, so the whole line breathes together and the only thing
	// that changes per frame is one sprite's alpha.
	const GLOW_MOOD = {
		basegame: { cycleSeconds: 2.4, low: 0.16, high: 0.42 },
		bonus: { cycleSeconds: 0.9, low: 0.3, high: 1 },
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

	const glowAlpha = $derived.by(() => {
		const mood = inBonus ? GLOW_MOOD.bonus : GLOW_MOOD.basegame;
		const wave = 0.5 + 0.5 * Math.cos(glowPhase);
		return mood.low + (mood.high - mood.low) * wave;
	});

	// The grid art is one flat image, so the playfield read as a table rather than a lit surface.
	// A vignette gives it a centre: rings of black stroked from the edge inward, each fainter than
	// the last. Rings rather than stacked fills because a fill covers everything inside it, which
	// darkens the middle — the exact opposite of a vignette.
	const VIGNETTE_RINGS = 14;
	const VIGNETTE_REACH = 0.3; // fraction of the short side the falloff spans
	const VIGNETTE_DEPTH = 0.17; // alpha at the outermost ring
	const drawVignette =
		(width: number, height: number, radius: number) =>
		(graphics: InstanceType<typeof PIXI.Graphics>) => {
			graphics.clear();
			const step = (Math.min(width, height) * VIGNETTE_REACH) / VIGNETTE_RINGS;
			for (let ring = 0; ring < VIGNETTE_RINGS; ring += 1) {
				const inset = ring * step;
				const fade = (1 - ring / VIGNETTE_RINGS) ** 2;
				graphics
					.roundRect(
						-width * 0.5 + inset,
						-height * 0.5 + inset,
						width - inset * 2,
						height - inset * 2,
						Math.max(1, radius - inset),
					)
					// 1.7x overlap between neighbouring rings, so the falloff has no visible banding.
					.stroke({ width: step * 1.7, color: 0x000000, alpha: (VIGNETTE_DEPTH * fade) / 3 });
			}
		};
	const drawGridVignette = $derived(drawVignette(gridW, gridH, gridRadius));
</script>

{#if layer === 'base'}
	<!-- Exact grid crop. Its size is the gameplay contract and never changes with border styling.
	     The clip runs past the opening at the corners on purpose: the drawn corners cut deeper than
	     any rounded rect, and the rail above covers the overshoot. Clip any rounder and the park
	     shows through the board's corners. -->
	<Container x={board.x + boardShake.x} y={board.y + boardShake.y}>
		<Graphics
			isMask
			draw={(graphics) =>
				graphics.roundRect(-gridW * 0.5, -gridH * 0.5, gridW, gridH, gridRadius).fill(0xffffff)}
		/>
		<Sprite key="themeBoardGrid" anchor={0.5} width={gridW} height={gridH} />
		<Graphics draw={drawGridVignette} />
	</Container>
{:else}
	<!-- Everything outside the gameplay rect, above the reels, so the frame reads over feature art. -->
	<Container
		x={board.x + frameW * GRID_OFFSET_X + boardShake.x}
		y={board.y + frameH * GRID_OFFSET_Y + boardShake.y}
	>
		<Sprite key="themeBoardRail" anchor={0.5} width={frameW} height={frameH} />
		<Sprite
			key="themeBoardRailGlow"
			anchor={0.5}
			blendMode="add"
			width={frameW}
			height={frameH}
			alpha={glowAlpha}
			tint={glowVisible ? 0xffc4ff : 0xffffff}
		/>
	</Container>
{/if}
