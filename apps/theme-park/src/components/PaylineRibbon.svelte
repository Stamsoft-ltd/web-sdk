<script lang="ts">
	import { getContextParent, PIXI } from 'pixi-svelte';
	import { GlowFilter } from 'pixi-filters';
	import { onDestroy } from 'svelte';
	import { stateBetDerived } from 'state-shared';

	import { getContext } from '../game/context';
	import { SYMBOL_H, CELL_W } from '../game/constants';
	import RibbonLine from './RibbonLine.svelte';

	type WinEntry = { lineIndex: number; path: Array<{ reel: number; row: number }> };
	type Props = { wins: WinEntry[] };

	const props: Props = $props();
	const context = getContext();
	const parentContext = getContextParent();

	// Every line's shadow in one layer UNDER every line's ribbon. When each line carried its own
	// shadow, the second ribbon's shadow painted over the first ribbon — a hard black silhouette on
	// the gold is what made every crossing look dirty. Shadows now only ever fall on the board.
	const shadowLayer = new PIXI.Container();
	const ribbonLayer = new PIXI.Container();
	// One glow around the combined ribbons, instead of one per line: crossings used to double up
	// into hot spots, and each filter cost its own render target besides.
	const glow = new GlowFilter({
		distance: 10,
		outerStrength: 1.3,
		innerStrength: 0,
		color: 0xffb648,
		alpha: 0.55,
		quality: 0.2,
	});
	ribbonLayer.filters = [glow];
	parentContext.addToParent(shadowLayer);
	parentContext.addToParent(ribbonLayer);

	onDestroy(() => {
		shadowLayer.parent?.removeChild(shadowLayer);
		ribbonLayer.parent?.removeChild(ribbonLayer);
		shadowLayer.destroy({ children: true });
		ribbonLayer.destroy({ children: true });
		glow.destroy();
	});

	const cx = (reel: number) => CELL_W * (reel + 0.5);
	const cy = (row: number) => SYMBOL_H * (row + 0.5);

	// Ribbon width is a fraction of the cell so it holds its weight at every board scale — then
	// tapered as the line count climbs: five full-width ribbons read fine, fifteen of them buried
	// the board in gold. Square-root so the taper is gentle at first and floored well short of a
	// thread.
	const RIBBON_W = $derived(
		SYMBOL_H * 0.2 * Math.max(0.55, Math.min(1, Math.sqrt(5 / Math.max(props.wins.length, 1)))),
	);
	/** Unfurl time. The ribbon is pulled across the reels once, then left to settle. */
	const DRAW_MS = 460;

	const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

	let progress = $state(0);
	let time = $state(0);

	// TEMP-DEBUG
	$effect(() => {
		(window as unknown as Record<string, unknown>).__ribbonWins = props.wins.length;
	});

	// Driven off the application ticker rather than a rAF of its own: <SceneAnimationDriver> caps
	// that ticker and renders on it, so a private loop would run at panel rate and update the mesh
	// at a different phase from the frame that draws it (and would keep going with the tab hidden).
	$effect(() => {
		const app = context.stateApp.pixiApplication;
		if (!app || props.wins.length === 0) return;

		const drawMs = DRAW_MS / stateBetDerived.timeScale();
		let elapsed = 0;
		progress = 0;
		time = 0;

		const tick = () => {
			elapsed += app.ticker.deltaMS;
			time = elapsed / 1000;
			progress = easeOutCubic(Math.min(elapsed / drawMs, 1));
		};

		app.ticker.add(tick, null, PIXI.UPDATE_PRIORITY.HIGH);
		return () => app.ticker.remove(tick, null);
	});
</script>

{#each props.wins as win (win.lineIndex)}
	<RibbonLine
		waypoints={win.path.map((p) => ({ x: cx(p.reel), y: cy(p.row) }))}
		{progress}
		{time}
		width={RIBBON_W}
		seed={win.lineIndex}
		{shadowLayer}
		{ribbonLayer}
	/>
{/each}
