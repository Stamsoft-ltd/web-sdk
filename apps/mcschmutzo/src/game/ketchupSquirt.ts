// Structural slice of PIXI.Graphics (apps can't type-import 'pixi.js' directly — see pixi-svelte).
export type SquirtGraphics = {
	moveTo: (x: number, y: number) => SquirtGraphics;
	lineTo: (x: number, y: number) => SquirtGraphics;
	stroke: (style: object) => unknown;
	circle: (x: number, y: number, r: number) => { fill: (style: object) => unknown; stroke: (style: object) => unknown };
};

// Sauce squirt, shared by the board chef's ketchup bottle and the sauce-bottle symbols. Fully
// deterministic off a time value (no per-frame state): particles are emitted along the nozzle axis
// over EMIT ms with a pressure curve (spikes, then fades — the head flies furthest, the tail
// dribbles), each on its own ballistic arc under gravity. While young they're drawn joined as one
// tapered glossy rope still attached to the nozzle; each then snaps (Plateau–Rayleigh style, head
// first) into a drop of its own size, drawn as a small teardrop along its motion. A last bead oozes
// off the nozzle after the squeeze. Everything is scaled by `unit` (px), so the same squirt reads
// right on a full-height chef (unit = canvas height) and on a small symbol.

export const SQUIRT_EMIT = 380; // ms of squeezing
const EMIT_DT = 13; // ms between emitted particles
export const SQUIRT_LIFE = 1500; // ms a drop lives after emission

export const squirtHash = (n: number) => {
	const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
	return x - Math.floor(x);
};

/** Darker rim shade of a sauce colour (for the drop/rope outline). */
export const sauceDark = (color: number) =>
	(((color >> 16) & 0xff) * 0.45) << 16 | (((color >> 8) & 0xff) * 0.45) << 8 | ((color & 0xff) * 0.45);

export type SquirtOptions = {
	/** ms since the squeeze began (draws nothing outside 0 … EMIT + LIFE). */
	u: number;
	/** Length scale in px: speeds, gravity, rope width and drop sizes are all fractions of it. */
	unit: number;
	/** Nozzle tip + axis direction (radians) at `ms` after the squeeze began. */
	nozzleAt: (ms: number) => { x: number; y: number; dir: number };
	color: number;
	dark?: number;
	/** Drops fade out as they fall past this y (over `floorBand` px). */
	floorY?: number;
	floorBand?: number;
	/** Varies the particle pattern between instances. */
	seed?: number;
	/** Rope/drop thickness multiplier (a short squirt on a small bottle still wants a fat rope). */
	widthScale?: number;
};

