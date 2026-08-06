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

	// One cadence for update and render together. The `maxFPS` setter writes `Ticker._minElapsedMS`,
	// and `Ticker.update()` returns BEFORE running any listener when the frame is early
	// (Ticker.mjs:245-250) — so this single assignment throttles the scene walk and PIXI's render
	// listener as one. That is the property the old component's comment claimed and could not
	// deliver, because it owned only one of the two loops and the app ticker rendered uncapped at
	// panel rate (~120/s on ProMotion).
	//
	// 60 rather than an idle drop to 30: at 30 Hz `deltaTime` is 2.0 and the 3-tick cadences
	// (`animationSpeed` 1/3 — scatter, wild, wins, free-spin sheets) stop dividing evenly, which
	// reads as a stutter. Every clip cadence is now a divisor of the 60 Hz tick (1/3, 0.25, 0.2 —
	// the R4 judder fix); this cap and those values are tuned as a pair.
	//
	// 62 and NOT 60, which is the rate we actually want. `Ticker.update()` truncates the elapsed
	// time to whole milliseconds before testing it — `currentTime - this._lastFrame | 0`
	// (Ticker.mjs:246) — and compares that against `_minElapsedMS = 1000/maxFPS`. At maxFPS 60 the
	// threshold is 16.6667 while a real 16.67 ms vsync frame truncates to 16, so the frame is
	// DROPPED: the cap admits only frames of >= 17 ms, a 58.8 fps ceiling. Worse, a drop is a
	// doubled frame, not a missing one — `lastTime` isn't advanced on the early return, so the next
	// accepted frame carries `deltaTime` 2.0. Simulated against that exact code path, maxFPS 60 on a
	// 60 Hz panel yields 58.0 fps with 9/299 frames doubled (a hitch about twice a second) even with
	// zero timing jitter; 62 yields 59.8 fps with none. On a 120 Hz ProMotion panel 62 still
	// throttles — 60.0 fps vs 58.0 — so it is strictly better on both. Anything >= 62 behaves
	// identically here; the value only has to clear the truncation, not name the target rate.
	const MAX_FPS = 62;

	// The walk itself lives in ../game/sceneAnimation.ts: same code, but importable by a test that
	// drives it with a fixed delta instead of the ticker's (plan 14's deterministic clock).

	$effect(() => {
		const app = context.stateApp.pixiApplication;
		if (!app) return;

		PIXI.Ticker.shared.autoStart = false;
		PIXI.Ticker.shared.stop();

		app.ticker.maxFPS = MAX_FPS;

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
			document.removeEventListener('visibilitychange', onVisibilityChange);
			app.ticker.remove(tick, null);
		};
	});
</script>
