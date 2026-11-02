<script lang="ts">
	// Mama blob in WebGL (scene/MamaView.ts), inside App's .base-mama box. Falls back to the
	// still art breathing in CSS (also the ?scene=dom version).
	import { onMount } from 'svelte';
	import type { MamaView } from '../scene/MamaView';

	let {
		pixi = true,
		beat = 0,
		sulk = 0,
		fear = false,
		push = 0,
		win = false,
		party = false,
		edge = false,
		shown = true,
		instant = false,
		gaze = null,
	}: { pixi?: boolean; shown?: boolean; instant?: boolean; beat?: number; sulk?: number; fear?: boolean; push?: number; win?: boolean; party?: boolean; edge?: boolean; gaze?: { x: number; y: number } | null } = $props();
	let host = $state<HTMLDivElement>();
	let view: MamaView | null = null;
	let fellBack = $state(false);

	const INIT_TIMEOUT_MS = 20000;
	let dead = false;
	let failed = false;
	function fail(e: unknown) {
		if (failed || dead) return;
		failed = true;
		console.error('[PixiMama]', e);
		view?.destroy();
		view = null;
		fellBack = true;
	}

	onMount(() => {
		if (!pixi) return;
		const timer = setTimeout(() => fail(new Error('init timed out')), INIT_TIMEOUT_MS);
		import('../scene/MamaView')
			.then(async ({ MamaView }) => {
				if (dead || failed || !host) return;
				view = new MamaView();
				view.onfail = fail;
				view.cheer(beat);
				view.sulk(sulk);
				view.push(push);
				view.fear(fear);
				view.win(win);
				view.dance(party);
				view.tense(edge);
				view.appear(shown, instant);
				view.setGaze(gaze);
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
	/** Her mouth's centre in client px, or null when the still art stands in for the rig. */
	export function mouth(): { x: number; y: number } | null {
		const m = view?.mouthAt();
		const r = host?.getBoundingClientRect();
		if (!m || !r?.width) return null;
		return { x: r.left + m.fx * r.width, y: r.top + m.fy * r.height };
	}
	$effect(() => {
		const b = beat;
		const su = sulk;
		const f = fear;
		const p = push;
		const g = gaze;
		const w = win;
		const pa = party;
		const e = edge;
		const sh = shown;
		try {
			view?.appear(sh, instant);
			view?.win(w);
			view?.dance(pa);
			view?.tense(e);
			view?.cheer(b);
			view?.sulk(su);
			view?.fear(f);
			view?.push(p);
			view?.setGaze(g);
		} catch (e) {
			fail(e);
		}
	});
</script>

{#if !pixi || fellBack}
	<img class="mama-still" class:fear={fear || edge} class:party src="./base/hd/mama/still.webp" alt="" />
{:else}
	<!-- MamaView's pads past the Figma box: 34 units each side, 46 above, 6 below. -->
	<div class="mama-canvas" bind:this={host} aria-hidden="true"></div>
{/if}

<style>
	.mama-canvas {
		position: absolute;
		left: -14.78%;
		right: -14.78%;
		top: -18.25%;
		bottom: -2.38%;
		pointer-events: none;
	}
	.mama-still {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		/* Mama-2's art is narrower than the desktop box: never stretched. */
		object-fit: contain;
		object-position: 50% 100%;
		transform-origin: 50% 100%;
		animation: mama-breathe 3.4s ease-in-out infinite;
	}
	.mama-still.fear {
		animation-duration: 0.9s;
	}
	/* The bonus dance (MamaView.dance): a bounce on every 540ms beat, squashed on landing,
	   rocking over four beats. */
	.mama-still.party:not(.fear) {
		animation:
			mama-bounce 1.08s ease-in-out infinite,
			mama-rock 2.16s ease-in-out infinite;
	}
	@keyframes mama-bounce {
		0%,
		50%,
		100% {
			translate: 0 0;
			transform: scale(1.06, 0.92);
		}
		25%,
		75% {
			translate: 0 -4.5%;
			transform: scale(0.98, 1.04);
		}
	}
	@keyframes mama-rock {
		0%,
		100% {
			rotate: -3deg;
		}
		50% {
			rotate: 3deg;
		}
	}
	@keyframes mama-breathe {
		50% {
			transform: scale(0.992, 1.014);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.mama-still,
		.mama-still.party:not(.fear) {
			animation: none;
		}
	}
</style>
