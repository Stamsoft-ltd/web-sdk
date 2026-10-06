<script lang="ts" module>
	export type EmitterEventBonusEnding = { type: 'bonusEnding'; mult: number };
</script>

<script lang="ts">
	import { stateBet } from 'state-shared';
	import { waitForResolve } from 'utils-shared/wait';

	import { getContext } from '../game/context';
	import { potState } from '../game/potState.svelte';
	import { shake, shakeAfter } from '../game/screenShake.svelte';
	import { i18nDerived } from '../i18n/i18nDerived';

	// The bonus ending, before the TOTAL WIN plaque (bookEventHandlerMap freeSpinEnd): the board dims,
	// BONUS COMPLETE slams down with a spray of ketchup; then (if the pot climbed) the final multiplier
	// jumps out of the pot, arcs to the centre on an ease-in curve and punches down under a FINAL
	// MULTIPLIER label in a burst of soup. Meanwhile the pot boils over and the chef celebrates. ~2.2s
	// (1.1s with no multiplier), halved in turbo; a click / Space / Enter skips straight on.
	const context = getContext();

	const SLAM_MS = 300; // BONUS COMPLETE lands
	const MULT_FROM_MS = 700; // the multiplier leaves the pot
	const FLY_MS = 450;
	const END_WITH_MULT_MS = 2200;
	const END_PLAIN_MS = 1150;
	const OUT_MS = 220;
	// sfx_soup_boost builds for ~620 ms before its peak: started that far ahead of the ×N card's slam,
	// its rise rides the flight out of the pot and the peak lands on the hit
	const BOOST_PEAK_MS = 620;

	let start = $state(-1);
	let now = $state(0);
	let mult = $state(1);
	let speed = 1;
	let raf = 0;
	let finish: (() => void) | null = null;
	// where the multiplier starts: the pot's plaque (canvas px = overlay px), or below centre
	let from = $state({ x: 0, y: 0 });

	const withMult = $derived(mult > 1);
	const endMs = $derived(withMult ? END_WITH_MULT_MS : END_PLAIN_MS);
	const ms = $derived(start < 0 ? -1 : (now - start) * speed);

	context.eventEmitter.subscribeOnMount({
		bonusEnding: ({ mult: m }) =>
			waitForResolve((resolve) => {
				cancelAnimationFrame(raf);
				mult = m;
				speed = stateBet.isTurbo ? 2 : 1;
				const r = potState.rect;
				from = r ? { x: r.x + r.w * 0.5, y: r.y + r.h * 0.75 } : { x: innerWidth / 2, y: innerHeight * 0.8 };
				start = performance.now();
				now = start;
				let done = false;
				let hitMult = false;
				let boosted = false;
				finish = () => {
					if (done) return;
					done = true;
					finish = null;
					// fade out over OUT_MS while the plaque comes in
					const outAt = performance.now();
					const fadeLoop = (ts: number) => {
						now = ts;
						if (ts - outAt < OUT_MS) raf = requestAnimationFrame(fadeLoop);
						else start = -1;
					};
					outStart = outAt;
					cancelAnimationFrame(raf);
					raf = requestAnimationFrame(fadeLoop);
					resolve();
				};
				context.eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_reel_stop_hit', forcePlay: true });
				shakeAfter(SLAM_MS / speed, 4, 260);
				const loop = (ts: number) => {
					now = ts;
					const t = (ts - start) * speed;
					// (t runs at `speed`; the clip doesn't — its lead in t is BOOST_PEAK_MS·speed)
					if (withMult && !boosted && t >= MULT_FROM_MS + FLY_MS - BOOST_PEAK_MS * speed) {
						boosted = true;
						context.eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_soup_boost', forcePlay: true });
					}
					if (withMult && !hitMult && t >= MULT_FROM_MS + FLY_MS) {
						hitMult = true;
						shake(3, 200);
					}
					if (t >= endMs) finish?.();
					else raf = requestAnimationFrame(loop);
				};
				raf = requestAnimationFrame(loop);
				// rAF stops in a hidden tab — never hold the round on it
				setTimeout(() => finish?.(), endMs / speed + 400);
			}),
	});
	$effect(() => () => cancelAnimationFrame(raf));

	let outStart = $state(-1);
	const out = $derived(outStart < 0 || start < 0 ? 0 : Math.min(1, (now - outStart) / OUT_MS));
	$effect(() => {
		if (start < 0) outStart = -1;
	});

	const skip = () => finish?.();
	const onKey = (e: KeyboardEvent) => {
		if (start >= 0 && finish && (e.code === 'Space' || e.code === 'Enter')) {
			e.preventDefault();
			e.stopPropagation();
			skip();
		}
	};

	const smooth = (x: number) => x * x * (3 - 2 * x);
	const backOut = (u: number, c = 1.7) => 1 + (c + 1) * (u - 1) ** 3 + c * (u - 1) ** 2;

	// BONUS COMPLETE: slam from 2× (back-out); when the multiplier comes, it rises out of its way.
	const title = $derived.by(() => {
		if (ms < 0) return { s: 0, a: 0, y: 0 };
		const u = Math.min(1, ms / SLAM_MS);
		const s = 2 - backOut(u);
		const lift = withMult ? smooth(Math.min(1, Math.max(0, (ms - MULT_FROM_MS) / 350))) : 0;
		return { s: s * (1 - 0.35 * lift), a: Math.min(1, u * 3), y: -lift * 22 };
	});
	// impact squash on the title as it lands
	const titleSquash = $derived.by(() => {
		const d = ms - SLAM_MS;
		if (ms < 0 || d < 0 || d > 260) return { x: 1, y: 1 };
		const k = Math.exp(-d / 70) * Math.cos(d / 30);
		return { x: 1 + 0.12 * k, y: 1 - 0.14 * k };
	});
	// The multiplier: out of the pot, up and over on a quadratic Bézier, ease-in (it accelerates into
	// the slam), then a back-out punch; the label fades in above it once it has landed.
	const card = $derived.by(() => {
		if (!withMult || ms < MULT_FROM_MS) return null;
		const cx = innerWidth / 2;
		const cy = innerHeight * 0.55;
		const u = Math.min(1, (ms - MULT_FROM_MS) / FLY_MS);
		const e = u * u * u; // ease-in
		const ctrl = { x: (from.x + cx) / 2, y: Math.min(from.y, cy) - innerHeight * 0.32 };
		const x = (1 - e) ** 2 * from.x + 2 * (1 - e) * e * ctrl.x + e * e * cx;
		const y = (1 - e) ** 2 * from.y + 2 * (1 - e) * e * ctrl.y + e * e * cy;
		const land = ms - MULT_FROM_MS - FLY_MS;
		let s = 0.35 + 0.65 * e;
		if (land >= 0) s = land < 380 ? 1.35 - 0.35 * backOut(Math.min(1, land / 380), 2.2) : 1;
		return { x, y, s, labelA: land < 0 ? 0 : Math.min(1, land / 200), landed: land >= 0 };
	});
	// Particles (deterministic per index): ketchup off the title slam, soup off the multiplier slam.
	const SPLAT_N = 16;
	const splat = (i: number, age: number, power: number) => {
		const ang = (i / SPLAT_N) * Math.PI * 2 + Math.sin(i * 12.9898) * 0.4;
		const v = power * (0.6 + 0.4 * Math.abs(Math.sin(i * 78.233)));
		const t = age / 1000;
		return {
			x: Math.cos(ang) * v * t,
			y: Math.sin(ang) * v * t + 900 * t * t,
			r: (6 + (i % 4) * 3) * Math.max(0.2, 1 - t * 1.2),
			a: Math.max(0, 1 - t / 0.75),
		};
	};
	const titleDrops = $derived(ms < SLAM_MS ? [] : Array.from({ length: SPLAT_N }, (_, i) => splat(i, ms - SLAM_MS, 520)));
	const multDrops = $derived(
		!card?.landed ? [] : Array.from({ length: SPLAT_N }, (_, i) => splat(i + 3, ms - MULT_FROM_MS - FLY_MS, 620)),
	);
