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
	// stayed empty). The reveal is done by drawing only the grown part of the vine, and the glow
	// is faked with layered strokes — plain geometry that renders everywhere.
	const line = new PIXI.Graphics();
	const container = new PIXI.Container();
	container.addChild(line);

	parentContext.addToParent(container);

	onDestroy(() => {
		container.parent?.removeChild(container);
		container.destroy({ children: true });
	});

	// --- Vine look -------------------------------------------------------------------------------
	// Stem greens read as a forest creeper; the passed-in `color` (gold) stays as the halo and the
	// growing tip, so a win still registers as gold at a glance.
	const STEM_DARK = 0x24471a;
	const STEM_MID = 0x4a8b2a;
	const STEM_LIT = 0x8fd44a;
	const LEAF_FILL = 0x53992c;
	const LEAF_EDGE = 0x24471a;
	const LEAF_VEIN = 0x9fdd5c;

	// Samples per waypoint segment for the curve. 10 is smooth at this size and keeps the per-frame
	// rebuild cheap — this redraws every rAF while the vine grows, once per win line.
	const SEG_SAMPLES = 10;
	// Cardinal-spline tension. MUST stay low: at the Catmull-Rom default (0.5) the curve overshoots
	// hard on a zig-zag payline — it bowed a full cell past the winning symbols, so the vine sailed
	// around the very cells it is meant to point at. 0.18 keeps the curve visibly through every
	// symbol centre while still bending. Verified by rendering paylines with the cell centres
	// marked; raise this and the line stops passing through them.
	const CURVE_TENSION = 0.18;

	// Everything fixed for the life of the win is hoisted out of the per-frame effect: the sampled
	// centre-line, its arc lengths and the leaf anchors are all pure functions of the waypoints.
	const vine = $derived.by(() => {
		const pts = props.waypoints;
		if (pts.length < 2) return null;

		// Cardinal spline through the symbol centres (Hermite form, tangents scaled by
		// CURVE_TENSION), ends duplicated so the curve starts and finishes exactly on the first and
		// last symbol. A straight polyline is what made the old "rope" read as a plain zig-zag; the
		// spline is what gives the creeper its bend, and the low tension is what keeps that bend
		// from wandering off the winning cells.
		const at = (i: number) => pts[Math.max(0, Math.min(pts.length - 1, i))];
		const curve: Array<{ x: number; y: number }> = [];
		for (let i = 0; i < pts.length - 1; i++) {
			const p0 = at(i - 1);
			const p1 = at(i);
			const p2 = at(i + 1);
			const p3 = at(i + 2);
			const m1x = CURVE_TENSION * (p2.x - p0.x);
			const m1y = CURVE_TENSION * (p2.y - p0.y);
			const m2x = CURVE_TENSION * (p3.x - p1.x);
			const m2y = CURVE_TENSION * (p3.y - p1.y);
			for (let s = 0; s < SEG_SAMPLES; s++) {
				const t = s / SEG_SAMPLES;
				const t2 = t * t;
				const t3 = t2 * t;
				const h1 = 2 * t3 - 3 * t2 + 1;
				const h2 = -2 * t3 + 3 * t2;
				const h3 = t3 - 2 * t2 + t;
				const h4 = t3 - t2;
				curve.push({
					x: h1 * p1.x + h2 * p2.x + h3 * m1x + h4 * m2x,
					y: h1 * p1.y + h2 * p2.y + h3 * m1y + h4 * m2y,
				});
			}
		}
		curve.push(pts[pts.length - 1]);

		// Cumulative arc length: the growth is revealed BY LENGTH, not by x as the old straight
		// version did. A vine that waves has segments where x barely advances, and an x-based
		// reveal makes those crawl while the rest races.
		const lens = [0];
		for (let i = 1; i < curve.length; i++) {
			lens.push(lens[i - 1] + Math.hypot(curve[i].x - curve[i - 1].x, curve[i].y - curve[i - 1].y));
		}
		const total = lens[lens.length - 1] || 1;

		// Perpendicular undulation, so the stem snakes instead of tracing the spline exactly.
		// Deterministic phase from the path itself — a random one would re-roll the shape on every
		// re-render and make the vine twitch.
		const amp = props.vineH * 0.11;
		const phase = (pts[0].y * 0.05 + pts.length) % (Math.PI * 2);
		const waves = 1.15 * (pts.length - 1);
		const path = curve.map((p, i) => {
			const prev = curve[Math.max(0, i - 1)];
			const next = curve[Math.min(curve.length - 1, i + 1)];
			const tx = next.x - prev.x;
			const ty = next.y - prev.y;
			const tl = Math.hypot(tx, ty) || 1;
			// Perpendicular to the local tangent.
			const nx = -ty / tl;
			const ny = tx / tl;
			const u = lens[i] / total;
			// Taper the wave to nothing at the root so the vine leaves the first symbol cleanly.
			const swing = Math.sin(u * waves * Math.PI * 2 + phase) * amp * Math.min(1, u * 4);
			return { x: p.x + nx * swing, y: p.y + ny * swing, nx, ny, len: lens[i] };
		});

		// Leaf anchors every `spacing` of arc length, alternating sides.
		const spacing = props.vineH * 2.6;
		const leaves: Array<{ i: number; side: number; len: number }> = [];
		for (let target = spacing * 0.6; target < total - spacing * 0.25; target += spacing) {
			let i = 1;
			while (i < path.length - 1 && path[i].len < target) i++;
			leaves.push({ i, side: leaves.length % 2 === 0 ? 1 : -1, len: path[i].len });
		}

		return { path, total, leaves };
	});

	$effect(() => {
		container.alpha = props.alpha ?? 0.75;
	});

	$effect(() => {
		line.clear();
		const data = vine;
		if (!data) return;

		const { path, total, leaves } = data;
		const grown = total * Math.max(0, Math.min(1, props.progress));

		// The grown prefix, plus one interpolated point exactly at the growing tip so the vine
		// doesn't advance in visible sample-sized steps.
		const drawn: Array<{ x: number; y: number; nx: number; ny: number; len: number }> = [];
		for (let i = 0; i < path.length; i++) {
			if (path[i].len <= grown) {
				drawn.push(path[i]);
				continue;
			}
			const prev = path[i - 1];
			if (prev) {
				const t = (grown - prev.len) / Math.max(1e-6, path[i].len - prev.len);
				drawn.push({
					x: prev.x + (path[i].x - prev.x) * t,
					y: prev.y + (path[i].y - prev.y) * t,
					nx: path[i].nx,
					ny: path[i].ny,
					len: grown,
				});
			}
			break;
		}
		if (drawn.length < 2) return;

		// Soft gold halo under the stem — keeps the payline readable over dark board wood and is
		// what carries the "this is a win" colour now that the stem itself is green.
		line.moveTo(drawn[0].x, drawn[0].y);
		for (let i = 1; i < drawn.length; i++) line.lineTo(drawn[i].x, drawn[i].y);
		line.stroke({ width: props.vineH * 0.7, color: props.color, alpha: 0.13, cap: 'round', join: 'round' });

		// Tapered stem: an outline polygon (thick at the root, thin at the tip) rather than a
		// constant-width stroke — the taper is most of what separates a vine from a cable.
		const halfAt = (len: number) => {
			const u = len / total;
			return props.vineH * 0.15 * (1 - 0.62 * u);
		};
		const left: number[] = [];
		const right: number[] = [];
		for (const p of drawn) {
			const h = halfAt(p.len);
			left.push(p.x + p.nx * h, p.y + p.ny * h);
			right.push(p.x - p.nx * h, p.y - p.ny * h);
		}
		const outline = left.slice();
		for (let i = right.length - 2; i >= 0; i -= 2) outline.push(right[i], right[i + 1]);
		line.poly(outline).fill({ color: STEM_MID, alpha: 0.95 });
		line.poly(outline).stroke({ width: 1, color: STEM_DARK, alpha: 0.85, join: 'round' });

		// Lit edge along the top of the stem for a bit of round.
		line.moveTo(left[0], left[1]);
		for (let i = 2; i < left.length; i += 2) line.lineTo(left[i], left[i + 1]);
		line.stroke({ width: 0.9, color: STEM_LIT, alpha: 0.5, cap: 'round', join: 'round' });

		// Leaves unfurl as the growth passes them: each scales up over a short run of arc length
		// just after its anchor, so they pop out behind the tip instead of all at once.
		const leafRun = props.vineH * 0.9;
		for (const leaf of leaves) {
			if (grown <= leaf.len) continue;
			const open = Math.min(1, (grown - leaf.len) / leafRun);
			const p = path[leaf.i];
			// Along-path direction at the anchor (perpendicular of the stored normal).
			const ax = p.ny;
			const ay = -p.nx;
			const size = props.vineH * 1.05 * open;
			// Leaf points out and slightly forward, so the vine reads as growing left→right.
			const dx = p.nx * leaf.side + ax * 0.2;
			const dy = p.ny * leaf.side + ay * 0.2;
			const dl = Math.hypot(dx, dy) || 1;
			const ux = dx / dl;
			const uy = dy / dl;
			const tipX = p.x + ux * size;
			const tipY = p.y + uy * size;
			// Two arcs from stem to tip, bulging either side of the leaf's own axis.
			const bulge = size * 0.54;
			line.moveTo(p.x, p.y);
			line.quadraticCurveTo(p.x + ux * size * 0.5 - uy * bulge, p.y + uy * size * 0.5 + ux * bulge, tipX, tipY);
			line.quadraticCurveTo(p.x + ux * size * 0.5 + uy * bulge, p.y + uy * size * 0.5 - ux * bulge, p.x, p.y);
			line.fill({ color: LEAF_FILL, alpha: 0.95 });
			line.stroke({ width: 0.8, color: LEAF_EDGE, alpha: 0.7, join: 'round' });
			// Midrib.
			line.moveTo(p.x, p.y);
			line.lineTo(tipX, tipY);
			line.stroke({ width: 0.7, color: LEAF_VEIN, alpha: 0.55, cap: 'round' });
		}

		// Growing tip: a curling tendril plus the gold spark, only while the vine is still growing.
		if (props.progress > 0.01 && props.progress < 0.99) {
			const tip = drawn[drawn.length - 1];
			const prev = drawn[Math.max(0, drawn.length - 2)];
			let tx = tip.x - prev.x;
			let ty = tip.y - prev.y;
			const tl = Math.hypot(tx, ty) || 1;
			tx /= tl;
			ty /= tl;
			// Tendril: a few points spiralling off the tip with a shrinking radius.
			const curl = props.vineH * 0.5;
			line.moveTo(tip.x, tip.y);
			for (let s = 1; s <= 6; s++) {
				const a = (s / 6) * Math.PI * 1.5;
				const r = curl * (1 - s / 9);
				const cx = tip.x + tx * r * Math.cos(a) - ty * r * Math.sin(a) * 0.6;
				const cy = tip.y + ty * r * Math.cos(a) + tx * r * Math.sin(a) * 0.6;
				line.lineTo(cx, cy);
			}
			line.stroke({ width: 1.2, color: STEM_LIT, alpha: 0.8, cap: 'round', join: 'round' });

			line.circle(tip.x, tip.y, props.vineH * 0.38).fill({ color: props.color, alpha: 0.3 });
			line.circle(tip.x, tip.y, props.vineH * 0.16).fill({ color: 0xfff8d8, alpha: 0.85 });
		}
	});
</script>
