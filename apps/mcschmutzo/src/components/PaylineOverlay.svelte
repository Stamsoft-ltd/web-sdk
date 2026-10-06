<script lang="ts">
	import { untrack } from 'svelte';
	import { Container, Graphics } from 'pixi-svelte';

	import { SYMBOL_SIZE, SYMBOL_WIDTH } from '../game/constants';
	import { getContext } from '../game/context';
	import { sauceOf } from '../game/sauces';

	type Point = { reel: number; row: number };
	type WinEntry = { lineIndex: number; symbol?: string; path: Point[] };
	type Props = { wins: WinEntry[] };
	type LineGraphics = {
		destroyed: boolean;
		clear: () => void;
		moveTo: (x: number, y: number) => void;
		lineTo: (x: number, y: number) => void;
		stroke: (style: object) => void;
	};

	const props: Props = $props();
	const context = getContext();
	const board = $derived(context.stateGameDerived.boardLayout());

	let lineGraphics: LineGraphics | null = null;
	let activeLine = $state(0);
	let progress = $state(0);
	let frame = 0;
	let cycleTimer: ReturnType<typeof setTimeout> | undefined;
	const LINE_DELAY_MS = 150;

	const point = ({ reel, row }: Point) => ({
		x: (reel + 0.5) * SYMBOL_WIDTH,
		y: (row + 0.5) * SYMBOL_SIZE,
	});

	const partialPath = (points: Array<{ x: number; y: number }>, amount: number) => {
		if (points.length < 2) return points;
		const lengths = [0];
		for (let index = 1; index < points.length; index += 1) {
			lengths.push(
				lengths[index - 1] +
					Math.hypot(points[index].x - points[index - 1].x, points[index].y - points[index - 1].y),
			);
		}
		const target = lengths[lengths.length - 1] * Math.max(0, Math.min(1, amount));
		const result = [points[0]];
		for (let index = 1; index < points.length; index += 1) {
			if (lengths[index] <= target) {
				result.push(points[index]);
				continue;
			}
			const segment = Math.max(1e-6, lengths[index] - lengths[index - 1]);
			const ratio = (target - lengths[index - 1]) / segment;
			if (ratio > 0) {
				result.push({
					x: points[index - 1].x + (points[index].x - points[index - 1].x) * ratio,
					y: points[index - 1].y + (points[index].y - points[index - 1].y) * ratio,
				});
			}
			break;
		}
		return result;
	};

	const trace = (
		graphics: LineGraphics,
		points: Array<{ x: number; y: number }>,
		amount: number,
		style: object,
	) => {
		const visible = partialPath(points, amount);
		if (visible.length < 2) return;
		graphics.moveTo(visible[0].x, visible[0].y);
		for (const item of visible.slice(1)) graphics.lineTo(item.x, item.y);
		graphics.stroke(style);
	};

	// The win line is a streak of sauce in the paying symbol's colour (game/sauces): a dark rim, the
	// sauce body, a wet highlight, a fat blob on every winning cell and a couple of drips hanging off
	// it — the same line logic, McSchmutzo's own skin.
	const BODY_W = 11;

	const draw = () => {
		const graphics = lineGraphics as unknown as LineGraphics & {
			circle: (x: number, y: number, r: number) => { fill: (style: object) => void };
		};
		if (!graphics || graphics.destroyed) return;
		graphics.clear();

		props.wins.forEach((win, index) => {
			const points = win.path.map(point);
			if (points.length < 2) return;
			const sauce = sauceOf(win.symbol);
			const active = index === activeLine;

			if (!active) {
				trace(graphics, points, 1, { width: 5, color: sauce.body, alpha: 0.35, cap: 'round', join: 'round' });
				return;
			}

			const line = { cap: 'round', join: 'round' };
			trace(graphics, points, progress, { ...line, width: BODY_W + 5, color: sauce.rim, alpha: 0.95 });
			trace(graphics, points, progress, { ...line, width: BODY_W, color: sauce.body, alpha: 1 });
			// wet highlight, nudged up-left along the top of the streak
			const lit = points.map((p) => ({ x: p.x - 1.5, y: p.y - BODY_W * 0.22 }));
			trace(graphics, lit, progress, { ...line, width: 2.5, color: sauce.lit, alpha: 0.85 });
			// blobs where the sauce pooled on each winning cell (only where the streak has reached)
			const reached = Math.max(0, Math.min(points.length, Math.floor(progress * (points.length - 1) + 1e-6) + 1));
			points.slice(0, reached).forEach((p, k) => {
				const r = BODY_W * (0.95 + 0.25 * ((k * 7) % 3) / 2);
				graphics.circle(p.x, p.y, r + 2.5).fill({ color: sauce.rim, alpha: 0.95 });
				graphics.circle(p.x, p.y, r).fill({ color: sauce.body, alpha: 1 });
				graphics.circle(p.x - r * 0.3, p.y - r * 0.35, r * 0.28).fill({ color: sauce.lit, alpha: 0.8 });
				// a drip hanging off every other blob
				if (k % 2 === 1) {
					const len = BODY_W * 1.4;
					graphics.circle(p.x + r * 0.2, p.y + r + len * 0.5, BODY_W * 0.32 + 2).fill({ color: sauce.rim, alpha: 0.95 });
					graphics.circle(p.x + r * 0.2, p.y + r + len * 0.5, BODY_W * 0.32).fill({ color: sauce.body, alpha: 1 });
					trace(graphics, [{ x: p.x + r * 0.2, y: p.y }, { x: p.x + r * 0.2, y: p.y + r + len * 0.4 }], 1, {
						...line,
						width: BODY_W * 0.38,
						color: sauce.body,
						alpha: 1,
					});
				}
			});
		});
	};

	// each line squirts on its first draw only (cycling through several lines repeats silently)
	let sounded = new Set<number>();
	const animateActiveLine = () => {
		cancelAnimationFrame(frame);
		progress = 0;
		const startedAt = performance.now();
		if (!sounded.has(activeLine)) {
			sounded.add(activeLine);
			context.eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_line_squirt', forcePlay: true });
		}
		const tick = (now: number) => {
			progress = Math.min(1, (now - startedAt) / 320);
			draw();
			if (progress < 1) {
				frame = requestAnimationFrame(tick);
				return;
			}
			if (props.wins.length > 1) {
				cycleTimer = setTimeout(() => {
					activeLine = (activeLine + 1) % props.wins.length;
					animateActiveLine();
				}, 700);
			}
		};
		frame = requestAnimationFrame(tick);
	};

	$effect(() => {
		const signature = props.wins
			.map((win) => `${win.lineIndex}:${win.path.map(({ reel, row }) => `${reel},${row}`).join('|')}`)
			.join(';');
		void signature;
		cancelAnimationFrame(frame);
		if (cycleTimer) clearTimeout(cycleTimer);
		activeLine = 0;
		progress = 0;
		sounded = new Set();
		// The winners pulse first (Symbol WIN_PULSE peaks at 150 ms); the line draws through them after.
		if (props.wins.length > 0) cycleTimer = setTimeout(animateActiveLine, LINE_DELAY_MS);
		// (untracked: draw reads progress / activeLine, which would restart this effect every frame)
		untrack(draw);
		return () => {
			cancelAnimationFrame(frame);
			if (cycleTimer) clearTimeout(cycleTimer);
		};
	});
</script>

<!-- zIndex above LockedCells (5) + Anticipations (6) so the win lines always draw ON TOP of the
     symbols, including locked ones. -->
<Container x={board.x} y={board.y} pivot={board.pivot} zIndex={20} sortableChildren={true}>
	<Graphics
		zIndex={70}
		draw={(graphics) => {
			lineGraphics = graphics as unknown as LineGraphics;
			draw();
		}}
	/>
</Container>