</script>

<svelte:window onkeydowncapture={onKey} />

{#if start >= 0}
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
	<div class="be" role="presentation" style={`opacity:${1 - out}`} onclick={skip}>
		<div class="be__dim" style={`opacity:${Math.min(1, Math.max(0, ms) / 200)}`}></div>

		<div class="be__title" style={`transform:translate(-50%,-50%) translateY(${title.y}cqh) scale(${title.s * titleSquash.x},${title.s * titleSquash.y});opacity:${title.a}`}>
			{#each titleDrops as d, i (i)}
				<i class="be__drop be__drop--ketchup" style={`transform:translate(${d.x}px,${d.y}px);width:${d.r * 2}px;height:${d.r * 2}px;opacity:${d.a}`}></i>
			{/each}
			<span>{i18nDerived.translate('BONUS COMPLETE')}</span>
		</div>

		{#if card}
			<div class="be__mult" style={`left:${card.x}px;top:${card.y}px;transform:translate(-50%,-50%) scale(${card.s})`}>
				{#each multDrops as d, i (i)}
					<i class="be__drop be__drop--soup" style={`transform:translate(${d.x}px,${d.y}px);width:${d.r * 2}px;height:${d.r * 2}px;opacity:${d.a}`}></i>
				{/each}
				<span class="be__label" style={`opacity:${card.labelA}`}>{i18nDerived.translate('FINAL MULTIPLIER')}</span>
				<span class="be__value">×{mult}</span>
			</div>
		{/if}
	</div>
{/if}

<style>
	.be {
		position: fixed;
		inset: 0;
		z-index: 54; /* under the TOTAL WIN plaque (55), over the board and HUD */
		cursor: pointer;
		user-select: none;
		container-type: size;
	}
	.be__dim {
		position: absolute;
		inset: 0;
		background: radial-gradient(ellipse at 50% 45%, rgba(20, 6, 2, 0.35) 0%, rgba(10, 2, 0, 0.7) 100%);
	}
	.be__title {
		position: absolute;
		left: 50%;
		top: 30%;
		display: grid;
		place-items: center;
	}
	.be__title span {
		position: relative;
		font-family: 'Bowlby One SC', sans-serif;
		font-size: min(7.5cqw, 11cqh);
		color: #ffd36b;
		letter-spacing: 0.04em;
		white-space: nowrap;
		-webkit-text-stroke: 0.08em #6b0b04;
		paint-order: stroke fill;
		filter: drop-shadow(0 6px 10px rgba(40, 0, 0, 0.6));
	}
	.be__mult {
		position: absolute;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.2em;
	}
	.be__label {
		position: relative;
		font-family: 'Bowlby One SC', sans-serif;
		font-size: min(3.2cqw, 5cqh);
		color: #fff1cf;
		letter-spacing: 0.06em;
		white-space: nowrap;
		-webkit-text-stroke: 0.08em #2e4a08;
		paint-order: stroke fill;
	}
	/* the value in the pot's own plaque style: grey box, red border, red numerals */
	.be__value {
		position: relative;
		font-family: 'Bowlby One SC', sans-serif;
		font-size: min(10cqw, 15cqh);
		line-height: 1;
		color: #c10c01;
		background: #bcb7af;
		border: 3px solid #c10c01;
		border-radius: 0.35em;
		padding: 0.12em 0.4em 0.08em;
		box-shadow:
			0 0 0 5px rgba(143, 194, 42, 0.85),
			0 10px 24px rgba(0, 0, 0, 0.55);
	}
	.be__drop {
		position: absolute;
		left: 50%;
		top: 50%;
		margin: -6px 0 0 -6px;
		border-radius: 50%;
		pointer-events: none;
	}
	.be__drop--ketchup {
		background: radial-gradient(circle at 35% 30%, #ff6a4d 0 18%, #c8180b 40%, #7d0d06 100%);
	}
	.be__drop--soup {
		background: radial-gradient(circle at 35% 30%, #e7f5b8 0 16%, #9fd431 40%, #4f7d12 100%);
	}
</style>
