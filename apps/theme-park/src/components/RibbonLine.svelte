<script lang="ts">
	// Via pixi-svelte's re-export rather than a direct 'pixi.js' import: the app has no pixi.js
	// dependency of its own, and adding one breaks svelte-check across the whole project.
	import { getContextParent, PIXI } from 'pixi-svelte';
	import { onDestroy } from 'svelte';
	import { GlowFilter } from 'pixi-filters';

	import { getRibbonTexture } from '../game/ribbonTexture';

	type Pt = { x: number; y: number };

	type Props = {
		/** Symbol centres the ribbon has to pass through, reel order. */
		waypoints: Pt[];
		/** Width of the ribbon at its flattest, in board pixels. */
		width: number;
		/** 0..1 unfurl along the path. */
		progress: number;
		/** Seconds since the win appeared — drives the drift and the travelling glint. */
		time: number;
		/** Per-line variation, so two ribbons crossing the board never twist in lockstep. */
		seed: number;
	};

	const props: Props = $props();
	const parentContext = getContextParent();

	// ── Why a mesh and not stacked strokes ───────────────────────────────────────────────────────
	//
	// This used to be four Graphics strokes over one path, each narrower and lighter than the last.
	// That builds a tube: the shading only ever varies ACROSS the line, never along it, so the thing
	// reads as a glowing rope no matter how the colours are tuned.
	//
	// A ribbon is a flat strip of fabric, and the three cues that sell it are all length-varying:
	//   • it TWISTS, so it pinches to nothing at the twist points and shows its duller reverse side
	//     between them;
	//   • it DRAPES, so it leaves the straight line between symbol centres and rounds its corners
	//     instead of turning them;
	//   • it has CUT ENDS, forked into a swallowtail rather than a rounded cap.
	//
	// So the ribbon is built as a triangle strip whose half-width, facing and shading are recomputed
	// per cross-section each frame. All the fabric detail lives in a baked 2D lookup texture
	// (see ../game/ribbonTexture.ts) that the strip samples with u across the width and v by facing —
	// the per-frame work is only writing positions and uvs into two buffers that never change size.

	/** Cross-sections along the ribbon. Fixed so the geometry buffers are allocated exactly once. */
	const SECTIONS = 120;
	/** left edge / centre / right edge — the centre vertex is what lets the ends fork. */
	const VERTS_PER_SECTION = 3;
	/** Full turns of twist over the ribbon's length. Whole/half turns land the ends flat. */
	const TWIST_TURNS = [1, 1, 1.5, 1];

	const TAU = Math.PI * 2;
	const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

	const texture = getRibbonTexture();

	const positions = new Float32Array(SECTIONS * VERTS_PER_SECTION * 2);
	const uvs = new Float32Array(SECTIONS * VERTS_PER_SECTION * 2);
	const indices = new Uint32Array((SECTIONS - 1) * 4 * 3);
	for (let i = 0, o = 0; i < SECTIONS - 1; i++) {
		const b = i * VERTS_PER_SECTION;
		// Two quads per segment: edge→centre on each side.
		indices[o++] = b;
		indices[o++] = b + 3;
		indices[o++] = b + 1;
		indices[o++] = b + 1;
		indices[o++] = b + 3;
		indices[o++] = b + 4;
		indices[o++] = b + 1;
		indices[o++] = b + 4;
		indices[o++] = b + 2;
		indices[o++] = b + 2;
		indices[o++] = b + 4;
		indices[o++] = b + 5;
	}

	const geometry = new PIXI.MeshGeometry({ positions, uvs, indices });
	const positionBuffer = geometry.getBuffer('aPosition');
	const uvBuffer = geometry.getBuffer('aUV');

	const container = new PIXI.Container();

	// Contact shadow. Shares the geometry with the ribbon and is simply offset — tinted to black the
	// lookup texture contributes nothing but its silhouette, including the feathered edges. Left
	// unblurred on purpose: a blur filter here would cost a render target per win line.
	const shadow = new PIXI.Mesh({ geometry, texture });
	shadow.tint = 0x000000;
	shadow.alpha = 0.3;

	const ribbon = new PIXI.Mesh({ geometry, texture });
	// Warm and shallow: enough to lift the ribbon off the reels, well short of neon.
	const glow = new GlowFilter({
		distance: 10,
		outerStrength: 1.3,
		innerStrength: 0,
		color: 0xffb648,
		alpha: 0.55,
		quality: 0.2,
	});
	ribbon.filters = [glow];

	container.addChild(shadow);
	container.addChild(ribbon);
	parentContext.addToParent(container);

	onDestroy(() => {
		container.parent?.removeChild(container);
		// The lookup texture is shared and cached across every ribbon, so it is deliberately left
		// alone here — only this instance's geometry and filter are ours to release.
		container.destroy({ children: true });
		geometry.destroy(true);
		glow.destroy();
	});

	// ── Centreline ───────────────────────────────────────────────────────────────────────────────

	const norm = (dx: number, dy: number) => {
		const l = Math.hypot(dx, dy) || 1;
		return { x: dx / l, y: dy / l };
	};

	/**
	 * Symbol centres → a dense, corner-rounded polyline that overshoots both end symbols, with the
	 * cumulative arc length alongside it. Rounding corners with a quadratic through each waypoint
	 * (rather than fitting a spline) cannot overshoot, so the ribbon never bulges off a symbol on a
	 * steep row change.
	 */
	const buildPath = (waypoints: Pt[], width: number) => {
		const tail = width * 2.6;
		const radius = width * 1.5;

		const head = waypoints[0];
		const next = waypoints[1] ?? waypoints[0];
		const last = waypoints[waypoints.length - 1];
		const prev = waypoints[waypoints.length - 2] ?? last;
		const dIn = norm(head.x - next.x, head.y - next.y);
		const dOut = norm(last.x - prev.x, last.y - prev.y);

		const ctrl: Pt[] = [
			{ x: head.x + dIn.x * tail, y: head.y + dIn.y * tail },
			...waypoints,
			{ x: last.x + dOut.x * tail, y: last.y + dOut.y * tail },
		];

		const pts: Pt[] = [ctrl[0]];
		for (let i = 1; i < ctrl.length - 1; i++) {
			const p = ctrl[i];
			const a = ctrl[i - 1];
			const b = ctrl[i + 1];
			const la = Math.hypot(a.x - p.x, a.y - p.y);
			const lb = Math.hypot(b.x - p.x, b.y - p.y);
			if (la === 0 || lb === 0) continue;
			const r = Math.min(radius, la * 0.45, lb * 0.45);
			const A = { x: p.x + ((a.x - p.x) / la) * r, y: p.y + ((a.y - p.y) / la) * r };
			const B = { x: p.x + ((b.x - p.x) / lb) * r, y: p.y + ((b.y - p.y) / lb) * r };
			pts.push(A);
			const STEPS = 10;
			for (let s = 1; s < STEPS; s++) {
				const t = s / STEPS;
				const mt = 1 - t;
				pts.push({
					x: mt * mt * A.x + 2 * mt * t * p.x + t * t * B.x,
					y: mt * mt * A.y + 2 * mt * t * p.y + t * t * B.y,
				});
			}
			pts.push(B);
		}
		pts.push(ctrl[ctrl.length - 1]);

		const arc = new Float64Array(pts.length);
		for (let i = 1; i < pts.length; i++) {
			arc[i] = arc[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
		}
		return { pts, arc, length: arc[arc.length - 1] };
	};

	const path = $derived.by(() => buildPath(props.waypoints, props.width));

	// Scratch for the two-pass build: centres are laid down (with the drape) before tangents are
	// taken, so the normals follow the draped curve rather than the straight one.
	const cx = new Float64Array(SECTIONS);
	const cy = new Float64Array(SECTIONS);
	const cs = new Float64Array(SECTIONS);
	const tx = new Float64Array(SECTIONS);
	const ty = new Float64Array(SECTIONS);

	$effect(() => {
		const { pts, arc, length } = path;
		const width = props.width;
		const time = props.time;
		const seed = props.seed;
		const revealed = length * clamp01(props.progress);

		// Nothing meaningful to draw yet — keep the mesh off rather than emitting degenerate tris.
		if (revealed < width * 0.5) {
			container.visible = false;
			return;
		}
		container.visible = true;

		shadow.position.set(width * 0.18, width * 0.4);

		const turns = TWIST_TURNS[Math.abs(Math.round(seed)) % TWIST_TURNS.length];
		// The swallowtail cannot be deeper than the ribbon currently is long.
		const notch = Math.min(width * 0.85, revealed * 0.28);
		// One glint sweeps the length, then a gap before the next.
		const glintAt = ((time * 0.26 + seed * 0.37) % 1.7) - 0.35;

		// Pass 1 — centres along the path, pushed off it by the drape.
		let cursor = 0;
		for (let i = 0; i < SECTIONS; i++) {
			const target = (revealed * i) / (SECTIONS - 1);
			while (cursor < arc.length - 2 && arc[cursor + 1] < target) cursor++;
			const span = arc[cursor + 1] - arc[cursor];
			const t = span > 0 ? (target - arc[cursor]) / span : 0;
			const a = pts[cursor];
			const b = pts[cursor + 1];
			const px = a.x + (b.x - a.x) * t;
			const py = a.y + (b.y - a.y) * t;
			const d = norm(b.x - a.x, b.y - a.y);

			const s = length > 0 ? target / length : 0;
			cs[i] = s;
			// Pinned to zero at both ends: the tails hang off the board, they do not flap.
			const env = Math.sin(Math.PI * s) ** 0.7;
			const drape = Math.sin(s * TAU * 1.6 + seed * 2.1 + time * 0.55) * width * 0.22 * env;
			cx[i] = px - d.y * drape;
			cy[i] = py + d.x * drape;
		}

		// Pass 2 — tangents off the draped centreline.
		for (let i = 0; i < SECTIONS; i++) {
			const i0 = i > 0 ? i - 1 : i;
			const i1 = i < SECTIONS - 1 ? i + 1 : i;
			const d = norm(cx[i1] - cx[i0], cy[i1] - cy[i0]);
			tx[i] = d.x;
			ty[i] = d.y;
		}

		// Pass 3 — twist, width, shading, forked ends.
		for (let i = 0; i < SECTIONS; i++) {
			const s = cs[i];
			const env = Math.sin(Math.PI * s) ** 0.7;
			const theta =
				TAU * turns * s +
				env * (0.5 * Math.sin(TAU * 1.7 * s + seed * 1.9) + 0.42 * Math.sin(time * 0.8 + s * 4.4 + seed));
			// cos of the twist angle IS the facing: +1 front-on, 0 edge-on, -1 showing the reverse.
			const facing = Math.cos(theta);
			const face = Math.abs(facing);

			// A ribbon foreshortens to nothing where it twists; the floor keeps a crease visible
			// instead of a gap, and the lookup texture lights that crease.
			const halfWidth = width * 0.5 * (0.26 + 0.74 * face ** 0.8);

			// Brighten toward the lit end of the lookup WITHOUT crossing into the other face: the
			// glint travels over whichever side happens to be showing.
			const glint = Math.exp(-(((s - glintAt) / 0.11) ** 2));
			const lit = Math.min(1, face + glint * 0.4);
			const v = (facing < 0 ? -lit : lit) * 0.5 + 0.5;

			// Swallowtail: within `notch` of either end the centre vertex stays put while the edge
			// vertices run on to the tip, which forks the cut into a V.
			const fromStart = s * length;
			const fromEnd = revealed - fromStart;
			let pull = 0;
			if (fromStart < notch) pull += notch - fromStart;
			if (fromEnd < notch) pull -= notch - fromEnd;

			const nx = -ty[i];
			const ny = tx[i];
			const o = i * 6;
			positions[o] = cx[i] - nx * halfWidth;
			positions[o + 1] = cy[i] - ny * halfWidth;
			positions[o + 2] = cx[i] + tx[i] * pull;
			positions[o + 3] = cy[i] + ty[i] * pull;
			positions[o + 4] = cx[i] + nx * halfWidth;
			positions[o + 5] = cy[i] + ny * halfWidth;

			// Seeing the reverse mirrors the cross-section, so the sheen stays on the same selvedge.
			const near = facing < 0 ? 1 : 0;
			uvs[o] = near;
			uvs[o + 1] = v;
			uvs[o + 2] = 0.5;
			uvs[o + 3] = v;
			uvs[o + 4] = 1 - near;
			uvs[o + 5] = v;
		}

		positionBuffer.update();
		uvBuffer.update();
	});
</script>
