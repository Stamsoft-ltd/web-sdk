<script lang="ts">
	// The base-game logo in WebGL (scene/LogoView.ts), inside App's .base-logo box (the fly-in
	// target and the gaze's reference stay that DOM box). Falls back to the SVG Logo.
	import { onMount } from 'svelte';
	import Logo from './Logo.svelte';
	import type { LogoView } from '../scene/LogoView';

	let {
		gaze = null,
		cheer = false,
		beat = 0,
	}: { gaze?: { x: number; y: number } | null; cheer?: boolean; beat?: number } = $props();
	let host = $state<HTMLDivElement>();
	let view: LogoView | null = null;
	let fellBack = $state(false);

	// Past this, a load that never settles (a stalled request) would leave the logo empty.
	const INIT_TIMEOUT_MS = 20000;
	let dead = false;
	let failed = false;
	// Once, from wherever it breaks (import, init, timeout, a frame, a lost context, an update):
	// tear the view down and hand back to the DOM version.
	function fail(e: unknown) {
		if (failed || dead) return;
		failed = true;
		console.error('[PixiLogo]', e);
		view?.destroy();
		view = null;
		fellBack = true;
	}

	onMount(() => {
		const timer = setTimeout(() => fail(new Error('init timed out')), INIT_TIMEOUT_MS);
		import('../scene/LogoView')
			.then(async ({ LogoView }) => {
				if (dead || failed || !host) return;
				view = new LogoView();
				view.onfail = fail;
				view.setGaze(gaze);
				view.setCheer(cheer, beat);
				await view.init(host);
			})
			.then(() => clearTimeout(timer), fail);
		return () => {
			dead = true;
			clearTimeout(timer);
			view?.destroy();
			view = null;
		};
	});
	$effect(() => {
		const c = cheer;
		const b = beat;
		try {
			view?.setCheer(c, b);
		} catch (e) {
			fail(e);
		}
	});
	$effect(() => {
		const g = gaze;
		try {
			view?.setGaze(g);
		} catch (e) {
			fail(e);
		}
	});
</script>

{#if fellBack}
	<Logo uid="base-logo" {gaze} {cheer} {beat} />
{:else}
	<!-- 12 logo units past the art each side (LogoView PAD), for the flung splashes. -->
	<div class="logo-canvas" bind:this={host} role="img" aria-label="Blob Split"></div>
{/if}

<style>
	.logo-canvas {
		position: absolute;
		inset: -24% -12%;
		pointer-events: none;
	}
</style>
