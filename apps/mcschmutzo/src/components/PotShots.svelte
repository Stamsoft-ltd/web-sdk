<script lang="ts">
	import { untrack } from 'svelte';
	import { Container, Graphics, Text } from 'pixi-svelte';

	import AnimatedSymbol from './AnimatedSymbol.svelte';
	import { getContext } from '../game/context';
	import { potCellKey, potState, type PotShot } from '../game/potState.svelte';
	import { SYMBOL_INFO_MAP, SYMBOL_SIZE, SYMBOL_WIDTH } from '../game/constants';
	import { SYMBOL_PARTS } from '../game/symbolParts';

	// Right after soups raise the multiplier (the book's step event, while the soups are still on the
	// board): each soup hops up in its cell and spits a green soup blob carrying its "+N"; the blob
	// arcs over the board into the chef's pot, splashes and sinks. When the last one has sunk,
	// flushPot() lets the pot's plaque tick up and the round moves on. Drawn in canvas px, above the
	// board.
	//
	// The soup that hops is the board's own soup art (same AnimatedSymbol, same size): the cell's
	// board symbol — and, if the cell is locked, its yellow box + held symbol — cross-fade out to it
	// (potState.hidden, read by ReelSymbol / LockedCells) and back in once it has spat. So a soup still
	// on the board just comes alive, and a cell that has been locked over meanwhile opens up to show
	// the soup, which shoots, and is covered again.
	const context = getContext();
	const canvas = $derived(context.stateLayoutDerived.canvasSizes());

	const STAGGER = 300; // ms between soups
	const POP = 600; // soup hop, then it spits
	const FLY = 850; // blob flight
	const SINK = 520; // splash + sink
	const SHOT_MS = POP + FLY + SINK;
	const FADE = 200; // cell ↔ soup cross-fade
	const HOLD = 260; // the soup rests in its cell after spitting, before the cell comes back
	const BACK = POP + HOLD; // cross-fade back starts
	const SOUP = SYMBOL_PARTS.M;
	const SOUP_SCALE = SYMBOL_INFO_MAP.M.static.sizeRatios.width;

	let clock = $state(0);
	let start = $state(0);
	$effect(() => {
		const v = potState.volley;
		if (!v) return;
		start = performance.now();
		clock = start;
		let raf = 0;
		// Per shot: its boost sound starts as the soup starts to hop (the clip pops, rises into the
		// spit and sustains through the flight, ending as the blob sinks — sfx_soup_boost), and the
		// pot's number climbs to that shot's value as its blob hits the soup (potState.mult = after).
		let boosted = 0;
		let sunk = 0;
		const loop = (ts: number) => {
			clock = ts;
			while (boosted < v.shots.length && ts - start - FADE - boosted * STAGGER >= 0) {
				context.eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_soup_boost', forcePlay: true });
				boosted++;
			}
			while (sunk < v.shots.length && ts - start - FADE - sunk * STAGGER >= POP + FLY) {
				potState.mult = v.shots[sunk].after ?? v.target;
				sunk++;
			}
			if (ts - start < FADE + (v.shots.length - 1) * STAGGER + Math.max(SHOT_MS, BACK + FADE) + 150)
				raf = requestAnimationFrame(loop);
			else v.done();
		};
		raf = requestAnimationFrame(loop);
		return () => cancelAnimationFrame(raf);
	});

	// Board cell centre in canvas px (same mapping SpecialMascot uses for the board's edge).
	const cellAt = (s: PotShot) => {
		const main = context.stateLayoutDerived.mainLayout();
		const b = context.stateGameDerived.boardLayout();
		const left = main.x - (main.width * main.scale) / 2 + (b.x - b.width / 2) * main.scale;
		const top = main.y - (main.height * main.scale) / 2 + (b.y - b.height / 2) * main.scale;
		const reel = s.reel ?? 2;
		const gridRow = s.row !== undefined ? s.row - 1 : 0;
		return {
			x: left + (reel * SYMBOL_WIDTH + SYMBOL_WIDTH / 2) * main.scale,
			y: top + (gridRow * SYMBOL_SIZE + SYMBOL_SIZE / 2) * main.scale,
			size: SYMBOL_SIZE * main.scale,
		};
	};
	const ease = (q: number) => q * q * (3 - 2 * q);

	const frames = $derived.by(() => {
		const v = potState.volley;
		const pot = potState.rect;
		if (!v || !pot) return [];
		const tx = pot.x + pot.w * 0.45; // soup surface centre (SpecialMascot SOUP_CX / SOUP_CY)
		const ty = pot.y + pot.h * 0.32;
		return v.shots.map((s, i) => {
			// shot clock: 0 = the soup starts its hop (after the first shot's cross-fade lead-in)
			const t = clock - start - FADE - i * STAGGER;
			const c = cellAt(s);
			// cell ↔ soup cross-fade: 0 = the cell as it is on the board, 1 = only the soup
			let hide = 0;
			if (t >= -FADE && t < 0) hide = (t + FADE) / FADE;
			else if (t >= 0 && t < BACK) hide = 1;
			else if (t >= BACK && t < BACK + FADE) hide = 1 - (t - BACK) / FADE;
			// soup hop (in its cell): swells up off the cell, settles, squashes as it spits
			let soup = null as null | { x: number; y: number; s: number; sy: number; a: number };
			if (hide > 0) {
				const u = Math.max(0, Math.min(1, t / POP));
				const hop = t > 0 && t < POP;
				const spit = hop && u > 0.8 ? Math.min(1, (u - 0.8) / 0.2) : 0;
				soup = {
					x: c.x,
					y: c.y - (hop ? c.size * 0.06 * Math.sin(Math.PI * u) : 0),
					s: hop ? 1 + 0.16 * Math.sin(Math.PI * Math.min(1, u * 1.6)) : 1,
					sy: 1 - 0.14 * spit,
					a: hide,
				};
			}
			// blob flight: a lob over the board into the pot
			let blob = null as null | { x: number; y: number; r: number; sy: number; a: number; ang?: number };
			let splash = null as null | { u: number };
			const r0 = c.size * 0.3;
			if (t >= POP && t < POP + FLY) {
				const q = (t - POP) / FLY;
				const e = ease(q);
				const apex = Math.min(c.y, ty) - Math.max(80, Math.abs(tx - c.x) * 0.22);
				const x = c.x + (tx - c.x) * e;
				const y = (1 - e) ** 2 * c.y + 2 * (1 - e) * e * apex + e * e * ty;
				// direction of travel (derivative of the lob) → the splash streams along it
				const e2 = ease(Math.min(1, q + 0.02));
				const nx = c.x + (tx - c.x) * e2;
				const ny = (1 - e2) ** 2 * c.y + 2 * (1 - e2) * e2 * apex + e2 * e2 * ty;
				const ang = Math.atan2(ny - y, nx - x);
				blob = { x, y, r: r0 * (1 - 0.15 * e), sy: 1.25 + 0.3 * Math.sin(Math.PI * q), a: Math.min(1, q * 8), ang };
			} else if (t >= POP + FLY && t < SHOT_MS) {
				const q = (t - POP - FLY) / SINK;
				// sinks into the soup: squashes into the surface and goes under
				blob = { x: tx, y: ty + r0 * 0.85 * q, r: r0 * 0.85, sy: 1 - 0.65 * q, a: 1 - q, ang: 0 };
				splash = { u: q };
			}
			return { id: i, steps: s.steps, soup, blob, splash, tx, ty, r0, hide, key: potCellKey(s), cell: c };
		});
	});

	// Publish which cells are handed over to their shot (ReelSymbol / LockedCells fade them out).
	$effect(() => {
		const next: Record<string, number> = {};
		for (const f of frames) if (f.hide > 0 && f.key) next[f.key] = Math.max(next[f.key] ?? 0, f.hide);
		if (!Object.keys(next).length && !Object.keys(untrack(() => potState.hidden)).length) return;
		potState.hidden = next;
	});

	// A splash of green soup (not a bubble): an irregular blob with lobes, stretched along its flight
	// and wobbling, trailing a tail of smaller drops; on landing it throws a crown of sauce up off the
	// surface that falls back, with a ripple. Dark outline + body + a small wet highlight streak.
	const OUT = 0x2f4a06;
	const BODY = 0x8fc22a;
	const LIT = 0xc8e86a;
	const blobPts = (x: number, y: number, r: number, ang: number, stretch: number, seed: number, wob: number) => {
		const pts: number[] = [];
		const N = 18;
		for (let k = 0; k < N; k++) {
			const th = (k / N) * Math.PI * 2;
			const lobe =
				1 + 0.16 * Math.sin(th * 3 + seed) + 0.09 * Math.sin(th * 5 + seed * 1.7 + wob) + 0.05 * Math.sin(th * 7 - wob);
			// stretched along the motion (ang), squeezed across it
			const lx = Math.cos(th) * r * lobe * stretch;
			const ly = (Math.sin(th) * r * lobe) / Math.sqrt(stretch);
			pts.push(x + lx * Math.cos(ang) - ly * Math.sin(ang), y + lx * Math.sin(ang) + ly * Math.cos(ang));
		}
		return pts;
	};
	const drawFx = (g: any) => {
		for (const f of frames) {
			if (f.blob) {
				const { x, y, r, sy, a } = f.blob;
				const ang = f.blob.ang ?? 0;
				const st = f.splash ? 1 / Math.max(0.4, sy) : sy;
				const wob = clock / 90 + f.id;
				// tail of drops shed behind it
				if (!f.splash) {
					for (let k = 1; k <= 4; k++) {
						const d = r * (0.9 + 0.75 * k);
						const tr = r * (0.34 - 0.06 * k);
						const tx = x - Math.cos(ang) * d + Math.sin(wob * 0.7 + k) * r * 0.12;
						const ty = y - Math.sin(ang) * d;
						g.circle(tx, ty, tr + 2).fill({ color: OUT, alpha: a * 0.9 });
						g.circle(tx, ty, tr).fill({ color: BODY, alpha: a });
					}
				}
				g.poly(blobPts(x, y, r * 1.1, ang, st, f.id * 2.3, wob)).fill({ color: OUT, alpha: a });
				g.poly(blobPts(x, y, r, ang, st, f.id * 2.3, wob)).fill({ color: BODY, alpha: a });
				g.poly(blobPts(x - r * 0.28, y - r * 0.3, r * 0.22, ang + 0.6, 1.8, f.id, 0)).fill({ color: LIT, alpha: 0.8 * a });
			}
			if (f.splash) {
				const u = f.splash.u;
				// ripple on the surface
				for (let k = 0; k < 2; k++) {
					const uu = Math.max(0, u - k * 0.25);
					if (uu <= 0) continue;
					g.ellipse(f.tx, f.ty, f.r0 * (1 + 2.4 * uu), f.r0 * (0.3 + 0.55 * uu)).stroke({ width: 3, color: LIT, alpha: 0.75 * (1 - uu) });
				}
				// crown: sauce thrown up from the rim of the impact, arcing out and falling back
				for (let k = 0; k < 9; k++) {
					const side = (k / 8) * 2 - 1; // -1 … 1 across the crown
					const up = f.r0 * (1.5 + 0.9 * (1 - Math.abs(side))) * Math.sin(Math.PI * Math.min(1, u * 1.15));
					const x = f.tx + side * f.r0 * (0.7 + 1.5 * u);
					const y = f.ty - up + f.r0 * 0.2;
					const rr = f.r0 * (0.2 + 0.08 * ((k * 7) % 3)) * (1 - 0.45 * u);
					g.poly(blobPts(x, y, rr * 1.15, -Math.PI / 2, 1.5, k, 0)).fill({ color: OUT, alpha: 1 - u });
					g.poly(blobPts(x, y, rr, -Math.PI / 2, 1.5, k, 0)).fill({ color: BODY, alpha: 1 - u });
				}
			}
		}
	};
