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
	// Set once the opening pass has finished. After that the vines STAY grown: the cycle only moves
	// the highlight from line to line. The previous version restarted the draw from 0 on every
	// cycle, which on a single-line win (no other lines left on screen as ghosts) wiped the vine
	// off the board and regrew it — it read as the win being taken away and put back.
	let hasGrown = $state(false);
	let raf = 0;
	let holdTimeout = 0;
	let start = 0;

	const scheduleCycle = () => {
		holdTimeout = setTimeout(() => {
			const count = props.wins.length;
			// Only multi-line wins have anything to cycle through; a single line just stays drawn.
			if (count > 1) {
				activeLine = (activeLine + 1) % count;
				scheduleCycle();
			}
		}, HOLD_MS + DRAW_MS) as unknown as number;
	};

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
				hasGrown = true;
				scheduleCycle();
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
		hasGrown = false;
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

<!-- Every vine stays fully grown once the opening pass is done; the cycle then only shifts which
     one is bright, so the win's full picture is on the board the whole time it's on screen. -->
{#each props.wins as win, index (win.lineIndex)}
	{@const isActive = activeLine === -1 || activeLine === index}
	<VineRope
		waypoints={win.path.map((p) => ({ x: cx(p.reel), y: cy(p.row) }))}
		color={GOLD}
		progress={props.snap || hasGrown || !isActive ? 1 : drawProgress}
		alpha={props.snap ? 0.75 : isActive ? 0.85 : 0.16}
		vineH={VINE_H}
	/>
{/each}
