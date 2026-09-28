/* Background birds (user 2026-09-25: "small bird or 2-3 birds but small", then "focus on this
   area cause it stays a bit empty" — the open sky left of the board). A Svelte action for a
   full-size, pointer-transparent layer: every few seconds a flock of one to three flies through it.
   With a `gutter` (the box of whatever blocks the middle of the sky), most flights stay in the open
   sky to its left: in from the screen edge, a wide bank through the gutter, then out over the top
   or back the way they came. The rest cross the whole sky. Each bird is the 4-frame strip from
   scripts/build-birds.py, flapping on its own phase; everything is WAAPI and inline style, so the
   action needs no CSS from the screen that uses it. Nothing runs with reduced motion. */

/* Two kinds ("make the birds different sizes so they are either closer or different birds",
   user 2026-09-25). The gull is seen from behind, so it needs no facing; the sparrow is drawn in
   profile facing right and is mirrored whenever it flies left. The sparrow is the smaller bird,
   flaps faster and flies the dipping, bounding line small birds fly. */
const SPECIES = [
	{
		strip: './assets/veggie-salad/pixel/background/bird.webp',
		aspect: 5 / 11,
		profile: false,
		size: 1,
		flapMs: [500, 700],
		bob: 1,
		weight: 0.6,
	},
	{
		strip: './assets/veggie-salad/pixel/background/bird-sparrow.webp',
		aspect: 7 / 12,
		profile: true,
		size: 0.85,
		flapMs: [240, 340],
		bob: 2.4,
		weight: 0.4,
	},
] as const;

type Options = {
	/** The box that hides the sky's middle (the board); omitted = crossing flights only. */
	gutter?: () => DOMRect | undefined;
	/** True while birds should not spawn (a bonus garden is up). */
	paused?: () => boolean;
	/** Bird width in px for this viewport. */
	size?: () => number;
};

