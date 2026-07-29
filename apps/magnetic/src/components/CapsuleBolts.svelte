<script lang="ts">
	import { Graphics } from 'pixi-svelte';

	// Procedurally drawn tesla bolts for the capsule interior, replacing the baked flipbook — a
	// fixed cycle always eventually reads as a loop, generated geometry never repeats.
	//
	// Geometry is NODE-based, not angle-based. Integrating small per-step angle changes (the first
	// attempt) can only ever produce smooth curves, which read as plant roots; real lightning is
	// piecewise-LINEAR with sharp kinks. So the trunk is a random walk in x with a restoring pull,
	// joined by straight lines, and branches are short near-horizontal angular walks off it.
	//
	// There is deliberately NO constant vertical beam. Drawing one made the tube look like it held
	// a laser; the continuously-lit core comes from overlapping bolt lifetimes instead.
	//
	// Coordinates are LOCAL to the capsule container (sprites anchor at 0.5), so x runs -W/2..W/2
	// and y runs -H/2..H/2. The glass interior was measured off the shell art: the straight
	// cylinder section spans x 0.168..0.828 and roughly y 0.24..0.80 of the sprite box.
	type Props = { width: number; height: number };
	const props: Props = $props();

	// Vertical bounds are the GLASS, measured off the shell art: the top collar ends at y 0.28 and
	// the base plate starts at y 0.81, so the cylinder interior is 0.30..0.81 of the sprite box.
	// Starting at -0.26 put the strike inside the metal cap.
	const TOP_Y = -0.14; // top of the glass, as a fraction of height from centre
	const BOT_Y = 0.27; // base plate
	// Half-width filaments may occupy. NOT the sprite silhouette (0.330 W) — that is the outer metal
	// edge, and the glass walls have visible thickness, so a filament at 0.26 W plus its bloom
	// spilled across the inside of the left wall. 0.21 keeps the whole stroke on clear glass.
	const HALF_X = 0.21;
	const TRUNK_NODES = 13;

	type Pt = { x: number; y: number };
	type Seg = { pts: Pt[]; w: number };
	type Bolt = { segs: Seg[]; born: number; life: number; peak: number };

	type BoltG = {
		destroyed: boolean;
		clear: () => void;
		moveTo: (x: number, y: number) => void;
		lineTo: (x: number, y: number) => void;
		stroke: (s: object) => void;
		circle: (x: number, y: number, r: number) => unknown;
		fill: (s: object) => void;
	};
	let boltG: BoltG | null = null;

	const buildBolt = (W: number, H: number): Seg[] => {
		const segs: Seg[] = [];
		const lim = HALF_X * W;
		const y0 = TOP_Y * H;
		const y1 = BOT_Y * H;

		// Trunk: essentially STRAIGHT down the middle, with only a slight kink per node. A heavy
		// random walk here (an earlier attempt used 3x this deviation plus hard kicks) reads as a
		// wandering crack rather than the bright vertical core the art has. Deviation is capped at
		// 30% of the glass half-width and pulled back hard each node.
		const xs: number[] = [];
		let x = (Math.random() - 0.5) * W * 0.01;
		for (let i = 0; i <= TRUNK_NODES; i++) {
			xs.push(x);
			// Deviation is capped at 2.5% of W (~6px) with a hard restoring pull, so the core reads
			// as a STRAIGHT vertical light that barely moves — the visible motion is the per-frame
			// sub-pixel buzz in strokeSeg plus the branches restriking, not the beam wandering.
			x = Math.max(
				-W * 0.025,
				Math.min(W * 0.025, x + (Math.random() - 0.5) * W * 0.012 - x * 0.6),
			);
		}
		const trunk: Pt[] = xs.map((tx, i) => ({ x: tx, y: y0 + ((y1 - y0) * i) / TRUNK_NODES }));
		segs.push({ pts: trunk, w: 1 });

		// Branches. Angle is measured from straight-down, so ~1.05-1.5 rad is mostly-sideways but
		// still sloping — which is what the reference forks do. The per-step jitter is LARGE (±0.4
		// rad) so a branch zigzags along its own length; stepping a fixed dx with a tiny dy, as an
		// earlier attempt did, produced ruled horizontal lines and the whole thing read as a
		// fishbone. A branch that reaches the glass stops rather than being clamped — clamping slid
		// it along the wall as a hard vertical line.
		const branch = (start: Pt, dirx: number, level: number, reach: number): number => {
			// Angle is measured from straight-DOWN, so PI/2 is horizontal and anything beyond it
			// climbs. 2.18-2.52 rad puts the forks 40-50 deg ABOVE horizontal, pointing up and out.
			let a = dirx * (2.18 + Math.random() * 0.34);
			// More nodes with larger per-step jitter, so a fork is jagged along its own length
			// rather than a smooth polyline.
			const n = 6 + Math.floor(Math.random() * 5);
			const step = reach / n;
			let px = start.x;
			let py = start.y;
			const pts: Pt[] = [start];
			for (let i = 0; i < n; i++) {
				a += (Math.random() - 0.5) * 0.62;
				// Occasional HARD KINK. Uniform small jitter gives a smooth arc; real filaments
				// change direction abruptly every so often.
				if (Math.random() < 0.22) a += (Math.random() - 0.5) * 1.15;
				// Band is deliberately WIDER than the jitter. When it was narrower the angle kept
				// saturating against the limit, and once pinned consecutive steps reuse the same
				// angle — which is what made forks run dead straight.
				a = (a >= 0 ? 1 : -1) * Math.max(1.7, Math.min(2.95, Math.abs(a)));
				px += Math.sin(a) * step;
				py += Math.cos(a) * step; // cos < 0 past horizontal, so the fork CLIMBS
				// Stop at the glass wall and at BOTH ends of the cylinder — forks now rise, so the
				// top bound matters as much as the base.
				if (Math.abs(px) > lim * 0.95 || py > BOT_Y * H || py < TOP_Y * H) break;
				pts.push({ x: px, y: py });
				if (level < 4 && i >= 1 && Math.random() < (level === 1 ? 0.26 : level === 2 ? 0.17 : 0.09)) {
					branch(
						{ x: px, y: py },
						Math.random() < 0.75 ? dirx : -dirx,
						level + 1,
						reach * (0.4 + Math.random() * 0.3),
					);
				}
			}
			// Fork weight relative to the trunk. The reference's 2px median filament width is measured
			// over the WHOLE fork including its tapered tip, so sizing the base to it (0.26) made the
			// forks too fine; these are the base widths and TAPER handles the thinning.
			// Per-fork thickness JITTER on top of the per-level base: real strikes have a few heavy
			// filaments among thinner ones, and a single width per level made them look stamped.
			// The channel dominates and each generation tapers hard — in the references the trunk is
			// several times the width of its branches, and sub-branches fade to hairlines.
			// Width varies HARD per filament (0.30x to 2.4x, skewed thin) so a strike carries a few
			// heavy channels among many hairlines, as the references do.
			const base = level === 1 ? 0.5 : level === 2 ? 0.3 : level === 3 ? 0.18 : 0.1;
			if (pts.length > 1) segs.push({ pts, w: base * (0.3 + Math.random() ** 1.7 * 2.1) });
			return pts.length;
		};

		// Spawn at RANDOM heights on a random side — one branch per trunk node on both sides gave
		// regular spacing, which is most of what made it look like a fishbone.
		// Raising the FLOOR, not the ceiling: with only one bolt on screen there is no second trunk
		// to fill in, so a low-count strike left the tube visibly bare. 7 is the minimum that always
		// reads as full. Sub-fork rates were pulled back at the same time (0.20/0.08 -> 0.18/0.07)
		// because more top-level branches multiply through them.
		// STRATIFIED placement: the spawn range is split into `count` bands and each fork is placed
		// inside its own band, rather than each picking a uniform-random height. With only 6-9 forks,
		// pure random clusters them and leaves long stretches of the beam bare — which is what made
		// some strikes look empty even when the count was fine. Sides alternate for the same reason.
		const count = 6 + Math.floor(Math.random() * 4);
		const SPAWN_LO = 0.3;
		const SPAWN_HI = 1;
		for (let k = 0; k < count; k++) {
			const bandLo = SPAWN_LO + ((SPAWN_HI - SPAWN_LO) * k) / count;
			const bandHi = SPAWN_LO + ((SPAWN_HI - SPAWN_LO) * (k + 1)) / count;
			// Mostly alternate sides so neither side of the beam is left empty.
			const dirx = (k % 2 === 0 ? 1 : -1) * (Math.random() < 0.82 ? 1 : -1);
			// RETRY short forks. Forks climb, so one that starts too near the top hits the bound after
			// a node or two and lays down nothing visible.
			for (let attempt = 0; attempt < 4; attempt++) {
				const f = bandLo + (bandHi - bandLo) * Math.random();
				const idx = f * (trunk.length - 2) + 0.5;
				const i0 = Math.floor(idx);
				const ff = idx - i0;
				const at = {
					x: trunk[i0].x * (1 - ff) + trunk[i0 + 1].x * ff,
					y: trunk[i0].y * (1 - ff) + trunk[i0 + 1].y * ff,
				};
				// Length skewed SHORT (squared random): mostly stubby forks with the occasional long
				// one, matching how the reference's ink falls off with distance from the axis.
				const laid = branch(at, dirx, 1, W * (0.12 + Math.random() ** 2 * 0.32));
				if (laid >= 4) break;
			}
		}
		return segs;
	};

	const makeBolt = (now: number, W: number, H: number): Bolt => ({
		segs: buildBolt(W, H),
		born: now,
		// Restrike interval. The reference redraws its shape every frame (~120ms), so this is fast.
		life: 90 + Math.random() * 140,
		peak: 0.82 + Math.random() * 0.18,
	});

	// Four passes per filament — very wide dim bloom, wide halo, mid glow, hot thin core. Pixi
	// Graphics has no cheap per-stroke blur, so overlapping translucent widths stand in for it;
	// the widest pass is what stops the bolt reading as a drawn line.
	// Widths are CALIBRATED against the reference frames: its core measures 7px at half-max on a
	// 244px-wide sprite, i.e. 0.029 of W. An earlier guess used a 0.004W core (1px), roughly 3x too
	// thin, which is most of why the bolts read as scratches rather than light.
	// Light build-up: six additive passes from a broad atmospheric haze down to a hot white core.
	// Pixi Graphics has no cheap per-stroke blur, so overlapping translucent widths stand in for it.
	//
	// `ex` is the key parameter — each layer's width scales as pow(filamentWidth, ex). Glow layers
	// use a SUB-linear exponent so a hairline fork still carries a real halo; scaling them linearly
	// gave thin branches a hairline glow, which is why they read as bare white lines with no light
	// around them. Only the hot core tracks filament width exactly.
	const LAYERS = [
		{ w: 0.3, color: 0x0c2264, alpha: 0.014, ex: 0.35 },
		{ w: 0.165, color: 0x143ea5, alpha: 0.024, ex: 0.4 },
		{ w: 0.09, color: 0x2269dc, alpha: 0.046, ex: 0.5 },
		{ w: 0.042, color: 0x5aa5f0, alpha: 0.135, ex: 0.7 },
		{ w: 0.018, color: 0xd7eeff, alpha: 0.42, ex: 0.9 },
		{ w: 0.008, color: 0xffffff, alpha: 0.85, ex: 1 },
	];
	// Branches are drawn in three overlapping chunks of decreasing width so they TAPER to a point.
	// A constant-width polyline reads as a drawn stick; in the reference, filaments measure a median
	// of 2px against the trunk's 11px and thin out along their length. The trunk itself is exempt —
	// it stays full width top to bottom.
	const TAPER = [
		{ lo: 0, hi: 0.4, w: 1 },
		{ lo: 0.34, hi: 0.72, w: 0.62 },
		{ lo: 0.66, hi: 1, w: 0.32 },
	];
	const NO_TAPER = [{ lo: 0, hi: 1, w: 1 }];
	const strokeSeg = (g: BoltG, seg: Seg, a: number, W: number, t: number, seed: number) => {
		const j = W * 0.003 * seg.w;
		const n = seg.pts.length;
		const chunks = seg.w >= 1 ? NO_TAPER : TAPER;
		for (const L of LAYERS) {
			for (const c of chunks) {
				const i0 = Math.floor(c.lo * (n - 1));
				const i1 = Math.min(n, Math.max(Math.floor(c.hi * (n - 1)) + 1, i0 + 2));
				let started = false;
				for (let i = i0; i < i1; i++) {
					const p = seg.pts[i];
					const w = i === 0 ? 0 : j;
					const x = p.x + Math.sin(t * 47 + i * 1.9 + seed) * w;
					const y = p.y + Math.cos(t * 41 + i * 2.7 + seed) * w;
					if (!started) {
						g.moveTo(x, y);
						started = true;
					} else g.lineTo(x, y);
				}
				if (!started) continue;
				g.stroke({
					width: Math.max(0.4, W * L.w * Math.pow(seg.w, L.ex) * c.w),
					color: L.color,
					alpha: L.alpha * a,
					cap: 'round',
					join: 'round',
				});
			}
		}
	};

	$effect(() => {
		const W = props.width;
		const H = props.height;
		if (!W || !H) return;
		let raf = 0;
		// Exactly ONE bolt at a time. Keeping two alive at staggered ages drew two trunks, which is
		// most of what read as "too many vertical lines". Instead the single bolt RESTRIKES: its
		// geometry is rebuilt outright every 90-230ms while brightness stays continuous, which is
		// what the reference does frame to frame.
		let bolt: Bolt | null = null;
		const tick = (now: number) => {
			raf = requestAnimationFrame(tick);
			const g = boltG;
			if (!g || g.destroyed) return;
			if (!bolt || now - bolt.born >= bolt.life) bolt = makeBolt(now, W, H);

			const t = now / 1000;
			g.clear();

			// Soft electrode glow — concentric low-alpha discs rather than one hard circle, which
			// read as a white ball sitting in the tube.
			const pulse = 0.85 + 0.15 * Math.sin(t * 13);
			for (const [r, al] of [
				[0.115, 0.042],
				[0.07, 0.072],
				[0.035, 0.14],
			] as const) {
				g.circle(0, TOP_Y * H, W * r * pulse);
				g.fill({ color: 0x9fe0ff, alpha: al * pulse });
			}

			// Brightness is a continuous flicker, NOT an attack/decay envelope — the bolt is always
			// present and simply changes shape, so fading each strike in and out would read as a
			// pulsing lamp instead of live current.
			const a = bolt.peak * (0.8 + 0.2 * Math.sin(t * 70) * Math.sin(t * 23));
			for (let s = 0; s < bolt.segs.length; s++) strokeSeg(g, bolt.segs[s], a, W, t, s * 0.7);
		};
		raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
	});
</script>

<Graphics blendMode="add" draw={(gr) => (boltG = gr as unknown as BoltG)} />
