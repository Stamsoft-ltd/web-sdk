<script lang="ts">
	// Pre-game loading screen, the studio's shared look (mcschmutzo's PressPlayLoader): the splash
	// sky dimmed under a shade, and the Press Play "P" filling in step with the REAL preload
	// progress (lib/preload.ts), not a looping animation. App swaps it for the splash when done.
	let { progress = 0, label = 'Loading' }: { progress?: number; label?: string } = $props();
	let pct = $derived(Math.round(Math.min(1, Math.max(0, progress)) * 100));
	// p00 = empty mark … p09 = full. All ten stay mounted so a step never waits on a download.
	const FRAMES = Array.from({ length: 10 }, (_, i) => `./loader/p0${i}.webp`);
	let frame = $derived(Math.min(9, Math.round((pct / 100) * 9)));
	// index.html paints this same screen (#boot) before any script runs, so the mark is up from
	// the first frame; once this copy has mounted over it, the static one goes.
	$effect(() => document.getElementById('boot')?.remove());
</script>

<div class="pp-loader" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={pct} aria-label={label}>
	<div class="shade"></div>
	<div class="mark">
		<span class="p">
			{#each FRAMES as src, i}<img
					{src}
					alt=""
					draggable="false"
					class:on={i === frame}
				/>{/each}
		</span>
		<span class="word">Press Play</span>
	</div>
</div>

<style>
	.pp-loader {
		position: fixed;
		inset: 0;
		z-index: 21;
		display: grid;
		place-items: center;
		background: #5b4fd6 url('/splash/sky-bg.webp') center / cover no-repeat;
		user-select: none;
	}
	/* Shadow over the sky so the P and the wordmark read clearly. */
	.shade {
		position: absolute;
		inset: 0;
		background: rgb(0 0 0 / 0.62);
	}
	.mark {
		position: relative;
		display: flex;
		align-items: center;
		gap: clamp(10px, 1.8vw, 26px);
	}
	.p {
		position: relative;
		width: clamp(58px, 8vw, 108px);
		aspect-ratio: 1;
		filter: drop-shadow(0 6px 14px rgb(0 0 0 / 0.5));
	}
	.p img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		opacity: 0;
	}
	.p img.on {
		opacity: 1;
	}
	.word {
		font-family: 'Poppins', sans-serif;
		font-weight: 400;
		color: #fff;
		font-size: clamp(26px, 3.6vw, 52px);
		letter-spacing: 0.005em;
		text-shadow: 0 2px 8px rgb(0 0 0 / 0.5);
	}
</style>