export const drawSauceSquirt = (g: SquirtGraphics, o: SquirtOptions) => {
	const { u, unit: H } = o;
	if (u < 0 || u > SQUIRT_EMIT + SQUIRT_LIFE) return;
	const color = o.color;
	const dark = o.dark ?? sauceDark(color);
	const seed = o.seed ?? 0;
	const ws = o.widthScale ?? 1;
	const hash = (n: number) => squirtHash(n + seed * 101.7);
	const G = 2.5 * H; // px/s²
	const pressure = (e: number) => Math.min(1, e / 45) * Math.pow(Math.max(0, 1 - e / SQUIRT_EMIT), 0.55);
	type P = { x: number; y: number; vx: number; vy: number; w: number; age: number; i: number };
	const ps: P[] = [];
	const n = Math.floor(SQUIRT_EMIT / EMIT_DT);
	for (let i = 0; i <= n; i++) {
		const e = i * EMIT_DT;
		const age = (u - e) / 1000;
		if (age < 0) break;
		const pr = pressure(e);
		const noz = o.nozzleAt(e);
		const jit = (hash(i * 3.1) - 0.5) * 0.05;
		const speed = H * (0.38 + 0.45 * pr) * (0.97 + 0.06 * hash(i * 7.7));
		const vx = Math.cos(noz.dir + jit) * speed;
		const vy0 = Math.sin(noz.dir + jit) * speed;
		ps.push({
			x: noz.x + vx * age,
			y: noz.y + vy0 * age + 0.5 * G * age * age,
			vx,
			vy: vy0 + G * age,
			w: H * 0.019 * ws * (0.3 + 0.7 * pr), // sauce is thick: a fat, cohesive rope
			age,
			i,
		});
	}
	const breakAge = (i: number) => 0.22 + 0.25 * hash(i * 5.3) + 0.001 * i; // head snaps first
	const floorY = o.floorY ?? Infinity;
	const floorBand = o.floorBand ?? H * 0.1;
	const fade = (p: P) => {
		const life = 1 - Math.max(0, (p.age * 1000 - (SQUIRT_LIFE - 350)) / 350);
		const floor = 1 - Math.max(0, (p.y - floorY) / floorBand);
		return Math.max(0, Math.min(life, floor));
	};
	// Rope: consecutive unbroken particles joined (newest end pinned to the nozzle while squeezing).
	const rope: P[][] = [];
	let run: P[] = [];
	for (const p of ps) {
		if (p.age < breakAge(p.i)) run.push(p);
		else if (run.length) (rope.push(run), (run = []));
	}
	if (u <= SQUIRT_EMIT) {
		const noz = o.nozzleAt(u);
		run.push({ x: noz.x, y: noz.y, vx: 0, vy: 0, w: run.at(-1)?.w ?? H * 0.004, age: 0, i: n + 1 });
	}
	if (run.length) rope.push(run);
	for (const r of rope) {
		for (let k = 0; k + 1 < r.length; k++) {
			const a = r[k];
			const b = r[k + 1];
			g.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ width: ((a.w + b.w) / 2) * 1.25, color: dark, alpha: 0.55, cap: 'round' });
		}
		for (let k = 0; k + 1 < r.length; k++) {
			const a = r[k];
			const b = r[k + 1];
			g.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ width: (a.w + b.w) / 2, color, cap: 'round' });
		}
		// Wet highlight running along the rope (offset up-left).
		for (let k = 0; k + 1 < r.length; k++) {
			const a = r[k];
			const b = r[k + 1];
			const off = a.w * 0.2;
			g.moveTo(a.x - off, a.y - off).lineTo(b.x - off, b.y - off).stroke({ width: a.w * 0.22, color: 0xffffff, alpha: 0.35, cap: 'round' });
		}
	}
	// Drops: each snapped particle (half merge away) as a teardrop with its own size.
	const drop = (x: number, y: number, vx: number, vy: number, r: number, al: number) => {
		const sp = Math.hypot(vx, vy) || 1;
		const ux = vx / sp;
		const uy = vy / sp;
		const stretch = Math.min(1, sp / H); // faster = more elongated
		g.circle(x, y, r * 1.18).fill({ color: dark, alpha: 0.5 * al });
		g.circle(x - ux * r * (0.7 + 0.6 * stretch), y - uy * r * (0.7 + 0.6 * stretch), r * 0.62).fill({ color, alpha: al });
		g.circle(x - ux * r * (1.2 + 1.1 * stretch), y - uy * r * (1.2 + 1.1 * stretch), r * 0.3).fill({ color, alpha: al });
		g.circle(x, y, r).fill({ color, alpha: al });
		g.circle(x - r * 0.32, y - r * 0.34, r * 0.3).fill({ color: 0xffffff, alpha: 0.5 * al });
	};
	for (const p of ps) {
		if (p.age < breakAge(p.i)) continue;
		if (hash(p.i * 2.3) < 0.5) continue; // merged into a neighbour → fewer, bigger globs
		const al = fade(p);
		if (al <= 0) continue;
		drop(p.x, p.y, p.vx, p.vy, (p.w / 2) * (0.75 + 0.8 * hash(p.i * 9.1)), al);
	}
	// The last bead: swells on the nozzle after the squeeze, pinches off and falls.
	const bu = (u - SQUIRT_EMIT - 120) / 900;
	if (bu > 0 && bu < 1) {
		const noz = o.nozzleAt(u);
		const swell = Math.min(1, bu / 0.45);
		const fall = Math.max(0, (bu - 0.45) / 0.55);
		const r = H * 0.0075 * ws * (0.4 + 0.6 * swell);
		const y = noz.y + r * 0.6 + fall * fall * H * 0.35;
		const al = Math.min(1 - Math.max(0, (bu - 0.85) / 0.15), 1 - Math.max(0, (y - floorY) / floorBand));
		if (al <= 0) return;
		if (fall === 0) {
			// still attached: a short neck back to the tip
			g.moveTo(noz.x, noz.y).lineTo(noz.x, y).stroke({ width: r * 0.9, color, cap: 'round' });
		}
		drop(noz.x, y, 0, fall > 0 ? H : 1, r, al);
	}
};
