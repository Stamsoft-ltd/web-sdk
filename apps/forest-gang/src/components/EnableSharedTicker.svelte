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

		const loop = () => {
			if (!running) return;
			const app = context.stateApp.pixiApplication;
			if (app?.stage) {
				const now = performance.now();
				const ms = now - last;
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
			} else {
				last = performance.now();
			}
			raf = requestAnimationFrame(loop);
		};
		raf = requestAnimationFrame(loop);

		return () => {
			running = false;
			cancelAnimationFrame(raf);
		};
	});
</script>
