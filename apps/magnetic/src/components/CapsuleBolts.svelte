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
	// The vertical trunk is the SUBJECT and is always lit; forks are occasional punctuation on a
	// much slower clock. It does not read as a static laser because its geometry is rebuilt every
	// 90-230ms and every point carries a sub-pixel per-frame buzz.
	//
	// Coordinates are LOCAL to the capsule container (sprites anchor at 0.5), so x runs -W/2..W/2
	// and y runs -H/2..H/2. The glass interior was measured off the shell art: the straight
	// cylinder section spans x 0.168..0.828 and roughly y 0.24..0.80 of the sprite box.
	// `charged` = a symbol is currently held in the tube. The capsule should visibly react to
	// having caught something, so forks fire three times as often while it is set, and cluster
	// around `focusY` — the symbol's centre, as a fraction of height from the middle (the same
	// convention as TOP_Y/BOT_Y) — so the discharge reads as being drawn TO the object rather than
	// happening at random heights that ignore it.
	// symRx/symRy are the held symbol's CURRENT half-extents in px (already including its pop-in
	// scale), used to land arcs on its surface. Without them the charged state falls back to the
	// idle forks.
	type Props = {
		width: number;
		height: number;
		charged?: boolean;
		focusY?: number;
		symRx?: number;
		symRy?: number;
		// Trunk span as fractions of H from the centre, defaulting to the DESKTOP capsule's glass
		// (TOP_Y/BOT_Y). Callers whose housing has different proportions — notably the portrait tube,
		// which is rotated and whose glass runs nearly its whole length — override these; leaving the
		// desktop values there made the beam cover only 0.41 of the tube and sit off-centre.
		spanTop?: number;
		spanBot?: number;
	};
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
	// `taper` thins a run to a point along its length. Right for a free-ending filament, WRONG for
	// an arc that terminates on a surface — a strike that fades out just before it lands does not
	// read as contact. Previously inferred from `w >= 1`, which coupled thickness to shape.
	type Seg = { pts: Pt[]; w: number; taper?: boolean };
	// A fork is its own timed event, independent of the trunk's restrike (see the $effect).
	// `flare` marks where an arc terminates on the held symbol, drawn as a contact glow.
	type Fork = { segs: Seg[]; born: number; life: number; peak: number; flare?: Pt };

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

	const buildTrunk = (W: number, H: number, topY: number, botY: number): Seg => {
		const y0 = topY * H;
		const y1 = botY * H;

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
		// The trunk is the SUBJECT of the effect, so it is drawn wider than any fork can reach
		// (fork level 1 tops out at ~0.8). It should read as the one bright vertical light.
		return { pts: xs.map((tx, i) => ({ x: tx, y: y0 + ((y1 - y0) * i) / TRUNK_NODES })), w: 1.15 };
	};

	// One fork event: a single branch off the trunk, plus whatever sub-branches it spawns. Kept
	// deliberately sparse — the trunk is the focus and forks are occasional punctuation.
	// `focusF` is a position along the trunk (0 = top, 1 = bottom) to cluster forks around, or null
	// for the idle spread.
	const buildFork = (W: number, H: number, trunk: Pt[], focusF: number | null, topY: number, botY: number): Seg[] => {
		const segs: Seg[] = [];
		const lim = HALF_X * W;

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
				if (Math.abs(px) > lim * 0.95 || py > botY * H || py < topY * H) break;
				pts.push({ x: px, y: py });
				// Sub-branching is heavily damped and stops at level 3 (was level 4 at 0.26/0.17/0.09).
				// Each generation multiplies, so a single fork used to bush out into a shrub of
				// near-horizontal filaments — collectively the main reason the horizontals swamped the
				// trunk even when the top-level fork count was modest.
				if (level < 3 && i >= 1 && Math.random() < (level === 1 ? 0.14 : 0.06)) {
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
			// Bases pulled down (0.5/0.3/0.18) so no fork rivals the 1.15-wide trunk for attention.
			// Focused forks are drawn ~45% heavier: they arc over the held symbol, whose own art is
			// bright and busy, so a filament sized to read against the empty tube disappears against
			// it. The idle spread is unchanged.
			const base =
				(level === 1 ? 0.36 : level === 2 ? 0.2 : 0.11) * (focusF === null ? 1 : 1.45);
			if (pts.length > 1) segs.push({ pts, w: base * (0.3 + Math.random() ** 1.7 * 2.1), taper: true });
			return pts.length;
		};

		// ONE top-level fork per event, at a random height on a random side. This used to lay down
		// 6-9 stratified forks on EVERY trunk restrike (~7x/second), which is why the tube read as a
		// permanent fishbone: the horizontals were never absent long enough for the vertical core to
		// be the subject. Spacing/stratification logic went with it — with a single fork there is
		// nothing to space against, and the gaps it used to fill are now the point.
		const SPAWN_LO = 0.3;
		const SPAWN_HI = 1;
		// RETRY short forks. Forks climb, so one that starts too near the top hits the bound after
		// a node or two and lays down nothing visible — and with only one fork per event, a dud
		// means the event is invisible entirely.
		for (let attempt = 0; attempt < 6; attempt++) {
			const dirx = Math.random() < 0.5 ? 1 : -1;
			// With a focus, draw the height from a TRIANGULAR distribution centred on it (sum of two
			// uniforms) instead of a flat one. A triangle keeps a soft falloff either side, so the
			// bolts crowd the symbol without collapsing into a single hard band at exactly its
			// centre — which reads as a stripe rather than an attraction.
			const f =
				focusF === null
					? SPAWN_LO + (SPAWN_HI - SPAWN_LO) * Math.random()
					: Math.min(
							0.99,
							Math.max(0.02, focusF + (Math.random() + Math.random() - 1) * 0.19),
						);
			const idx = f * (trunk.length - 2) + 0.5;
			const i0 = Math.floor(idx);
			const ff = idx - i0;
			const at = {
				x: trunk[i0].x * (1 - ff) + trunk[i0 + 1].x * ff,
				y: trunk[i0].y * (1 - ff) + trunk[i0 + 1].y * ff,
			};
			// Length skewed SHORT (squared random): mostly stubby forks with the occasional long
			// one, matching how the reference's ink falls off with distance from the axis.
			const laid = branch(at, dirx, 1, W * (0.14 + Math.random() ** 2 * 0.34));
			if (laid >= 4) break;
			segs.length = 0; // discard the dud's sub-branches before retrying
		}
		return segs;
	};

	// ── Arcs that TERMINATE on the held symbol ──────────────────────────────────────────────────
	// The idle forks are a free random walk outward from the trunk: only one end is anchored, so
	// however they are placed they read as hairs sprouting off whatever they overlap. Current
	// flowing INTO an object needs BOTH ends pinned — source and landing point — which is what
	// midpoint displacement gives: recursively split the segment and push each new midpoint
	// perpendicular by a decaying amount. Endpoints never move, so the arc always visibly connects.
	const jaggedPath = (a: Pt, b: Pt, depth: number, offset: number): Pt[] => {
		let pts: Pt[] = [a, b];
		let off = offset;
		for (let d = 0; d < depth; d++) {
			const next: Pt[] = [pts[0]];
			for (let i = 0; i < pts.length - 1; i++) {
				const p = pts[i];
				const q = pts[i + 1];
				const dx = q.x - p.x;
				const dy = q.y - p.y;
				const len = Math.hypot(dx, dy) || 1;
				// Displace along the segment NORMAL, so the kink is always across the run rather
				// than shortening or stretching it.
				const j = (Math.random() - 0.5) * off;
				next.push({ x: (p.x + q.x) / 2 + (-dy / len) * j, y: (p.y + q.y) / 2 + (dx / len) * j });
				next.push(q);
			}
			pts = next;
			off *= 0.55; // finer detail at each level, so the shape reads fractal rather than wavy
		}
		return pts;
	};

	const buildArc = (W: number, H: number, cy: number, rx: number, ry: number): { segs: Seg[]; flare: Pt } => {
		const segs: Seg[] = [];
		// Land on the ART, not on the sprite box. The box is only ~0.62-0.75 filled (the drill's
		// content is 0.62 of its file by width), so striking the box perimeter puts the contact point
		// in empty space beside the object. CONTENT shrinks the landing ellipse onto the visible
		// silhouette.
		const CONTENT = 0.68;
		const lrx = rx * CONTENT;
		const lry = ry * CONTENT;
		// Landing point on that ellipse, biased to the upper half — arcs striking the top and
		// shoulders read clearly, ones landing underneath sit behind the object.
		const ang = Math.random() * Math.PI * 2;
		const lift = Math.sin(ang) * (Math.sin(ang) < 0 ? 1 : 0.55);
		const land: Pt = { x: Math.cos(ang) * lrx, y: cy + lift * lry };

		// Source: the exposed TRUNK above or below the symbol. Sourcing from the glass wall was the
		// obvious idea and is wrong here — the sprite half-width (0.25 W) is wider than the glass
		// bound HALF_X (0.21 W), so a wall-to-symbol arc had almost no span and sometimes ran
		// backwards. Going vertically along the beam gives a span of ~1.6-2.8 ry and reads as current
		// running down the beam and jumping onto the object.
		const up = Math.random() < 0.5 ? -1 : 1;
		const src: Pt = {
			x: (Math.random() - 0.5) * W * 0.06,
			y: cy + up * lry * (1.6 + Math.random() * 1.2),
		};

		const span = Math.hypot(land.x - src.x, land.y - src.y);
		const main = jaggedPath(src, land, 5, span * 0.28);
		segs.push({ pts: main, w: 0.8 + Math.random() * 0.35 });

		// One optional spur peeling off partway, dying in open space — real strikes rarely arrive as
		// a single clean channel.
		if (Math.random() < 0.55) {
			const i = 2 + Math.floor(Math.random() * (main.length - 6));
			const from = main[i];
			const a2 = Math.atan2(land.y - src.y, land.x - src.x) + (Math.random() - 0.5) * 1.6;
			const l2 = span * (0.2 + Math.random() * 0.3);
			const to = { x: from.x + Math.cos(a2) * l2, y: from.y + Math.sin(a2) * l2 };
			segs.push({ pts: jaggedPath(from, to, 4, l2 * 0.3), w: 0.3 + Math.random() * 0.18, taper: true });
		}
		return { segs, flare: land };
	};

	const makeArc = (now: number, W: number, H: number, cy: number, rx: number, ry: number): Fork => {
		const { segs, flare } = buildArc(W, H, cy, rx, ry);
		return { segs, flare, born: now, life: 120 + Math.random() * 130, peak: 0.9 + Math.random() * 0.25 };
	};

	const makeFork = (now: number, W: number, H: number, trunk: Pt[], focusF: number | null, topY: number, botY: number): Fork => ({
		segs: buildFork(W, H, trunk, focusF, topY, botY),
		born: now,
		// A fork is a discharge, not a steady light: it flashes and dies well before the next one.
		// Focused forks live a little longer and peak brighter — they compete with the lit symbol
		// underneath, so the idle values read as a faint flicker over it.
		life: (focusF === null ? 130 : 190) + Math.random() * 170,
		peak: (focusF === null ? 0.7 : 0.95) + Math.random() * 0.3,
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
		const chunks = seg.taper ? TAPER : NO_TAPER;
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
		// Exactly ONE trunk at a time. Keeping two alive at staggered ages drew two vertical cores.
		// The single trunk RESTRIKES: its geometry is rebuilt outright every 90-230ms while
		// brightness stays continuous, which is what the reference does frame to frame.
		//
		// Forks are on their OWN clock, deliberately much slower than the trunk's. Previously they
		// were rebuilt WITH the trunk, so ~7 fork volleys landed every second and the horizontals
		// were effectively continuous. Now one fires roughly every 0.5-2s and dies inside ~300ms,
		// leaving the bare vertical beam visible most of the time.
		// Resolved once per effect run: the caller's housing proportions, or the desktop defaults.
		const topY = props.spanTop ?? TOP_Y;
		const botY = props.spanBot ?? BOT_Y;
		let trunk: Seg | null = null;
		let trunkBorn = 0;
		let trunkLife = 0;
		let forks: Fork[] = [];
		let nextForkAt = 0;
		const tick = (now: number) => {
			raf = requestAnimationFrame(tick);
			const g = boltG;
			if (!g || g.destroyed) return;
			if (!trunk || now - trunkBorn >= trunkLife) {
				trunk = buildTrunk(W, H, topY, botY);
				trunkBorn = now;
				trunkLife = 90 + Math.random() * 140;
			}
			if (now >= nextForkAt) {
				// Usually a single fork; occasionally two at once so the cadence is not metronomic.
				const n = Math.random() < 0.32 ? 2 : 1;
				// While a symbol is held, discharge as arcs that LAND on it rather than as forks that
				// radiate past it — see buildArc. Falls back to the idle forks if the parent did not
				// supply the symbol's extents.
				const rx = props.symRx ?? 0;
				const ry = props.symRy ?? 0;
				const held = !!props.charged && rx > 1 && ry > 1;
				const cy = (props.focusY ?? 0) * H;
				const focusF =
					props.charged && props.focusY != null
						? Math.min(1, Math.max(0, (props.focusY - topY) / (botY - topY)))
						: null;
				for (let k = 0; k < n; k++) {
					const f = held
						? makeArc(now, W, H, cy, rx, ry)
						: makeFork(now, W, H, trunk.pts, focusF, topY, botY);
					if (f.segs.length) forks.push(f);
				}
				// 0.17-0.7s between events (was 0.5-2.0s). Frequency is raised HERE rather than by
				// spawning more forks per event: several forks landing at once is what read as a
				// fishbone, whereas a faster stream of single strikes reads as a more energetic arc
				// and still leaves the bare trunk visible a good share of the time.
				//
				// While a symbol is held, the interval is cut to a third (~57-233ms) so roughly three
				// times as many forks are in flight — the tube reads as reacting to its catch. Read
				// from props inside the rAF callback rather than the effect body on purpose: doing it
				// in the body would make `charged` a dependency and tear down/restart the animation
				// every time a symbol enters or leaves.
				const boost = props.charged ? 3 : 1;
				nextForkAt = now + (170 + Math.random() * 530) / boost;
			}
			forks = forks.filter((f) => now - f.born < f.life);

			const t = now / 1000;
			g.clear();

			// Soft electrode glow — concentric low-alpha discs rather than one hard circle, which
			// read as a white ball sitting in the tube.
			const pulse = 0.85 + 0.15 * Math.sin(t * 13);
			// BOTH ends, not just the top. A single glow reads as a bright blob capping one end of the
			// beam — wrong for any housing with electrodes at both ends, and obvious once the component
			// was rotated into the horizontal portrait tube.
			for (const endY of [topY, botY]) {
				for (const [r, al] of [
					[0.115, 0.042],
					[0.07, 0.072],
					[0.035, 0.14],
				] as const) {
					g.circle(0, endY * H, W * r * pulse);
					g.fill({ color: 0x9fe0ff, alpha: al * pulse });
				}
			}

			// Trunk brightness is a continuous flicker, NOT an attack/decay envelope — the beam is
			// always present and simply changes shape, so fading it in and out would read as a
			// pulsing lamp instead of live current.
			const a = 0.8 + 0.2 * Math.sin(t * 70) * Math.sin(t * 23);
			strokeSeg(g, trunk, a, W, t, 0);

			// Forks DO get an envelope, precisely because they are transient: a hard attack and a
			// quick decay reads as a discharge. Popping them on and off at full alpha instead made
			// each one look like a light being switched.
			for (let b = 0; b < forks.length; b++) {
				const f = forks[b];
				const u = (now - f.born) / f.life;
				// Decay exponent 1.35 rather than 1.6: at 1.6 a fork spent most of its life already
				// too dim to see, so raising the spawn rate barely changed how often one was actually
				// visible (measured: 23% -> 20% of frames, i.e. no change). Holding brightness longer
				// is what converts a higher spawn rate into a visibly livelier tube.
				const env = u < 0.1 ? u / 0.1 : Math.pow(1 - (u - 0.1) / 0.9, 1.35);
				const fa = f.peak * a * env;
				for (let s = 0; s < f.segs.length; s++) strokeSeg(g, f.segs[s], fa, W, t, b * 3.1 + s * 0.7);
				// Contact flare where an arc meets the symbol. Without it the arc just stops at the
				// surface and reads as a line drawn over the art rather than current landing on it.
				if (f.flare) {
					for (const [r, al] of [
						[0.075, 0.05],
						[0.042, 0.1],
						[0.02, 0.22],
					] as const) {
						g.circle(f.flare.x, f.flare.y, W * r);
						g.fill({ color: 0xbfe9ff, alpha: al * fa });
					}
				}
			}
		};
		raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
	});
</script>

<Graphics blendMode="add" draw={(gr) => (boltG = gr as unknown as BoltG)} />
