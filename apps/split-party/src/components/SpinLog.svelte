<script lang="ts" module>
	export type SpinLogRow = { id: number; symbol: string; units: number; amount: string };
</script>

<script lang="ts">
	import { fade, fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	// Figma 11259:3576 (desktop 11195:8973 right of the board, phone 11075:34378 top left): the
	// current spin's wins, newest on top. Each row is a cluster: how many blobs it held, the
	// blob and what it paid. The box only shows once the spin has a win; then six slots show, so it never changes size, and a
	// long cascade chain scrolls.
	let { rows, label }: { rows: SpinLogRow[]; label: string } = $props();
	const SLOTS = 6;
	// The rows and the empty slots under them in one keyed list, so the empty slots slide down
	// with the rows when a win pushes in (the last one drops off the bottom).
	let slots = $derived([
		...rows.map((r) => ({ key: r.id, r })),
		...Array.from({ length: Math.max(0, SLOTS - rows.length) }, (_, i) => ({ key: -1 - i, r: null })),
	]);
	// Sized for the amount, so a long one shrinks instead of running under the boxes.
	const amountSize = (s: string) => (18 * Math.min(1, 10 / s.length)).toFixed(1);

	// A new win drops in from the top edge while the rows below slide down a slot. The panel
	// sits in the CSS-scaled stage, so moves are measured on screen and divided by that scale
	// (svelte's flip would overshoot by it).
	const still = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
	const ROW_MS = still ? 0 : 340;
	const stageScale = (node: HTMLElement, rect: DOMRect) => rect.height / node.offsetHeight || 1;
	function slideDown(node: HTMLElement, { from, to }: { from: DOMRect; to: DOMRect }) {
		const dy = (from.top - to.top) / stageScale(node, to);
		return { duration: ROW_MS, easing: cubicOut, css: (_t: number, u: number) => `transform: translateY(${u * dy}px)` };
	}
	// New rows ride in from above the top edge in step with the rows they push down (same
	// distance, timing and easing), so no empty slot opens between them. One update's new rows
	// share a batch stamp, and the batch's size sets the distance.
	let batch = 0;
	let batchAt = -1;
	function dropIn(node: HTMLElement) {
		const now = performance.now();
		if (now - batchAt > 1) batch++;
		batchAt = now;
		node.dataset.fresh = String(batch);
		const h = node.offsetHeight + 2.651;
		return {
			duration: ROW_MS,
			easing: cubicOut,
			tick: (t: number, u: number) => {
				// Counted each frame: the first tick can run before the batch's later rows exist.
				const k = node.parentElement?.querySelectorAll(`[data-fresh="${node.dataset.fresh}"]`).length || 1;
				node.style.transform = u ? `translateY(${-u * k * h}px)` : '';
				if (t === 1) delete node.dataset.fresh;
			},
		};
	}

	function edgeFade(node: HTMLElement) {
		const update = () => {
			node.classList.toggle('more-above', node.scrollTop > 2);
			node.classList.toggle('more-below', node.scrollTop + node.clientHeight < node.scrollHeight - 2);
		};
		const ro = new ResizeObserver(update);
		ro.observe(node);
		const mo = new MutationObserver(update);
		mo.observe(node, { childList: true });
		node.addEventListener('scroll', update, { passive: true });
		update();
		return {
			destroy() {
				ro.disconnect();
				mo.disconnect();
				node.removeEventListener('scroll', update);
			},
		};
	}
</script>

{#if rows.length}<aside
	class="spin-log"
	aria-label={label}
	in:fly={{ y: -24, duration: ROW_MS, easing: cubicOut }}
	out:fade={{ duration: ROW_MS * 0.6 }}
>
	<ol class="spin-log-rows" use:edgeFade>
		{#each slots as s (s.key)}
			<li class="spin-log-row" class:vacant={!s.r} aria-hidden={s.r ? undefined : 'true'} in:dropIn animate:slideDown>
				{#if s.r}
					<span class="spin-log-box">{s.r.units}</span>
					<img src={`./symbols/${s.r.symbol}.webp`} alt={s.r.symbol} width="33" height="33" />
					<strong style={`font-size:${amountSize(s.r.amount)}px`}>{s.r.amount}</strong>
				{/if}
			</li>
		{/each}
	</ol>
</aside>{/if}

<style>
	/* 228.66 wide #202149 well with a 2.135px #3a3981 rule; 206-wide rows 38.88 tall at a 2.65
	   gap, six of them (the design's five plus one). */
	.spin-log {
		position: absolute;
		box-sizing: border-box;
		width: 228.66px;
		height: var(--log-h, 266.5px);
		padding: 8px 9.2px;
		/* The framed panel (style.css "Framed panels"): bevel rim, dark outline, indigo well. */
		border: 3px solid transparent;
		border-radius: 16px;
		background:
			linear-gradient(#251870, #1a0f52) padding-box,
			linear-gradient(#c4adff, #8a68f5 30%, #5a3bd2) border-box;
		box-shadow:
			0 0 0 2.5px #241063,
			inset 0 0 0 1.5px #241063,
			inset 0 4px 10px #0006,
			0 10px 24px #12063a80;
	}
	.spin-log-rows {
		height: 100%;
		margin: 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 2.651px;
		overflow-y: auto;
		overscroll-behavior: contain;
		scrollbar-width: none;
		touch-action: pan-y;
	}
	.spin-log-rows::-webkit-scrollbar {
		display: none;
	}
	.spin-log-rows:global(.more-below) {
		mask-image: linear-gradient(#000 calc(100% - 22px), transparent);
	}
	.spin-log-rows:global(.more-above) {
		mask-image: linear-gradient(transparent, #000 22px);
	}
	.spin-log-rows:global(.more-above.more-below) {
		mask-image: linear-gradient(transparent, #000 22px, #000 calc(100% - 22px), transparent);
	}
	.spin-log-row {
		/* Sizes are overridable per layout (the phone landscape fits five shorter rows). */
		flex: 0 0 var(--row-h, 38.879px);
		box-sizing: border-box;
		display: flex;
		align-items: center;
		gap: 6.806px;
		padding: 0 8px 0 3.5px;
		/* A jelly slab: lit lip, shaded foot. */
		background: linear-gradient(#8f78dc, #7259c4 55%, #6148b0);
		border: 2px solid #2a1a72;
		border-radius: 10px;
		box-shadow:
			inset 0 1.5px 0 #ffffff40,
			inset 0 -2px 0 #2a1a7255;
	}
	.spin-log-row.vacant {
		background: #ffffff0a;
		border: 2px dashed #ffffff1f;
		box-shadow: none;
	}
	.spin-log-box {
		flex: 0 0 auto;
		box-sizing: border-box;
		min-width: var(--row-box, 28.075px);
		height: var(--row-box, 28.075px);
		padding: 0 3px;
		display: grid;
		place-items: center;
		background: #2a1a72;
		border: 1px solid rgba(255, 255, 255, 0.25);
		border-radius: 8px;
		/* Figma 11259:3652 (Coiny 8.2px in the 114-wide phone log) at this log's ×2. */
		font: 400 16.4px/1 'Coiny', sans-serif;
		letter-spacing: 0.72px;
		color: #fff;
		text-transform: uppercase;
	}
	img {
		flex: 0 0 var(--row-img, 33px);
		width: var(--row-img, 33px);
		height: var(--row-img, 33px);
		object-fit: contain;
	}
	strong {
		flex: 1;
		min-width: 0;
		text-align: right;
		/* Figma 11259:3652: Coiny 9px #fee302, 0.94 tracking, at ×2. */
		font: 400 18px/1 'Coiny', sans-serif;
		letter-spacing: 1.88px;
		color: #fee302;
		text-shadow: 0 1.5px 0 #2a1a72;
		white-space: nowrap;
	}
</style>
