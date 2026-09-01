<script lang="ts" module>
	/**
	 * The Coaster Wild's splat, drawn per frame so that it can actually churn.
	 *
	 * This Wild is not a reel symbol that comes and goes. Once it lands it stays for the rest of the
	 * feature, and there can be a dozen of them sitting on the board across a dozen spins — so it is
	 * the one thing in this game a player stares at while nothing else is moving. As a PNG it could
	 * only ever be TRANSFORMED: scaled, turned, faded. None of those is what slime does. What slime
	 * does is churn, and a churning outline is a shape that has to be recomputed rather than a
	 * picture that has to be moved. Hence a <Graphics> rebuilt every frame instead of a <Sprite>.
	 *
	 * WHAT IT IS A REBUILD OF. The design's splat is kept at `scripts/coaster-wild/source/` as a
	 * SPECIFICATION rather than as art, and `build_coaster_wild.py` measures it. Its two greens, its
	 * rim thickness and its droplets are that measurement; the shape below is a model fitted to it.
	 *
	 * WHY A UNION OF DISCS AND NOT A SUM OF SINES. The obvious way to draw a lumpy blob is to wobble
	 * a circle's radius with a few sine terms, and it was tried first. It cannot work here, and the
	 * arithmetic says why: a term `a·sin(nθ)` reads as smooth only while `a·n²` stays near 1, and the
	 * reference's lumps are sixteen-per-turn at an amplitude of 0.078 — `a·n²` of twenty. Reproduce
	 * its measured harmonics honestly and you get a shape with the right lumpiness and the WRONG
	 * curvature: a star with cusps. The reference's lobes are round because they ARE round — it is
	 * drawn as blobs thrown off a body, so it is modelled as blobs thrown off a body. The outline is
	 * the union of a central disc and `LOBES` smaller ones, sampled outward along each spoke, which
	 * gives rounded tips and the deep narrow necks between them for free.
	 *
	 * HOW IT MOVES. Every lobe's distance, size and bearing rides its own slow sine, and each lobe
	 * takes its phase from `k × PHI` — the golden angle — so no two are ever doing the same thing and
	 * the pattern does not repeat within a session. Nothing scales and nothing spins: the shape is a
	 * different shape each frame, which is what makes it read as alive rather than as an animation
	 * played on a blob.
	 *
	 * WHAT IT COSTS. Not `POINTS × LOBES`: a lobe can only reach the spokes within `asin(R/d)` of its
	 * bearing, so each one touches about a sixteenth of them and the whole outline costs on the order
	 * of `POINTS` square roots — a couple of hundred, per tile per frame. The tessellation of the
	 * polygon is the real cost, as it was before. If it ever needs to come down, `POINTS` is the
	 * knob, though not far: below about 96 the thin lobes start to show their facets.
	 */

	/** How many ways round the outline is drawn. See the note on cost above. */
	const POINTS = 128;

	const TAU = Math.PI * 2;

	/** The measured greens. Flat, like the rest of the redrawn symbol set. */
	const FILL = 0x448f27;
	const RIM = 0x6fb51a;
	/** Rim thickness, as a share of the blob's mean radius. Measured at 5px against 172.6. */
	const RIM_SHARE = 0.029;

	/**
	 * The blob, in units of the body's own radius: a central disc of `BODY`, and `LOBES` discs of
	 * `LOBE` thrown `THROW` out from the middle. `THROW` is deliberately more than `BODY + LOBE`, so
	 * the lobes stand clear of the body and are joined to it by a neck rather than sitting in it as
	 * bumps — that neck is what makes it a splat and not a flower. `BODY` is deeper than the
	 * reference's own 0.76 because this sign carries copy: the wordmark and the multiplier's plaque
	 * have to rest on slime at every moment of the churn, and a deeper body is what stops a neck
	 * opening under a letter. `scripts/coaster-wild/build_coaster_wild.py` renders the sign assembled
	 * at three moments minutes apart, which is where that gets checked rather than assumed.
	 */
	const LOBES = 16;
	const BODY = 0.88;
	const THROW = 0.93;
	const LOBE = 0.22;

	/**
	 * How far each of those three wanders from its nominal, as a share of it — bearing in units of
	 * the gap between neighbouring lobes. This is where the irregularity comes from: at any instant
	 * the sixteen lobes are at sixteen different points of their own cycles, so the outline is never
	 * the same twice and never symmetrical.
	 */
	const THROW_VARY = 0.16;
	const LOBE_VARY = 0.35;
	const BEARING_VARY = 0.42;

	/** How often each wanders, in turns a second. No two of them commensurate. */
	const THROW_HZ = 0.11;
	const LOBE_HZ = 0.17;
	const BEARING_HZ = 0.074;

	/**
	 * Each lobe's offset into those three cycles, per lobe index. Multiples of the golden angle and
	 * of two other turns that do not divide into it: sixteen samples of any of these are spread about
	 * as evenly as sixteen samples can be, which is what a baked table of random numbers would have
	 * been for, without the table.
	 */
	const THROW_PHASE = 2.39996;
	const LOBE_PHASE = 1.7305;
	const BEARING_PHASE = 4.1231;

	/**
	 * The furthest the outline ever reaches, which is what the blob is sized against. Not derived —
	 * the lobes' cycles beat against each other, so this is the peak measured over four minutes of
	 * the model, rounded up.
	 */
	const MAX_REACH = 1.4;

	/**
	 * The six droplets, as the measurement found them: radius and throw, both in units of the main
	 * blob's mean radius, at angles spread around it. Fixed to the splat rather than orbiting — they
	 * are where it landed — but they creep in and out on one slow shared beat, so they read as part
	 * of the same living thing rather than as dots pasted round it.
	 */
	const DROPLETS = [
		{ angle: 0.42, throw: 1.02, radius: 0.051 },
		{ angle: 1.71, throw: 1.19, radius: 0.044 },
		{ angle: 2.68, throw: 1.19, radius: 0.038 },
		{ angle: 3.55, throw: 1.23, radius: 0.037 },
		{ angle: 4.62, throw: 1.2, radius: 0.037 },
		{ angle: 5.61, throw: 0.98, radius: 0.031 },
	];
	const DRIFT = 0.035;
	const DRIFT_HZ = 0.051;
