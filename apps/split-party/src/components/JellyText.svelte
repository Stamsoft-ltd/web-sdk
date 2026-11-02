<script lang="ts">
	// Live text dressed like the win screens' glossy jelly lettering (win/hd/title2-*.webp, user
	// 2026-10-29: "FREE SPINS and TOTAL WIN ... similar to legendary or sweet or mythic win"):
	// a candy gradient fill, a rim and a drop in the deep colour, and a white gloss over the top
	// of the letters. Three stacked copies of the text: the rim behind (text-shadow ring), the
	// gradient fill, the gloss. Kept separate because a text-shadow on gradient-clipped text
	// paints over its fill. The copies are aria-hidden; the text itself is read once.
	type Look = 'gold' | 'blue' | 'pink' | 'green' | 'teal' | 'orange';
	let { text, look = 'gold' }: { text: string; look?: Look } = $props();
</script>

<span class={`jelly-text ${look}`}
	><span class="rim" aria-hidden="true">{text}</span><span class="fill">{text}</span><span class="gloss" aria-hidden="true"
		>{text}</span
	></span
>

<style>
	.jelly-text {
		position: relative;
		display: inline-block;
		isolation: isolate;
		text-shadow: none;
	}
	.gold {
		--hi: #fff7b0;
		--mid: #ffd21f;
		--lo: #ff9d0a;
		--rim: #c25d00;
		--deep: #6e2c00;
	}
	.blue {
		--hi: #c9fbff;
		--mid: #45d2ff;
		--lo: #1f8dff;
		--rim: #1546d8;
		--deep: #0b1f7a;
	}
	.pink {
		--hi: #ffd6ef;
		--mid: #ff6fc4;
		--lo: #f0238f;
		--rim: #b80f6b;
		--deep: #5e0636;
	}
	.green {
		--hi: #f2ffb8;
		--mid: #b8ff4d;
		--lo: #4fd61c;
		--rim: #1f8a12;
		--deep: #0c3d0a;
	}
	.teal {
		--hi: #d4fff8;
		--mid: #5ff0df;
		--lo: #14bfae;
		--rim: #0a7d84;
		--deep: #053640;
	}
	.orange {
		--hi: #ffeec2;
		--mid: #ffb84d;
		--lo: #ff7a1a;
		--rim: #b8430a;
		--deep: #5a1c02;
	}
	.fill {
		position: relative;
		color: transparent;
		background: linear-gradient(180deg, var(--hi) 4%, var(--mid) 48%, var(--lo) 100%);
		-webkit-background-clip: text;
		background-clip: text;
		text-shadow: none;
	}
	.rim,
	.gloss {
		position: absolute;
		left: 0;
		top: 0;
		pointer-events: none;
	}
	/* The rim: the text in the rim colour ringed by its own shadows (0.07em round), then the
	   deep colour dropped below it, like the titles' thick candy edge. */
	.rim {
		z-index: -1;
		color: var(--rim);
		text-shadow:
			0.07em 0 0 var(--rim),
			-0.07em 0 0 var(--rim),
			0 0.07em 0 var(--rim),
			0 -0.07em 0 var(--rim),
			0.05em 0.05em 0 var(--rim),
			-0.05em 0.05em 0 var(--rim),
			0.05em -0.05em 0 var(--rim),
			-0.05em -0.05em 0 var(--rim),
			0 0.15em 0 var(--deep),
			0.05em 0.13em 0 var(--deep),
			-0.05em 0.13em 0 var(--deep),
			0 0.2em 0.18em #0006;
	}
	/* The gloss: white over the letters' top third, soft into the fill. */
	.gloss {
		color: transparent;
		background: linear-gradient(180deg, #fff0 8%, #ffffffc4 18%, #ffffff8c 30%, #fff0 44%);
		-webkit-background-clip: text;
		background-clip: text;
		text-shadow: none;
	}
</style>
