<script lang="ts">
	import { stateBet } from 'state-shared';
	import { SYMBOL_W, SYMBOL_H } from '../game/constants';
	import VineRope from './VineRope.svelte';

	type WinEntry = { lineIndex: number; path: Array<{ reel: number; row: number }> };
	type Props = { wins: WinEntry[]; snap?: boolean };

	const props: Props = $props();

	const cx = (reel: number) => SYMBOL_W * (reel + 0.5);
	const cy = (row: number) => SYMBOL_H * (row + 0.5);

	const VINE_H = 20;
	const isFast = $derived(stateBet.isTurbo || stateBet.isSuperTurbo);
	const DRAW_MS = $derived(isFast ? 250 : 600);
	const HOLD_MS = $derived(isFast ? 400 : 700); // pause at full before restarting loop
	// Bright gold (dominant tone of the win gradient) for the winning-payline lines.
	const GOLD = 0xfbc503;

	let drawProgress = $state(0);
	// Which line is currently drawing: -1 = all lines together (the first pass, so the full win
	// picture registers at once), then 0..N-1 cycling line-by-line so each payline can be read.
	let activeLine = $state(-1);
	let raf = 0;
	let holdTimeout = 0;
	let start = 0;

	const startDraw = () => {
		cancelAnimationFrame(raf);
		drawProgress = 0;
		start = 0;
		const tick = (t: number) => {
			if (!start) start = t;
			drawProgress = Math.min((t - start) / DRAW_MS, 1);
			if (drawProgress < 1) {
				raf = requestAnimationFrame(tick);
			} else {
				holdTimeout = setTimeout(() => {
					const count = props.wins.length;
					// Multi-line wins advance to per-line cycling after the all-lines pass;
					// single-line wins just keep redrawing their one line.
					if (count > 1) activeLine = (activeLine + 1) % count;
					startDraw();
				}, HOLD_MS) as unknown as number;
			}
		};
		raf = requestAnimationFrame(tick);
	};

	$effect(() => {
		const count = props.wins.length;
		clearTimeout(holdTimeout);
		cancelAnimationFrame(raf);
		drawProgress = 0;
		activeLine = -1;
		start = 0;
		if (count === 0) return;
		startDraw();
		return () => { clearTimeout(holdTimeout); cancelAnimationFrame(raf); };
	});

	$effect(() => {
		if (!props.snap) return;
		clearTimeout(holdTimeout);
		cancelAnimationFrame(raf);
		drawProgress = 1;
	});
</script>

{#each props.wins as win, index (win.lineIndex)}
	<VineRope
		waypoints={win.path.map((p) => ({ x: cx(p.reel), y: cy(p.row) }))}
		color={GOLD}
		progress={props.snap ? 1 : activeLine === -1 || activeLine === index ? drawProgress : 0}
		vineH={VINE_H}
	/>
{/each}
