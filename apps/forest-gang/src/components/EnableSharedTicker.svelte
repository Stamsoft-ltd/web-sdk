<script lang="ts">
	import { PIXI } from 'pixi-svelte';
	import { onMount } from 'svelte';

	import { getContext } from '../game/context';

	const context = getContext();

	// pixi-svelte's <AnimatedSprite> AND <Spine> both advance from PIXI.Ticker.shared (autoUpdate). This
	// app renders reactively (no continuous render loop), and once the scene settles the shared ticker
	// gets throttled to a stop — FREEZING every AnimatedSprite on a single frame (win-symbol animations
	// read as the static win tile, idle blinks stop) AND freezing every Spine at its setup pose (the
	// free-spin intro/outro "CONGRATULATIONS" board never plays its intro anim, so its text slot stays
	// tiny). It also froze during the big-win presentation because a listener error killed shared.update.
	//
	// Bulletproof fix: stop the shared ticker and, in one persistent onMount rAF loop, walk the scene and
	// advance every playing AnimatedSprite (delta in pixi frames) AND every Spine (delta in SECONDS)
	// ourselves, then force a render. This never depends on the shared ticker running or its listener
	// list, and every step is guarded so nothing can kill the loop.
	onMount(() => {
		PIXI.Ticker.shared.autoStart = false;
		PIXI.Ticker.shared.stop();

		let raf = 0;
		let running = true;
		let last = performance.now();

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

		const loop = (now: number) => {
			if (!running) return;
			raf = requestAnimationFrame(loop);

			const app = context.stateApp.pixiApplication;
			if (!app?.stage) {
				last = now;
				return;
			}
			// Pause ALL work while the tab is hidden: no scene walk, no render, no battery/thermal
			// churn in the background (Safari throttles rAF too, but this stops the work outright).
			if (typeof document !== 'undefined' && document.hidden) {
				last = now;
				return;
			}
			// Scale the refresh rate to activity instead of force-rendering the whole canvas at the
			// display's full rate forever. While the spin state machine is busy (spins, wins,
			// count-ups, feature transitions) render at 60fps; once it settles to idle drop to 30fps
			// — the idle-blink loops and any occasional reactive change render fine at 30fps, which
			// ~halves idle GPU cost (the dominant Safari lag once resolution is capped). On 120Hz
			// ProMotion displays this also caps the active path at ~60 (was rendering ~120/s).
			let idle = false;
			try {
				idle = context.stateXstateDerived?.isIdle?.() ?? false;
			} catch {
				/* if state isn't ready, treat as active (safer — never under-render) */
			}
			const minFrameMs = idle ? 1000 / 30 : 1000 / 61;
			const ms = now - last;
			if (ms < minFrameMs - 1) return; // too soon for this cadence — wait for the next rAF

			const deltaFrames = Math.min(4, ms / 16.6667); // pixi delta units, clamped after stalls
			const deltaSeconds = Math.min(0.067, ms / 1000); // seconds for spines, clamped (~4 frames)
			last = now;
			try {
				advance(app.stage, deltaFrames, deltaSeconds);
			} catch {
				/* never let a bad node kill the loop */
			}
			try {
				app.render();
			} catch {
				/* renderer may be mid-teardown */
			}
		};
		raf = requestAnimationFrame(loop);

		return () => {
			running = false;
			cancelAnimationFrame(raf);
		};
	});
</script>
