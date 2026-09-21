<script lang="ts">
	import { onMount } from 'svelte';
	import { Container, Sprite } from 'pixi-svelte';

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
</Container>
