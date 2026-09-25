<script lang="ts">
	import { onMount } from 'svelte';
	import { Circle, Container, Graphics, Rectangle, Sprite } from 'pixi-svelte';

	import { SYMBOL_SIZE, SYMBOL_WIDTH } from '../game/constants';
	import { drawSauceSquirt, squirtHash, type SquirtGraphics } from '../game/ketchupSquirt';
	import type { SymbolPartsConfig } from '../game/symbolParts';
	import type { SymbolState } from '../game/types';

	// A symbol reassembled from layered part sprites (see symbolParts.ts). While it is active
	// (locked / winning — "yellow"), it keeps animating on a loop: each layer travels out along its
	// own (dx, dy) offset and rotates by `rot`, then back, over and over (burger separates and
	// reassembles, spoon stirs, cap/straw rotates, rings tumble). It runs until the symbol is no
	// longer active (the next turn clears the lock), then settles to rest.

	type Props = {
		config: SymbolPartsConfig;
		x?: number;
		y?: number;
		scale?: number; // symbol size ratio (matches the other symbols' sizeRatios)
		state?: SymbolState;
		winning?: boolean;
		oncomplete?: () => void;
	};
	const props: Props = $props();

	// Preserve SymbolSprite's contract: resolve the win-presentation await immediately.
	onMount(() => props.oncomplete?.());
	$effect(() => {
		props.state;
		props.oncomplete?.();
	});

	const boxW = $derived(SYMBOL_WIDTH * (props.scale ?? 0.96) * props.config.fit);
	const boxH = $derived(SYMBOL_SIZE * (props.scale ?? 0.96) * props.config.fit);
	const h = $derived(Math.min(boxH, boxW / props.config.aspect));
	const w = $derived(h * props.config.aspect);

	const PERIOD = 1400; // ms per loop cycle (out and back)
	const PERIOD_IDLE = 2600; // slower, softer loop for symbols that are alive at rest (config.idle)
	// Everything the layer math reads is $state so the render tracks the animation reliably.
	let clock = $state(0); // rAF timestamp
	let startTime = $state(-1); // when the active loop began (-1 = at rest)
	let running = $state(false);

	// Run the loop while the symbol is active — or, for idle-configured symbols, whenever it sits on
	// the board (not mid-spin). Stop (settle) otherwise.
	const idleAmp = $derived(props.config.idle ?? 0);
	const shouldRun = $derived(!!props.winning || (idleAmp > 0 && props.state !== 'spin'));
	$effect(() => {
		if (shouldRun) {
			if (!running) {
				startTime = performance.now();
				clock = startTime;
				running = true;
			}
		} else if (running) {
			running = false;
			startTime = -1;
		}
	});
	// Idle and win loops have different periods/amplitudes: restart the clock when switching so the
	// phase doesn't jump.
	$effect(() => {
		props.winning;
		if (running) {
			startTime = performance.now();
			clock = startTime;
		}
	});
	$effect(() => {
		if (!running) return;
		let raf = 0;
		const loop = (ts: number) => {
			clock = ts;
			raf = requestAnimationFrame(loop);
		};
		raf = requestAnimationFrame(loop);
		return () => cancelAnimationFrame(raf);
	});

	// Land one-shot (opt-in via config.landAnim, e.g. the wild): each layer scales in from 0 with a
	// slight overshoot at its own `landDelay`, so the parts arrive in sequence (splat first, then
	// text). Runs once per landing, independent of the win/lock loop, then hands back to rest/loop.
	const LAND_MS = $derived(props.config.landMs ?? 800);
	let landStart = $state(-1);
	let landClock = $state(0);
	// Fire the land one-shot exactly ONCE per entry into the 'land' state. A bare `if (state==='land')`
	// re-fires whenever this effect re-runs while state stays 'land' (e.g. the win-pad burger, which is
	// permanently mounted in state="land" while its parent re-renders every frame) — that made the
	// burger re-materialise on a loop. The latch resets when the symbol leaves 'land', so board symbols
	// (whose state toggles land→static→land each landing) still splash on every landing.
	let landLatched = false;
	// $effect.pre so this runs BEFORE the oncomplete $effect above, which flips the momentary 'land'
	// state straight back to 'static' (see ReelSymbol) — a regular $effect here would only ever read
	// 'static' and the splash would never fire.
	$effect.pre(() => {
		if (props.config.landAnim && props.state === 'land') {
			if (!landLatched) {
				landLatched = true;
				landStart = performance.now();
				landClock = landStart;
			}
		} else {
			landLatched = false;
		}
	});
	$effect(() => {
		if (landStart < 0) return;
		let raf = 0;
		const loop = (ts: number) => {
			landClock = ts;
			if (ts - landStart < LAND_MS) raf = requestAnimationFrame(loop);
			else landStart = -1;
		};
		raf = requestAnimationFrame(loop);
		return () => cancelAnimationFrame(raf);
	});

	const layers = $derived.by(() => {
		const active = running && startTime >= 0;
		const idle = active && !props.winning;
		const frac = active ? ((clock - startTime) / (idle ? PERIOD_IDLE : PERIOD)) % 1 : 0;
		// Smooth loop 0 → 1 → 0 with zero velocity at the seam (no jerk between cycles). The idle loop
		// runs the same motion at a fraction of the amplitude.
		const env = active ? ((1 - Math.cos(Math.PI * 2 * frac)) / 2) * (idle ? idleAmp : 1) : 0;
		const theta = Math.PI * 2 * frac; // full turn per cycle — drives circular `orbit`
		const sq = (props.config.squash ?? 0) * env;
		const sqx = 1 - sq;
		const sqy = 1 + sq;
		const cx = props.x ?? 0;
		const cy = props.y ?? 0;
		const out: Array<{
			id: string;
			key: string;
			x: number;
			y: number;
			width: number;
			height: number;
			rotation: number;
			alpha: number;
		}> = [];
		// Land one-shot in progress: scale each layer in (0 → overshoot → 1) at its own landDelay.
		const landing = landStart >= 0;
		const lt = landing ? Math.min(1, (landClock - landStart) / LAND_MS) : 1;
		for (const l of props.config.layers) {
			if (landing) {
				const delay = l.landDelay ?? 0;
				const local = delay >= 1 ? 0 : Math.max(0, (lt - delay) / (1 - delay));
				// easeOutBack: 0 → slight overshoot (~1.1) → settle at 1 (one grow-then-shrink).
				const c1 = 1.70158;
				const c3 = c1 + 1;
				const s = local <= 0 ? 0 : 1 + c3 * (local - 1) ** 3 + c1 * (local - 1) ** 2;
				out.push({
					id: l.key,
					key: l.key,
					x: cx + (l.nx - 0.5) * w,
					// Fall in from above: start `landDrop` of the height up and drop onto the stack as it
					// scales in (decelerating), so each slice reads as splatting into place.
					y: cy + (l.ny - 0.5) * h - (l.landDrop ?? props.config.landDrop ?? 0) * h * (1 - local) ** 1.6,
					width: l.nw * w * s,
					height: l.nh * h * s,
					rotation: 0,
					alpha: Math.min(1, local * 4),
				});
				continue;
			}
			// Rising smoke/steam: a continuous stream — several puffs at staggered phases each form at
			// the base, rise + waft + grow, and fade out (bell alpha, so 0 at both ends → no visible
			// reset). Overlapping copies keep the stream unbroken. At rest, one puff sits at the base.
			if (l.rise) {
				const N = 3;
				for (let i = 0; i < N; i++) {
					const fr = (frac + i / N) % 1;
					const swayX = (l.sway ?? 0) * w * Math.sin(fr * Math.PI * 3 + i * 2.1);
					const grow = 1 + (l.grow ?? 0.4) * fr;
					out.push({
						id: `${l.key}-${i}`,
						key: l.key,
						x: cx + (l.nx - 0.5) * w + swayX,
						y: cy + (l.ny - 0.5) * h - l.rise * h * (active ? fr : 0),
						width: l.nw * w * grow,
						height: l.nh * h * grow,
						rotation: 0,
						alpha: active ? Math.sin(Math.PI * fr) : i === 0 ? 1 : 0,
					});
				}
				continue;
			}
			// Circular path (starts + ends at the rest position so it loops seamlessly). Dips DOWN
			// (into the soup) rather than up, so a stirring spoon stays submerged/hidden.
			const orbitX = (l.orbit ?? 0) * w * Math.sin(theta);
			const orbitY = (l.orbit ?? 0) * h * (1 - Math.cos(theta));
			const ox = ((l.nx - 0.5) * w + (l.dx ?? 0) * w * env + orbitX) * sqx;
			const oy = ((l.ny - 0.5) * h + (l.dy ?? 0) * h * env + orbitY) * sqy;
			const pop = 1 + (l.pop ?? 0) * env; // uniform pulse
			const spin = 1 - (l.spin ?? 0) * env; // horizontal squeeze = turn about vertical axis
			// Rotation: `rot` is a one-way swing (env-driven); `tilt` a small signed rock (sin-driven).
			// Both pivot about a point offset from the sprite centre by `pivotY` (fraction of h; negative
			// = up), so e.g. a bottle cap rocks realistically about its base instead of about the symbol
			// centre (which would swing the cap in a wide arc). The position is compensated so that pivot
			// point stays put as the sprite rotates about its own anchor.
			const jit = l.jitter && active && props.winning ? l.jitter * Math.sin(clock / 38) * Math.sin(clock / 97) : 0;
			const rotation = (l.rot ?? 0) * env + (l.tilt ?? 0) * Math.sin(theta) + jit;
			const pv = (l.pivotY ?? 0) * h;
			const pivotCompX = pv * Math.sin(rotation);
			const pivotCompY = pv * (1 - Math.cos(rotation));
			out.push({
				id: l.key,
				key: l.key,
				x: cx + ox + pivotCompX,
				y: cy + oy + pivotCompY,
				width: l.nw * w * sqx * spin * pop,
				height: l.nh * h * sqy * pop,
				rotation,
				alpha: 1,
			});
		}
		return out;
	});

	// Sauce squirt: while the bottle is active (winning/locked) it squeezes out a shot of sauce each
	// loop cycle, timed to the squash peak — the SAME squirt as the board chef's ketchup (see
	// ketchupSquirt.ts), scaled down to the symbol: a tapered glossy rope arcing up off the nozzle that
	// snaps into drops of different sizes. The previous cycle's drops are still falling when the next
	// squeeze starts, so both are drawn.
	const SQUIRT_UNIT = 1.5; // squirt length scale, in symbol heights (a short arc over the cap)
	const SQUIRT_WIDTH = 1.9; // …with a proportionally fatter rope so it still reads as sauce
	const drawSquirt = (g: SquirtGraphics) => {
		const cfg = props.config.squirt;
		const active = running && startTime >= 0 && !!props.winning;
		if (!cfg || !active) return;
		const t = clock - startTime;
		const cx = props.x ?? 0;
		const cy = props.y ?? 0;
		const noz = {
			x: cx + ((cfg.nozzleNx ?? 0.5) - 0.5) * w,
			y: cy + ((cfg.nozzleNy ?? 0.086) - 0.5) * h,
			dir: -Math.PI / 2 + (cfg.dir ?? 0) * 0.25,
		};
		const cycle = Math.floor((t - PERIOD * 0.35) / PERIOD);
		for (const k of [cycle - 1, cycle]) {
			if (k < 0) continue;
			// Each shot arcs off to one side (~25°, side varies per shot) so it lands beside the bottle.
			const hk = squirtHash(k * 1.7 + cx * 0.01);
			const lean = (hk < 0.5 ? -1 : 1) * (0.36 + 0.16 * hk);
			drawSauceSquirt(g, {
				u: t - PERIOD * 0.35 - k * PERIOD,
				unit: h * SQUIRT_UNIT,
				widthScale: SQUIRT_WIDTH,
				color: cfg.color,
				floorY: cy + h * 0.42,
				floorBand: h * 0.12,
				seed: k + cx * 0.013 + cy * 0.007,
				nozzleAt: () => ({ ...noz, dir: noz.dir + lean }),
			});
		}
	};

	// Fizz (cup) + sizzle (sausage) particles — deterministic off the clock, only while active.
	const drawFx = (g: SquirtGraphics) => {
		const active = running && startTime >= 0 && !!props.winning;
		if (!active) return;
		const t = clock - startTime;
		const cx = props.x ?? 0;
		const cy = props.y ?? 0;
		const fz = props.config.fizz;
		if (fz) {
			const N = 11;
			const P = 1100; // ms a bubble takes to rise
			for (let i = 0; i < N; i++) {
				const tt = t + (i / N) * P;
				const k = Math.floor(tt / P);
				const p = (tt % P) / P;
				const hs = squirtHash(i * 3.7 + k * 1.3);
				const x0 = cx + (fz.nx - 0.5) * w + (hs - 0.5) * fz.spread * w;
				const x = x0 + Math.sin(p * 9 + i) * 0.025 * w;
				const y = cy + (fz.ny - 0.5) * h - p * 0.2 * h;
				const r = h * (0.012 + 0.016 * squirtHash(i * 5.1 + k)) * (0.6 + 0.7 * p);
				if (p < 0.88) {
					const a = Math.min(1, p / 0.12);
					g.circle(x, y, r).fill({ color: fz.color, alpha: 0.28 * a });
					g.circle(x, y, r).stroke({ width: Math.max(1, r * 0.3), color: 0xffffff, alpha: 0.85 * a });
					g.circle(x - r * 0.35, y - r * 0.35, r * 0.28).fill({ color: 0xffffff, alpha: 0.9 * a });
				} else {
					// pop: a thin ring flashing outward
					const q = (p - 0.88) / 0.12;
					g.circle(x, y, r * (1 + 0.9 * q)).stroke({ width: Math.max(1, r * 0.2), color: 0xffffff, alpha: 0.7 * (1 - q) });
				}
			}
		}
		const sz = props.config.sizzle;
		if (sz) {
			const P = 820;
			sz.points.forEach((pt, j) => {
				for (let s2 = 0; s2 < 2; s2++) {
					const off = (j * 0.37 + s2 * 0.5) * P;
					const tt = t + off;
					const k = Math.floor(tt / P);
					const p = (tt % P) / P;
					const hs = squirtHash(j * 7.1 + s2 * 2.9 + k * 1.7);
					if (hs < 0.25) continue; // not every slot spits
					const ox = cx + (pt.nx - 0.5) * w;
					const oy = cy + (pt.ny - 0.5) * h;
					const vx = (hs - 0.6) * 0.5 * w; // px per cycle
					const up = (0.16 + 0.18 * squirtHash(k + j)) * h;
					const x = ox + vx * p;
					const y = oy - up * 4 * p * (1 - p); // parabola: up and back down
					const a = p < 0.1 ? p / 0.1 : 1 - Math.max(0, (p - 0.7) / 0.3);
					const r = h * (0.014 + 0.01 * hs);
					g.circle(x, y, r * 2.6).fill({ color: 0xff9a2e, alpha: 0.28 * a }); // hot glow
					g.circle(x, y, r * 1.25).fill({ color: 0xb8620f, alpha: 0.85 * a }); // amber rim (reads on light bg)
					g.circle(x, y, r).fill({ color: sz.color, alpha: a });
					g.circle(x - r * 0.3, y - r * 0.3, r * 0.4).fill({ color: 0xffffff, alpha: 0.9 * a });
					if (hs > 0.82 && p > 0.35 && p < 0.6) {
						// a bright spark at the top of the hop
						const L = r * 3.6;
						g.moveTo(x - L, y).lineTo(x + L, y).stroke({ width: Math.max(1, r * 0.45), color: 0xfff1b0, alpha: 0.95 * a });
						g.moveTo(x, y - L).lineTo(x, y + L).stroke({ width: Math.max(1, r * 0.45), color: 0xffffff, alpha: 0.8 * a });
					}
				}
			});
		}
	};

	// Melty cheese drip: while the cheese is alive on the board, small gooey drops ooze off the tips
	// of the painted drips — the tip stretches down a touch, a modest bead pinches off, falls a SHORT
	// way and fades (well inside the symbol's own cell). Each drop wears its tip's sampled colour.
	const dripBlobs = $derived.by(() => {
		const cfg = props.config.drip;
		// Drip only while the symbol is truly active (locked / on a win line), like the other symbols.
		const active = running && startTime >= 0 && !!props.winning;
		if (!cfg || !active)
			return [] as Array<{ id: number; x: number; y: number; edgeY: number; d: number; alpha: number; neckAlpha: number; color: number }>;
		const t = clock - startTime;
		const cx = props.x ?? 0;
		const cy = props.y ?? 0;
		const points = cfg.points ?? [{ nx: 0.5, ny: 0.74 }];
		const T_EMIT = 1150; // ms between drops per point — cheese oozes lazily
		const T_LIFE = 1500; // ms a drop lives (swell + hang + short fall + fade)
		const out: Array<{ id: number; x: number; y: number; edgeY: number; d: number; alpha: number; neckAlpha: number; color: number }> = [];
		points.forEach((pt, ni) => {
			const nozX = cx + (pt.nx - 0.5) * w;
			const edgeY = cy + (pt.ny - 0.5) * h; // origin at this painted drip's tip
			const color = pt.color ?? cfg.color;
			const tt = t + ni * T_EMIT * 0.6; // stagger the points so they don't drip in unison
			const newest = Math.floor(tt / T_EMIT);
			for (let k = 0; k < 2; k++) {
				const idx = newest - k;
				if (idx < 0) continue;
				const p = (tt - idx * T_EMIT) / T_LIFE;
				if (p < 0 || p > 1) continue;
				const swell = Math.min(1, p / 0.4); // the bead fattens as it forms
				const attached = p < 0.55;
				const stretch = (attached ? p / 0.55 : 1) * 0.07; // the tip extends down a touch
				const fall = attached ? 0 : (p - 0.55) / 0.45; // then pinches off and drops a short way
				const y = edgeY + (stretch + 0.12 * fall * fall) * h;
				const d = Math.max(2.5, 0.075 * w) * (0.45 + 0.55 * swell);
				const fadeOut = 1 - Math.max(0, (p - 0.7) / 0.3);
				out.push({
					id: ni * 1000 + idx,
					x: nozX,
					y,
					edgeY,
					d,
					alpha: Math.min(1, swell * 1.4) * fadeOut,
					neckAlpha: attached ? (1 - p / 0.55) * 0.9 : 0,
					color,
				});
			}
		});
		return out;
	});
