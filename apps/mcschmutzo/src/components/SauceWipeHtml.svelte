<script lang="ts" module>
	export type EmitterEventSauceWipe = { type: 'sauceWipe'; phase: 'cover' | 'reveal' };
</script>

<script lang="ts">
	import { stateBet } from 'state-shared';
	import { waitForResolve } from 'utils-shared/wait';

	import { ap } from '../lib/preloadArt';
	import { getContext } from '../game/context';
	import { i18nDerived } from '../i18n/i18nDerived';

	// The branded way into the bonus board (bookEventHandlerMap bonusWheel): ketchup pours down over
	// the wheel — a drippy leading edge, tongues running ahead — until the screen is all sauce; the
	// wordmark stamps on it while the wheel is taken away underneath; then the sauce slides off the
	// bottom, its top edge hanging back in drips, and the bonus board is there.
	// Two awaited phases: `cover` resolves once the screen is fully covered, `reveal` once it is clear.
	const context = getContext();
	const word = ap('/assets/mcschmutzo/logo-word-v2.webp');

	const COVER_MS = 480;
	const REVEAL_MS = 520;

	let phase = $state<'idle' | 'cover' | 'hold' | 'reveal'>('idle');
	let t = $state(0); // 0..1 within the current phase
	let raf = 0;

	const run = (kind: 'cover' | 'reveal') =>
		waitForResolve((resolve) => {
			cancelAnimationFrame(raf);
			const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
			const ms = (kind === 'cover' ? COVER_MS : REVEAL_MS) * (stateBet.isTurbo ? 0.6 : 1) * (reduced ? 0.4 : 1);
			phase = kind;
			t = 0;
			const start = performance.now();
			let done = false;
			const finish = () => {
				if (done) return;
				done = true;
				cancelAnimationFrame(raf);
				t = 1;
				phase = kind === 'cover' ? 'hold' : 'idle';
				resolve();
			};
			const loop = (ts: number) => {
				t = Math.min(1, (ts - start) / ms);
				if (t < 1) raf = requestAnimationFrame(loop);
				else finish();
			};
			raf = requestAnimationFrame(loop);
			// rAF stops in a hidden tab — never hold the round on it
			setTimeout(finish, ms + 300);
		});

	context.eventEmitter.subscribeOnMount({
		sauceWipe: ({ phase: kind }) => run(kind),
	});
	$effect(() => () => cancelAnimationFrame(raf));

	// Tongues of sauce (x %, width %, length %): they run ahead of the pour and hang back on the drain.
	const TONGUES: [number, number, number][] = [
		[6, 3.2, 16], [17, 2.2, 9], [29, 4, 22], [41, 2.6, 11], [52, 3.4, 18],
		[63, 2.2, 8], [72, 4.2, 25], [84, 2.8, 13], [94, 3, 19],
	];
	const tongue = (x: number) => {
		let d = 0;
		for (const [c, w, len] of TONGUES) d = Math.max(d, len * Math.exp(-(((x - c) / w) ** 2)));
		return d;
	};
	const N = 80;
	const easeIn = (x: number) => x * x * x;
	const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);
	// The sauce body (viewBox 0..100, stretched to the screen): `cover` grows a drippy bottom edge
	// down past the screen; `reveal` sends a drippy top edge down after it.
	const shape = $derived.by(() => {
		if (phase === 'idle') return null;
		const wave = (x: number, k: number) => 1.6 * Math.sin(x * 0.21 + k) + 0.9 * Math.sin(x * 0.53 - k * 1.7);
		if (phase === 'cover' || phase === 'hold') {
			const e = phase === 'hold' ? 1 : easeIn(t);
			const level = -30 + 160 * e; // the body's bottom, before tongues; ≥ 130 = fully covered
			const reach = 1 - 0.55 * e; // the tongues shorten as the body catches up with them
			const pts: string[] = [];
			for (let i = N; i >= 0; i -= 1) {
				const x = (i / N) * 100;
				pts.push(`${x.toFixed(2)},${(level + tongue(x) * reach + wave(x, t * 6)).toFixed(2)}`);
			}
			return { d: `M0,-10 L100,-10 L${pts.join(' L')} Z`, edge: pts, sign: 1 };
		}
		const e = easeInOut(t);
		const level = -40 + 175 * e; // the body's top
		const pts: string[] = [];
		for (let i = 0; i <= N; i += 1) {
			const x = (i / N) * 100;
			pts.push(`${x.toFixed(2)},${(level - tongue(x) * (0.6 + 0.4 * e) + wave(x, t * 5)).toFixed(2)}`);
		}
		return { d: `M${pts.join(' L')} L100,110 L0,110 Z`, edge: pts, sign: -1 };
	});
	// The stamp on the sauce: pops in as the screen fills (back-out), out (1 → 1.1 → 0) as it drains.
	const mark = $derived.by(() => {
		if (phase === 'hold') return { s: 1, a: 1 };
		if (phase === 'cover') {
			const u = Math.max(0, (t - 0.72) / 0.28);
			const back = 1 + 2.4 * (u - 1) ** 3 + 1.4 * (u - 1) ** 2;
			return { s: 0.4 + 0.6 * back, a: Math.min(1, u * 2) };
		}
		if (phase === 'reveal') {
			const u = Math.min(1, t / 0.35);
			return { s: u < 0.4 ? 1 + 0.1 * (u / 0.4) : 1.1 * (1 - (u - 0.4) / 0.6), a: 1 - u };
		}
		return { s: 0, a: 0 };
	});
</script>

{#if shape}
	<div class="sw" aria-hidden="true">
		<svg class="sw__svg" viewBox="0 0 100 100" preserveAspectRatio="none">
			<!-- a darker body leads a hair ahead, so the edge reads thick -->
			<path d={shape.d} fill="#7d0d06" transform={`translate(0 ${1.4 * shape.sign})`} />
			<path d={shape.d} fill="#c8180b" />
			<!-- gloss along the leading edge -->
			<polyline
				points={shape.edge.join(' ')}
				fill="none"
				stroke="#ff7a5c"
				stroke-opacity="0.55"
				stroke-width="0.9"
				vector-effect="non-scaling-stroke"
				transform={`translate(0 ${-1.6 * shape.sign})`}
			/>
		</svg>
		<div class="sw__mark" style={`opacity:${mark.a};transform:translate(-50%,-50%) scale(${mark.s})`}>
			<img src={word} alt="" draggable="false" />
			<span>{i18nDerived.translate('FREE SPINS')}</span>
		</div>
	</div>
{/if}

<style>
	.sw {
		position: fixed;
		inset: 0;
		z-index: 70; /* over the wheel (45) and the intro / outro screens */
		pointer-events: none;
		container-type: size;
	}
	.sw__svg {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
	}
	.sw__mark {
		position: absolute;
		left: 50%;
		top: 48%;
		width: min(56cqw, 70cqh);
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.6em;
		filter: drop-shadow(0 6px 10px rgba(60, 0, 0, 0.55));
	}
	.sw__mark img {
		width: 100%;
	}
	.sw__mark span {
		font-family: 'Bowlby One SC', sans-serif;
		font-size: min(5cqw, 6.5cqh);
		color: #fff1cf;
		letter-spacing: 0.04em;
		-webkit-text-stroke: 0.06em #5a0a04;
		paint-order: stroke fill;
	}
</style>
