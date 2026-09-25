<script lang="ts">
	import { Graphics, Rectangle, Sprite } from 'pixi-svelte';
	import { stateUi } from 'state-shared';

	import { getContext } from '../game/context';
	import { mascotIdle } from '../game/mascotIdle';
	import { SQUIRT_EMIT, drawSauceSquirt, squirtHash, type SquirtGraphics } from '../game/ketchupSquirt';
	import AnimatedGuy from './AnimatedGuy.svelte';
	import SpecialMascot from './SpecialMascot.svelte';

	type Props = {
		/** False while the loading screen / splash is up: only the dark backdrop renders. */
		showArt?: boolean;
	};
	const { showArt = true }: Props = $props();

	const context = getContext();
	const aspect = 1678 / 937;
	// Portrait diner background (mobile-bg): its own 9:16-ish raster, cover-scaled to the phone.
	const portraitAspect = 941 / 1672;
	// Landscape SPECIAL (free-games) grey kitchen — its own wide crop (special-bg-landscape.webp).
	const specialLandscapeAspect = 1590 / 716;
	const canvas = $derived(context.stateLayoutDerived.canvasSizes());
	const layoutType = $derived(context.stateLayoutDerived.layoutType());
	const isPortrait = $derived(layoutType === 'portrait');
	const isLandscape = $derived(layoutType === 'landscape');
	// Free games swap to the special (grey kitchen) background. Keyed off the free-spin counter
	// (shown for the whole bonus) — the per-spin gameType flips to 'respin'/'basegame' mid-bonus.
	const isFreegame = $derived(
		context.stateGame.gameType === 'freegame' || stateUi.freeSpinCounterShow,
	);
	// The chef mascots (base + salting) and the special grey-kitchen bg are DESKTOP-only. Landscape
	// uses its own clean wide diner background with no chef (design ask).
	const showMascot = $derived(!isFreegame && layoutType === 'desktop');
	const showSpecialMascot = $derived(isFreegame && layoutType === 'desktop');
	const mascotHeight = $derived(canvas.height * 0.6);
	const mascotWidth = $derived(mascotHeight * (1304 / 1699));
	// Subtle idle so the chef isn't a frozen cut-out: a slow breathe (no lean — his eyes carry the
	// life, and a rotation would drag the pupils/label out of place).
	let clock = $state(0);
	$effect(() => {
		// Runs for the base-game chef + sparks (any layout) AND the special-bg (its hanging lamps blink).
		if (!showSparks && !showMascot && !showSpecialMascot) return;
		let raf = 0;
		const loop = (ts: number) => {
			clock = ts;
			raf = requestAnimationFrame(loop);
		};
		raf = requestAnimationFrame(loop);
		return () => cancelAnimationFrame(raf);
	});
	// Sparks: a few tiny warm glints drifting up behind the board on the regular (base-game) bg, so it
	// feels alive without competing with the reels. Deterministic off the clock: each spark has its
	// own column, speed, sway and size; it fades in, rises one lifetime and fades out, twinkling.
	const showSparks = $derived(showArt && !isFreegame);
	const SPARKS = 26;
	const drawSparks = (g: SquirtGraphics) => {
		const W = canvas.width;
		const H = canvas.height;
		for (let i = 0; i < SPARKS; i++) {
			const life = 6000 + 5000 * squirtHash(i * 4.1); // ms per rise
			const t = clock + squirtHash(i * 7.3) * life;
			const cycle = Math.floor(t / life);
			const p = (t % life) / life; // 0..1 through this rise
			// New column + start height every cycle so the pattern never repeats visibly.
			const hx = squirtHash(i * 13.7 + cycle * 3.3);
			const x0 = hx * W;
			const y0 = H * (0.55 + 0.45 * squirtHash(i * 5.9 + cycle * 1.7));
			const x = x0 + Math.sin(p * Math.PI * 2 * (0.6 + hx) + i) * W * 0.012;
			const y = y0 - p * H * (0.3 + 0.25 * squirtHash(i * 2.2));
			const twinkle = 0.65 + 0.35 * Math.sin(clock / (180 + 140 * squirtHash(i)) + i * 2.1);
			const a = Math.sin(Math.PI * p) * twinkle * 0.55; // fade in / out
			const r = H * (0.0016 + 0.0022 * squirtHash(i * 9.4));
			g.circle(x, y, r * 3.2).fill({ color: 0xffb347, alpha: a * 0.18 }); // soft glow
			g.circle(x, y, r).fill({ color: 0xfff1c8, alpha: a }); // hot core
		}
	};
	const mascotPose = $derived(
		mascotIdle(clock, canvas.width * 0.86, canvas.height * 0.59, mascotWidth, mascotHeight, {
			sway: 0,
			breathe: 0.005,
			bob: 0.004,
		}),
	);
	// The Figma chef (McShmutzo file, "Frame 427321577"), exported at 4× (1304×1699) and keyed off
	// the flat canvas grey — the same art as the free-games salting chef. Layers: base (pupils erased,
	// the bottle hand cut out), the bottle hand (drawn BEHIND the body, as in Figma, so it can shake),
	// and the nametag plate (jiggles over its baked copy). Pupils are redrawn a touch smaller than the
	// art and nudged up so the right one clears its lower-lid line while glancing. All fractions of
	// the frame. Skin sampled beside the eyes so the blink lid blends in.
	const mascotPupils = [
		{ nx: 0.3804, ny: 0.2866, nw: 0.0559, nh: 0.0429 },
		{ nx: 0.4962, ny: 0.2719, nw: 0.0701, nh: 0.0538 },
	];
	const mascotLids = [
		{ cx: 0.3658, cy: 0.2778, w: 0.069, h: 0.056 },
		{ cx: 0.4885, cy: 0.2666, w: 0.0767, h: 0.0689 },
	];
	// The held ketchup bottle (full-frame hand layer) shakes about the wrist, tucked behind the body.
	const BOTTLE_PIVX = 0.29;
	const BOTTLE_PIVY = 0.56;
	const mascotLeft = $derived(mascotPose.x - mascotPose.width / 2);
	const mascotTop = $derived(mascotPose.y - mascotPose.height / 2);
	const bottlePivotX = $derived(mascotLeft + BOTTLE_PIVX * mascotPose.width);
	const bottlePivotY = $derived(mascotTop + BOTTLE_PIVY * mascotPose.height);
	// A quick damped wiggle, more often now (matching the splash's bottle-shake), otherwise still.
	const BOTTLE_PERIOD = 2800; // ms between shakes
	const SHAKE_DUR = 950; // ms the wiggle lasts
	const shakeAt = (t: number) => {
		const u = (t % BOTTLE_PERIOD) / SHAKE_DUR; // 0..1 across the shake
		if (u > 1) return 0;
		return 0.058 * Math.exp(-2.7 * u) * Math.sin(u * 2 * Math.PI * 2.6); // ~3.3° damped, ~2.6 wiggles
	};

	// Ketchup squirt: now and then he squeezes the bottle and a real-looking shot of ketchup leaves the
	// nozzle (physics + drawing in ketchupSquirt.ts, shared with the sauce symbols). The bottle kicks
	// back a touch while squeezed.
	const SQ_PERIOD = 6500; // a squirt slot every 6.5s …
	const SQ_OFFSET = 1700; // … starting this far into the slot (clear of the shake)
	const NOZZLE = { x: 0.1438, y: 0.3773 }; // nozzle tip (frame fractions)
	const NOZZLE_DIR = Math.atan2(-0.979, -0.204); // bottle axis: up, leaning ~12° toward the board
	/** Squirt slot for time t: local ms into the squirt, or -1 when this slot doesn't squirt. */
	const squirtLocal = (t: number) => {
		const k = Math.floor(t / SQ_PERIOD);
		if (squirtHash(k) < 0.35) return -1; // skip ~1 in 3 slots → irregular, "from time to time"
		return t - k * SQ_PERIOD - SQ_OFFSET;
	};
	const recoilAt = (t: number) => {
		const u = squirtLocal(t);
		if (u < 0 || u > SQUIRT_EMIT + 400) return 0;
		// Kick back (clockwise, away from the stream) as he squeezes, then settle with a small overshoot.
		const k = u / (SQUIRT_EMIT + 400);
		return 0.05 * Math.sin(Math.PI * Math.min(1, u / SQUIRT_EMIT)) * (1 - k) + 0.012 * Math.sin(k * Math.PI * 3) * (1 - k);
	};
	const bottleRotAt = (t: number) => {
		const u = squirtLocal(t);
		const squirting = u >= -200 && u <= SQUIRT_EMIT + 700;
		return (squirting ? 0 : shakeAt(t)) + recoilAt(t);
	};
	const bottleShake = $derived(bottleRotAt(clock));
	const drawSquirt = (g: SquirtGraphics) => {
		const u = squirtLocal(clock);
		const t0 = clock - u; // absolute time the squeeze began
		const w = mascotPose.width;
		const h = mascotPose.height;
		const dx = mascotLeft + NOZZLE.x * w - bottlePivotX;
		const dy = mascotTop + NOZZLE.y * h - bottlePivotY;
		drawSauceSquirt(g, {
			u,
			unit: canvas.height,
			color: 0xb3160d,
			dark: 0x5e0704,
			floorY: canvas.height * 0.8, // gone behind the HUD band
			// The nozzle rides the bottle's rotation about the wrist.
			nozzleAt: (ms) => {
				const th = bottleRotAt(t0 + ms);
				const c = Math.cos(th);
				const sn = Math.sin(th);
				return { x: bottlePivotX + dx * c - dy * sn, y: bottlePivotY + dx * sn + dy * c, dir: NOZZLE_DIR + th };
			},
		});
	};
	// Desktop base game uses the new desktop diner art; free games keep the grey-kitchen special bg.
	const key = $derived(isFreegame ? 'backgroundWideBonus' : 'backgroundDesktop');
	const portraitKey = $derived(isFreegame ? 'backgroundPortraitBonus' : 'backgroundPortrait');
	const cover = $derived.by(() => {
		const canvasAspect = canvas.width / canvas.height;
		return canvasAspect > aspect
			? { width: canvas.width, height: canvas.width / aspect }
			: { width: canvas.height * aspect, height: canvas.height };
	});
	// Cover for the wide landscape special crop (free games only).
	const specialLandscapeCover = $derived.by(() => {
		const canvasAspect = canvas.width / canvas.height;
		return canvasAspect > specialLandscapeAspect
			? { width: canvas.width, height: canvas.width / specialLandscapeAspect }
			: { width: canvas.height * specialLandscapeAspect, height: canvas.height };
	});
	// Cover-scale the portrait bg: the phone is usually narrower than the art, so height fills the
	// screen and the sides overhang (lamp + shelf stay in view).
	const portraitCover = $derived.by(() => {
		const canvasAspect = canvas.width / canvas.height;
		return canvasAspect > portraitAspect
			? { width: canvas.width, height: canvas.width / portraitAspect }
			: { width: canvas.height * portraitAspect, height: canvas.height };
	});
	// A slow, subtle diagonal light-sweep across the diner so it reads as freshly polished / super
	// clean. Sweeps every ~10s and fades in/out; only on the desktop base-game bg (uses the same clock).
	const shine = $derived.by(() => {
		const period = 10000;
		const dur = 2800;
		const t = clock % period;
		if (t > dur) return null;
		const p = t / dur;
		return { x: (-0.2 + 1.4 * p) * canvas.width, a: 0.11 * Math.sin(Math.PI * p) };
	});
	// Two hanging pendant lamps in the special (free-games) kitchen bg's top-left. They hang from the
	// ceiling (bg top) and their bulbs blink on/off smoothly from time to time.
	const lamps = $derived.by(() => {
		if (!showSpecialMascot) return null;
		const bgLeft = canvas.width / 2 - cover.width / 2;
		const bgTop = canvas.height / 2 - cover.height / 2;
		// Small lamps that sit in the clear ceiling strip ABOVE the top-left readout (so the
		// multiplier plaque never covers them). Keep the bulb above the readout's top edge.
		const lampH = Math.min(canvas.height * 0.16, cover.height * 0.2);
		const lampW = lampH * (700 / 1077);
		// On most of the time, with a frequent double-flicker (two quick dips back to back) — a
		// stuttery neon-sign feel. Both lamps share the same phase so they blink in sync.
		const blink = (phase: number) => {
			const period = 1300;
			const t = (((clock + phase) % period) + period) % period;
			const dip = (lo: number, hi: number) => {
				if (t < lo * period || t > hi * period) return 0;
				const u = (t - lo * period) / ((hi - lo) * period); // 0..1 across the dip
				const tri = 1 - Math.abs(u * 2 - 1); // 0 → 1 → 0
				return tri * tri * (3 - 2 * tri); // smoothstep the dip
			};
			return 1 - Math.max(dip(0.6, 0.72), dip(0.78, 0.9)); // 1 (on) → 0 (off) → 1, twice
		};
		return {
			lampW,
			lampH,
			y: bgTop,
			bulbYPx: bgTop + lampH * 0.95, // the bulb sits at the shade's bottom opening
			haloYPx: bgTop + lampH * 1.0, // halo centred on the bulb (light escaping under the rim)
			list: [
				{ x: bgLeft + cover.width * 0.1, on: blink(0) },
				{ x: bgLeft + cover.width * 0.2, on: blink(0) },
			],
		};
	});
