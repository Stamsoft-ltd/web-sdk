<script lang="ts">
	import { PIXI } from 'pixi-svelte';
	import { stateBetDerived } from 'state-shared';

	import { getContext } from '../game/context';
	import { SYMBOL_H, CELL_W } from '../game/constants';
	import RibbonLine from './RibbonLine.svelte';

	type WinEntry = { lineIndex: number; path: Array<{ reel: number; row: number }> };
	type Props = { wins: WinEntry[] };

	const props: Props = $props();
	const context = getContext();

	const cx = (reel: number) => CELL_W * (reel + 0.5);
	const cy = (row: number) => SYMBOL_H * (row + 0.5);

	// Ribbon width is a fraction of the cell so it holds its weight at every board scale.
	const RIBBON_W = SYMBOL_H * 0.3;
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
	/>
{/each}
