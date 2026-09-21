<script lang="ts">
	import { Sprite, Rectangle } from 'pixi-svelte';

	// A chef that stands (the parent breathes him via x/y/width/height) while his face is ALIVE: the
	// pupils glance around with occasional quick saccades and he blinks now and then. The base art has
	// the pupils cut out (sclera filled), the pupils are their own sprites nudged within the eye, and
	// each blink is a skin-coloured lid that drops over the eye (drawn in pixi — overshooting onto the
	// surrounding skin is invisible since it's the same colour). Extra layers (label) can be tilted via
	// `extras` — each rotates a hair about its own pin so it reads as pinned-and-jiggling.
	type Pupil = { key: string; nx: number; ny: number; nw: number; nh: number };
	type Lid = { cx: number; cy: number; w: number; h: number };
	type Extra = {
		key: string;
		nx: number;
		ny: number;
		nw: number;
		nh: number;
		/** pivot within the sprite (0..1); the tilt swings about this point. */
		px?: number;
		py?: number;
		/** peak tilt in radians and its period (ms). */
		amp?: number;
		period?: number;
		phase?: number;
	};
	type Props = {
		baseKey: string;
		x: number;
		y: number;
		width: number;
		height: number;
		zIndex?: number;
		pupils: Pupil[];
		lids?: Lid[];
		skin?: number;
		extras?: Extra[];
		/** ms offset so two instances never blink/glance in lock-step. */
		phase?: number;
	};
	const props: Props = $props();

	let clock = $state(0);
	$effect(() => {
		let raf = 0;
		let start = 0;
		const loop = (ts: number) => {
			if (!start) start = ts;
			clock = ts - start + (props.phase ?? 0);
			raf = requestAnimationFrame(loop);
		};
		raf = requestAnimationFrame(loop);
		return () => cancelAnimationFrame(raf);
	});

	// Glance (saccades): long holds, quick moves. Offsets are fractions of the figure w/h.
	const GLANCE_PERIOD = 5600;
	const KF = [
		{ t: 0.0, x: 0, y: 0 },
		{ t: 0.4, x: 0, y: 0 },
		{ t: 0.45, x: 0.015, y: -0.006 }, // quick glance to his left/up
		{ t: 0.66, x: 0.015, y: -0.006 },
		{ t: 0.71, x: 0.008, y: 0.009 }, // then down a touch
		{ t: 0.9, x: 0.008, y: 0.009 },
		{ t: 0.95, x: 0, y: 0 },
		{ t: 1.0, x: 0, y: 0 },
	];
	const glance = $derived.by(() => {
		const f = (clock % GLANCE_PERIOD) / GLANCE_PERIOD;
		for (let i = 0; i < KF.length - 1; i++) {
			if (f >= KF[i].t && f <= KF[i + 1].t) {
				const u = (f - KF[i].t) / (KF[i + 1].t - KF[i].t);
				const s = u * u * (3 - 2 * u); // smoothstep
				return {
					x: KF[i].x + (KF[i + 1].x - KF[i].x) * s,
					y: KF[i].y + (KF[i + 1].y - KF[i].y) * s,
				};
			}
		}
		return { x: 0, y: 0 };
	});

	// Blink: a quick lid drop (0 → 1 → 0 over ~140ms), with an occasional double blink.
	const BLINK_PERIOD = 4300;
	const blink = $derived.by(() => {
		const t = clock % BLINK_PERIOD;
		const pulse = (start: number, dur: number) => {
			if (t < start || t > start + dur) return 0;
			const u = (t - start) / dur;
			return 1 - Math.abs(u * 2 - 1); // triangle 0 → 1 → 0
		};
		return Math.max(pulse(BLINK_PERIOD - 520, 150), pulse(BLINK_PERIOD - 250, 130));
	});

	const left = $derived(props.x - props.width / 2);
	const top = $derived(props.y - props.height / 2);
	const z = $derived(props.zIndex ?? 0);
	const skin = $derived(props.skin ?? 0xf6ac67);

	const extraTilt = (e: Extra) => (e.amp ?? 0) * Math.sin((clock + (e.phase ?? 0)) / (e.period ?? 2600));
</script>

<Sprite
	key={props.baseKey}
	x={props.x}
	y={props.y}
	anchor={0.5}
	width={props.width}
	height={props.height}
	zIndex={z}
/>
{#each props.pupils as p (p.key)}
	<Sprite
		key={p.key}
		x={left + (p.nx + glance.x) * props.width}
		y={top + (p.ny + glance.y) * props.height}
		anchor={0.5}
		width={p.nw * props.width}
		height={p.nh * props.height}
		zIndex={z}
	/>
{/each}
{#if props.lids}
	{#each props.lids as l, i (i)}
		<!-- Skin lid drops from the eye top; overshoot onto surrounding skin is invisible (same colour). -->
		<Rectangle
			x={left + l.cx * props.width}
			y={top + (l.cy - l.h / 2) * props.height}
			anchor={{ x: 0.5, y: 0 }}
			width={l.w * props.width}
			height={blink * l.h * props.height}
			borderRadius={Math.min(l.w * props.width, l.h * props.height) * 0.5}
			backgroundColor={skin}
			zIndex={z}
		/>
		<!-- Eyelid crease: a soft dark line riding the lid's lower edge so a full blink reads as a
		     closed eye (lids meeting) rather than a flat skin patch. -->
		<Rectangle
			x={left + l.cx * props.width}
			y={top + (l.cy - l.h / 2 + blink * l.h) * props.height}
			anchor={0.5}
			width={l.w * props.width * 0.82}
			height={Math.max(2, l.h * props.height * 0.07)}
			borderRadius={l.h * props.height * 0.05}
			backgroundColor={0x3a2416}
			backgroundAlpha={blink * 0.7}
			zIndex={z}
		/>
	{/each}
{/if}
{#if props.extras}
	{#each props.extras as e (e.key)}
		<Sprite
			key={e.key}
			x={left + (e.nx + (e.nw * (e.px ?? 0.5))) * props.width}
			y={top + (e.ny + (e.nh * (e.py ?? 0.5))) * props.height}
			anchor={{ x: e.px ?? 0.5, y: e.py ?? 0.5 }}
			width={e.nw * props.width}
			height={e.nh * props.height}
			rotation={extraTilt(e)}
			zIndex={z}
		/>
	{/each}
{/if}
