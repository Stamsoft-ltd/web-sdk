<script lang="ts">
	import { Container, Graphics } from 'pixi-svelte';

	import { SYMBOL_SIZE, SYMBOL_WIDTH } from '../game/constants';
	import { getContext } from '../game/context';

	type Point = { reel: number; row: number };
	type WinEntry = { lineIndex: number; path: Point[] };
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

	const draw = () => {
		const graphics = lineGraphics;
		if (!graphics || graphics.destroyed) return;
		graphics.clear();

		props.wins.forEach((win, index) => {
			const points = win.path.map(point);
			if (points.length < 2) return;
			const active = index === activeLine;

			if (!active) {
				trace(graphics, points, 1, {
					width: 4,
					color: 0xffb000,
					alpha: 0.16,
					cap: 'round',
					join: 'round',
				});
				return;
			}

			trace(graphics, points, progress, {
				width: 16,
				color: 0xff8a00,
				alpha: 0.18,
				cap: 'round',
				join: 'round',
			});
			trace(graphics, points, progress, {
				width: 8,
				color: 0xffc400,
				alpha: 0.7,
				cap: 'round',
				join: 'round',
			});
			trace(graphics, points, progress, {
				width: 3,
				color: 0xfff4b0,
				alpha: 1,
				cap: 'round',
				join: 'round',
			});

		});
	};

	const animateActiveLine = () => {
		cancelAnimationFrame(frame);
		progress = 0;
		const startedAt = performance.now();
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
		if (props.wins.length > 0) animateActiveLine();
		else draw();
		return () => {
			cancelAnimationFrame(frame);
			if (cycleTimer) clearTimeout(cycleTimer);
		};
	});
</script>

<Container x={board.x} y={board.y} pivot={board.pivot} sortableChildren={true}>
	<Graphics
		blendMode="add"
		zIndex={70}
		draw={(graphics) => {
			lineGraphics = graphics as unknown as LineGraphics;
			draw();
		}}
	/>
</Container>
