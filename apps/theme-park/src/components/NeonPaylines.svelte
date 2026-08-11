<script lang="ts">
	import { Graphics, PIXI } from 'pixi-svelte';
	import { stateBetDerived } from 'state-shared';

	import { getContext } from '../game/context';
	import { SYMBOL_H, getBoardCellCenterX } from '../game/constants';

	type Point = { x: number; y: number };
	type WinEntry = { lineIndex: number; path: Array<{ reel: number; row: number }> };
	type NeonLine = { color: number; phase: number; points: Point[] };
	type Layer = 'farGlow' | 'nearGlow' | 'tube' | 'core';
	type Props = { wins: WinEntry[] };

	const props: Props = $props();
	const context = getContext();

	const COLORS = [
		0x00f5ff, // cyan
		0xff2bd6, // pink
		0xa8ff00, // lime
		0xff8a00, // orange
		0x7a5cff, // violet
		0x168bff, // electric blue
		0xff334f, // red
		0xffea00, // yellow
	];

	// New mount = new palette order. Colours stay fixed while the win is on screen.
	const shuffledColors = [...COLORS];
	for (let i = shuffledColors.length - 1; i > 0; i -= 1) {
		const j = Math.floor(Math.random() * (i + 1));
		[shuffledColors[i], shuffledColors[j]] = [shuffledColors[j], shuffledColors[i]];
	}

	const centre = (position: { reel: number; row: number }): Point => ({
		x: getBoardCellCenterX(position.reel),
		y: SYMBOL_H * (position.row + 0.5),
	});

	const lines = $derived(
		props.wins.map(
			(win, index): NeonLine => ({
				color: shuffledColors[index % shuffledColors.length],
				phase: ((win.lineIndex * 2.399 + index * 1.117) % 6.283) + 0.2,
				points: win.path.map(centre),
			}),
		),
	);

	const TUBE_WIDTH = SYMBOL_H * 0.028;
	const DRAW_MS = 420;
	const easeOutCubic = (value: number) => 1 - (1 - value) ** 3;

	let progress = $state(0);
	let time = $state(0);

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

	const visiblePoints = (points: Point[]) => {
		if (points.length < 2 || progress <= 0) return [];
		const cursor = progress * (points.length - 1);
		const whole = Math.floor(cursor);
		const result = points.slice(0, whole + 1);
		if (whole < points.length - 1) {
			const fraction = cursor - whole;
			const start = points[whole];
			const end = points[whole + 1];
			result.push({
				x: start.x + (end.x - start.x) * fraction,
				y: start.y + (end.y - start.y) * fraction,
			});
		}
		return result;
	};

	const drawLayer = (graphics: InstanceType<typeof PIXI.Graphics>, layer: Layer) => {
		for (const line of lines) {
			const points = visiblePoints(line.points);
			if (points.length < 2) continue;

			const pulse = 0.9 + 0.1 * Math.sin(time * 4.4 + line.phase);
			const flicker = 0.96 + 0.04 * Math.sin(time * 11.7 + line.phase * 2.3);
			const style =
				layer === 'farGlow'
					? { width: TUBE_WIDTH * 8.5, color: line.color, alpha: 0.18 * pulse }
					: layer === 'nearGlow'
						? { width: TUBE_WIDTH * 4.4, color: line.color, alpha: 0.42 * pulse }
						: layer === 'tube'
							? { width: TUBE_WIDTH * 2.05, color: line.color, alpha: 0.98 * flicker }
							: { width: Math.max(1.4, TUBE_WIDTH * 0.55), color: 0xffffff, alpha: flicker };

			graphics.moveTo(points[0].x, points[0].y);
			for (let i = 1; i < points.length; i += 1) graphics.lineTo(points[i].x, points[i].y);
			graphics.stroke({ ...style, cap: 'round', join: 'round' });
		}
	};
</script>

<!-- Layer every line's glow first, then every coloured tube and white-hot core. Crossings stay
     luminous instead of one line painting an opaque shape over another. No symbol-centre dots. -->
<Graphics blendMode="add" draw={(graphics) => drawLayer(graphics, 'farGlow')} />
<Graphics blendMode="add" draw={(graphics) => drawLayer(graphics, 'nearGlow')} />
<Graphics blendMode="add" draw={(graphics) => drawLayer(graphics, 'tube')} />
<Graphics blendMode="add" draw={(graphics) => drawLayer(graphics, 'core')} />
