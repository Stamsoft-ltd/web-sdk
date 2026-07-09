<script lang="ts">
	import { Sprite } from 'pixi-svelte';

	// Random lightning storm for the congratulations popups — N bolt slots, each strike at a fresh
	// random position / angle / size / flip with a quick multi-flicker burst that decays (like real
	// lightning). Render it BEFORE the panel sprite so the storm stays behind the dialog.
	type Props = {
		active: boolean;
		panelWidth: number; // horizontal spread reference (popup width)
		screenHeight: number; // bolts span the full screen height
		count?: number;
	};
	const props: Props = $props();
	const count = props.count ?? 18;

	type Bolt = { xf: number; yf: number; rot: number; wf: number; flip: number; alpha: number };
	const randomBolt = (): Bolt => ({
		xf: (Math.random() - 0.5) * 1.5, // -0.75..0.75 of panel width
		yf: (Math.random() - 0.5) * 0.16,
		rot: (Math.random() - 0.5) * 1.5, // -0.75..0.75 rad
		wf: 0.2 + Math.random() * 0.3,
		flip: Math.random() < 0.5 ? -1 : 1,
		alpha: 0,
	});
	let bolts = $state<Bolt[]>(Array.from({ length: count }, randomBolt));
	$effect(() => {
		if (!props.active) return;
		// NOTE: schedule arrays are built from `count`, NOT from `bolts` — reading `bolts` here would
		// make the effect depend on it and re-run (resetting the schedule) on every frame.
		// Stagger the first flashes so the storm starts immediately but not all at once.
		const nextAt = Array.from({ length: count }, (_, i) => performance.now() + 120 + i * 130 + Math.random() * 400);
		const flashStart = Array.from({ length: count }, () => -1);
		const peak = Array.from({ length: count }, () => 1);
		let raf = 0;
		const tick = (now: number) => {
			bolts = bolts.map((b, i) => {
				if (flashStart[i] < 0 && now >= nextAt[i]) {
					// New strike: re-randomize the bolt's geometry, then flash.
					flashStart[i] = now;
					peak[i] = 0.65 + Math.random() * 0.35; // vary strike brightness
					b = { ...randomBolt(), alpha: 0 };
				}
				let flash = 0;
				if (flashStart[i] >= 0) {
					const t = (now - flashStart[i]) / 1000;
					// flicker burst: fast strobe modulated by an exponential decay (~0.45s)
					flash = Math.max(0, (0.55 + 0.45 * Math.sin(t * 55)) * Math.exp(-t / 0.16)) * peak[i];
					if (t > 0.55) {
						flashStart[i] = -1;
						nextAt[i] = now + 500 + Math.random() * 2200;
						flash = 0;
					}
				}
				return { ...b, alpha: Math.min(1, flash) };
			});
			raf = requestAnimationFrame(tick);
		};
		raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
	});
</script>

<!-- All bolt sprites stay MOUNTED (alpha 0 when idle). Mounting them lazily via an {#if} made
     pixi append them to the parent container mid-flash — on top of the dialog panel. -->
{#each bolts as bolt, i (i)}
	<Sprite
		key="capsuleLightning"
		anchor={0.5}
		x={props.panelWidth * bolt.xf}
		y={props.screenHeight * bolt.yf}
		rotation={bolt.rot}
		width={props.panelWidth * bolt.wf * bolt.flip}
		height={props.screenHeight * 1.25}
		alpha={bolt.alpha}
		blendMode="add"
	/>
{/each}
