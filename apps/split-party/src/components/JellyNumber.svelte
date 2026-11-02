<script lang="ts">
	// An amount in the glossy jelly digits (public/digits, scripts/build-digits.py). Characters
	// with no glyph (currency letters, €, spaces) fall back to the display face in the digits'
	// colours. `height` is a digit's height in px; `fit` (the widest `text` will get, e.g. the
	// final amount of a count-up) shrinks it to stay within `maxWidth`.
	import DIGITS from '../lib/digits.json';

	let { text, height, maxWidth = Infinity, fit = text }: { text: string; height: number; maxWidth?: number; fit?: string } = $props();

	type Glyph = { src: string; w: number; h: number };
	const GLYPHS = DIGITS.glyphs as Record<string, Glyph>;
	// Glyphs overlap a little at their rims, as the sheet's digits are set.
	const KERN = -0.05;
	const FALLBACK_W = 0.62;
	const widthOf = (s: string) =>
		[...s].reduce((sum, c) => sum + (GLYPHS[c] ? GLYPHS[c].w / DIGITS.h : FALLBACK_W) + KERN, -KERN);
	let h = $derived(Math.min(height, maxWidth / Math.max(1, widthOf(fit))));
</script>

<span class="jelly-number" style={`--h:${h}px`} aria-label={text}>
	{#each [...text] as c, i (i)}
		{#if GLYPHS[c]}
			<img src={GLYPHS[c].src} alt="" class:tail={c === ','} style={`height:${(GLYPHS[c].h / DIGITS.h) * h}px`} />
		{:else}
			<span class="fallback">{c}</span>
		{/if}
	{/each}
</span>

<style>
	.jelly-number {
		display: inline-flex;
		align-items: flex-end;
		height: var(--h);
		white-space: nowrap;
	}
	.jelly-number > * {
		margin-right: calc(var(--h) * -0.05);
		flex: none;
	}
	.jelly-number > :last-child {
		margin-right: 0;
	}
	img {
		display: block;
	}
	/* Bottoms line up on the baseline; a comma hangs below it by its tail. */
	.tail {
		transform: translateY(18%);
	}
	.fallback {
		font-family: 'Blob Display', ui-rounded, sans-serif;
		font-size: calc(var(--h) * 1.08);
		line-height: 0.86;
		color: #f7d457;
		-webkit-text-stroke: calc(var(--h) * 0.07) #e2562a;
		paint-order: stroke fill;
		text-shadow: 0 calc(var(--h) * 0.06) 0 #e2562a;
	}
</style>