</script>

<Container>
	{#each layers as l (l.id)}
		<Sprite
			key={l.key}
			x={l.x}
			y={l.y}
			anchor={0.5}
			width={l.width}
			height={l.height}
			rotation={l.rotation}
			alpha={l.alpha}
		/>
	{/each}
	{#if props.config.fizz || props.config.sizzle}
		<Graphics draw={drawFx} />
	{/if}
	<!-- Sauce squirt (bottles only), in front of the bottle. -->
	{#if props.config.squirt}
		<Graphics draw={drawSquirt} />
	{/if}
	<!-- Melty cheese drip: a gooey teardrop (round bottom + pointed top) on a thinning strand while it
	     hangs, that pinches off and falls. Dark rim + white glint read it as a wet drop of cheese. -->
	{#each dripBlobs as b (b.id)}
		{#if b.neckAlpha > 0.01}
			<Rectangle x={b.x} y={(b.edgeY + b.y) / 2} anchor={0.5} width={b.d * 0.42} height={Math.max(1, b.y - b.edgeY)} backgroundColor={b.color} backgroundAlpha={b.neckAlpha} />
		{/if}
		<Circle x={b.x} y={b.y} diameter={b.d * 1.14} anchor={0.5} backgroundColor={0x000000} backgroundAlpha={b.alpha * 0.16} />
		<Circle x={b.x} y={b.y - b.d * 0.42} diameter={b.d * 0.62} anchor={0.5} backgroundColor={b.color} backgroundAlpha={b.alpha} />
		<Circle x={b.x} y={b.y} diameter={b.d} anchor={0.5} backgroundColor={b.color} backgroundAlpha={b.alpha} />
		<Circle x={b.x - b.d * 0.2} y={b.y - b.d * 0.22} diameter={b.d * 0.28} anchor={0.5} backgroundColor={0xffffff} backgroundAlpha={b.alpha * 0.45} />
	{/each}
</Container>
