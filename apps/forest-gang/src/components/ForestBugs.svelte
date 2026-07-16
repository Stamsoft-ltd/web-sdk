<script lang="ts">
	import { Container, Graphics } from 'pixi-svelte';

	type Props = {
		boardSize: number;
		// Path rectangle overrides (board units, relative to the sprite centre). Defaults trace
		// the border of a full-bleed square art; WinBoard passes the acorn art's actual bounds.
		halfW?: number;
		halfH?: number;
		centerY?: number;
	};
	const { boardSize, halfW, halfH, centerY = 0 }: Props = $props();

	// Full-bleed square art default: the wooden border strip sits ~2.6–8% in from the edge,
	// so the bugs crawl the middle of that strip.
	const INSET = 0.053;

	type Bug = {
		offset: number; // start position along the perimeter (0..1)
		speed: number; // laps per second
		dir: 1 | -1;
		size: number;
		body: number; // elytra color
	};
	const BUGS: Bug[] = [
		{ offset: 0.05, speed: 0.030, dir: 1, size: 1, body: 0xc8351e },
		{ offset: 0.4, speed: 0.024, dir: -1, size: 0.85, body: 0xd06a1c },
		{ offset: 0.75, speed: 0.038, dir: 1, size: 0.72, body: 0xe0442e },
		{ offset: 0.18, speed: 0.027, dir: -1, size: 0.9, body: 0xb52d1a },
		{ offset: 0.55, speed: 0.034, dir: 1, size: 0.78, body: 0xd9552b },
		{ offset: 0.62, speed: 0.021, dir: -1, size: 0.68, body: 0xc8351e },
		{ offset: 0.88, speed: 0.041, dir: 1, size: 0.8, body: 0xe0603a },
		{ offset: 0.3, speed: 0.026, dir: 1, size: 0.65, body: 0xcf3f22 },
	];

	let t = $state(0);
	$effect(() => {
		let raf = 0;
		const t0 = performance.now();
		const tick = (now: number) => {
			t = (now - t0) / 1000;
			raf = requestAnimationFrame(tick);
		};
		raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
	});

	// Rounded-rectangle path along the border. u in [0..1) → position + heading (clockwise).
	const pathPoint = (u: number, Ex: number, Ey: number, r: number) => {
		const SX = 2 * (Ex - r); // horizontal edge length
		const SY = 2 * (Ey - r); // vertical edge length
		const A = (Math.PI / 2) * r; // quarter-arc length
		const P = 2 * (SX + SY) + 4 * A;
		let s = ((u % 1) + 1) % 1 * P;
		// Segments: top edge → TR arc → right edge → BR arc → bottom edge → BL arc → left edge → TL arc
		const segs = [
			{ len: SX, f: (d: number) => ({ x: -Ex + r + d, y: -Ey, a: 0 }) },
			{ len: A, f: (d: number) => arc(Ex - r, -Ey + r, -Math.PI / 2 + d / r, r) },
			{ len: SY, f: (d: number) => ({ x: Ex, y: -Ey + r + d, a: Math.PI / 2 }) },
			{ len: A, f: (d: number) => arc(Ex - r, Ey - r, d / r, r) },
			{ len: SX, f: (d: number) => ({ x: Ex - r - d, y: Ey, a: Math.PI }) },
			{ len: A, f: (d: number) => arc(-Ex + r, Ey - r, Math.PI / 2 + d / r, r) },
			{ len: SY, f: (d: number) => ({ x: -Ex, y: Ey - r - d, a: -Math.PI / 2 }) },
			{ len: A, f: (d: number) => arc(-Ex + r, -Ey + r, Math.PI + d / r, r) },
		];
		for (const seg of segs) {
			if (s <= seg.len) return seg.f(s);
			s -= seg.len;
		}
		return segs[0].f(0);
	};
	const arc = (cx: number, cy: number, ang: number, r: number) => ({
		x: cx + Math.cos(ang) * r,
		y: cy + Math.sin(ang) * r,
		a: ang + Math.PI / 2,
	});

	const drawBug = (g: any, L: number, body: number, phase: number) => {
		g.clear();
		// Legs — three per side, alternating swing (drawn first, under the body)
		for (let side = -1; side <= 1; side += 2) {
			for (let i = 0; i < 3; i++) {
				const bx = -L * 0.28 + i * L * 0.26;
				const swing = Math.sin(phase + i * 2.1 + (side > 0 ? Math.PI : 0)) * L * 0.14;
				g.moveTo(bx, side * L * 0.2);
				g.lineTo(bx + swing, side * L * 0.42);
				g.stroke({ color: 0x1a0d05, width: Math.max(1, L * 0.06) });
			}
		}
		// Antennae
		for (let side = -1; side <= 1; side += 2) {
			g.moveTo(L * 0.5, side * L * 0.06);
			g.lineTo(L * 0.68, side * L * 0.16);
			g.stroke({ color: 0x1a0d05, width: Math.max(1, L * 0.05) });
		}
		// Head
		g.circle(L * 0.38, 0, L * 0.17);
		g.fill(0x1a0d05);
		// Elytra (body)
		g.ellipse(-L * 0.05, 0, L * 0.42, L * 0.3);
		g.fill(body);
		g.stroke({ color: 0x1a0d05, width: Math.max(1, L * 0.04) });
		// Wing split
		g.moveTo(L * 0.32, 0);
		g.lineTo(-L * 0.46, 0);
		g.stroke({ color: 0x1a0d05, width: Math.max(1, L * 0.045) });
		// Spots
		const spots = [
			[0.1, 0.14], [0.1, -0.14], [-0.16, 0.17], [-0.16, -0.17], [-0.34, 0.09], [-0.34, -0.09],
		];
		for (const [sx, sy] of spots) {
			g.circle(sx * L, sy * L, L * 0.055);
			g.fill(0x1a0d05);
		}
	};
</script>

{#each BUGS as bug, i (i)}
	{@const Ex = halfW ?? boardSize * (0.5 - INSET)}
	{@const Ey = halfH ?? boardSize * (0.5 - INSET)}
	{@const r = Math.min(Ex, Ey) * 0.16}
	{@const u = bug.offset + t * bug.speed * bug.dir}
	{@const p = pathPoint(bug.dir === 1 ? u : -u, Ex, Ey, r)}
	{@const L = boardSize * 0.052 * bug.size}
	{@const phase = t * bug.speed * 900}
	{@const waddle = Math.sin(phase * 0.5) * 0.05}
	<Container x={p.x} y={centerY + p.y} rotation={p.a + (bug.dir === 1 ? 0 : Math.PI) + waddle}>
		<Graphics draw={(g) => drawBug(g, L, bug.body, phase)} />
	</Container>
{/each}
