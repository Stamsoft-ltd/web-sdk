<script lang="ts">
	import { PIXI } from 'pixi-svelte';

	import { getContext } from '../game/context';
	import { advance } from '../game/sceneAnimation';

	const context = getContext();

	// ── One ticker/update/render owner ───────────────────────────────────────────────────────────
	//
	// PIXI's TickerPlugin auto-starts the application's PRIVATE ticker (`sharedTicker` defaults to
	// false, so `app.ticker !== Ticker.shared`) and registers `app.render` on it at
	// UPDATE_PRIORITY.LOW. This component adds the scene walk to that same ticker at NORMAL — higher
	// priority runs first (NORMAL 0 > LOW -25) — so each frame advances the scene and then renders
	// it, exactly once. No requestAnimationFrame of our own, and no manual `app.render()`.
	//
	// The component this replaced ran its own rAF loop AND called `app.render()` on top of the app
	// ticker's render listener, so the scene was rendered twice per frame at unrelated phases —
	// measured at ~83 renders/sec against a 58 fps ticker.
	//
	// `Ticker.shared` must stay STOPPED. pixi-svelte's <AnimatedSprite> and <Spine> are constructed
	// with PIXI's default `autoUpdate: true`, which registers them on the shared ticker; restarting
	// it would advance every board sprite twice. The walk below is not an optimisation — it IS the
	// sprite clock. Without it the win animations freeze on their first frame, idle blinks stop, and
	// every Spine holds its setup pose (the free-spin CONGRATULATIONS board never plays its intro).

	// ── The cap, and why there usually isn't one ─────────────────────────────────────────────────
	//
	// The `maxFPS` setter writes `Ticker._minElapsedMS`, and `Ticker.update()` returns BEFORE running
	// any listener when the frame is early — so one assignment throttles the scene walk and PIXI's
	// render listener together. The catch is HOW it decides a frame is early: it truncates the
	// elapsed time to whole milliseconds first, `currentTime - this._lastFrame | 0`, and compares
	// that against `1000 / maxFPS`. At maxFPS 60 the threshold is 16.667 while a real vsync frame
	// truncates to 16, so the frame is DROPPED — and a drop is a DOUBLED frame, not a missing one,
	// because `_lastFrame` is not advanced on the early return. That is the Safari judder: WebKit
	// quantises rAF timestamps to whole milliseconds, so its 60 Hz frames arrive as an alternating
	// 16/17 and land on the wrong side of the threshold constantly. rAF is running at a flawless
	// 60 while the ticker rejects a fifth of what it hands over, and the rejects come back paired.
	//
	// So: no cap at all on a 60 Hz panel. vsync IS the cap there — 60 is what we want and what rAF
	// already delivers — and an uncapped ticker cannot drop or double anything. The cap exists only
	// to stop a 120 Hz ProMotion panel rendering the whole scene twice per displayed frame for
	// nothing, so it is applied only when the panel is actually fast, and at 62 rather than 60: any
	// value clear of the truncation behaves the same, and 60 does not clear it.
	//
	// The panel is measured rather than guessed (`screen.refreshRate` does not exist on the web):
	// a short burst of rAF deltas at mount, median taken so one janky frame during boot cannot
	// decide it. Median of a 120 Hz panel is ~8.3ms, of 60 Hz ~16.7ms.
	const HIGH_REFRESH_MAX_FPS = 62;
	const HIGH_REFRESH_HZ = 70;
	const REFRESH_SAMPLE_FRAMES = 13;

	/** Resolves with the panel's measured refresh rate in Hz, or 0 if it could not be measured. */
	const measureRefreshHz = () =>
		new Promise<number>((resolve) => {
			const deltas: number[] = [];
			let previous = 0;
			const sample = (now: number) => {
				if (previous) deltas.push(now - previous);
				previous = now;
				if (deltas.length < REFRESH_SAMPLE_FRAMES) {
					requestAnimationFrame(sample);
					return;
				}
				deltas.sort((a, b) => a - b);
				const median = deltas[deltas.length >> 1];
				resolve(median > 0 ? 1000 / median : 0);
			};
			requestAnimationFrame(sample);
		});

	// The walk itself lives in ../game/sceneAnimation.ts: same code, but importable by a test that
	// drives it with a fixed delta instead of the ticker's (plan 14's deterministic clock).

	$effect(() => {
		const app = context.stateApp.pixiApplication;
		if (!app) return;

		PIXI.Ticker.shared.autoStart = false;
		PIXI.Ticker.shared.stop();

		// Uncapped until proven otherwise, so a 60 Hz panel never meets the truncation bug above.
		app.ticker.maxFPS = 0;
		let disposed = false;
		measureRefreshHz().then((hz) => {
			if (disposed || hz <= HIGH_REFRESH_HZ) return;
			app.ticker.maxFPS = HIGH_REFRESH_MAX_FPS;
		});

		const tick = () => {
			if (!app.stage) return;
			try {
				advance(app.stage, app.ticker.deltaTime, app.ticker.deltaMS / 1000);
			} catch {
				/* never let a bad node kill the ticker */
			}
		};
		app.ticker.add(tick, null, PIXI.UPDATE_PRIORITY.NORMAL);

		// Pause ALL work while the tab is hidden: stopping the ticker stops the scene walk AND the
		// render, which the old manual loop could not do — it owned only one of the two, so the app
		// ticker kept rendering in the background.
		//
		// No manual delta clamp on resume. `Ticker.start()` goes through `_requestIfNeeded()`, which
		// resets `lastTime` to now (Ticker.mjs:79-83), so the first frame back measures from the
		// resume — not from whenever the tab was hidden. Independently, `_maxElapsedMS = 100` caps
		// `elapsedMS` before `deltaTime` is computed, so `deltaTime` can never exceed 6 frames.
		const onVisibilityChange = () => {
			if (document.hidden) app.ticker.stop();
			else app.ticker.start();
		};
		document.addEventListener('visibilitychange', onVisibilityChange);

		return () => {
			disposed = true;
			document.removeEventListener('visibilitychange', onVisibilityChange);
			app.ticker.remove(tick, null);
		};
	});
</script>
