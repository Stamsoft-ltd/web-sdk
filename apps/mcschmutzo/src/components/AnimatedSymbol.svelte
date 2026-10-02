<script lang="ts">
	import { onMount } from 'svelte';
	import { Circle, Container, Graphics, Rectangle, Sprite } from 'pixi-svelte';

	import { SYMBOL_SIZE, SYMBOL_WIDTH } from '../game/constants';
	import { drawSauceSquirt, squirtHash, type SquirtGraphics } from '../game/ketchupSquirt';
	import { drawPaintedDrip } from '../game/paintedDrip';
	import { splatDrips, splatShapes, WILD_SPLAT_LAND, type SplatShape } from '../game/wildSplat';
	import { getContext } from '../game/context';
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
	const appContext = getContext();

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
	const RAMP_MS = 700; // ease-in of the loop's amplitude whenever it (re)starts
	const PERIOD_IDLE = 2600;
	const PULSE_MS = 1900; // one swell + shrink of a pulsing layer
	const SLAM_MS = 1700; // one wild slam cycle while active (idle uses PERIOD_IDLE)
	// Slam cycle shared by the layers and the splash droplets: 0 → 0.38 rise, → 0.5 fall, impact at 0.5.
	const slamPhase = (t: number, idle: boolean) => (t / (idle ? PERIOD_IDLE : SLAM_MS)) % 1; // slower, softer loop for symbols that are alive at rest (config.idle)
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
			else {
				landStart = -1;
				// Hand over to the loop from its rest pose: the loop clock kept ticking under the
				// one-shot, so without this restart it would take over mid-swing (a visible jump).
				if (running) {
					startTime = ts;
					clock = ts;
				}
			}
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
		// Each (re)start eases the motion in over RAMP_MS, so it also starts with zero velocity (the
		// signed `tilt` rock would otherwise set off at full speed).
		const r0 = active ? Math.min(1, (clock - startTime) / RAMP_MS) : 0;
		const ramp = r0 * r0 * (3 - 2 * r0);
		const env = active ? ((1 - Math.cos(Math.PI * 2 * frac)) / 2) * (idle ? idleAmp : 1) * ramp : 0;
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
			if (landing && props.config.landFall) {
				const delay = l.landDelay ?? 0;
				const slice = props.config.landSlice ?? 0.3;
				const local = Math.max(0, Math.min(1, (lt - delay) / slice));
				const FALL = 0.5; // share of the slice spent falling; the rest is the splat + bounce
				let oy = 0;
				let sx = 1;
				let sy = 1;
				let alpha = 1;
				if (local <= 0) {
					alpha = 0; // not dropped yet
				} else if (local < FALL) {
					const q = local / FALL;
					oy = -(props.config.landDrop ?? 1) * h * (1 - q * q); // gravity: accelerates down
					alpha = Math.min(1, q * 5);
					sy = 1 + 0.1 * q; // stretches a touch with speed
					sx = 1 - 0.05 * q;
				} else {
					const q = (local - FALL) / (1 - FALL);
					const e = Math.exp(-4.5 * q) * Math.cos(q * Math.PI * 2.6); // impact → rebound → settle
					sx = 1 + 0.22 * e;
					sy = 1 - 0.26 * e;
					oy = -Math.max(0, -e) * h * 0.03; // tiny hop on the rebound
				}
				out.push({
					id: l.key,
					key: l.key,
					x: cx + (l.nx - 0.5) * w,
					// squash about the slice's BOTTOM so it lands on the one below
					y: cy + (l.ny - 0.5) * h + oy + (l.nh * h * (1 - sy)) / 2,
					width: l.nw * w * sx,
					height: l.nh * h * sy,
					rotation: 0,
					alpha,
				});
				continue;
			}
			if (landing && l.landStamp) {
				// Stamp: comes DOWN from 1.5× (accelerating) onto the splat, hits at textHit, squashes
				// flat and springs back — the sauce ripples from the same hit (wildSplat).
				const start = l.landDelay ?? 0;
				const hit = WILD_SPLAT_LAND.textHit;
				let s = 1;
				let sx = 1;
				let sy = 1;
				let alpha = 1;
				if (lt < start) alpha = 0;
				else if (lt < hit) {
					const q = (lt - start) / (hit - start);
					s = 1.5 - 0.5 * q * q;
					alpha = Math.min(1, q * 3);
				} else {
					const v = (lt - hit) / (1 - hit);
					const d = Math.exp(-6 * v) * Math.cos(v * Math.PI * 3);
					sx = 1 + 0.14 * d;
					sy = 1 - 0.18 * d;
				}
				out.push({
					id: l.key,
					key: l.key,
					x: cx + (l.nx - 0.5) * w,
					y: cy + (l.ny - 0.5) * h,
					width: l.nw * w * s * sx,
					height: l.nh * h * s * sy,
					rotation: 0,
					alpha,
				});
				continue;
			}
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
			// reset). Overlapping copies keep the stream unbroken. At rest there is no smoke.
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
						// No smoke at rest (design ask); when active it fades in with the loop's ease-in ramp.
						alpha: active ? Math.sin(Math.PI * fr) * ramp : 0,
					});
				}
				continue;
			}
			// Toss (e.g. onion rings): each layer runs its own staggered hop inside a SLOWER loop (3 tosses
			// per 2 base periods) — gravity arc, a coin-flip in the air, landing squash + rebound.
			if (l.hop) {
				const TOSS = 0.36; // share of the layer's cycle spent in the air
				const f = active ? (((clock - startTime) / (PERIOD * 2) + (l.phase ?? 0)) % 1) : 1;
				const amp = props.winning ? 1 : idleAmp;
				let oy = 0;
				let sx = 1;
				let sy = 1;
				let rotT = 0;
				// Every stage starts AND ends at rest (value + velocity ≈ 0), so there are no jumps between
				// the arc, the landing and the idle wait.
				if (f < TOSS) {
					const q = f / TOSS;
					const e = (1 - Math.cos(Math.PI * q)) / 2; // eased 0→1 through the air
					oy = -l.hop * h * Math.sin(Math.PI * e) * amp; // smooth rise + fall (zero speed at ends)
					// Turn toward edge-on and back (never mirrored, never collapses to a sliver).
					sx = 1 - 0.55 * Math.sin(Math.PI * e) ** 2 * (l.flip ?? 0) * amp;
					rotT = (l.rot ?? 0) * Math.sin(Math.PI * e) * amp;
				} else if (f < TOSS + 0.24) {
					const q = (f - TOSS) / 0.24; // landing: squash grows from 0, rebounds once, settles
					const d = Math.sin(Math.PI * q) * (1 - q) * 1.6 - 0.25 * Math.sin(Math.PI * 2 * q) * (1 - q);
					sx = 1 + 0.1 * d * amp;
					sy = 1 - 0.12 * d * amp;
				} else {
					// Sympathetic jiggle as the OTHER rings land — faded in/out so it never pops.
					const r = (f - TOSS - 0.24) / (1 - TOSS - 0.24);
					sy = 1 + 0.012 * Math.sin(r * Math.PI * 4) * Math.sin(Math.PI * r) * amp;
				}
				const ox = (l.dx ?? 0) * w * Math.sin(Math.PI * ((1 - Math.cos(Math.PI * Math.min(1, f / TOSS))) / 2)) * amp;
				out.push({
					id: l.key,
					key: l.key,
					x: cx + (l.nx - 0.5) * w + ox,
					// keep the bottom planted while squashing (grow/shrink from the base)
					y: cy + (l.ny - 0.5) * h + oy + (l.nh * h * (1 - sy)) / 2,
					width: l.nw * w * sx,
					height: l.nh * h * sy,
					rotation: rotT,
					alpha: 1,
				});
				continue;
			}
			// Ketchup slam (wild letters) / the sauce they land in (wild splat).
			if (active && l.pulse) {
				// liquid pulse: swell + shrink, height a little behind width (a wobbling puddle)
				const tt = (clock - startTime) / PULSE_MS;
				const amp = l.pulse * (idle ? idleAmp : 1) * ramp;
				const ph = Math.PI * 2 * tt - (l.pulseLag ?? 0);
				const sx = 1 + amp * Math.sin(ph);
				const sy = 1 + amp * Math.sin(ph - 0.55);
				out.push({
					id: l.key,
					key: l.key,
					x: cx + (l.nx - 0.5) * w,
					y: cy + (l.ny - 0.5) * h,
					width: l.nw * w * sx,
					height: l.nh * h * sy,
					rotation: 0.012 * amp * 10 * Math.sin(ph * 0.5),
					alpha: 1,
				});
				continue;
			}
			if (active && (l.slam || l.ripple)) {
				const f = slamPhase(clock - startTime, idle);
				const amp = (idle ? idleAmp : 1) * ramp;
				let oy = 0;
				let sx = 1;
				let sy = 1;
				if (l.slam) {
					const H = l.slam * h * amp;
					if (f < 0.38) {
						oy = -H * Math.sin((Math.PI / 2) * (f / 0.38)); // rising, slowing
						sy = 1 + 0.05 * amp * (1 - f / 0.38);
					} else if (f < 0.5) {
						const q = (f - 0.38) / 0.12;
						oy = -H * Math.cos((Math.PI / 2) * q); // falling, speeding up
						sy = 1 + 0.08 * amp * q; // stretched by the speed
					} else if (f < 0.85) {
						const u = (f - 0.5) / 0.35;
						const d = Math.exp(-5.5 * u) * Math.cos(u * Math.PI * 3); // SLAM: squash → rebound
						sx = 1 + 0.16 * d * amp;
						sy = 1 - 0.2 * d * amp;
					}
				}
				if (l.ripple) {
					// liquid: an impact ripple (alternating wide/tall like a jelly) + a slow breathing wobble
					const u = f >= 0.5 ? (f - 0.5) / 0.5 : -1;
					const hit = u >= 0 ? Math.exp(-4.2 * u) * Math.sin(u * Math.PI * 3.2) : 0;
					const pre = f > 0.44 && f < 0.5 ? -0.02 * Math.sin(((f - 0.44) / 0.06) * Math.PI) : 0;
					const tt = (clock - startTime) / 1000;
					sx = 1 + (l.ripple * hit + pre) * amp + 0.012 * amp * Math.sin(tt * 2.3);
					sy = 1 + (-l.ripple * 0.85 * hit + pre) * amp + 0.012 * amp * Math.sin(tt * 2.3 + 1.7);
				}
				out.push({
					id: l.key,
					key: l.key,
					x: cx + (l.nx - 0.5) * w,
					// letters squash onto their BASE (the splat), so the bottom edge stays planted
					y: cy + (l.ny - 0.5) * h + oy + (l.slam ? (l.nh * h * (1 - sy)) / 2 : 0),
					width: l.nw * w * sx,
					height: l.nh * h * sy,
					rotation: 0,
					alpha: 1,
				});
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
			const rotation = (l.rot ?? 0) * env + (l.tilt ?? 0) * Math.sin(theta) * ramp + jit;
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
	// Shot out SIDEWAYS in a short arc that drops down beside the bottle: the cap sits just under the
	// cell's top edge, so an upward shot would be cut by the cell clip.
	const SQUIRT_UNIT = 0.95;
	const SQUIRT_WIDTH = 2.7; // …with a proportionally fatter rope so it still reads as sauce (same thickness as before the shorter arc)
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
			const lean = (hk < 0.5 ? -1 : 1) * (0.8 + 0.2 * hk); // ~46–57° off vertical: out to the side
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

	const CELL_INSET = 9;
	const drawCellMask = (g: SquirtGraphics & { rect: (x: number, y: number, w: number, h: number) => { fill: (s: object) => unknown } }) => {
		const cx = props.x ?? 0;
		const cy = props.y ?? 0;
		g.rect(cx - SYMBOL_WIDTH / 2 + CELL_INSET, cy - SYMBOL_SIZE / 2 + CELL_INSET, SYMBOL_WIDTH - 2 * CELL_INSET, SYMBOL_SIZE - 2 * CELL_INSET).fill({ color: 0xffffff });
	};

	// Painted drips riding their layer (wild splat): drawn only while the symbol is winning.
	const drawLayerDrips = (g: any) => {
		const cfg = props.config.paintedDrips;
		const active = running && startTime >= 0 && !!props.winning;
		if (!cfg || !active) return;
		const tex = appContext.stateApp.loadedAssets?.[cfg.layer] as Parameters<typeof drawPaintedDrip>[1] | undefined;
		const L = layers.find((x) => x.key === cfg.layer);
		if (!tex || !L) return;
		const map = {
			ox: cfg.srcW / 2,
			oy: cfg.srcH / 2,
			k: 1,
			kx: L.width / cfg.srcW,
			ky: L.height / cfg.srcH,
			tx: L.x,
			ty: L.y,
		};
		const t = clock - startTime;
		for (const d of cfg.tendrils) drawPaintedDrip(g, tex, d, t, map);
	};

	// Code-drawn ketchup splat (wild): one frame of game/wildSplat in box-height units, scaled to `h`.
	const drawShapes = (g: any, list: SplatShape[]) => {
		const cx = props.x ?? 0;
		const cy = props.y ?? 0;
		for (const s of list) {
			if (s.alpha <= 0.002) continue;
			if (s.kind === 'poly') {
				const pts = s.pts.map((v, i) => (i % 2 === 0 ? cx + v * h : cy + v * h));
				g.poly(pts, true).fill({ color: s.color, alpha: s.alpha });
			} else if (s.kind === 'circle') g.circle(cx + s.x * h, cy + s.y * h, s.r * h).fill({ color: s.color, alpha: s.alpha });
			else g.ellipse(cx + s.x * h, cy + s.y * h, s.rx * h, s.ry * h).fill({ color: s.color, alpha: s.alpha });
		}
	};
	const splatLoop = $derived.by(() => {
		const active = running && startTime >= 0;
		if (!active) return { t: 0, amp: 0 };
		const r0 = Math.min(1, (clock - startTime) / RAMP_MS);
		const ramp = r0 * r0 * (3 - 2 * r0);
		return { t: clock - startTime, amp: (props.winning ? 1 : idleAmp) * ramp };
	});
	const drawSplat = (g: any) => {
		const land = landStart >= 0 ? Math.min(1, (landClock - landStart) / LAND_MS) : null;
		drawShapes(g, splatShapes({ land, ...splatLoop }));
	};
	// Win drips off the splat's bottom lobes — in the cell-clipped container, only while winning.
	const drawSplatDrips = (g: any) => {
		if (!props.winning || landStart >= 0) return;
		drawShapes(g, splatDrips(splatLoop.t, splatLoop.amp));
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
		const sp = props.config.splash;
		if (sp) {
			// Each slam throws ~7 ketchup droplets off the splat's edge (mostly up/outward): short gravity
			// arcs that fall away and fade — deterministic per cycle, so every hit splashes differently.
			const k = Math.floor(t / SLAM_MS);
			const u = ((t / SLAM_MS) % 1 - 0.5) / 0.48; // 0 at impact → 1
			if (u >= 0 && u <= 1) {
				const N = 7;
				for (let i = 0; i < N; i++) {
					const hs = squirtHash(k * 3.3 + i * 7.9);
					const hs2 = squirtHash(k * 1.9 + i * 4.1 + 0.5);
					// out of the sides and shoulders (the cell has little room above the splat): −200° … +20°
					const side = i % 2 === 0 ? -1 : 1;
					const ang = side < 0 ? Math.PI * (0.92 + 0.22 * hs) : Math.PI * (-0.14 + 0.22 * hs);
					const ox = cx + Math.cos(ang) * sp.rx * w;
					const oy = cy + Math.sin(ang) * sp.ry * h;
					const v = (0.1 + 0.09 * hs2) * h; // short arcs: they stay inside the symbol's own box
					const x = ox + Math.cos(ang) * v * u - side * 0.02 * h * u;
					const y = oy + Math.sin(ang) * v * u - 0.12 * h * u + 0.42 * h * u * u; // pop up, then gravity
					const r = h * (0.026 + 0.022 * hs) * (1 - 0.3 * u);
					const a = u < 0.08 ? u / 0.08 : 1 - Math.max(0, (u - 0.6) / 0.4);
					// stretched along its motion right after launch
					const st = 1 + 0.6 * Math.max(0, 1 - u * 3);
					g.ellipse(x, y, r * 1.18, r * 1.18 * st).fill({ color: sp.rim, alpha: 0.9 * a });
					g.ellipse(x, y, r, r * st).fill({ color: sp.color, alpha: a });
					g.circle(x - r * 0.35, y - r * 0.4 * st, r * 0.32).fill({ color: 0xffffff, alpha: 0.75 * a });
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
	{#if props.config.splat}
		<Graphics draw={drawSplat} />
	{/if}
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
	<!-- All particle FX (squirt, fizz, sizzle, cheese drips) are clipped to THIS symbol's own cell
	     (inset 9px — the locked cell's light box), so sauce never lands in a neighbouring box. -->
	<Container>
		<Graphics isMask draw={drawCellMask} />
	{#if props.config.paintedDrips}
		<Graphics draw={drawLayerDrips} />
	{/if}
	{#if props.config.splat}
		<Graphics draw={drawSplatDrips} />
	{/if}
	{#if props.config.fizz || props.config.sizzle || props.config.splash}
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
</Container>
