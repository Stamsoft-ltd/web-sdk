<script lang="ts">
	import { onMount } from 'svelte';
	import { Circle, Container, Rectangle, Sprite } from 'pixi-svelte';

	import { SYMBOL_SIZE, SYMBOL_WIDTH } from '../game/constants';
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
					y: cy + (l.ny - 0.5) * h - (props.config.landDrop ?? 0) * h * (1 - local) ** 1.6,
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
			const rotation = (l.rot ?? 0) * env + (l.tilt ?? 0) * Math.sin(theta);
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

	// Sauce drip: while the bottle is active (winning/locked) it dribbles sauce from its nozzle exactly
	// like the button drips — a bead swells at the tip, pinches off, then falls STRAIGHT DOWN under
	// gravity and fades. One drip every T_EMIT, so only a couple hang/fall at once (no upward spray).
	const squirtColor = $derived(props.config.squirt?.color ?? 0xffffff);
	const squirtBlobs = $derived.by(() => {
		const cfg = props.config.squirt;
		const active = running && startTime >= 0 && !!props.winning;
		if (!cfg || !active) return [] as Array<{ id: number; x: number; y: number; d: number; alpha: number }>;
		const t = clock - startTime; // ms the bottle has been active
		const cx = props.x ?? 0;
		const cy = props.y ?? 0;
		const nozX = cx + ((cfg.nozzleNx ?? 0.5) - 0.5) * w;
		const nozY = cy + ((cfg.nozzleNy ?? 0.086) - 0.5) * h;
		const T_EMIT = 320; // ms between drips — fast enough that a few chase each other down (a drip run)
		const T_LIFE = 950; // ms a drip lives (swell + fall + fade)
		const newest = Math.floor(t / T_EMIT);
		const out: Array<{ id: number; x: number; y: number; d: number; alpha: number }> = [];
		for (let k = 0; k < 5; k++) {
			const idx = newest - k;
			if (idx < 0) continue;
			const p = (t - idx * T_EMIT) / T_LIFE; // 0..1 progress of this drip
			if (p < 0 || p > 1) continue;
			const jx = (((idx * 37) % 5) / 5 - 0.5) * 0.05; // tiny per-drip scatter
			const swell = Math.min(1, p / 0.3); // a bead swells at the nozzle tip (the ooze)
			const fall = Math.max(0, (p - 0.3) / 0.7); // then it pinches off and falls
			const x = nozX + jx * w;
			const y = nozY + (0.02 + 0.72 * fall * fall) * h; // straight down, gravity accelerating
			const d = Math.max(3, 0.145 * w) * (0.4 + 0.6 * swell);
			const fadeOut = 1 - Math.max(0, (p - 0.82) / 0.18);
			out.push({ id: idx, x, y, d, alpha: Math.min(1, swell * 1.5) * fadeOut });
		}
		return out;
	});

	// Melty cheese drip: while the cheese is alive on the board, slow gooey drops ooze off a few
	// points along its bottom edge — a bead swells and hangs on a thinning strand, pinches off, then
	// falls and fades. Thicker/slower than the sauce squirt so it reads as melted cheese.
	const dripColor = $derived(props.config.drip?.color ?? 0xf6aa0b);
	const dripBlobs = $derived.by(() => {
		const cfg = props.config.drip;
		const active = running && startTime >= 0;
		if (!cfg || !active)
			return [] as Array<{ id: number; x: number; y: number; edgeY: number; d: number; alpha: number; neckAlpha: number }>;
		const t = clock - startTime;
		const cx = props.x ?? 0;
		const cy = props.y ?? 0;
		const edgeY = cy + ((cfg.edgeNy ?? 0.74) - 0.5) * h;
		const nozzles = cfg.nozzles ?? [0.5];
		const T_EMIT = 1150; // ms between drops per point — cheese oozes lazily
		const T_LIFE = 2050; // ms a drop lives (swell + hang + fall + fade)
		const out: Array<{ id: number; x: number; y: number; edgeY: number; d: number; alpha: number; neckAlpha: number }> = [];
		nozzles.forEach((nx, ni) => {
			const nozX = cx + (nx - 0.5) * w;
			const tt = t + ni * T_EMIT * 0.6; // stagger the points so they don't drip in unison
			const newest = Math.floor(tt / T_EMIT);
			for (let k = 0; k < 2; k++) {
				const idx = newest - k;
				if (idx < 0) continue;
				const p = (tt - idx * T_EMIT) / T_LIFE;
				if (p < 0 || p > 1) continue;
				const swell = Math.min(1, p / 0.4); // the bead fattens as it forms
				const attached = p < 0.5;
				const stretch = (attached ? p / 0.5 : 1) * 0.14; // hangs lower on a thinning strand
				const fall = attached ? 0 : (p - 0.5) / 0.5; // then pinches off and drops
				const y = edgeY + (stretch + 0.42 * fall * fall) * h;
				const d = Math.max(3, 0.12 * w) * (0.4 + 0.6 * swell);
				const fadeOut = 1 - Math.max(0, (p - 0.72) / 0.28);
				out.push({
					id: ni * 1000 + idx,
					x: nozX,
					y,
					edgeY,
					d,
					alpha: Math.min(1, swell * 1.4) * fadeOut,
					neckAlpha: attached ? (1 - p / 0.5) * 0.9 : 0,
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
	<!-- Sauce drip (bottles only) — a glossy drop that dribbles down off the nozzle. A dark rim + a
	     white glint make it read as a distinct wet drop even over a same-coloured bottle. -->
	{#each squirtBlobs as b (b.id)}
		<Circle x={b.x} y={b.y} diameter={b.d * 1.16} anchor={0.5} backgroundColor={0x000000} backgroundAlpha={b.alpha * 0.28} />
		<Circle x={b.x} y={b.y} diameter={b.d} anchor={0.5} backgroundColor={squirtColor} backgroundAlpha={b.alpha} />
		<Circle x={b.x - b.d * 0.19} y={b.y - b.d * 0.22} diameter={b.d * 0.34} anchor={0.5} backgroundColor={0xffffff} backgroundAlpha={b.alpha * 0.55} />
	{/each}
	<!-- Melty cheese drip: a gooey teardrop (round bottom + pointed top) on a thinning strand while it
	     hangs, that pinches off and falls. Dark rim + white glint read it as a wet drop of cheese. -->
	{#each dripBlobs as b (b.id)}
		{#if b.neckAlpha > 0.01}
			<Rectangle x={b.x} y={(b.edgeY + b.y) / 2} anchor={0.5} width={b.d * 0.42} height={Math.max(1, b.y - b.edgeY)} backgroundColor={dripColor} backgroundAlpha={b.neckAlpha} />
		{/if}
		<Circle x={b.x} y={b.y} diameter={b.d * 1.18} anchor={0.5} backgroundColor={0x000000} backgroundAlpha={b.alpha * 0.2} />
		<Circle x={b.x} y={b.y - b.d * 0.42} diameter={b.d * 0.62} anchor={0.5} backgroundColor={dripColor} backgroundAlpha={b.alpha} />
		<Circle x={b.x} y={b.y} diameter={b.d} anchor={0.5} backgroundColor={dripColor} backgroundAlpha={b.alpha} />
		<Circle x={b.x - b.d * 0.2} y={b.y - b.d * 0.22} diameter={b.d * 0.3} anchor={0.5} backgroundColor={0xffffff} backgroundAlpha={b.alpha * 0.5} />
	{/each}
</Container>
