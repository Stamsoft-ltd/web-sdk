<script lang="ts">
	import { onMount } from 'svelte';

	// A jelly dome that lives as a bubble: it blows up at a random moment, rests, bursts into
	// droplets and vanishes, then blows up again later. With pop off it just sits there.
	// Times are [min, max] ms; the splash pops often, the base game rarely.
	type Range = [number, number];
	let {
		src,
		x,
		y,
		w,
		h = w,
		ox,
		oy,
		color,
		pop = true,
		shown = false,
		first = [900, 3400],
		rest = [2500, 7500],
		wait = [1200, 4800],
	}: {
		src: string;
		x: number;
		y: number;
		w: number;
		h?: number;
		/** The point the dome inflates from (its foot), px in the box. */
		ox: number;
		oy: number;
		color: string;
		pop?: boolean;
		/** Start blown up (then burst after `first`) instead of hidden. */
		shown?: boolean;
		first?: Range;
		rest?: Range;
		wait?: Range;
	} = $props();

	type Phase = 'wait' | 'blow' | 'rest' | 'burst';
	const rand = (a: number, b: number) => a + Math.random() * (b - a);
	const drops = () =>
		Array.from({ length: 7 }, (_, i) => {
			const a = -Math.PI * (0.1 + (0.8 * (i + Math.random() * 0.6)) / 7);
			const r = w * rand(0.35, 0.6);
			return { dx: Math.cos(a) * r, dy: Math.sin(a) * r, s: rand(5, 11) };
		});
	let phase = $state<Phase>(pop && !shown ? 'wait' : 'rest');
	let n = $state(0);
	let spray = $state(drops());

	onMount(() => {
		if (!pop) return;
		if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
			phase = 'rest';
			return;
		}
		let timer: ReturnType<typeof setTimeout>;
		const later = (ms: number, fn: () => void) => (timer = setTimeout(fn, ms));
		const step = (next: Phase) => {
			phase = next;
			n++;
			if (next === 'blow' || next === 'burst') spray = drops();
			if (next === 'blow') later(950, () => step('rest'));
			else if (next === 'rest') later(rand(...rest), () => step('burst'));
			else if (next === 'burst') later(420, () => step('wait'));
			else later(rand(...wait), () => step('blow'));
		};
		later(rand(...first), () => step(shown ? 'burst' : 'blow'));
		return () => clearTimeout(timer);
	});
</script>

<div
	class="dome"
	style={`left:${x}px;top:${y}px;width:${w}px;height:${h}px;--ox:${ox}px;--oy:${oy}px;--c:${color}`}
>
	<img class={phase} {src} alt="" />
	{#if phase === 'blow' || phase === 'burst'}
		{#key n}
			<span class="dome-burst" class:now={phase === 'burst'}>
				<span class="dome-ring"></span>
				{#each spray as p}<span
						class="dome-drop"
						style={`--dx:${p.dx.toFixed(1)}px;--dy:${p.dy.toFixed(1)}px;width:${p.s.toFixed(1)}px;height:${p.s.toFixed(1)}px`}
					></span>{/each}
			</span>
		{/key}
	{/if}
</div>

<style>
	.dome {
		position: absolute;
	}
	.dome img {
		display: block;
		width: 100%;
		height: 100%;
		transform-origin: var(--ox) var(--oy);
	}
	.dome img.wait {
		opacity: 0;
	}
	.dome img.blow {
		animation: dome-blow 0.95s both;
	}
	.dome img.burst {
		animation: dome-pop 0.32s ease-in forwards;
	}
	/* Droplets fly at the blow-up's pop (54% of dome-blow) or right away on a burst. */
	.dome-burst {
		--pd: 0.5s;
	}
	.dome-burst.now {
		--pd: 0s;
	}
	.dome-ring,
	.dome-drop {
		position: absolute;
		left: var(--ox);
		top: calc(var(--oy) * 0.55);
		border-radius: 50%;
		pointer-events: none;
		/* The domes are painted soft (blur baked into the art): their spray matches. */
		filter: blur(1.5px);
	}
	.dome-ring {
		width: 40%;
		aspect-ratio: 1;
		border: 3px solid color-mix(in srgb, var(--c), white 45%);
		translate: -50% -50%;
		animation: dome-ring 0.5s ease-out var(--pd) both;
	}
	.dome-drop {
		background: radial-gradient(circle at 35% 30%, #fffc 0 18%, var(--c) 30%);
		translate: -50% -50%;
		animation: dome-drop 0.75s cubic-bezier(0.2, 0.6, 0.4, 1) var(--pd) both;
	}
	/* Bubble blowing up from the ground: inflates past full size, pops into a squash, jiggles. */
	@keyframes dome-blow {
		0% {
			opacity: 0;
			transform: scale(0.06, 0.03);
			animation-timing-function: cubic-bezier(0.25, 0.6, 0.4, 1);
		}
		10% {
			opacity: 1;
		}
		54% {
			transform: scale(1.14, 1.2);
			animation-timing-function: cubic-bezier(0.5, 0, 0.6, 1);
		}
		66% {
			transform: scale(1.2, 0.84);
		}
		78% {
			transform: scale(0.94, 1.07);
		}
		89% {
			transform: scale(1.03, 0.97);
		}
		100% {
			opacity: 1;
			transform: none;
		}
	}
	/* Burst: a last stretch, then the skin is gone. */
	@keyframes dome-pop {
		0% {
			transform: none;
		}
		50% {
			opacity: 1;
			transform: scale(1.1, 1.14);
		}
		100% {
			opacity: 0;
			transform: scale(1.35, 1.2);
		}
	}
	@keyframes dome-ring {
		from {
			opacity: 0.9;
			transform: scale(0.3);
		}
		to {
			opacity: 0;
			transform: scale(2.4);
		}
	}
	@keyframes dome-drop {
		0% {
			opacity: 0;
			transform: none;
		}
		12% {
			opacity: 1;
		}
		70% {
			opacity: 1;
			transform: translate(var(--dx), var(--dy)) scale(1);
		}
		100% {
			opacity: 0;
			transform: translate(calc(var(--dx) * 1.1), calc(var(--dy) + 18px)) scale(0.4);
		}
	}
</style>
