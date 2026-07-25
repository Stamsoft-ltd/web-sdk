<script lang="ts">
	import { PIXI } from 'pixi-svelte';

	import { getContext } from '../game/context';

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
	// 60 rather than an idle drop to 30: at 30 Hz `deltaTime` is 2.0, and none of the current
	// `animationSpeed` values divide into it evenly (0.28 alternates 33 ms / 67 ms holds, 44% under
	// the mean on the short one), which reads as a stutter. The cap belongs with the clip cadences —
	// plan 13 picks it once each clip's frame time is measured.
	const MAX_FPS = 60;

	// Advance every playing AnimatedSprite (delta in PIXI frames) and every Spine (delta in SECONDS)
	// in the subtree. Both deltas are INJECTED rather than read from the ticker inside here, so a
	// deterministic clock can drive this with a fixed step for animation regression tests.
	// Every node is guarded individually: one bad frame must not take down the ticker.
	const advance = (node: any, deltaFrames: number, deltaSeconds: number) => {
		// AnimatedSprite: has gotoAndStop + a textures array + update(). Advance only while playing.
		if (
			typeof node.gotoAndStop === 'function' &&
			typeof node.update === 'function' &&
			node.playing &&
			node.textures?.length
		) {
			try {
				node.update({ deltaTime: deltaFrames });
			} catch {
				/* ignore a bad frame */
			}
		} else if (node.skeleton && node.state && typeof node.update === 'function') {
			// Spine (spine-pixi v8): advance its AnimationState/skeleton. update() takes SECONDS.
			try {
				node.update(deltaSeconds);
			} catch {
				/* ignore a bad frame */
			}
		}
		const kids = node.children;
		if (kids) for (let i = 0; i < kids.length; i++) advance(kids[i], deltaFrames, deltaSeconds);
	};

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
