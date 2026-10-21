<script lang="ts">
	// The board's pads, cracks and blobs drawn in WebGL (board/BoardView.ts). App passes a
	// snapshot of its board state; the DOM grid stays on top for the accessible label. Pixi
	// loads on mount, so the first paint and the SSR test never touch it; if WebGL can't start,
	// `onfail` hands the board back to the DOM blobs.
	import { onMount } from 'svelte';
	import type { BoardSnap, BoardView } from '../board/BoardView';
	import { VIEW_LEFT, VIEW_TOP, VIEW_W, VIEW_H } from '../board/geometry';

	let { snap, onfail }: { snap: BoardSnap; onfail?: () => void } = $props();
	let host: HTMLDivElement;
	let view: BoardView | null = null;

	// Past this, a load that never settles (a stalled request) would leave the board empty.
	const INIT_TIMEOUT_MS = 20000;
	let dead = false;
	let failed = false;
	// Once, from wherever it breaks (import, init, timeout, a frame, a lost context, an update):
	// tear the view down and hand back to the DOM version.
	function fail(e: unknown) {
		if (failed || dead) return;
		failed = true;
		console.error('[PixiBoard]', e);
		view?.destroy();
		view = null;
		onfail?.();
	}

	onMount(() => {
		const timer = setTimeout(() => fail(new Error('init timed out')), INIT_TIMEOUT_MS);
		import('../board/BoardView')
			.then(async ({ BoardView }) => {
				if (dead || failed) return;
				view = new BoardView();
				view.onfail = fail;
				// Live before init resolves: updates meanwhile are kept and applied on ready.
				view.update(snap);
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
		const s = snap;
		try {
			view?.update(s);
		} catch (e) {
			fail(e);
		}
	});
</script>

<div
	class="pixi-board"
	bind:this={host}
	aria-hidden="true"
	style={`left:${VIEW_LEFT.toFixed(2)}px;top:${VIEW_TOP.toFixed(2)}px;width:${VIEW_W.toFixed(2)}px;height:${VIEW_H.toFixed(2)}px`}
></div>

<style>
	.pixi-board {
		position: absolute;
		pointer-events: none;
	}
</style>