</script>

{#if potState.volley && potState.rect}
	<Container zIndex={40}>
		{#each frames as f (f.id)}
			{#if f.soup}
				{@const k = context.stateLayoutDerived.mainLayout().scale}
				<!-- the board's soup (same art + size: board units scaled to canvas px), squashing toward its base -->
				<Container
					x={f.soup.x}
					y={f.soup.y + (SYMBOL_SIZE * 0.4 * k * f.soup.s * (1 - f.soup.sy))}
					scale={{ x: k * f.soup.s, y: k * f.soup.s * f.soup.sy }}
					alpha={f.soup.a}
				>
					<AnimatedSymbol config={SOUP} x={0} y={0} scale={SOUP_SCALE} state="static" winning={false} />
				</Container>
			{/if}
		{/each}
		<Graphics draw={drawFx} />
		{#each frames as f (f.id)}
			{#if f.blob}
				<Text
					anchor={0.5}
					x={f.blob.x}
					y={f.blob.y}
					alpha={f.blob.a}
					scale={{ x: 1, y: f.blob.sy }}
					text={`+${f.steps}`}
					style={{
						fontFamily: 'Bowlby One SC',
						fontSize: f.r0 * 0.95,
						fill: 0xffffff,
						stroke: { color: 0x2f4a06, width: Math.max(2, f.r0 * 0.14) },
						align: 'center',
					}}
				/>
			{/if}
		{/each}
	</Container>
{/if}