export function birdFlight(node: HTMLElement, options: Options = {}) {
	let timer: ReturnType<typeof setTimeout> | undefined;
	let destroyed = false;
	let flocks = 0;
	const animations = new Set<Animation>();
	if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
		return { destroy: () => undefined };
	}
	const rand = (min: number, max: number) => min + Math.random() * (max - min);
	const schedule = (min: number, max: number) => {
		timer = setTimeout(spawn, rand(min, max));
	};
	const birdWidth = () =>
		options.size?.() ?? Math.max(15, Math.min(26, window.innerWidth * 0.016));

	const spawn = () => {
		if (destroyed) return;
		// Flocks run on their own clock, so a near bird and a far one can share the sky; never more
		// than two flocks up at once.
		if (document.hidden || options.paused?.() || flocks >= 2) {
			schedule(4000, 8000);
			return;
		}
		flocks += 1;
		schedule(7000, 15000);
		const field = node.getBoundingClientRect();
		const width = field.width || window.innerWidth;
		const height = field.height || window.innerHeight;
		const blocker = options.gutter?.();
		const gutter = blocker ? blocker.left - field.left : 0;
		const inGutter = gutter > 90 && Math.random() < 0.75;
		const species = Math.random() < SPECIES[0].weight ? SPECIES[0] : SPECIES[1];
		// Distance, 0 far .. 1 near, one per flock: near birds are larger and cross faster, far
		// ones are small, slow and a little hazed into the sky, so the sky reads as having depth.
		const depth = Math.random();
		// Mostly lone birds; a pair now and then, three rarely ("i think always by 2 flying", user
		// 2026-09-25).
		const roll = Math.random();
		const count = species.profile ? (roll < 0.8 ? 1 : 2) : roll < 0.6 ? 1 : roll < 0.87 ? 2 : 3;
		const leftToRight = inGutter || Math.random() < 0.5;
		const skyBottom = Math.min(height * 0.5, (blocker?.bottom ?? height) - field.top);
		const top = inGutter ? rand(height * 0.08, skyBottom * 0.85) : height * rand(0.05, 0.3);
		// Unhurried ("now they are very quick", user 2026-09-25): about twice the first timings. Near
		// birds still cross a little faster than far ones.
		const pace = 1.2 - depth * 0.35;
		const duration =
			(inGutter
				? rand(14000, 20000)
				: rand(22000, 34000) * Math.max(0.7, Math.min(1.3, width / 1400))) * pace;
		const bob = Math.min(9, height * 0.012) * species.bob * (0.6 + depth * 0.6);
		// Gutter path, a quadratic Bezier: the edge, a bank well inside the gutter, the exit above
		// the window or back off the left edge. Every control point is fixed per flight.
		const exitUp = Math.random() < 0.55;
		const p1: [number, number] = [gutter * rand(0.55, 0.85) * 1.6, -rand(40, 140)];
		const p2: [number, number] = exitUp
			? [gutter * rand(0.3, 0.7), -top - 60]
			: [-60, -rand(30, 105)];
		const gutterPoint = (t: number): [number, number] => {
			const u = 1 - t;
			return [2 * u * t * p1[0] + t * t * p2[0] - 40 * u * u, 2 * u * t * p1[1] + t * t * p2[1]];
		};
		const w = birdWidth() * species.size * (0.5 + depth * 1.1);
		const haze = depth < 0.35 ? 0.7 + depth : 1;
		let pending = count;
		for (let i = 0; i < count; i++) {
			const bird = document.createElement('span');
			// Followers trail the leader, a little above or below, a touch smaller or larger.
			const lag = i === 0 ? 0 : rand(18, 42) * i;
			const dy = i === 0 ? 0 : rand(-14, 14);
			const scale = i === 0 ? 1 : rand(0.8, 1);
			// The outer span flies the path; the inner one carries the art, the wing beat and the
			// facing, so a turn is its own instant mirror and never rides the path's interpolation.
			const art = document.createElement('span');
			Object.assign(bird.style, {
				position: 'absolute',
				left: '0',
				top: `${top + dy}px`,
				width: `${w}px`,
				height: `${w * species.aspect}px`,
				opacity: String(haze),
				pointerEvents: 'none',
				willChange: 'transform',
			});
			Object.assign(art.style, {
				position: 'absolute',
				inset: '0',
				background: `url('${species.strip}') 0 0 / 400% 100% no-repeat`,
				imageRendering: 'pixelated',
			});
			bird.append(art);
			node.append(bird);
			const flap = art.animate(
				[{ backgroundPosition: '0 0' }, { backgroundPosition: `${-w * 4}px 0` }],
				{
					duration: rand(species.flapMs[0], species.flapMs[1]),
					iterations: Infinity,
					easing: 'steps(4)',
					delay: -rand(0, 600),
				},
			);
			const from = leftToRight ? -40 - lag : width + 40 + lag;
			const to = leftToRight ? width + 40 + (80 - lag) : -40 - (80 - lag);
			const phase = rand(0, Math.PI * 2);
			// Sparrows bound (sharp dips between wing bursts); gulls roll gently.
			const wobble = species.profile
				? (t: number) => -Math.abs(Math.sin(phase + t * Math.PI * 7)) * bob
				: (t: number) => Math.sin(phase + t * Math.PI * 5) * bob;
			const point = (t: number): [number, number] => {
				if (!inGutter) return [from + (to - from) * t, wobble(t)];
				const [x, y] = gutterPoint(t);
				return [x - lag, y + wobble(t)];
			};
			const steps = inGutter ? 16 : 4;
			const frames = Array.from({ length: steps + 1 }, (_, k) => {
				const [px, py] = point(k / steps);
				return { transform: `translate3d(${px}px, ${py}px, 0) scale(${scale})` };
			});
			const flight = bird.animate(frames, { duration, easing: 'linear', fill: 'forwards' });
			animations.add(flight);
			animations.add(flap);
			// A profile bird faces the way it is going. The heading is read off the path at fine
			// steps and every reversal becomes two keyframes at the same offset — a true step, not
			// the squeeze-through-zero a scale tween drew ("when rotates animation is not ok", user
			// 2026-09-25).
			if (species.profile) {
				const SAMPLES = 240;
				const facing = (t: number) => {
					const a = point(Math.max(0, t - 0.002))[0];
					const b = point(Math.min(1, t + 0.002))[0];
					return b - a < 0 ? -1 : 1;
				};
				let current = facing(0);
				const turns: Keyframe[] = [{ offset: 0, transform: `scaleX(${current})` }];
				for (let k = 1; k <= SAMPLES; k++) {
					const t = k / SAMPLES;
					const next = facing(t);
					if (next !== current) {
						turns.push({ offset: t, transform: `scaleX(${current})` });
						turns.push({ offset: t, transform: `scaleX(${next})` });
						current = next;
					}
				}
				turns.push({ offset: 1, transform: `scaleX(${current})` });
				const turn = art.animate(turns, { duration, easing: 'linear', fill: 'forwards' });
				animations.add(turn);
				flight.finished.catch(() => undefined).then(() => {
					animations.delete(turn);
					turn.cancel();
				});
			}
			flight.finished
				.catch(() => undefined)
				.then(() => {
					animations.delete(flight);
					animations.delete(flap);
					flap.cancel();
					bird.remove();
					pending -= 1;
					if (pending === 0) flocks -= 1;
				});
		}
	};
	schedule(1200, 4000);
	return {
		destroy() {
			destroyed = true;
			if (timer) clearTimeout(timer);
			for (const animation of animations) animation.cancel();
		},
	};
}
