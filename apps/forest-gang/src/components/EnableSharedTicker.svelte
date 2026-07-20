<script lang="ts">
	import * as PIXI from 'pixi.js';
	import { onMount } from 'svelte';

	import { getContext } from '../game/context';

	const context = getContext();

	// pixi-svelte's <AnimatedSprite> advances its frames from PIXI.Ticker.shared (autoUpdate). This
	// app renders reactively (no continuous render loop), and once the scene settles the shared ticker
	// gets throttled to a stop — FREEZING every AnimatedSprite on a single frame (win-symbol
	// animations read as the static win tile, idle blinks stop, etc). It froze again during the big-win
	// presentation because a listener error killed the shared ticker's update.
	//
	// Bulletproof fix: stop the shared ticker and, in one persistent onMount rAF loop, walk the scene
	// and advance every playing AnimatedSprite ourselves, then force a render. This never depends on the
	// shared ticker running or its listener list, and every step is guarded so nothing can kill the loop.
	onMount(() => {
		PIXI.Ticker.shared.autoStart = false;
		PIXI.Ticker.shared.stop();

		let raf = 0;
		let running = true;
		let last = performance.now();

		const advance = (node: any, delta: number) => {
			// AnimatedSprite: has gotoAndStop + a textures array + update(). Advance only while playing.
			if (
				typeof node.gotoAndStop === 'function' &&
				typeof node.update === 'function' &&
				node.playing &&
				node.textures?.length
			) {
				try {
					node.update({ deltaTime: delta });
				} catch {
					/* ignore a bad frame */
				}
			}
			const kids = node.children;
			if (kids) for (let i = 0; i < kids.length; i++) advance(kids[i], delta);
		};

		const loop = () => {
			if (!running) return;
			const app = context.stateApp.pixiApplication;
			if (app?.stage) {
				const now = performance.now();
				const delta = Math.min(4, (now - last) / 16.6667); // pixi delta units, clamped after stalls
				last = now;
				try {
					advance(app.stage, delta);
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
