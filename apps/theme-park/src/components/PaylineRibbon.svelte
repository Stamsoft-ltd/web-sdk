<script lang="ts">
	import { SYMBOL_H, CELL_W } from '../game/constants';
	import RibbonLine from './RibbonLine.svelte';

	type WinEntry = { lineIndex: number; path: Array<{ reel: number; row: number }> };
	type Props = { wins: WinEntry[] };

	const props: Props = $props();

	const cx = (reel: number) => CELL_W * (reel + 0.5);
	const cy = (row: number) => SYMBOL_H * (row + 0.5);

	// Ribbon width is a fraction of the cell so it holds its weight at every board scale.
	const RIBBON_W = SYMBOL_H * 0.13;
	const DRAW_MS = 1;
	const HOLD_MS = 400; // pause at full before restarting the loop

	let drawProgress = $state(1);
	let raf = 0;
	let holdTimeout = 0;
	let start = 0;

	const startDraw = () => {
		cancelAnimationFrame(raf);
		// TEMP
		start = 0;
		const tick = (t: number) => {
			if (!start) start = t;
			drawProgress = Math.min((t - start) / DRAW_MS, 1);
			if (drawProgress < 1) {
				raf = requestAnimationFrame(tick);
			} else {
				holdTimeout = setTimeout(startDraw, HOLD_MS) as unknown as number;
			}
		};
		raf = requestAnimationFrame(tick);
	};

	$effect(() => {
		const count = props.wins.length;
		clearTimeout(holdTimeout);
		cancelAnimationFrame(raf);
		// TEMP
		start = 0;
		if (count === 0) return;
		startDraw();
		return () => {
			clearTimeout(holdTimeout);
			cancelAnimationFrame(raf);
		};
	});
</script>

{#each props.wins as win (win.lineIndex)}
	<RibbonLine
		waypoints={win.path.map((p) => ({ x: cx(p.reel), y: cy(p.row) }))}
		progress={drawProgress}
		width={RIBBON_W}
	/>
{/each}
