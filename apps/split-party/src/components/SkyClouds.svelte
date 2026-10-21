<script lang="ts">
	// Clouds drifting with the wind across a 1200px-wide sky: one per height band so they
	// rarely cross, at random heights, sizes and depths (far = small, soft, slow), each
	// respawning off-screen a while after it leaves. Lane y is the cloud's top in sky px.
	type Lane = { far: boolean; y: [number, number] };
	// src/size default to the splash's white clouds; the bonus skies pass their own.
	type Look = { src: string; w: [number, number]; alpha: [number, number] };
	let {
		lanes,
		width = 1200,
		near = { src: './splash/cloud-puff.webp', w: [130, 170], alpha: [0.92, 0.92] },
		far = { src: './splash/cloud-puff-far.webp', w: [70, 95], alpha: [0.7, 0.8] },
	}: { lanes: Lane[]; width?: number; near?: Look; far?: Look } = $props();

	type Cloud = { id: number; lane: number; far: boolean; y: number; w: number; dur: number; delay: number; alpha: number };
	let cloudId = 0;
	const rand = (a: number, b: number) => a + Math.random() * (b - a);
	function cloud(lane: number, midway: boolean): Cloud {
		const { far: isFar, y } = lanes[lane];
		const look = isFar ? far : near;
		const w = rand(...look.w);
		// px/s: near clouds pass at ~22, far ones at ~9, so depth reads from parallax.
		const dur = (width + w + 80) / (isFar ? rand(7, 11) : rand(18, 26));
		return {
			id: cloudId++,
			lane,
			far: isFar,
			y: rand(y[0], y[1]),
			w,
			dur,
			// Start staggered across the sky; a respawn waits a while so the sky breathes.
			delay: midway ? -((lane / lanes.length + rand(0.1, 0.25)) % 1) * dur : rand(2, 12),
			alpha: rand(...look.alpha),
		};
	}
	let clouds = $state(lanes.map((_, i) => cloud(i, true)));
	const respawn = (id: number) => (clouds = clouds.map((c) => (c.id === id ? cloud(c.lane, false) : c)));
</script>

{#each clouds as c (c.id)}
	<div
		class="cloud"
		style={`top:${c.y.toFixed(0)}px;--w:${c.w.toFixed(0)}px;--sky-w:${width}px;animation-duration:${c.dur.toFixed(1)}s;animation-delay:${c.delay.toFixed(1)}s`}
		onanimationend={(e) => e.target === e.currentTarget && respawn(c.id)}
	>
		<img
			src={c.far ? far.src : near.src}
			alt=""
			style={`opacity:${c.alpha.toFixed(2)};animation-delay:${(-c.dur * 0.37).toFixed(1)}s`}
		/>
	</div>
{/each}

<style>
	.cloud {
		position: absolute;
		left: 0;
		width: var(--w);
		animation: cloud-drift linear both;
	}
	.cloud img {
		display: block;
		width: 100%;
		transform-origin: 50% 80%;
		animation: cloud-breathe 11s ease-in-out infinite;
	}
	@keyframes cloud-drift {
		from {
			transform: translateX(calc(-1 * var(--w) - 40px));
		}
		to {
			transform: translateX(calc(var(--sky-w) + 40px));
		}
	}
	/* Clouds slowly swell and rise a touch, so they don't read as stickers sliding. */
	@keyframes cloud-breathe {
		50% {
			transform: translateY(-4px) scale(1.05, 1.03);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.cloud,
		.cloud img {
			animation-play-state: paused;
		}
	}
</style>
