<script lang="ts">
	import { Graphics } from 'pixi-svelte';
	import { MainContainer } from 'components-layout';

	import { getContext } from '../game/context';

	// Ambient atmosphere for the burnt-out-laboratory theme: charred debris — small irregular ash
	// flakes with a few still-hot embers among them — blown across the play area by a draft.
	//
	// Two things make it read as wind rather than as floating sparkles:
	//   * every flake is carried by ONE shared gust function, so the whole field surges and eases
	//     together the way real airborne debris does;
	//   * flakes tumble as they travel, flipping edge-on and back, instead of gliding flat.
	//
	// Both layers are drawn imperatively into captured Graphics from ONE persistent rAF (the
	// CapsuleBeam / SymbolWinFx pattern). Position is a pure function of time and the mote's own
	// seed — nothing accumulates per frame, so the field survives remounts and the loop tears down
	// with the component.
	const context = getContext();

	const main = $derived(context.stateLayoutDerived.mainLayout());
	const canvas = $derived(context.stateLayoutDerived.canvasSizes());
	const isDesktop = $derived(context.stateLayoutDerived.layoutType() === 'desktop');

	// Visible canvas in main-container coordinates (the maths the rail/panel components use), so
	// the field covers the real screen rather than the nominal main box.
	const viewW = $derived(canvas.width / (main.scale || 1));
	const viewH = $derived(canvas.height / (main.scale || 1));
	const viewX = $derived(main.width * 0.5 - viewW / 2);
	const viewY = $derived(main.height * 0.5 - viewH / 2);

	// Mobile runs a smaller field — the Safari budget is tight and this is decoration.
	const COUNT = $derived(isDesktop ? 26 : 16);

	type G = {
		destroyed: boolean;
		clear: () => void;
		circle: (x: number, y: number, r: number) => unknown;
		moveTo: (x: number, y: number) => void;
		lineTo: (x: number, y: number) => void;
		closePath: () => void;
		fill: (s: object) => void;
	};
	let ashG = $state<G | null>(null);
	let emberG = $state<G | null>(null);

	// Deterministic seeds. Sizes/offsets are FRACTIONS of the view box, so the field re-lays itself
	// on resize or orientation change without being regenerated.
	const FLAKES = Array.from({ length: 64 }, (_, i) => {
		const h = (k: number) => (((i + 1) * k) % 997) / 997;
		// A FEW fragments are still faintly warm — kept rare and dim on purpose; a brighter, more
		// frequent ember read as glowing sparkles rather than as burnt debris.
		const ember = i % 11 === 4;
		// Irregular 5-gon outline — a charred fragment, not a disc.
		const verts = Array.from({ length: 5 }, (_, v) => {
			const a = (v / 5) * Math.PI * 2 + h(9973 * (v + 2)) * 0.7;
			const r = 0.55 + 0.45 * h(7919 * (v + 3));
			return { cos: Math.cos(a) * r, sin: Math.sin(a) * r };
		});
		return {
			ember,
			verts,
			// Golden-ratio spread — an index hash clusters visibly at these counts.
			startX: (i * 0.61803) % 1,
			y: h(15485863) * 1.06 - 0.03,
			// Per-flake wind response: lighter scraps run ahead of heavier ones.
			drag: 0.55 + 0.9 * h(40503),
			// Slow sink/lift across the crossing plus a gentle bob.
			sink: (h(104729) - 0.55) * 0.16,
			bob: 0.006 + 0.018 * h(9973),
			bobFreq: 0.5 + 1.1 * h(7919),
			size: (ember ? 0.0022 : 0.0035) + 0.0042 * h(104729),
			spin: (h(40503) - 0.5) * 2.4,
			phase: h(15485863) * 6.283,
			// Kept very light — these should sit behind the game, not on top of it.
			dim: 0.35 + 0.65 * h(7919),
		};
	});

	// Shared gust: the INTEGRAL of the wind speed, in view-widths. Its derivative (the actual
	// speed) rises and falls on two slow cycles, which is what makes the field gust instead of
	// scrolling at a constant rate.
	const gust = (t: number) => 0.055 * t + 0.052 * Math.sin(t * 0.21) + 0.026 * Math.sin(t * 0.53 + 1.1);

	// Fade at both ends of the crossing so flakes stream on and off screen instead of popping.
	const edgeFade = (u: number) => Math.min(1, u / 0.12, (1 - u) / 0.12);

	const draw = (t: number) => {
		const ash = ashG;
		const emb = emberG;
		ash?.clear();
		emb?.clear();
		const W = viewW;
		const H = viewH;
		if (W < 1 || H < 1) return;
		const wind = gust(t);
		for (let i = 0; i < COUNT; i++) {
			const f = FLAKES[i];
			const gr = f.ember ? emb : ash;
			if (!gr) continue;
			// Crossing progress 0..1 over the full width plus a margin at each side.
			const u = (((f.startX + wind * f.drag) % 1) + 1) % 1;
			const a = f.dim * edgeFade(u) * (f.ember ? 0.22 : 0.45);
			if (a <= 0.004) continue;
			const x = viewX + W * (-0.05 + 1.1 * u);
			const y = viewY + H * (f.y + f.sink * u + f.bob * Math.sin(t * f.bobFreq + f.phase));
			const r = W * f.size;
			// Tumble: rotation plus an edge-on flip, so each flake presents a changing silhouette.
			const rot = f.phase + t * f.spin;
			const flip = 0.25 + 0.75 * Math.abs(Math.cos(rot * 1.6 + f.phase));
			const cr = Math.cos(rot);
			const sr = Math.sin(rot);
			for (let v = 0; v < f.verts.length; v++) {
				const vx = f.verts[v].cos * r * flip;
				const vy = f.verts[v].sin * r;
				const px = x + vx * cr - vy * sr;
				const py = y + vx * sr + vy * cr;
				if (v === 0) gr.moveTo(px, py);
				else gr.lineTo(px, py);
			}
			gr.closePath();
			if (f.ember) {
				// Still-warm fragment: the SAME charred silhouette, just warm-toned with a barely
				// there halo. No hot core — a bright point immediately reads as a magic spark.
				const glow = 0.6 + 0.4 * Math.sin(t * 3.1 + f.phase) ** 2;
				gr.fill({ color: 0xff9c4a, alpha: a * glow });
				gr.circle(x, y, r * 1.6);
				gr.fill({ color: 0xff7a22, alpha: a * 0.16 * glow });
			} else {
				gr.fill({ color: 0xcfd8e6, alpha: a });
			}
		}
	};

	$effect(() => {
		let raf = 0;
		const t0 = performance.now();
		const tick = (now: number) => {
			raf = requestAnimationFrame(tick);
			if (ashG?.destroyed) ashG = null;
			if (emberG?.destroyed) emberG = null;
			if (ashG || emberG) draw((now - t0) / 1000);
		};
		raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
	});
</script>

<!-- Behind the board and its frame: the debris belongs to the ROOM, and blowing it across the
     reels put moving specks on top of the symbols the player is reading.
     The layer is set by where <AmbientDebris /> sits in Game.svelte, NOT by this zIndex — a
     MainContainer spreads its props onto an inner container, so the outer node the stage sorts
     always has zIndex 0 and siblings tie-break on mount order. Kept at 0 to say so honestly. -->
<MainContainer zIndex={0}>
	<Graphics draw={(gr) => (ashG = gr as unknown as G)} />
	<Graphics blendMode="add" draw={(gr) => (emberG = gr as unknown as G)} />
</MainContainer>
