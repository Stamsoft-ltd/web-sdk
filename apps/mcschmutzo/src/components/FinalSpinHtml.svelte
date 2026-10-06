<script lang="ts" module>
	export type EmitterEventFinalSpin = { type: 'finalSpin' };
</script>

<script lang="ts">
	import { stateBet } from 'state-shared';
	import { waitForResolve } from 'utils-shared/wait';

	import { getContext } from '../game/context';
	import { shake } from '../game/screenShake.svelte';
	import { i18nDerived } from '../i18n/i18nDerived';

	// The last free spin is announced (bookEventHandlerMap updateFreeSpin): the room dims at the edges
	// for a beat (the pot pulses and the chef reacts — potState.nudge), then FINAL SPIN slams onto a
	// sauce splat with a flash, back-out. The round waits only until the slam has landed; the banner
	// holds while the reels start, then goes 1 → 1.1 → 0.
	const context = getContext();

	const BUILD_MS = 400; // anticipation before the slam
	const SLAM_MS = 320;
	const HOLD_MS = 800;
	const OUT_MS = 260;

	let start = $state(-1);
	let now = $state(0);
	let speed = 1;
	let raf = 0;

	context.eventEmitter.subscribeOnMount({
		finalSpin: () =>
			waitForResolve((resolve) => {
				cancelAnimationFrame(raf);
				speed = stateBet.isTurbo ? 2 : 1;
				start = performance.now();
				now = start;
				let resolved = false;
				let hit = false;
				const loop = (ts: number) => {
					now = ts;
					const ms = (ts - start) * speed;
					if (!hit && ms >= BUILD_MS + SLAM_MS * 0.55) {
						hit = true;
						context.eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_reel_stop_hit' });
						shake(3, 200);
					}
					if (!resolved && ms >= BUILD_MS + SLAM_MS) {
						resolved = true;
						resolve();
					}
					if (ms < BUILD_MS + SLAM_MS + HOLD_MS + OUT_MS) raf = requestAnimationFrame(loop);
					else start = -1;
				};
				raf = requestAnimationFrame(loop);
				// rAF stops in a hidden tab — never hold the round on it
				setTimeout(() => {
					if (!resolved) {
						resolved = true;
						resolve();
					}
				}, (BUILD_MS + SLAM_MS) / speed + 300);
			}),
	});
	$effect(() => () => cancelAnimationFrame(raf));

	const ms = $derived(start < 0 ? -1 : (now - start) * speed);
	// edge dim: up over the build, eases away through the hold
	const dim = $derived.by(() => {
		if (ms < 0) return 0;
		if (ms < BUILD_MS) return ms / BUILD_MS;
		return Math.max(0, 1 - (ms - BUILD_MS - SLAM_MS) / HOLD_MS);
	});
	// the banner: slam from 2.2× with a back-out settle, hold, then 1 → 1.1 → 0
	const banner = $derived.by(() => {
		const m = ms - BUILD_MS;
		if (ms < 0 || m < 0) return { s: 0, a: 0 };
		if (m < SLAM_MS) {
			const u = m / SLAM_MS;
			const back = 1 + 2.7 * (u - 1) ** 3 + 1.7 * (u - 1) ** 2;
			return { s: 2.2 - 1.2 * back, a: Math.min(1, u * 3) };
		}
		const o = (m - SLAM_MS - HOLD_MS) / OUT_MS;
		if (o < 0) return { s: 1, a: 1 };
		return o < 0.4 ? { s: 1 + 0.1 * (o / 0.4), a: 1 } : { s: 1.1 * (1 - (o - 0.4) / 0.6), a: 1 - (o - 0.4) / 0.6 };
	});
	// impact flash
	const flash = $derived.by(() => {
		const m = ms - BUILD_MS - SLAM_MS * 0.55;
		return ms < 0 || m < 0 ? 0 : Math.max(0, 1 - m / 220);
	});
</script>

{#if start >= 0}
	<div class="fs" aria-hidden="true">
		<div class="fs__dim" style={`opacity:${dim}`}></div>
		<div class="fs__flash" style={`opacity:${flash * 0.35}`}></div>
		<div class="fs__banner" style={`opacity:${banner.a};transform:translate(-50%,-50%) scale(${banner.s})`}>
			<svg class="fs__splat" viewBox="-60 -30 120 60" preserveAspectRatio="none">
				<path
					d="M-52,-6 C-58,-20 -38,-26 -24,-22 C-14,-30 4,-27 12,-23 C26,-29 46,-24 50,-14 C60,-10 59,4 52,9 C56,20 40,26 28,22 C18,29 -2,27 -12,23 C-26,29 -46,24 -50,14 C-60,10 -59,0 -52,-6 Z"
					fill="#c8180b"
				/>
				<circle cx="-56" cy="16" r="3" fill="#c8180b" />
				<circle cx="57" cy="-18" r="2.4" fill="#c8180b" />
				<circle cx="44" cy="27" r="1.8" fill="#c8180b" />
			</svg>
			<span>{i18nDerived.translate('FINAL SPIN')}</span>
		</div>
	</div>
{/if}

<style>
	.fs {
		position: absolute;
		inset: 0;
		z-index: 30; /* over the canvas + HUD, under the win / outro screens */
		pointer-events: none;
		container-type: size;
	}
	.fs__dim {
		position: absolute;
		inset: 0;
		background: radial-gradient(ellipse at 50% 50%, transparent 40%, rgba(10, 2, 0, 0.62) 100%);
	}
	.fs__flash {
		position: absolute;
		inset: 0;
		background: radial-gradient(ellipse at 50% 46%, #fff1cf 0%, rgba(255, 180, 90, 0.4) 35%, transparent 70%);
	}
	.fs__banner {
		position: absolute;
		left: 50%;
		top: 46%;
		width: min(52cqw, 80cqh);
		aspect-ratio: 4 / 1.25;
		display: grid;
		place-items: center;
		filter: drop-shadow(0 8px 14px rgba(40, 0, 0, 0.6));
	}
	.fs__splat {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
	}
	.fs__banner span {
		position: relative;
		font-family: 'Bowlby One SC', sans-serif;
		font-size: min(6.4cqw, 10cqh);
		color: #fff1cf;
		letter-spacing: 0.05em;
		white-space: nowrap;
		-webkit-text-stroke: 0.07em #5a0a04;
		paint-order: stroke fill;
	}
</style>
