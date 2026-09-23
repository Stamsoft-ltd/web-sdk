<script lang="ts">
	import { Sprite, Rectangle, Circle } from 'pixi-svelte';

	// A chef that stands (the parent breathes him via x/y/width/height) while his face is ALIVE: the
	// pupils glance around with occasional quick saccades and he blinks now and then. The base art has
	// the pupils cut out (sclera filled), and the pupils are drawn FRESH as clean dark discs + a glint
	// (like the splash chef) rather than the cut-from-art pupils — those carried a sliver of the eye's
	// black outline, so nudging them merged pupil-into-border and read badly. The discs are a touch
	// smaller than the socket and the glance is small, so they never reach the outline. Each blink is a
	// skin-coloured lid that drops over the eye (overshoot onto surrounding skin is invisible, same
	// colour) with a soft crease. Extra layers (label) can tilt about their own pin via `extras`.
	type Pupil = { nx: number; ny: number; nw: number; nh: number };
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
	/** A periodic *ding* sparkle on a tooth (nx/ny in figure fractions; size fraction of width). */
	type Sparkle = { nx: number; ny: number; size: number; period?: number; phase?: number };
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
		sparkle?: Sparkle;
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
		{ t: 0.45, x: 0.0045, y: -0.002 }, // quick glance to his left/up (tiny — pupils stay well inside the sclera)
		{ t: 0.66, x: 0.0045, y: -0.002 },
		{ t: 0.71, x: 0.0025, y: 0.003 }, // then down a touch
		{ t: 0.9, x: 0.0025, y: 0.003 },
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

	// Teeth *ding*: a white 4-point sparkle that flashes on a tooth now and then.
	const sparkle = $derived.by(() => {
		const sp = props.sparkle;
		if (!sp) return null;
		const period = sp.period ?? 3200;
		const p = (((clock + (sp.phase ?? 0)) % period) + period) % period / period;
		const fl = Math.exp(-(((p - 0.12) * 9) ** 2)); // quick flash 0 → 1 → 0 once per period
		return { x: left + sp.nx * props.width, y: top + sp.ny * props.height, s: fl * sp.size * props.width, a: fl };
	});
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
{#each props.pupils as p, i (i)}
	{@const d = Math.min(p.nw * props.width, p.nh * props.height) * 0.7}
	{@const cx = left + (p.nx + glance.x) * props.width}
	{@const cy = top + (p.ny + glance.y) * props.height}
	<!-- Clean dark disc (no cut-art outline) + a glint, sitting in the filled sclera. -->
	<Circle x={cx} y={cy} diameter={d} anchor={0.5} backgroundColor={0x15100e} zIndex={z} />
	<Circle
		x={cx - d * 0.2}
		y={cy - d * 0.24}
		diameter={d * 0.34}
		anchor={0.5}
		backgroundColor={0xffffff}
		backgroundAlpha={0.9}
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
{#if sparkle && sparkle.a > 0.02}
	<!-- 4-point sparkle: a vertical + horizontal ray and a bright centre, all flashing together. -->
	<Rectangle x={sparkle.x} y={sparkle.y} anchor={0.5} width={sparkle.s * 0.15} height={sparkle.s} borderRadius={sparkle.s * 0.075} backgroundColor={0xffffff} backgroundAlpha={sparkle.a} zIndex={z} />
	<Rectangle x={sparkle.x} y={sparkle.y} anchor={0.5} width={sparkle.s} height={sparkle.s * 0.15} borderRadius={sparkle.s * 0.075} backgroundColor={0xffffff} backgroundAlpha={sparkle.a} zIndex={z} />
	<Circle x={sparkle.x} y={sparkle.y} diameter={sparkle.s * 0.42} anchor={0.5} backgroundColor={0xffffff} backgroundAlpha={Math.min(1, sparkle.a * 1.4)} zIndex={z} />
{/if}
