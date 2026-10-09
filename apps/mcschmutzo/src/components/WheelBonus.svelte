<script lang="ts" module>
	import { ap } from '../lib/preloadArt';

	// Figma "Wheel" (node 8737:1489), assembled from its separate parts. Everything is laid out in the
	// design's 1200×670 frame coordinates (the "stage") and the stage is scaled to the viewport.
	const A = '/assets/mcschmutzo/wheel2';
	// Diner wall: the design's bg image, pre-blurred (2px) and darkened (10%) as the design does, and
	// mirror-padded on every side so wide / tall screens continue it without a seam.
	const bgArt = ap(`${A}/bg.webp`);
	// Portrait crops to the wheel column; its wall is the plain-wall part of the same image (no
	// awning), mirror-padded the same way, so the tall area above the title stays a clean wall.
	const bgPortraitArt = ap(`${A}/bg-portrait.webp`);
	const woodStripArt = ap(`${A}/wood-strip.webp`); // the 3-plank strip, tiled down below the counter
	const woodArt = ap(`${A}/wood.webp`); // the plank strip both wood layers are cropped from
	const baseArt = ap(`${A}/base.webp`); // "no moving": rim + lights + dark disc + chef-hat hub
	const ringOuterArt = ap(`${A}/ring-outer.svg`); // cream free-games ring (14 wedges)
	const ringInnerArt = ap(`${A}/ring-inner.svg`); // red steps ring (14 wedges)
	const spatulaArt = ap(`${A}/spatula.svg`);
	const spinArt = ap(`${A}/spin-button.svg`);
	const barArt = ap(`${A}/yellow-bar.svg`);
	const badgeGamesArt = ap(`${A}/badge-games.webp`); // "30" splat — max free games
	const badgeStepsArt = ap(`${A}/badge-steps.webp`); // "+15" splat — max added steps
	// Top-left, behind the "+15": the soup pot — the symbol that raises the multiplier every time it
	// lands (Figma 8798:10303, its own hi-res export for this page).
	const soupArt = ap(`${A}/pot.webp`);

	// Both rings turn about ONE centre on the base, midway between the dark disc's centre (fitted:
	// 338.07, 331.46, r 279.9) and the hub's (Figma 8740:2373: 337, 331, r 101), so the dark gaps to
	// the rim and to the hub stay even all the way round (wheel-local px).
	const CX = 337.55;
	const CY = 331.25;
	const WHEEL_X = 259; // "no moving" frame, stage coords
	const WHEEL_Y = 211;
	// Ring art size, its MEASURED centre (circle fit to its edges — the vectorized art isn't exactly
	// centred in its box), label radius, and the perfect annulus it's trimmed to. The art's edges
	// wobble ±2–4px off a true circle, which made the dark gaps between the rings visibly uneven as
	// they turned; trimming to the 5th/95th-percentile edge radii makes every gap a true circle.
	const OUTER = { w: 548, h: 542, ox: 273.52, oy: 270.86, r: 224, clipIn: 192.1, clipOut: 270.5 };
	const INNER = { w: 392, h: 392, ox: 195.72, oy: 193.46, r: 143, clipIn: 112.7, clipOut: 179.6 };

	// 14 wedges per ring, index 0 at the top, clockwise. The upper half is the design's labels
	// (outer 8·10·12·15·20·30·10, inner +4·+10·+3·+4·+15·+6·+8); the hidden lower half completes each
	// ring so every value the RGS can award (free games 6–30, steps 3–15) is on it.
	const SEG = 360 / 14;
	// The ring art's wedges are NOT evenly spaced (up to ~3° off 360/14). These centres are MEASURED
	// from the divider gaps in ring-outer/inner.svg, so every label sits dead-centre in its wedge and
	// the won wedge lands squarely under the spatula. Re-measure if the ring art changes.
	const OUTER_ANGLES = [-0.1, 26.3, 52.45, 78.1, 102.7, 127.0, 152.75, 180.35, 207.85, 233.45, 257.8, 282.1, 307.3, 333.45];
	const INNER_ANGLES = [0.05, 26.1, 51.9, 77.4, 101.9, 125.8, 151.7, 180.0, 208.45, 234.35, 258.1, 282.6, 308.05, 333.9];
	const OUTER_VALUES = [15, 20, 30, 10, 6, 12, 8, 20, 6, 15, 10, 8, 10, 12];
	const INNER_VALUES = [4, 15, 6, 8, 5, 3, 10, 6, 5, 8, 3, 4, 10, 3];

	// Suspense pacing: both rings pull back a hair, wind up slowly, then coast down through a long
	// crawl. The inner ring follows the outer one a beat later and lands after it — on the spin
	// sound's final hit (sfx_wheel_spin: 8.0 s in, then it rings out), so the whole clip is heard.
	const OUTER_MS = 6950;
	const INNER_MS = 7350;
	const INNER_DELAY_MS = 650;
	const OUTER_TURNS = 8;
	const INNER_TURNS = 7;
	const EASE = 'cubic-bezier(0.45, -0.03, 0.1, 1)';

	// Rim bulbs (centres measured from the base art, wheel-local); the static rim doesn't turn, so the
	// light show sits on top of the baked bulbs: idle twinkle → chase while spinning → flash on land.
	const BULBS = [
		[337.9, 31.6], [445.3, 54.1], [533.3, 105.3], [597.1, 179.6], [632.6, 270.2], [635.9, 372.2],
		[608.3, 462.0], [553.3, 539.1], [479.9, 593.9], [389.0, 625.8], [282.8, 624.7], [192.9, 593.8],
		[121.8, 538.9], [67.6, 461.8], [40.1, 372.1], [43.4, 270.1], [78.7, 179.6], [142.5, 105.3],
		[230.7, 54.1],
	];

	// Sparks thrown off the pointer when the wheel lands (angle°, distance, size, delay ms).
	const SPARKS = Array.from({ length: 16 }, (_, i) => ({
		a: -165 + (i * 150) / 15 + ((i * 37) % 11) - 5,
		d: 90 + ((i * 53) % 70),
		size: 7 + ((i * 29) % 7),
		delay: (i * 17) % 90,
	}));

	// Pick a wedge showing `value` (random among matches). If the value isn't on the ring at all,
	// relabel a wedge from the hidden half so the wheel still lands on what was actually awarded.
	const pickSegment = (values: number[], value: number) => {
		const hits = values.flatMap((v, i) => (v === value ? [i] : []));
		if (hits.length) return { index: hits[Math.floor(Math.random() * hits.length)], values };
		const index = 7;
		return { index, values: values.map((v, i) => (i === index ? value : v)) };
	};
