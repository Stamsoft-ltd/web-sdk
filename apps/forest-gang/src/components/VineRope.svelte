<script lang="ts">
	import { PIXI, getContextParent } from 'pixi-svelte';
	import { onDestroy } from 'svelte';

	type Props = {
		waypoints: Array<{ x: number; y: number }>;
		color: number;
		progress: number;
		vineH: number;
		// Whole-rope opacity — the payline cycler dims non-active lines instead of hiding them.
		alpha?: number;
	};

	const props: Props = $props();
	const parentContext = getContextParent();

	// No mask and no filter on purpose: a Graphics mask inside a filtered container is exactly the
	// pixi-v8 combination that silently rendered nothing here (geometry/bounds were correct, screen
	// stayed empty). The reveal is done by drawing only the travelled part of the path, and the glow
	// is faked with layered strokes — plain geometry that renders everywhere.
	const line = new PIXI.Graphics();
	const container = new PIXI.Container();
	container.addChild(line);

	parentContext.addToParent(container);

	onDestroy(() => {
		container.parent?.removeChild(container);
		container.destroy({ children: true });
	});

	// Paylines run strictly left→right, so the reveal edge is an x-coordinate and the travelled
	// sub-path is every waypoint left of it plus one interpolated point on the current segment.
	const clippedPath = (revealX: number) => {
		const pts = props.waypoints;
		const out = [pts[0]];
		for (let i = 1; i < pts.length; i++) {
			if (revealX >= pts[i].x) {
				out.push(pts[i]);
				continue;
			}
			const t = (revealX - pts[i - 1].x) / Math.max(1e-6, pts[i].x - pts[i - 1].x);
			if (t > 0) out.push({ x: revealX, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * t });
			break;
		}
		return out;
	};

	$effect(() => {
		container.alpha = props.alpha ?? 0.75;
	});

	$effect(() => {
		const pts = props.waypoints;
		const minX = Math.min(...pts.map((p) => p.x));
		const maxX = Math.max(...pts.map((p) => p.x));
		const revealX = minX + (maxX - minX) * props.progress;
		const path = clippedPath(revealX);

		line.clear();
		if (path.length >= 2) {
			// Layered strokes: wide soft halo → tighter glow → gold rope → bright core.
			const layers: Array<{ width: number; color: number; alpha: number }> = [
				{ width: 14, color: props.color, alpha: 0.14 },
				{ width: 8.5, color: props.color, alpha: 0.32 },
				{ width: 4.5, color: props.color, alpha: 0.85 },
				{ width: 1.8, color: 0xfff3b8, alpha: 1 },
			];
			for (const layer of layers) {
				line.moveTo(path[0].x, path[0].y);
				for (let i = 1; i < path.length; i++) line.lineTo(path[i].x, path[i].y);
				line.stroke({ ...layer, cap: 'round', join: 'round' });
			}
		}

		// Comet head riding the reveal edge while the line draws in.
		if (props.progress > 0.01 && props.progress < 0.99 && path.length >= 1) {
			const p = path[path.length - 1];
			line.circle(p.x, p.y, 10).fill({ color: props.color, alpha: 0.35 });
			line.circle(p.x, p.y, 6).fill({ color: 0xfff8d8, alpha: 0.9 });
			line.circle(p.x, p.y, 2.8).fill({ color: 0xffffff, alpha: 1 });
		}
	});
</script>