</script>

<Rectangle {...canvas} backgroundColor={0x170905} zIndex={-3} />
{#if !showArt}
	<!-- Loading / splash: nothing but the backdrop (the art below would show through). -->
{:else if isLandscape}
	<!-- Mobile-landscape: the real full diner (cover-scaled) for the base game, swapping to the
	     dedicated wide grey-kitchen crop for free games. No chef in landscape (design ask). -->
	<Sprite
		key={isFreegame ? 'backgroundLandscapeBonus' : 'backgroundBase'}
		x={canvas.width * 0.5}
		y={canvas.height * 0.5}
		anchor={0.5}
		width={isFreegame ? specialLandscapeCover.width : cover.width}
		height={isFreegame ? specialLandscapeCover.height : cover.height}
		zIndex={-2}
	/>
	<Rectangle {...canvas} backgroundColor={0x180903} alpha={0.16} zIndex={-1} />
{:else if isPortrait}
	<!-- Mobile portrait: the dedicated diner background, no darkening overlay (matches the splash).
	     Swaps to the special grey-kitchen background during free games. -->
	<Sprite
		key={portraitKey}
		x={canvas.width * 0.5}
		y={canvas.height * 0.5}
		anchor={0.5}
		width={portraitCover.width}
		height={portraitCover.height}
		zIndex={-2}
	/>
{:else}
	<Sprite
		{key}
		x={canvas.width * 0.5}
		y={canvas.height * 0.5}
		anchor={0.5}
		width={cover.width}
		height={cover.height}
		zIndex={-2}
	/>
	<Rectangle {...canvas} backgroundColor={0x180903} alpha={0.16} zIndex={-1} />
	{#if showMascot && shine}
		<!-- Clean gleam: a soft light band (wide dim + narrow bright core) sweeping across the diner. -->
		<Rectangle x={shine.x} y={canvas.height * 0.5} anchor={0.5} width={canvas.width * 0.11} height={canvas.height * 1.7} rotation={0.32} backgroundColor={0xffffff} alpha={shine.a} zIndex={-0.6} />
		<Rectangle x={shine.x} y={canvas.height * 0.5} anchor={0.5} width={canvas.width * 0.04} height={canvas.height * 1.7} rotation={0.32} backgroundColor={0xffffff} alpha={shine.a * 1.3} zIndex={-0.6} />
	{/if}
	{#if lamps}
		<!-- Two small hanging pendant lamps in the top-left ceiling strip; bulbs blink on/off in sync.
		     The glow is a soft radial texture (baked warm gradient, transparent edge) blended
		     additively BEHIND the shade — a smooth natural falloff with no hard circle edge, biased
		     slightly DOWN so it reads as light spilling from under the shade. When the lamp switches
		     off the bulb itself dims: the SAME soft glow texture, tinted near-black, fades in over the
		     bulb (a soft radial, so it reads as the bulb going dark — not a hard shadow disc). -->
		{#each lamps.list as l, i (i)}
			<Sprite key="lampGlow" x={l.x} y={lamps.haloYPx + lamps.lampH * 0.08} anchor={0.5} width={lamps.lampW * 2.5} height={lamps.lampW * 2.85} alpha={l.on * 0.5} zIndex={-0.93} blendMode="add" />
			<Sprite key="specialLamp" x={l.x} y={lamps.y} anchor={{ x: 0.5, y: 0 }} width={lamps.lampW} height={lamps.lampH} zIndex={-0.92} />
			<Sprite key="lampGlow" x={l.x} y={lamps.bulbYPx} anchor={0.5} width={lamps.lampW * 0.82} height={lamps.lampW * 0.82} tint={0x181005} alpha={(1 - l.on) * 0.72} zIndex={-0.9} />
		{/each}
	{/if}
{/if}
{#if showSparks}
	<!-- Subtle rising sparks between the bg and the board (additive, so they glow on the warm art). -->
	<Graphics zIndex={-0.5} blendMode="add" draw={drawSparks} />
{/if}
{#if showArt && showMascot}
	<!-- The chef breathes, his eyes glance + blink, and his nametag jiggles (layered art). -->
	<AnimatedGuy
		baseKey="mascotBase"
		x={mascotPose.x}
		y={mascotPose.y}
		width={mascotPose.width}
		height={mascotPose.height}
		zIndex={0}
		pupils={mascotPupils}
		lids={mascotLids}
		skin={0xee9c58}
		extras={[
			{
				// Brows above the blink lids (static full-frame layer).
				key: 'mascotBrows',
				nx: 0,
				ny: 0,
				nw: 1,
				nh: 1,
				amp: 0,
			},
			{
				// Full-frame layer (the exact plate pixels), tilting about its pin.
				key: 'mascotLabel',
				nx: 0,
				ny: 0,
				nw: 1,
				nh: 1,
				px: 0.6196,
				py: 0.6027,
				amp: 0.035,
				period: 320,
			},
		]}
		sparkle={{ nx: 0.46, ny: 0.376, size: 0.075, period: 3400 }}
	/>
	<!-- The held ketchup bottle — behind the body (as in the Figma layer order), shaking about the wrist. -->
	<Sprite
		key="mascotBottle"
		x={bottlePivotX}
		y={bottlePivotY}
		anchor={{ x: BOTTLE_PIVX, y: BOTTLE_PIVY }}
		width={mascotPose.width}
		height={mascotPose.height}
		rotation={bottleShake}
		zIndex={-0.1}
	/>
	<!-- The ketchup squirt: zIndex 0 ties with the chef and the board containers, so insertion order
	     puts it in front of the chef but BEHIND the reels (drops never cover symbols). -->
	<Graphics zIndex={0} draw={drawSquirt} />
{/if}
{#if showArt && showSpecialMascot}
	<SpecialMascot />
{/if}