</script>

<script lang="ts">
	import { getContext } from '../game/context';
	import { i18nDerived } from '../i18n/i18nDerived';
	import { fade } from 'svelte/transition';
	import { cubicIn } from 'svelte/easing';
	import { stateBet, stateBetDerived, stateConfig } from 'state-shared';
	import { isReplayMode } from '../state/roundFlow.svelte';

	const context = getContext();
	const wheel = $derived(context.stateGame.wheel);

	let rotOuter = $state(0);
	let rotInner = $state(0);
	let outerValues = $state(OUTER_VALUES);
	let innerValues = $state(INNER_VALUES);
	let spinning = $state(false);
	let spun = $state(false);
	let settled = $state(false);
	let winOuter = $state(-1);
	let winInner = $state(-1);
	let spatulaTilt = $state(0);
	let outerDone = false;
	let innerDone = false;
	let outerEl: HTMLDivElement | undefined = $state();

	// Reset each time the wheel appears (or is cleared). In manual play the player presses SPIN;
	// autoplay, held Space and replay spin it on their own (see the auto-spin effect below).
	$effect(() => {
		context.stateGame.wheel;
		rotOuter = rotInner = 0;
		outerValues = OUTER_VALUES;
		innerValues = INNER_VALUES;
		spinning = spun = settled = false;
		winOuter = winInner = -1;
	});

	// Stage fit: the design frame is 1200×670. Landscape shows the whole frame (contain); portrait
	// crops to the wheel column (≈760 wide) and lifts the two "max win" badges above the title.
	let vw = $state(1200);
	let vh = $state(670);
	$effect(() => {
		const onResize = () => {
			vw = window.innerWidth;
			vh = window.innerHeight;
		};
		onResize();
		window.addEventListener('resize', onResize);
		return () => window.removeEventListener('resize', onResize);
	});
	const portrait = $derived(vh > vw * 1.05);
	const fit = $derived.by(() => {
		if (!portrait) {
			const s = Math.min(vw / 1200, vh / 670);
			return { s, ox: (vw - 1200 * s) / 2, oy: (vh - 670 * s) / 2 };
		}
		// content spans stage y −170 (badge) … 670, x ≈ 218 … 978
		const s = Math.min(vw / 760, vh / 900);
		return { s, ox: vw / 2 - 598 * s, oy: (vh - 840 * s) / 2 + 170 * s };
	});
	const stageStyle = $derived(`transform: translate(${fit.ox}px, ${fit.oy}px) scale(${fit.s})`);
	// Vignette = the design's radial shade (frame 8740:2302 fill), kept centred on the stage and
	// continued past its edges so wide/tall screens don't show a seam.
	const vignetteStyle = $derived.by(() => {
		const { s, ox, oy } = fit;
		// portrait: stretched tall so the extra wall / counter above and below isn't a black band
		const [rx, ry, cy] = portrait ? [600, 820, 330] : [635, 354, 316];
		return `background: radial-gradient(ellipse ${rx * s}px ${ry * s}px at ${ox + 600 * s}px ${oy + cy * s}px, rgba(104,27,18,0) 40.6%, rgba(55,14,9,0.305) 70.3%, rgba(30,8,5,0.4575) 85.2%, rgba(6,1,1,0.61) 100%)`;
	});

	// Idle "itching to spin": until SPIN is pressed both rings sway like pendulums in opposite
	// directions — equal swing each way (pure sine), eased in from rest, amplitude and tempo drifting
	// slowly on unrelated periods so it never visibly repeats. (The sway never reaches a divider, so
	// the spatula hangs still until the spin.) Driven through the same rotations the spin uses, so the spin starts from wherever
	// the rings are. Reduced motion: still.
	$effect(() => {
		if (!wheel || spun || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		let raf = 0;
		const t0 = performance.now();
		const loop = (now: number) => {
			const t = (now - t0) / 1000;
			const e = Math.min(1, t / 2.2);
			const easeIn = e * e * (3 - 2 * e);
			const amp = 4.4 + 0.9 * Math.sin(t / 5.3) * Math.sin(t / 3.1 + 1);
			// slow, heavy swing (≈3.2s each way and back) — the wheel "thinking about it"
			const phase = t * 1.95 + 0.25 * Math.sin(t / 4.7);
			rotOuter = easeIn * amp * Math.sin(phase);
			rotInner = -easeIn * amp * 0.8 * Math.sin(phase + 0.6);
			raf = requestAnimationFrame(loop);
		};
		raf = requestAnimationFrame(loop);
		return () => cancelAnimationFrame(raf);
	});

	// Spin both rings onto the RGS award: the outer (free games) clockwise, the inner (steps)
	// counter-clockwise and a beat longer, so the two results land one after the other.
	const onSpin = () => {
		const w = context.stateGame.wheel;
		if (!w || spun) return;
		spun = true;
		const o = pickSegment(OUTER_VALUES, w.freeSpins);
		const i = pickSegment(INNER_VALUES, w.addedSteps);
		outerValues = o.values;
		innerValues = i.values;
		winOuter = o.index;
		winInner = i.index;
		outerDone = innerDone = false;
		spinning = true;
		skipped = false;
		context.eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_wheel_spin', forcePlay: true });
		requestAnimationFrame(() => {
			rotOuter = Math.ceil(rotOuter / 360) * 360 + 360 * OUTER_TURNS - OUTER_ANGLES[o.index];
			rotInner = Math.floor(rotInner / 360) * 360 - 360 * INNER_TURNS - INNER_ANGLES[i.index];
		});
	};

	// Nobody is at the controls during autoplay / held Space, and a replay must play through on its
	// own — waiting for a SPIN press there stalls the round. Give the wheel a beat on screen, then spin.
	const AUTO_SPIN_DELAY_MS = 1800; // (after the screen's ~1.4 s entrance — see wb-in-* in the styles)
	const autoSpins = $derived(
		isReplayMode() ||
			stateBetDerived.hasAutoBetCounter() ||
			context.stateXstateDerived.isAutoBetting() ||
			stateBet.isSpaceHold,
	);
	$effect(() => {
		if (!wheel || spun || !autoSpins) return;
		const timer = setTimeout(onSpin, AUTO_SPIN_DELAY_MS);
		return () => clearTimeout(timer);
	});

	// Safety net: the bonus flow only continues when both rings report transitionend. A backgrounded
	// tab can drop those events, which would hold the round (and an autoplay run) on the wheel for
	// good — so once the spin has had all its time, settle it regardless.
	const SETTLE_FALLBACK_MS = INNER_DELAY_MS + Math.max(OUTER_MS, INNER_MS) + 1500;
	let fallbackTimer: ReturnType<typeof setTimeout> | undefined;
	const settleNow = () => {
		if (!spinning) return;
		outerDone = innerDone = true;
		spinning = false;
		settled = true;
		// (the spin sound's own final hit is the landing; a skipped spin cut it, so clack instead)
		if (skipped) context.eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_reel_stop', forcePlay: true });
		setTimeout(() => context.stateGame.wheelResolve?.(), 1400);
	};
	$effect(() => {
		if (!spinning) return;
		fallbackTimer = setTimeout(settleNow, SETTLE_FALLBACK_MS);
		return () => clearTimeout(fallbackTimer);
	});

	// Pointer = a real flapper: the spatula hangs on a pin (its upper rivet) and its tip dips into
	// the outer ring, where the wedge dividers act as pegs. A passing peg shoves the tip aside until
	// the lean lifts the tip clear (FLAP_SLIP), then it slips under and the spatula springs back,
	// overshooting and ringing down. At speed the pegs catch it on the way back (flutter); in the
	// final crawl every peg is one slow push → clack → wobble. Angles are in degrees; `flapTheta` > 0
	// = tip to the right (CSS rotate(-θ)).
	// Geometry (stage px): pin at y 181.5, tip at y 285.8, ring centre at y 542.25 → the tip moves
	// L/R ≈ 0.41° of ring angle per degree of lean.
	const FLAP_GEAR = 104.3 / 256.5;
	const FLAP_CONTACT = 2; // tip + divider half-widths, in ring degrees
	const FLAP_SLIP = 14; // lean at which the tip has lifted clear of the divider
	const FLAP_W = 2 * Math.PI * 6.5; // natural frequency (rad/s) — a light, stiff pointer
	const FLAP_ZETA = 0.16;
	const FLAP_BOUNCE = 0.3; // restitution when the swinging tip hits a divider
	// The bracket's stops: at full speed a divider flings the tip far harder than any lean it could
	// take, so it bangs against a stop each side instead of whirling round.
	const FLAP_STOP = 22;
	const FLAP_STOP_BOUNCE = 0.35;
	const DIVIDERS = OUTER_ANGLES.map((a, i) => {
		const next = OUTER_ANGLES[(i + 1) % OUTER_ANGLES.length] + (i === OUTER_ANGLES.length - 1 ? 360 : 0);
		return (a + next) / 2;
	});
	const wrap180 = (a: number) => ((((a + 180) % 360) + 360) % 360) - 180;
	$effect(() => {
		if (!wheel || !outerEl || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		const el = outerEl;
		const readRot = () => {
			const m = getComputedStyle(el).transform.match(/matrix\(([^,]+),\s*([^,]+)/);
			return m ? (Math.atan2(+m[2], +m[1]) * 180) / Math.PI : 0;
		};
		let theta = 0;
		let omega = 0;
		let rot = readRot(); // unwrapped ring angle
		let rawPrev = rot;
		// which side of each divider the tip is on (+1 = tip right of it); refreshed while not touching
		const side = DIVIDERS.map((d) => (wrap180(d + rot) > 0 ? -1 : 1));
		const slipping = DIVIDERS.map(() => false); // passing under the lifted tip
		let last = performance.now();
		let raf = 0;
		const loop = (now: number) => {
			const frameMs = Math.min(50, now - last);
			last = now;
			const raw = readRot();
			const rotTo = rot + wrap180(raw - rawPrev);
			rawPrev = raw;
			const steps = Math.max(1, Math.ceil(frameMs)); // ~1ms substeps
			const dt = frameMs / 1000 / steps;
			const ringVel = frameMs > 0 ? (rotTo - rot) / (frameMs / 1000) : 0;
			const rot0 = rot;
			for (let k = 1; k <= steps; k++) {
				const r = rot0 + ((rotTo - rot0) * k) / steps;
				omega += (-FLAP_W * FLAP_W * theta - 2 * FLAP_ZETA * FLAP_W * omega) * dt;
				theta += omega * dt;
				const tip = theta * FLAP_GEAR;
				for (let j = 0; j < DIVIDERS.length; j++) {
					const a = wrap180(DIVIDERS[j] + r);
					if (Math.abs(a - tip) >= FLAP_CONTACT) {
						side[j] = tip > a ? 1 : -1;
						slipping[j] = false;
						continue;
					}
					if (slipping[j]) continue;
					const pushed = (a + side[j] * FLAP_CONTACT) / FLAP_GEAR;
					if (Math.sign(pushed) === side[j] && Math.abs(pushed) > FLAP_SLIP) {
						slipping[j] = true; // lifted clear: the divider passes under the tip
						continue;
					}
					theta = pushed;
					const rel = omega * FLAP_GEAR - ringVel; // tip vs divider, ring degrees/s
					if (rel * side[j] < 0) omega = (ringVel - FLAP_BOUNCE * rel) / FLAP_GEAR;
				}
				if (Math.abs(theta) > FLAP_STOP) {
					theta = Math.sign(theta) * FLAP_STOP;
					if (omega * theta > 0) omega *= -FLAP_STOP_BOUNCE;
				}
			}
			rot = rotTo;
			spatulaTilt = -theta;
			raf = requestAnimationFrame(loop);
		};
		raf = requestAnimationFrame(loop);
		return () => {
			cancelAnimationFrame(raf);
			spatulaTilt = 0;
		};
	});

	// Space during the spin fast-forwards it: both rings' running transitions are sped up so they land
	// within FAST_FORWARD_MS (the real end values, so transitionend → settle runs as usual and the
	// spatula still clacks over the last pegs, just quicker).
	const FAST_FORWARD_MS = 380;
	let innerEl: HTMLDivElement | undefined = $state();
	let skipped = false;
	const fastForward = () => {
		// the spin sound runs to the slow landing — cut it with the fast-forwarded spin
		if (!skipped) context.eventEmitter.broadcast({ type: 'soundStop', name: 'sfx_wheel_spin' });
		skipped = true;
		for (const el of [outerEl, innerEl]) {
			for (const a of el?.getAnimations() ?? []) {
				const t = a.effect?.getComputedTiming();
				const end = Number(t?.endTime ?? 0);
				const now = Number(a.currentTime ?? 0);
				const left = end - now;
				if (left > FAST_FORWARD_MS) a.updatePlaybackRate(left / FAST_FORWARD_MS);
			}
		}
	};

	// Space presses SPIN too (captured, so the game's own space-to-spin never sees it while the wheel
	// is up), and a second press while it spins fast-forwards it.
	$effect(() => {
		if (!wheel || stateConfig.jurisdiction?.disabledSpacebar) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.code !== 'Space' && e.key !== ' ') return;
			e.preventDefault();
			e.stopImmediatePropagation();
			if (e.repeat) return;
			if (spinning) fastForward();
			else onSpin();
		};
		window.addEventListener('keydown', onKey, { capture: true });
		return () => window.removeEventListener('keydown', onKey, { capture: true });
	});

	// Once both rings have physically settled, let the bonus flow continue into the free games.
	const onSettled = (ring: 'outer' | 'inner') => (e: TransitionEvent) => {
		if (e.propertyName !== 'transform' || !spinning || e.target !== e.currentTarget) return;
		if (ring === 'outer') outerDone = true;
		else innerDone = true;
		if (!outerDone || !innerDone) return;
		// let the landed values pulse before the bonus flow moves on
		settleNow();
	};

	const labelStyle = (angle: number, r: number) =>
		`transform: translate(-50%, -50%) rotate(${angle}deg) translateY(${-r}px)`;
	const ringMask = (ring: typeof OUTER) => {
		const m = `radial-gradient(circle at ${ring.ox}px ${ring.oy}px, transparent ${ring.clipIn - 0.6}px, #000 ${ring.clipIn + 0.4}px, #000 ${ring.clipOut - 0.4}px, transparent ${ring.clipOut + 0.6}px)`;
		return `-webkit-mask:${m}; mask:${m};`;
	};
	const ringStyle = (rot: number, ms: number, ring: typeof OUTER, delay = 0) =>
		`left:${WHEEL_X + CX - ring.ox}px; top:${WHEEL_Y + CY - ring.oy}px; width:${ring.w}px; height:${ring.h}px; transform-origin:${ring.ox}px ${ring.oy}px; transform: rotate(${rot}deg); transition: transform ${spinning ? ms : 0}ms ${EASE} ${spinning ? delay : 0}ms; ${ringMask(ring)}`;
	const lightMode = $derived(spinning ? 'chase' : settled ? 'flash' : 'idle');
</script>

{#if wheel}
	<div class="wb-scene" role="dialog" aria-modal="true" out:fade={{ duration: 280 /* = WHEEL_FADE_OUT_MS in bookEventHandlerMap */, easing: cubicIn }}>
		<!-- Back layers: wall, wood counter, wheel, front plank, rail. -->
		<div class="wb-stage" style={stageStyle}>
			<div
				class="wb-bg-frame"
				class:wb-bg-frame--portrait={portrait}
				style={`background-image:url('${portrait ? bgPortraitArt : bgArt}')`}
			></div>
			<!-- warm stage light behind the wheel: slow-turning rays + a breathing glow -->
			<div class="wb-rays" class:wb-rays--hot={spinning || settled}></div>
			<div class="wb-glow" class:wb-glow--hot={spinning || settled}></div>
			<div class="wb-wood wb-wood--back" style={`background-image:url('${woodArt}')`}></div>

			<img class="wb-base" src={baseArt} alt="" draggable="false" />
			<div
				class="wb-ring"
				class:wb-ring--settled={settled}
				bind:this={outerEl}
				style={ringStyle(rotOuter, OUTER_MS, OUTER)}
				ontransitionend={onSettled('outer')}
			>
				<img src={ringOuterArt} alt="" draggable="false" />
				{#each outerValues as v, i (i)}
					<span
						class="wb-label wb-label--outer"
						class:wb-label--win={settled && i === winOuter}
						style={labelStyle(OUTER_ANGLES[i], OUTER.r) + `; left:${OUTER.ox}px; top:${OUTER.oy}px`}
						><span>{v}</span></span
					>
				{/each}
			</div>
			<div
				class="wb-ring"
				class:wb-ring--settled={settled}
				style={ringStyle(rotInner, INNER_MS, INNER, INNER_DELAY_MS)}
				bind:this={innerEl}
				ontransitionend={onSettled('inner')}
			>
				<img src={ringInnerArt} alt="" draggable="false" />
				{#each innerValues as v, i (i)}
					<span
						class="wb-label wb-label--inner"
						class:wb-label--small={String(v).length > 1}
						class:wb-label--win={settled && i === winInner}
						style={labelStyle(INNER_ANGLES[i], INNER.r) + `; left:${INNER.ox}px; top:${INNER.oy}px`}
						><span>+{v}</span></span
					>
				{/each}
			</div>

			<div class="wb-bulbs wb-bulbs--{lightMode}">
				{#each BULBS as [x, y], i (i)}
					<span style={`left:${WHEEL_X + x}px; top:${WHEEL_Y + y}px; --i:${i}; --odd:${i % 2}`}></span>
				{/each}
			</div>

			<div class="wb-wood wb-wood--front" style={`background-image:url('${woodArt}')`}></div>
			<!-- in front of the wheel, so its lower half stays hidden on tall screens -->
			<div class="wb-floor" style={`background-image:url('${woodStripArt}')`}></div>
			<div class="wb-glint"></div>
			<img class="wb-bar" src={barArt} alt="" draggable="false" />
			<img
				class="wb-spatula"
				src={spatulaArt}
				alt=""
				draggable="false"
				style={`transform: rotate(${spatulaTilt}deg)`}
			/>
			{#if settled}
				<!-- landing burst: light ring + sparks off the pointer -->
				<div class="wb-burst"></div>
				<div class="wb-sparks">
					{#each SPARKS as sp, i (i)}
						<span
							style={`--a:${sp.a}deg; --d:${sp.d}px; width:${sp.size}px; height:${sp.size}px; animation-delay:${sp.delay}ms`}
						></span>
					{/each}
				</div>
			{/if}
		</div>

		<div class="wb-vignette" style={vignetteStyle}></div>

		<!-- Front layers: title, max-win badge, SPIN. -->
		<div class="wb-stage" style={stageStyle}>
			<div class="wb-title">
				<span class="wb-title-outline" aria-hidden="true">{i18nDerived.translate('WIN UP TO')}</span>
				<span class="wb-title-fill">{i18nDerived.translate('WIN UP TO')}</span>
			</div>
			<!-- left corner: the soup pot with the "+15" max-steps splat on its lower right; right corner: max free games -->
			<img
				class="wb-badge wb-badge--soup"
				class:wb-badge--portrait={portrait}
				src={soupArt}
				alt=""
				draggable="false"
			/>
			<img
				class="wb-badge wb-badge--steps"
				class:wb-badge--portrait={portrait}
				src={badgeStepsArt}
				alt=""
				draggable="false"
			/>
			<img
				class="wb-badge wb-badge--games"
				class:wb-badge--portrait={portrait}
				src={badgeGamesArt}
				alt=""
				draggable="false"
			/>
			<button
				class="wb-spin"
				type="button"
				style={`background-image:url('${spinArt}')`}
				disabled={spun}
				onclick={onSpin}
			>
				<span>{i18nDerived.translate('SPIN')}</span>
			</button>
		</div>
	</div>
{/if}

<style>
	.wb-scene {
		position: fixed;
		inset: 0;
		z-index: 45;
		overflow: hidden;
		background: #66301c;
		pointer-events: auto;
		animation: wb-in 0.35s ease-out;
	}
	@keyframes wb-in {
		from {
			opacity: 0;
		}
	}

	.wb-stage {
		position: absolute;
		left: 0;
		top: 0;
		width: 1200px;
		height: 670px;
		transform-origin: 0 0;
		pointer-events: none;
	}

	/* The design places its bg image at (−9, −39, 1388×775); this is that image plus the mirrored
	   padding (839px each side, 937px above, 468px below at source scale ×0.8272). */
	.wb-bg-frame {
		position: absolute;
		left: -703px;
		top: -814.1px;
		width: 2776px;
		height: 1937.3px;
		background: 0 0 / 100% 100% no-repeat;
	}
	/* stage x 330…1100 of the image (plain wall), placed over the wheel column 214…984 */
	.wb-bg-frame--portrait {
		left: -556.1px;
		width: 2310.4px;
	}

	/* Counter continued below the design frame for tall screens: the front plank image ends at
	   y≈797.8, from there the same 3-plank strip repeats down (x/y aligned to the plank image). */
	.wb-floor {
		position: absolute;
		left: -636px;
		top: 797.8px;
		width: 2148px;
		height: 4000px;
		background: 0 0 / 2148px 216.3px repeat-y;
	}

	/* Both wood layers are windows onto one plank-strip image, exactly as the design crops it; the
	   strip runs ~490/645px past the frame on each side, so wide screens stay covered. */
	.wb-wood {
		position: absolute;
		background-repeat: no-repeat;
	}
	.wb-wood--back {
		left: -488.5px;
		top: 402px;
		width: 2041px;
		height: 191px;
		background-size: 2041px 681px;
		background-position: 0 -245.8px;
	}
	.wb-wood--front {
		left: -645px;
		top: 593px;
		width: 2166px;
		height: 465px;
		background-size: 2166px 721.7px;
		background-position: 0 -256.7px;
	}

	.wb-base {
		position: absolute;
		left: 259px;
		top: 211px;
		width: 677px;
		height: 677px;
	}

	.wb-ring {
		position: absolute;
		will-change: transform;
	}
	.wb-ring > img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
	}

	.wb-label {
		position: absolute;
		font-family: 'Bowlby One SC', sans-serif;
		letter-spacing: 1.4px;
		line-height: 1;
		white-space: nowrap;
		text-transform: uppercase;
	}
	.wb-label--outer {
		font-size: 44px;
		color: #ad1701;
	}
	.wb-label--inner {
		font-size: 28px;
		color: #f9dda7;
	}
	.wb-label--small {
		font-size: 25px;
	}
	/* Landed values bounce ONCE when the rings settle. The inner span animates, so the scale is about
	   the label itself (scaling the positioned outer span would fling it outward off its wedge). */
	.wb-label > span {
		display: block;
	}
	/* The landed values: everything else on the rings dims, the winners pop to ~1.75×, settle at
	   1.45× in a hot gold glow and keep pulsing while the result is on show. */
	.wb-label {
		transition: opacity 0.35s ease;
	}
	.wb-ring--settled .wb-label:not(.wb-label--win) {
		opacity: 0.4;
	}
	.wb-label--win > span {
		animation:
			wb-win 0.75s cubic-bezier(0.3, 1.5, 0.5, 1) both,
			wb-win-pulse 1.1s ease-in-out 0.75s infinite;
	}
	.wb-label--inner.wb-label--win {
		color: #fff7d6;
	}
	@keyframes wb-win {
		0% {
			scale: 1;
		}
		45% {
			scale: 1.75;
			filter: drop-shadow(0 0 6px #fff1a8) drop-shadow(0 0 16px #ffb400);
		}
		100% {
			scale: 1.45;
			filter: drop-shadow(0 0 4px #ffe27a) drop-shadow(0 0 10px #ff9a00);
		}
	}
	@keyframes wb-win-pulse {
		0%,
		100% {
			scale: 1.45;
			filter: drop-shadow(0 0 4px #ffe27a) drop-shadow(0 0 10px #ff9a00);
		}
		50% {
			scale: 1.55;
			filter: drop-shadow(0 0 7px #fff1a8) drop-shadow(0 0 18px #ffb400);
		}
	}

	/* Faint light line + cream rail the wheel rests in (8740:2697 / 8740:2186). */
	.wb-glint {
		position: absolute;
		left: 281px;
		top: 574px;
		width: 637px;
		height: 9px;
		background: rgba(217, 217, 217, 0.2);
		filter: blur(2px);
	}
	.wb-bar {
		position: absolute;
		left: 249px;
		top: 583.15px;
		width: 701px;
		height: 13px;
	}

	.wb-spatula {
		position: absolute;
		left: 534px;
		top: 161px;
		width: 133px;
		height: 133px;
		/* the pin = the upper rivet on the handle */
		transform-origin: 49.85% 15.4%;
		filter: drop-shadow(0 3px 4px rgba(0, 0, 0, 0.35));
	}

	.wb-vignette {
		position: absolute;
		inset: 0;
		opacity: 0.9;
		pointer-events: none;
	}

	/* "WIN UP TO": yellow→orange gradient fill over a dark-brown outline copy. */
	.wb-title {
		position: absolute;
		left: 600px;
		top: 78.5px;
		translate: -50% -50%;
		/* the game's title face (app.html --font-brush), a touch larger: it's narrower and lighter */
		font-family: var(--font-brush);
		font-size: 64px;
		line-height: 1.2;
		letter-spacing: 1.4px;
		text-transform: uppercase;
		white-space: nowrap;
	}
	.wb-title-outline {
		color: #5c1a07;
		/* the fill's 3px stroke + the 5px outline beyond it */
		-webkit-text-stroke: 8px #5c1a07;
		filter: drop-shadow(0 2px 2px rgba(0, 0, 0, 0.3));
	}
	.wb-title-fill {
		position: absolute;
		inset: 0;
		background: linear-gradient(180.5deg, #feeb62 28.7%, #ff8800 73.7%);
		-webkit-background-clip: text;
		background-clip: text;
		color: transparent;
		/* bold: the brush face is light, so the glyphs are fattened with a transparent stroke — the
		   text clip includes the stroke, so the gradient paints it too */
		-webkit-text-stroke: 3px transparent;
	}

	.wb-badge {
		position: absolute;
		top: 36px;
		width: 221px;
		height: 147px;
		/* entrance pop (scale/opacity), then the endless bob (translate/rotate) — separate properties */
		animation:
			wb-in-pop 0.5s cubic-bezier(0.34, 1.7, 0.6, 1) var(--in, 0.8s) both,
			wb-badge-bob 2.8s ease-in-out var(--bob, 0s) infinite;
	}
	/* Figma: 209×209 at (18, 19) — the symbol art's own padding sits it like the design. */
	.wb-badge--soup {
		left: 18px;
		top: 19px;
		width: 209px;
		height: 209px;
	}
	.wb-badge--games {
		left: 938px; /* mirrored: 1200 − 41 − 221 */
		--bob: -1.4s;
		--in: 0.9s;
	}
	.wb-badge--portrait {
		top: -165px;
	}
	/* a smaller "+15" on the pot's lower RIGHT, clear of the McSchmutzo label (pot: 209×209 at 18, 19;
	   its visible body spans x 27…218, y 33…191) — about half the pot's width */
	.wb-badge--steps {
		left: 130px;
		top: 132px;
		width: 100px;
		height: 66px;
		--bob: -0.7s;
		--in: 1s;
	}
	.wb-badge--steps.wb-badge--portrait {
		left: 490px; /* the same offset from the portrait pot (378, −196) */
		top: -83px;
	}
	.wb-badge--soup.wb-badge--portrait {
		left: 378px;
		top: -196px;
	}
	.wb-badge--games.wb-badge--portrait {
		left: 607px;
	}
	@keyframes wb-badge-bob {
		0%,
		100% {
			translate: 0 0;
			rotate: -2deg;
		}
		50% {
			translate: 0 -5px;
			rotate: 2deg;
		}
	}

	/* Warm light behind the wheel (centred on the rings, stage (596.55, 542.25)). */
	.wb-rays,
	.wb-glow {
		position: absolute;
		left: 596.55px;
		top: 542.25px;
		translate: -50% -50%;
		border-radius: 50%;
		pointer-events: none;
		transition: opacity 0.8s ease;
	}
	.wb-rays {
		width: 1500px;
		height: 1500px;
		background: repeating-conic-gradient(
			from 0deg,
			rgba(255, 236, 170, 0.55) 0deg 7deg,
			rgba(255, 236, 170, 0) 7deg 22.5deg
		);
		-webkit-mask: radial-gradient(circle, #000 18%, transparent 62%);
		mask: radial-gradient(circle, #000 18%, transparent 62%);
		mix-blend-mode: soft-light;
		opacity: 0.55;
		animation: wb-spin-rays 48s linear infinite;
	}
	.wb-rays--hot {
		opacity: 0.95;
	}
	@keyframes wb-spin-rays {
		to {
			rotate: 360deg;
		}
	}
	.wb-glow {
		width: 900px;
		height: 900px;
		background: radial-gradient(circle, rgba(255, 214, 130, 0.5) 30%, rgba(255, 190, 90, 0) 68%);
		mix-blend-mode: screen;
		opacity: 0.35;
		animation: wb-breathe 3.2s ease-in-out infinite;
	}
	.wb-glow--hot {
		opacity: 0.7;
	}
	@keyframes wb-breathe {
		50% {
			scale: 1.06;
			filter: brightness(1.15);
		}
	}

	/* Rim bulb light show over each baked bulb: ::before dims the bulb when it's "off", ::after is a
	   big bright halo when it's "on" — the two run the same animation inverted, so the contrast
	   between on and off is what reads. */
	.wb-bulbs span {
		position: absolute;
		width: 0;
		height: 0;
		pointer-events: none;
	}
	.wb-bulbs span::before,
	.wb-bulbs span::after {
		content: '';
		position: absolute;
		translate: -50% -50%;
		border-radius: 50%;
		animation-duration: inherit;
		animation-delay: inherit;
		animation-iteration-count: inherit;
		animation-timing-function: inherit;
	}
	.wb-bulbs span::before {
		width: 22px;
		height: 22px;
		background: radial-gradient(circle, rgba(110, 40, 0, 0.72) 0 55%, rgba(110, 40, 0, 0) 75%);
		opacity: 0;
	}
	.wb-bulbs span::after {
		width: 78px;
		height: 78px;
		background: radial-gradient(
			circle,
			#ffffff 0 13%,
			rgba(255, 245, 190, 0.95) 20%,
			rgba(255, 205, 70, 0.6) 34%,
			rgba(255, 150, 20, 0.22) 52%,
			rgba(255, 140, 0, 0) 70%
		);
		mix-blend-mode: plus-lighter;
		opacity: 0;
	}
	/* idle: alternate bulbs swap on/off in two groups */
	.wb-bulbs--idle span {
		animation-duration: 1.4s;
		animation-iteration-count: infinite;
		animation-timing-function: ease-in-out;
		animation-delay: calc(var(--odd) * -0.7s);
	}
	.wb-bulbs--idle span::after {
		animation-name: wb-on;
	}
	.wb-bulbs--idle span::before {
		animation-name: wb-off;
	}
	/* spinning: a bright light runs round the rim */
	.wb-bulbs--chase span {
		animation-duration: 0.8s;
		animation-iteration-count: infinite;
		animation-timing-function: linear;
		animation-delay: calc(var(--i) * 0.042s);
	}
	.wb-bulbs--chase span::after {
		animation-name: wb-chase-on;
	}
	.wb-bulbs--chase span::before {
		animation-name: wb-chase-off;
	}
	/* landed: everything flashes together */
	.wb-bulbs--flash span {
		animation-duration: 0.3s;
		animation-iteration-count: infinite;
		animation-timing-function: steps(1, end);
	}
	.wb-bulbs--flash span::after {
		animation-name: wb-flash-on;
	}
	.wb-bulbs--flash span::before {
		animation-name: wb-flash-off;
	}
	@keyframes wb-on {
		0%,
		100% {
			opacity: 0.15;
		}
		50% {
			opacity: 1;
		}
	}
	@keyframes wb-off {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0;
		}
	}
	@keyframes wb-chase-on {
		0%,
		25% {
			opacity: 1;
		}
		55%,
		100% {
			opacity: 0.05;
		}
	}
	@keyframes wb-chase-off {
		0%,
		25% {
			opacity: 0;
		}
		55%,
		100% {
			opacity: 1;
		}
	}
	@keyframes wb-flash-on {
		0% {
			opacity: 1;
		}
		50% {
			opacity: 0.1;
		}
	}
	@keyframes wb-flash-off {
		0% {
			opacity: 0;
		}
		50% {
			opacity: 1;
		}
	}

	/* Landing burst from the pointer: an expanding light ring + sparks. */
	.wb-burst {
		position: absolute;
		left: 600px;
		top: 300px;
		width: 60px;
		height: 60px;
		translate: -50% -50%;
		border-radius: 50%;
		background: radial-gradient(circle, rgba(255, 250, 220, 0.9) 0 25%, rgba(255, 200, 80, 0.5) 45%, transparent 70%);
		mix-blend-mode: screen;
		pointer-events: none;
		animation: wb-burst 0.7s ease-out forwards;
	}
	@keyframes wb-burst {
		from {
			scale: 0.3;
			opacity: 1;
		}
		to {
			scale: 7;
			opacity: 0;
		}
	}
	.wb-sparks {
		position: absolute;
		left: 600px;
		top: 290px;
		pointer-events: none;
	}
	.wb-sparks span {
		position: absolute;
		translate: -50% -50%;
		border-radius: 50%;
		background: radial-gradient(circle, #fffbe6 0 35%, #ffc93a 60%, rgba(255, 150, 0, 0) 72%);
		opacity: 0;
		animation: wb-spark 0.85s cubic-bezier(0.2, 0.7, 0.4, 1) forwards;
	}
	@keyframes wb-spark {
		0% {
			opacity: 1;
			transform: rotate(var(--a)) translateX(0) scale(1.2);
		}
		100% {
			opacity: 0;
			transform: rotate(var(--a)) translateX(var(--d)) translateY(40px) scale(0.3);
		}
	}

	/* SPIN button (8740:2190 art + 8740:2191 label). */
	.wb-spin {
		position: absolute;
		left: 445px;
		top: 555px;
		width: 303px;
		height: 63px;
		border: 0;
		padding: 0;
		background: transparent center / 100% 100% no-repeat;
		cursor: pointer;
		display: grid;
		place-items: center;
		pointer-events: auto;
		transition:
			filter 0.12s ease,
			transform 0.08s ease;
	}
	.wb-spin span {
		font-family: 'Nunito', sans-serif;
		font-weight: 700;
		font-size: 36px;
		line-height: 20px;
		letter-spacing: 1.4px;
		color: #e6c292;
		text-transform: uppercase;
	}
	.wb-spin:not(:disabled):hover {
		filter: brightness(1.1);
	}
	.wb-spin:not(:disabled):active {
		transform: scale(0.97);
	}
	.wb-spin:disabled {
		filter: saturate(0.6) brightness(0.8);
		cursor: default;
	}

	/* ── Entrance (the scene's own fade is wb-in) ─────────────────────────────────────────────────
	   The room settles (wall eases back, the counter rises into place), the wheel pops up spinning
	   into place, the spatula drops onto it, then the title stamps down, the badges pop and SPIN
	   bounces in last (~1.4 s). Only scale / rotate / translate / opacity are animated, so nothing
	   fights the inline transforms (the rings' spin, the spatula's tilt) or the badges' bob. */
	.wb-bg-frame {
		animation: wb-in-settle 0.9s cubic-bezier(0.2, 0.7, 0.3, 1) both;
	}
	.wb-wood,
	.wb-floor,
	.wb-glint,
	.wb-bar {
		animation: wb-in-rise 0.55s cubic-bezier(0.2, 0.8, 0.3, 1.05) 0.1s both;
	}
	.wb-base,
	.wb-ring {
		animation: wb-in-wheel 0.75s cubic-bezier(0.3, 1.35, 0.55, 1) 0.2s both;
	}
	.wb-base {
		transform-origin: 50% 50%;
	}
	.wb-bulbs {
		animation: wb-in-fade 0.35s ease-out 0.75s both;
	}
	.wb-spatula {
		animation: wb-in-drop 0.5s cubic-bezier(0.3, 1.5, 0.55, 1) 0.65s both;
	}
	.wb-title {
		animation: wb-in-stamp 0.45s cubic-bezier(0.3, 1.4, 0.55, 1) 0.6s both;
	}
	.wb-spin {
		animation: wb-in-pop 0.5s cubic-bezier(0.34, 1.7, 0.6, 1) 1.05s both;
	}
	@keyframes wb-in-settle {
		from {
			scale: 1.08;
		}
	}
	@keyframes wb-in-rise {
		from {
			translate: 0 90px;
			opacity: 0;
		}
	}
	@keyframes wb-in-wheel {
		from {
			scale: 0.35;
			rotate: -150deg;
			opacity: 0;
		}
		35% {
			opacity: 1;
		}
	}
	@keyframes wb-in-fade {
		from {
			opacity: 0;
		}
	}
	@keyframes wb-in-drop {
		from {
			translate: 0 -260px;
			opacity: 0;
		}
		40% {
			opacity: 1;
		}
	}
	@keyframes wb-in-stamp {
		from {
			scale: 1.9;
			opacity: 0;
		}
		60% {
			opacity: 1;
		}
	}
	@keyframes wb-in-pop {
		from {
			scale: 0;
			opacity: 0;
		}
		50% {
			opacity: 1;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.wb-bg-frame,
		.wb-wood,
		.wb-floor,
		.wb-glint,
		.wb-bar,
		.wb-base,
		.wb-ring,
		.wb-bulbs,
		.wb-spatula,
		.wb-title,
		.wb-spin {
			animation: none;
		}
		.wb-badge {
			animation: wb-badge-bob 2.8s ease-in-out var(--bob, 0s) infinite;
		}
	}
</style>
