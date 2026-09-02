<script lang="ts">
	import { Graphics } from 'pixi-svelte';

	// One-shot spark burst for the congratulations entry: when `active` flips true, a ring of
	// spark streaks flies outward from the centre and fades. Additive Graphics, no asset. Fires
	// once per activation (re-arms whenever `active` goes false -> true).
	type Props = {
		active: boolean;
		radius: number;
		count?: number;
		color?: number;
		duration?: number; // seconds
	};
	const props: Props = $props();
	const N = $derived(props.count ?? 20);
	const color = $derived(props.color ?? 0xbfe9ff);
	const DUR = $derived(props.duration ?? 0.75);

	type P = { a: number; speed: number; len: number; delay: number };
	let parts = $state<P[]>([]);
	let t = $state(0);
	let running = $state(false);

	$effect(() => {
		if (!props.active) {
			running = false;
			return;
		}
		// build a fresh burst each activation; jitter angle/speed so it never looks mechanical
		const n = N;
		parts = Array.from({ length: n }, (_, i) => ({
			a: (i / n) * Math.PI * 2 + (Math.random() - 0.5) * 0.35,
			speed: 0.65 + Math.random() * 0.5,
			len: 0.09 + Math.random() * 0.11,
			delay: Math.random() * 0.06,
		}));
		running = true;
		let raf = 0;
		const t0 = performance.now();
		const tick = (now: number) => {
			t = (now - t0) / 1000;
			if (t < DUR + 0.12) raf = requestAnimationFrame(tick);
			else running = false;
			return;
		};
		raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
	});
</script>

{#if running}
	<Graphics
		blendMode="add"
		draw={(g) => {
			g.clear();
			const R = props.radius;
			for (const p of parts) {
				const tt = Math.max(0, t - p.delay);
				const prog = Math.min(1, tt / DUR);
				const ease = 1 - Math.pow(1 - prog, 3); // easeOutCubic distance
				const dist = ease * R * p.speed;
				const fade = Math.max(0, 1 - prog);
				const c = Math.cos(p.a);
				const s = Math.sin(p.a);
				const x0 = c * dist;
				const y0 = s * dist;
				const x1 = c * (dist + R * p.len);
				const y1 = s * (dist + R * p.len);
				g.moveTo(x0, y0);
				g.lineTo(x1, y1);
				g.stroke({ width: R * 0.012, color, alpha: 0.9 * fade, cap: 'round' });
				g.circle(x1, y1, R * 0.014 * (0.7 + 0.6 * fade));
				g.fill({ color: 0xffffff, alpha: 0.9 * fade });
			}
		}}
	/>
{/if}