</script>

<script lang="ts">
	import { Graphics } from 'pixi-svelte';
	import type { ComponentProps } from 'svelte';

	// Taken off <Graphics> rather than written as `PIXI.Graphics`: pixi.js is not a dependency of
	// this app on purpose (it drags a pile of style-preprocessor errors in with it), and pixi-svelte
	// re-exports PIXI as a value, which is not a namespace a type annotation can use.
	type Draw = ComponentProps<typeof Graphics>['draw'];

	type Props = {
		/** The box the splat fills, which is the size the art it replaces was drawn at. */
		width: number;
		height: number;
		/** A clock in seconds that never stops — this thing is never still. */
		clock: number;
		/** Its own offset into that clock, so a board of splats is a dozen blobs and not one. */
		phase?: number;
	};

	const props: Props = $props();

	const draw = $derived.by(() => {
		const time = props.clock;
		const phase = props.phase ?? 0;
		// Sized so the outline's FURTHEST reach lands on the box, rather than its mean — otherwise
		// the lobes grow out past the cell the Wild is covering.
		const rx = (props.width * 0.5) / MAX_REACH;
		const ry = (props.height * 0.5) / MAX_REACH;
		const mean = (rx + ry) * 0.5;
		const step = TAU / POINTS;
		const drift = 1 + DRIFT * Math.sin(TAU * DRIFT_HZ * time + phase);

		const paint: Draw = (graphics) => {
			const radii = new Array<number>(POINTS).fill(BODY);
			for (let lobe = 0; lobe < LOBES; lobe += 1) {
				const distance =
					THROW * (1 + THROW_VARY * Math.sin(TAU * THROW_HZ * time + lobe * THROW_PHASE + phase));
				const size =
					LOBE * (1 + LOBE_VARY * Math.sin(TAU * LOBE_HZ * time + lobe * LOBE_PHASE + phase));
				const bearing =
					(lobe / LOBES) * TAU +
					BEARING_VARY *
						(TAU / LOBES) *
						Math.sin(TAU * BEARING_HZ * time + lobe * BEARING_PHASE + phase);
				// A lobe can only be the outermost thing along a spoke it actually subtends, so only
				// those spokes are visited. This is what keeps the cost at POINTS rather than at
				// POINTS x LOBES — see the note on cost above.
				const spread = size >= distance ? Math.PI : Math.asin(size / distance);
				const first = Math.ceil((bearing - spread) / step);
				const last = Math.floor((bearing + spread) / step);
				for (let index = first; index <= last; index += 1) {
					const away = index * step - bearing;
					const across = distance * Math.sin(away);
					const under = size * size - across * across;
					if (under <= 0) continue;
					const reach = distance * Math.cos(away) + Math.sqrt(under);
					const at = ((index % POINTS) + POINTS) % POINTS;
					if (reach > radii[at]) radii[at] = reach;
				}
			}

			const points: number[] = [];
			for (let index = 0; index < POINTS; index += 1) {
				const spoke = index * step;
				points.push(rx * radii[index] * Math.cos(spoke), ry * radii[index] * Math.sin(spoke));
			}
			graphics
				.poly(points)
				.fill(FILL)
				.stroke({ color: RIM, width: mean * RIM_SHARE * 2 });

			for (const droplet of DROPLETS) {
				// Solid rim colour: at the size these are drawn — a couple of pixels — a two-tone dot is
				// its own outline and nothing else.
				graphics
					.circle(
						rx * droplet.throw * drift * Math.cos(droplet.angle),
						ry * droplet.throw * drift * Math.sin(droplet.angle),
						mean * droplet.radius,
					)
					.fill(RIM);
			}
		};
		return paint;
	});
</script>

<Graphics {draw} />
