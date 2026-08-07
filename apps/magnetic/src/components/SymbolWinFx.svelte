<script lang="ts">
	import { Container, Graphics, Sprite } from 'pixi-svelte';

	// In-engine win choreography for ONE winning board cell, layered over the hi-res static win
	// art. This replaces the 9–10 frame win flipbooks, which looped at ~14fps and whose object
	// never actually moved — they read as a static symbol with a glitchy glow (called out in the
	// Stake review). Everything here is procedural and time-based, so it is resolution-independent
	// and stays fluid at any frame rate:
	//   entry   — spark burst + expanding shockwave ring + bright glow flash + decaying wobble
	//   sustain — heartbeat scale pulse, breathing back-glow, a soft ring each beat, and short
	//             electric arcs crawling the symbol's rim (the game's electric identity)
	// Drawing is IMPERATIVE into captured Graphics from one persistent rAF — the same pattern as
	// the board's lock borders and WinBoardFx, so no Svelte reactivity sits in the render path.
	type Props = {
		assetKey: string;
		x: number;
		y: number;
		width: number;
		height: number;
		alpha?: number;
		zIndex?: number;
		/** 0..1 — de-phases the sustain beat per cell so a full-board win breathes, not strobes. */
		phase?: number;
	};
	const props: Props = $props();

	// 0.62 → 0.5 (user round): a tighter FX footprint — glow, rings and sparks all key off R,
	// so this one factor shrinks the whole effect around the symbol.
	const R = $derived(Math.max(props.width, props.height) * 0.5);
	const GLOW_COLOR = 0x46c8ff;
	const ARC_COLOR = 0x66d4ff;
	/** Sustain heartbeat period, seconds. */
	const P = 1.0;

	type G = {
		destroyed: boolean;
		clear: () => void;
		moveTo: (x: number, y: number) => void;
		lineTo: (x: number, y: number) => void;
		circle: (x: number, y: number, r: number) => unknown;
		ellipse: (x: number, y: number, rx: number, ry: number) => unknown;
		stroke: (s: object) => void;
		fill: (s: object) => void;
	};
	let backG = $state<G | null>(null);
	let frontG = $state<G | null>(null);

	// Symbol transform, written by the rAF; the Sprite just binds them.
	let rot = $state(0);
	let pulse = $state(1);

	// One burst of spark streaks, built once at mount so the fan pattern is stable per activation.
	const SPARKS = Array.from({ length: 14 }, (_, i) => ({
		a: (i / 14) * Math.PI * 2 + ((i * 2654435761) % 100) / 100 - 0.5,
		speed: 0.7 + (((i * 40503) % 100) / 100) * 0.5,
		len: 0.1 + (((i * 9973) % 100) / 100) * 0.1,
	}));
	const BURST_DUR = 0.55;

	const drawBack = (g: G, t: number, beat: number) => {
		g.clear();
		// Bright entry flash easing into the sustained breathing glow.
		const flash = Math.exp(-t * 6) * 1.4;
		const base = 0.1 + 0.16 * beat + flash * 0.3;
		const steps = 6;
		for (let i = steps; i >= 1; i--) {
			const f = i / steps;
			g.circle(0, 0, R * (0.55 + 0.65 * f) * (1 + flash * 0.12));
			g.fill({ color: GLOW_COLOR, alpha: base * (1 - f) + 0.02 });
		}
	};

	const drawFront = (g: G, t: number, beat: number) => {
		g.clear();

		// ── Entry shockwave: one crisp ring flying out and fading. ──
		if (t < 0.5) {
			const u = t / 0.5;
			const ease = 1 - (1 - u) ** 3;
			const r = R * (0.35 + 0.95 * ease);
			const fade = (1 - u) ** 1.5;
			g.circle(0, 0, r);
			g.stroke({ width: R * 0.1 * (1 - u * 0.6), color: GLOW_COLOR, alpha: 0.55 * fade });
			g.circle(0, 0, r);
			g.stroke({ width: R * 0.03, color: 0xffffff, alpha: 0.85 * fade });
		}

		// ── Entry spark burst: streaks flying outward, white-hot tips. ──
		if (t < BURST_DUR + 0.1) {
			for (const p of SPARKS) {
				const u = Math.min(1, t / BURST_DUR);
				const ease = 1 - (1 - u) ** 3;
				const dist = ease * R * 1.1 * p.speed;
				const fade = Math.max(0, 1 - u);
				const c = Math.cos(p.a);
				const s = Math.sin(p.a);
				g.moveTo(c * dist, s * dist);
				g.lineTo(c * (dist + R * p.len), s * (dist + R * p.len));
				g.stroke({ width: R * 0.035, color: ARC_COLOR, alpha: 0.9 * fade, cap: 'round' });
				g.circle(c * (dist + R * p.len), s * (dist + R * p.len), R * 0.03 * (0.6 + fade));
				g.fill({ color: 0xffffff, alpha: 0.9 * fade });
			}
		}

		// ── A soft ring each heartbeat, radiating off the symbol. ──
		const ringT = (t + (props.phase ?? 0) * P) % P;
		if (t > 0.45) {
			const u = ringT / P;
			g.circle(0, 0, R * (0.6 + 0.6 * u));
			g.stroke({ width: R * 0.06 * (1 - u), color: GLOW_COLOR, alpha: 0.3 * (1 - u) ** 2 });
		}

		// ── Electric arcs crawling the symbol's rim — short jittered polylines with hot cores,
		//    re-jittered every frame so they read as live current, not a loop. ──
		const rimX = props.width * 0.56;
		const rimY = props.height * 0.56;
		const base = t * 0.45 + (props.phase ?? 0);
		for (const off of [0, 1 / 3, 2 / 3]) {
			const N = 6;
			const SEG = 0.09;
			const pts: { x: number; y: number }[] = [];
			for (let i = 0; i <= N; i++) {
				const a = (base + off - (i / N) * SEG) * Math.PI * 2;
				pts.push({
					x: Math.cos(a) * rimX + (Math.random() - 0.5) * R * 0.07,
					y: Math.sin(a) * rimY + (Math.random() - 0.5) * R * 0.07,
				});
			}
			const trace = () => {
				g.moveTo(pts[0].x, pts[0].y);
				for (let i = 1; i <= N; i++) g.lineTo(pts[i].x, pts[i].y);
			};
			trace();
			g.stroke({ width: R * 0.05, color: ARC_COLOR, alpha: 0.4 * (0.6 + 0.4 * beat), cap: 'round', join: 'round' });
			trace();
			g.stroke({ width: R * 0.016, color: 0xffffff, alpha: 0.8, cap: 'round', join: 'round' });
			g.circle(pts[0].x, pts[0].y, R * 0.035);
			g.fill({ color: 0xffffff, alpha: 0.85 });
		}
	};

	$effect(() => {
		let raf = 0;
		const t0 = performance.now();
		const tick = (now: number) => {
			raf = requestAnimationFrame(tick);
			const t = (now - t0) / 1000;

			// Sharpened heartbeat: 0..1, spends most of the cycle low with a punchy peak.
			const wave = 0.5 + 0.5 * Math.sin(((t / P) + (props.phase ?? 0)) * Math.PI * 2 - Math.PI / 2);
			const beat = wave ** 2;

			// Decaying entry wobble + a faint perpetual sway so the symbol never sits dead still.
			rot =
				0.06 * Math.sin(t * 24) * Math.exp(-t * 2.6) +
				0.012 * Math.sin(t * 3.1 + (props.phase ?? 0) * 6);
			pulse = 1 + 0.035 * beat;

			if (backG?.destroyed) backG = null;
			if (frontG?.destroyed) frontG = null;
			if (backG) drawBack(backG, t, beat);
			if (frontG) drawFront(frontG, t, beat);
		};
		raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
	});
</script>

<Container x={props.x} y={props.y} alpha={props.alpha ?? 1} zIndex={props.zIndex}>
	<Graphics blendMode="add" draw={(gr) => (backG = gr as unknown as G)} />
	<Sprite
		key={props.assetKey}
		anchor={0.5}
		width={props.width * pulse}
		height={props.height * pulse}
		rotation={rot}
	/>
	<Graphics blendMode="add" draw={(gr) => (frontG = gr as unknown as G)} />
</Container>
