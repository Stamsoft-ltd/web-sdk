<script lang="ts">
	import { onMount } from 'svelte';
	import { ap } from '../lib/preloadArt';
	import { i18nDerived } from '../i18n/i18nDerived';
	import SauceCorner from './SauceCorner.svelte';
	import { SAUCE } from '../lib/splashSauce';
	import {
		panoramaRect,
		PANORAMA_BASE_X,
		PANORAMA_SPLASH_X,
	} from '../game/panorama';
	import SauceFx from './SauceFx.svelte';
	import LogoHtml from './LogoHtml.svelte';
	import { getContext } from '../game/context';
	import { bowShake, chefPose, idleSnicker } from '../game/chefMood.svelte';

	type Props = {
		onpress: () => void;
		/** Where the game draws its board logo, in this overlay's px: the splash logo flies there on exit. */
		logoTarget?: () => { cx: number; cy: number; width: number };
	};
	const props: Props = $props();

	// Shrink a wrapping card title DOWN to fit its card by reducing FONT-SIZE (via the `--fit`
	// multiplier), not a transform. A transform scales the already-overflowed layout, which shoves a
	// long single word (de "EINZIGARTIGE", tr "SCHMUTZO'YA") off-centre and past the frame rule.
	// Reducing the font makes the text reflow so it actually fits, and `text-align: center` then keeps
	// every line centred. Only ever scales down — English/short titles stay at full size.
	function fitFont(node: HTMLElement, _dep?: unknown) {
		const fit = () => {
			const slot = node.parentElement;
			if (!slot) return;
			// Measure at FULL size: reset --fit to 1 so the line widths below are the real full-font
			// metrics (no extrapolation error). The parent's size is independent of --fit, so this
			// never re-triggers the observer below → no feedback loop.
			node.style.setProperty('--fit', '1');
			const cs = getComputedStyle(slot);
			const availW = slot.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
			const availH = slot.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
			// Widest actual LINE (getClientRects = the rendered text extent, incl. a single long word's
			// overflow). Using the line width — not scrollWidth — keeps short titles at full size: a
			// title only shrinks when a line genuinely can't fit, matching English's current look.
			const range = document.createRange();
			range.selectNodeContents(node);
			const widest = Math.max(0, ...Array.from(range.getClientRects(), (r) => r.width));
			const height = node.scrollHeight;
			let scale = 1;
			if (widest > availW && availW > 0) scale = Math.min(scale, availW / widest);
			if (height > availH && availH > 0) scale = Math.min(scale, availH / height);
			node.style.setProperty('--fit', scale < 1 ? String(scale) : '1');
		};
		const schedule = () => requestAnimationFrame(fit);
		const ro = new ResizeObserver(schedule);
		// Observe the CARD (parent), whose size is independent of --fit → resizing the viewport re-fits
		// but our own font change never re-triggers (no feedback loop).
		if (node.parentElement) ro.observe(node.parentElement);
		schedule();
		// The first pass runs in the fallback font (narrower); re-fit once the real font (Bowlby One SC)
		// has actually loaded. document.fonts.load resolves reliably even if `ready` already fired.
		if (typeof document !== 'undefined' && document.fonts) {
			try {
				const c = getComputedStyle(node);
				document.fonts
					.load(`${c.fontStyle} ${c.fontWeight} 40px ${c.fontFamily}`)
					.then(schedule)
					.catch(() => {});
			} catch {
				/* ignore an unparseable font shorthand — the timers below still cover the swap */
			}
			document.fonts.ready.then(schedule).catch(() => {});
		}
		const timers = [setTimeout(schedule, 200), setTimeout(schedule, 700)];
		return {
			update: schedule,
			destroy: () => {
				ro.disconnect();
				timers.forEach(clearTimeout);
			},
		};
	}

	const bg = ap('/assets/mcschmutzo/splash/bg.webp');
	// Wide screens: the LEFT end of the connected diner panorama (door, lamp, awning). Leaving the
	// splash pans the camera right to the panorama's base-game view, where the game's own background
	// takes over (same framing, see game/panorama.ts). Portrait keeps `bg` until mobile art exists.
	const panoArt = ap('/assets/mcschmutzo/background-panorama.webp');
	// The logo drops in (CSS logo-in: 1.75s delay, lands 43% into its 1.4s) and the impact squeezes
	// its ketchup splats out — LogoHtml bursts them this many ms after mount.
	const LOGO_HIT_MS = 1750 + 0.43 * 1400;
	// The splash mounts as soon as the game CAN proceed, often still under the Press Play pre-loader
	// (PressPlayLoader, gone on stateApp.loaded + its 320ms fade). Its whole entrance (cards in, the
	// logo's drop + hit) is held paused until then, or a slow load plays it all unseen and the logo
	// just "is there".
	const context = getContext();
	let revealed = $state(false);
	$effect(() => {
		if (!context.stateApp.loaded || revealed) return;
		const id = setTimeout(() => (revealed = true), 250);
		return () => clearTimeout(id);
	});
	/** Percent of a box dimension, for laying art-pixel geometry over fluid-sized layers. */
	const pct = (v: number, of: number) => `${((v / of) * 100).toFixed(3)}%`;

	// The chef is the board chef (Figma "Frame 427321577", 4× = 1304×1699) flipped horizontally so he
	// faces the cards from the left. The base is the relaxed-arm body (McShmutzo node 8779:1769) with
	// the old eye whites + brows pasted in, pre-mirrored (the nametag is its own readable layer).
	// Layers: body (pupils erased) + the bottle arm, drawn BEHIND the body and swinging from the strap seam,
	// + the head (tilting and nodding on its neck, carrying the eyes and brows) and the
	// hanging forearm (swinging from the elbow) — the board chef's rig, cut the same way
	// (scripts/build-chef-head.py) and driven by the same chefPose / idle snicker (the rAF loop below).
	// Pupils and eyelids are drawn in CSS. Geometry is in the frame's px.
	const manBody = ap('/assets/mcschmutzo/splash/man-body-v2.webp');
	// The bow tie, lifted off the body (scripts/build-chef-bow.py), wobbling on its knot like the board's.
	const manBow = ap('/assets/mcschmutzo/splash/man-bow-v1.webp');
	// head v2 carries a feathered strip of the under-chin shadow with it and has no copy of the collar
	// (build-splash-head-skirt.py), so a tilt never shows a second jaw or collar line
	const manHead = ap('/assets/mcschmutzo/splash/man-head-v2.webp');
	const manArm = ap('/assets/mcschmutzo/splash/man-arm-v1.webp');
	const manBottle = ap('/assets/mcschmutzo/splash/man-bottle-v4.webp');
	// The nametag plate (cropped layer over its baked copy) jiggles on its pin, like the board chef.
	const manLabel = ap('/assets/mcschmutzo/splash/man-label-v3.webp');
	// Card frame (Figma 8888:28568): dark rim with screws + red side tabs over a cream panel.
	const cardFrame = ap('/assets/mcschmutzo/splash/card-frame-v1.svg');
	// The corner sauce draws in a 470-px-wide card space: the frame's 283.154 × 384.895 at that width.
	const CARD_ART_H = Math.round((470 * 384.895) / 283.154);
	// Mirrored board-chef nozzle (frame fractions) + squirt direction (up, leaning toward the cards).
	const NOZZLE = { x: 1 - 0.1438, y: 0.3773, dir: Math.atan2(-0.979, 0.204) };
	const manBrows = ap('/assets/mcschmutzo/splash/man-brows-v3.webp'); // above the lids
	const MAN_W = 1304;
	const MAN_H = 1699;
	type Box = [number, number, number, number];
	const MAN = {
		// Pupils: the board chef's (a touch smaller than the art, the far one nudged up to clear its
		// lower-lid line), mirrored.
		pupilL: [783, 462, 834, 513] as Box,
		pupilR: [625, 430, 689, 494] as Box,
		// Eye openings (outline bbox): the lids are clipped to these so a blink never paints outside the eye.
		eyeL: [782, 425, 872, 520] as Box,
		eyeR: [617, 395, 717, 512] as Box,
		bottle: [0, 0, 1304, 1699] as Box, // full-frame layer (its squirt is placed in frame fractions)
		// Nametag / brows are cropped to their visible bounds (they were mostly-transparent
		// full-frame canvases); these boxes put each crop back exactly where it sat in the frame.
		label: [368, 1023, 624, 1160] as Box,
		bow: [516, 833, 788, 976] as Box, // build-chef-bow.py (splash box + knot)
		knot: [654, 905] as [number, number],
		brows: [574, 326, 907, 470] as Box,
		// the whole raised arm swings from where its sleeve runs in under the strap (build-chef-bottle.py)
		bottlePivot: [814, 1050] as [number, number],
		// build-chef-head.py prints these (splash man-head / man-arm boxes, neck + elbow)
		head: [287, 0, 986, 897] as Box, // + build-splash-head-skirt.py's skirt rows
		neck: [642, 861] as [number, number], // the head turns about this
		arm: [50, 1295, 274, 1794] as Box,
		elbow: [166, 1322] as [number, number],
		skin: '#ee9c58', // face skin right around the eyes (lid colour)
	};
	const manBox = ([x0, y0, x1, y1]: Box) =>
		`left:${pct(x0, MAN_W)};top:${pct(y0, MAN_H)};width:${pct(x1 - x0, MAN_W)};height:${pct(y1 - y0, MAN_H)};`;
	const bottleStyle =
		manBox(MAN.bottle) +
		`transform-origin:${pct(MAN.bottlePivot[0] - MAN.bottle[0], MAN.bottle[2] - MAN.bottle[0])} ` +
		`${pct(MAN.bottlePivot[1] - MAN.bottle[1], MAN.bottle[3] - MAN.bottle[1])};`;
	const origin = ([x, y]: [number, number], [x0, y0, x1, y1]: Box) =>
		`transform-origin:${pct(x - x0, x1 - x0)} ${pct(y - y0, y1 - y0)};`;
	const headOrigin = `transform-origin:${pct(MAN.neck[0], MAN_W)} ${pct(MAN.neck[1], MAN_H)};`;

	// The rig, on one rAF loop: the board chef's maths (AnimatedGuy head + Background forearm), every
	// rotation sign-flipped for the mirrored art. The head sways on two slow sines, nods with the
	// breath and follows the CSS pupils' glance (eyes-look, 13s) a beat late; the forearm swings
	// inward only; chefPose adds the idle snicker (shoulder pops, squint, cocked head, bottle waggle).
	const LOOK_MS = 13000;
	// eyes-look's keyframes: [progress, x, y] in fractions of a pupil
	const LOOK_KEYS: [number, number, number][] = [
		[0, 0, 0], [0.38, 0, 0], [0.41, -0.13, 0.05], [0.56, -0.13, 0.05],
		[0.59, 0.11, -0.03], [0.75, 0.11, -0.03], [0.78, 0, 0], [1, 0, 0],
	];
	const PUPIL_FRAC = 57 / MAN_W; // a pupil's width, as a fraction of the frame
	const easeInOut = (u: number) => (u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2);
	/** The CSS pupils' offset at t ms into their animation (fractions of the frame width). */
	const glanceAt = (t: number) => {
		const p = (((t % LOOK_MS) + LOOK_MS) % LOOK_MS) / LOOK_MS;
		for (let i = 1; i < LOOK_KEYS.length; i++) {
			const [p1, x1, y1] = LOOK_KEYS[i];
			const [p0, x0, y0] = LOOK_KEYS[i - 1];
			if (p <= p1) {
				const u = easeInOut((p - p0) / (p1 - p0));
				return { x: (x0 + (x1 - x0) * u) * PUPIL_FRAC, y: (y0 + (y1 - y0) * u) * PUPIL_FRAC };
			}
		}
		return { x: 0, y: 0 };
	};
	const HEAD_LAG_MS = 170;
	// The neck stays clean between these (offline composites of the rig): past them the jaw line
	// visibly leaves the collar's outline. Eased into, so the sway slows at the limit, never stops.
	const HEAD_ROT: [number, number] = [-0.022, 0.02];
	const HEAD_LIFT = 0.003; // fraction of the height the head may rise
	// Squash & stretch: the head flattens a touch as the chin drops fast and stretches as it pops up
	// (scaled about the neck, so the jaw edge stays put) — so it reads as flesh, not a rigid cut-out.
	const SQUASH_PER_SPEED = 3; // scale change per (fraction of the height per second) of nod speed
	const SQUASH_MAX = 0.02;
	const soft = (v: number, lo: number, hi: number) => {
		const lim = v >= 0 ? hi : -lo;
		return lim * Math.tanh(v / lim);
	};
	const HEAD_FOLLOW = 4.5; // radians of tilt per frame-width of glance
	const ARM_MAX = 0.04;
	let rig = $state({ head: '', arm: '', body: '', bottle: '', bow: '', brows: '', squint: 0 });
	let manH = $state(0); // the figure's px height (nod / brow offsets are fractions of it)
	onMount(() => {
		if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		const t0 = performance.now(); // the CSS eye animations start with the element
		let raf = 0;
		let lastNod = 0;
		let lastNow = t0;
		let nodSpeed = 0; // smoothed, fraction of the height per second (+ = down)
		const frame = (now: number) => {
			raf = requestAnimationFrame(frame);
			idleSnicker(now);
			const pose = chefPose(now);
			const g = glanceAt(now - t0 - HEAD_LAG_MS);
			const sway = 0.014 * Math.sin(now / 1730) + 0.006 * Math.sin(now / 830 + 1.1);
			const rot = soft(sway + g.x * HEAD_FOLLOW - pose.headTilt, HEAD_ROT[0], HEAD_ROT[1]);
			const nod = Math.max(-HEAD_LIFT, 0.0009 * Math.sin(now / 580) + g.y * 0.5 + pose.headNod);
			const dt = Math.max(1, now - lastNow);
			nodSpeed += (((nod - lastNod) * 1000) / dt - nodSpeed) * Math.min(1, dt / 60);
			lastNod = nod;
			lastNow = now;
			const squash = Math.max(-SQUASH_MAX, Math.min(SQUASH_MAX, nodSpeed * SQUASH_PER_SPEED));
			const swing = Math.min(
				ARM_MAX,
				Math.max(0, 0.014 + 0.012 * Math.sin(now / 1270 + 0.6) + 0.004 * Math.sin(now / 610) + Math.abs(pose.propRot) * 0.35),
			);
			// the board chef's bow wobble (Background.svelte bowTilt): sway + the head's tilt + the
			// bottle's waggle + the reaction shake, sign-flipped for the mirrored art
			const bow = Math.max(-0.06, Math.min(0.06, 0.014 * Math.sin(now / 1150 + 0.8) + 0.006 * Math.sin(now / 530) + 0.25 * pose.propRot + 0.3 * pose.headTilt + bowShake(now)));
			rig = {
				head: `transform:translateY(${(nod * manH).toFixed(2)}px) rotate(${rot.toFixed(4)}rad) scale(${(1 + 0.5 * squash).toFixed(4)},${(1 - squash).toFixed(4)});`,
				arm: `transform:rotate(${(-swing).toFixed(4)}rad);`,
				body: `transform:translate(${(-pose.dx * 100).toFixed(3)}%,${(pose.dy * 100).toFixed(3)}%) scale(${pose.sx.toFixed(4)},${pose.sy.toFixed(4)});`,
				bottle: `rotate:${(-0.72 * pose.propRot).toFixed(4)}rad;`,
				bow: `transform:rotate(${(-bow).toFixed(4)}rad);`,
				brows: `translate:0 ${(pose.brow * manH).toFixed(2)}px;`,
				squint: pose.squint,
			};
		};
		raf = requestAnimationFrame(frame);
		return () => cancelAnimationFrame(raf);
	});
	const pressPlay = ap('/assets/mcschmutzo/press-play.svg');
	// Card frames are drip-FREE; the corner sauce is drawn in code on top (SauceCorner + lib/splashSauce).

	// Each card = an empty drip frame + HTML copy (so the text stays editable / localizable).
	// `pad` is the interior inset per frame — the red frame carries a baked drop-shadow margin, so it
	// needs a wider inset than the shadow-less yellow/green frames.
	// title/body entries are i18n keys (translated in the markup).
	const CARDS = [
		{
			cls: 'card--red',
			sauce: SAUCE.red,
			title: 'SPLASH C1 TITLE',
			body: ['SPLASH C1 BODY'],
		},
		{
			cls: 'card--yellow',
			sauce: SAUCE.yellow,
			title: 'SPLASH C2 TITLE',
			body: ['SPLASH C2 BODY 1', 'SPLASH C2 BODY 2', 'SPLASH C2 BODY 3'],
		},
		{
			cls: 'card--green',
			sauce: SAUCE.green,
			title: 'SPLASH C3 TITLE',
			body: ['SPLASH C3 BODY'],
		},
	];

	// Leaving: the cards, logo and chef exit while the camera pans right across the panorama (and
	// the base game's 16% dim fades in), then the host fades the splash out over the game.
	const PAN_MS = 1700;
	const PORTRAIT_EXIT_MS = 900;
	let exiting = $state(false);
	let rootEl: HTMLDivElement | undefined = $state();
	let stageEl: HTMLDivElement | undefined = $state();
	let logoEl: HTMLDivElement | undefined = $state();
	// The logo's exit = a move + scale from its REST spot (layout box, so a press mid-entrance still
	// measures the landed pose) onto the board logo, which is already at rest under the splash when
	// it fades. Without a target it falls back to flying off the top.
	let logoFly = $state('');
	const measureLogoFly = () => {
		const target = props.logoTarget?.();
		if (!target || !rootEl || !stageEl || !logoEl || !logoEl.offsetWidth) return '';
		const root = rootEl.getBoundingClientRect();
		const stage = stageEl.getBoundingClientRect();
		// `.logo` is left:50% + translateX(-50%), so offsetLeft is its centre.
		const cx = stage.left - root.left + logoEl.offsetLeft;
		const cy = stage.top - root.top + logoEl.offsetTop + logoEl.offsetHeight * 0.5;
		const k = target.width / logoEl.offsetWidth;
		return `--fly-x:${target.cx - cx}px;--fly-y:${target.cy - cy}px;--fly-k:${k}`;
	};
	let vw = $state(0);
	let vh = $state(0);
	const press = () => {
		if (exiting) return;
		if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
			props.onpress();
			return;
		}
		logoFly = measureLogoFly();
		exiting = true;
		// Portrait has no pan and the game isn't drawn behind the splash yet, so it hands over as soon
		// as the (short) logo flight lands — the board then drops in under the logo.
		setTimeout(() => props.onpress(), isPortrait ? PORTRAIT_EXIT_MS : PAN_MS + 40);
	};
	const onKey = (e: KeyboardEvent) => {
		if (e.code === 'Space' || e.code === 'Enter') press();
	};
	const panoStyle = $derived.by(() => {
		const r = panoramaRect(vw, vh, PANORAMA_SPLASH_X);
		const pan = exiting ? (PANORAMA_BASE_X - PANORAMA_SPLASH_X) * r.k : 0;
		return `left:${r.x}px;top:${r.y}px;width:${r.width}px;height:${r.height}px;transform:translateX(${-pan}px);--pan-ms:${PAN_MS}ms`;
	});

	// Portrait (mobile): show the feature cards one at a time and auto-advance every 4.5s, with dot
	// indicators — matching the other games. Landscape/desktop keeps all three cards in a row.
	let isPortrait = $state(false);
	let slide = $state(0);
	// true from the first auto-advance on: later cards arrive by cardSlide, not the CSS entrance
	let swapped = $state(false);
	// Carousel motion: in from the right (dir 1), out to the left (dir −1), easing out, with a fade
	// at the far end; the standalone `translate` leaves the card's own transform (entrance/exit) alone.
	const cardSlide = (_node: Element, { dir }: { dir: 1 | -1 }) =>
		matchMedia('(prefers-reduced-motion: reduce)').matches
			? { duration: 0 }
			: {
					duration: 620,
					css: (t: number) => {
						const e = dir === 1 ? 1 - (1 - t) ** 3 : t * t * (3 - 2 * t);
						const x = (1 - e) * 115 * (dir === 1 ? 1 : -1);
						return `translate: ${x}% 0; opacity: ${Math.min(1, e * 1.6)}; rotate: ${(1 - e) * 4 * dir}deg;`;
					},
				};
	const SLIDE_COUNT = CARDS.length;
	const currentCard = $derived(CARDS[slide]);
	const updateOrientation = () => (isPortrait = window.innerWidth < window.innerHeight);
	onMount(updateOrientation);
	$effect(() => {
		if (!isPortrait || !revealed) {
			slide = 0;
			return;
		}
		const id = setInterval(() => {
			swapped = true;
			slide = (slide + 1) % SLIDE_COUNT;
		}, 4500);
		return () => clearInterval(id);
	});
</script>

<svelte:window onkeydown={onKey} onresize={updateOrientation} />

<div
	class="splash-intro"
	class:exiting
	class:waiting={!revealed}
	class:logo-fly={logoFly !== ''}
	bind:this={rootEl}
	role="button"
	tabindex="0"
	aria-label={i18nDerived.translate('PRESS TO CONTINUE')}
	onclick={press}
	onkeydown={onKey}
	bind:clientWidth={vw}
	bind:clientHeight={vh}
>
	{#if !isPortrait && vw > 0}
		<img class="pano" src={panoArt} alt="" draggable="false" style={panoStyle} />
		<!-- The wall lantern, lit: a warm halo on the wall + a hot core in the glass, flickering like a
		     flame. Same box + pan as the panorama, so it stays on the painted lamp. -->
		<div class="pano pano-lamp pano-lamp--halo" style={panoStyle} aria-hidden="true">
			<span class="lamp-halo"></span>
		</div>
		<div class="pano pano-lamp pano-lamp--core" style={panoStyle} aria-hidden="true">
			<span class="lamp-core"></span>
		</div>
		<div class="pano-dim" style={`--pan-ms:${PAN_MS}ms`}></div>
	{/if}
	<div class="stage" bind:this={stageEl} style={`--sbg-mobile:url('${bg}')`}>
		<!-- The board's "freshly polished" gleam: a tilted light band sweeps across the diner every 13s
		     (over the background, behind the logo / cards / chef). -->
		<div class="shine" aria-hidden="true"><div class="shine__band"></div></div>
		<div class="logo" bind:this={logoEl} style={logoFly}><LogoHtml hitAt={LOGO_HIT_MS} /></div>
		<div class="man" style={`--skin:${MAN.skin}`} bind:clientHeight={manH}>
		<!-- the rig's art is the board chef mirrored; the redesign (8888:28541) stands him at the right
		     facing the cards like on the board, so it is flipped back here as a whole -->
		<div class="man-flip">
		<div class="man-rig" style={rig.body}>
			<div class="bottle" style={bottleStyle + rig.bottle}>
				<img src={manBottle} alt="" draggable="false" />
				<!-- Now and then he squeezes the bottle: the board chef's ketchup squirt (it rides the bottle
				     layer, so it follows the shake). Fires in the calm part of the 9s shake loop. -->
				<SauceFx
					bleed={0.6}
					splashes={[
						{ x: NOZZLE.x, y: NOZZLE.y, dir: NOZZLE.dir, color: 0xb3160d, jets: 1, size: 1.2, delay: 1050, period: 9000, skip: 0.3 },
					]}
				/>
			</div>
			<img class="man-base" src={manBody} alt="" draggable="false" />
			<img class="man-part" src={manArm} alt="" draggable="false" style={manBox(MAN.arm) + origin(MAN.elbow, MAN.arm) + rig.arm} />
			<!-- Nametag on the apron strap. -->
			<img class="man-label" src={manLabel} alt="" draggable="false" style={manBox(MAN.label)} />
			<!-- The head on its neck: a frame-sized layer, so the face parts keep their frame boxes. -->
			<div class="man-head" style={headOrigin + rig.head}>
				<img class="man-part" src={manHead} alt="" draggable="false" style={manBox(MAN.head)} />
				<div class="pupil" style={manBox(MAN.pupilL)}><span class="glint"></span></div>
				<div class="pupil" style={manBox(MAN.pupilR)}><span class="glint"></span></div>
				{#each [MAN.eyeL, MAN.eyeR] as eye, i (i)}
					<div class="eye" style={manBox(eye)}>
						<div class="lid"></div>
						<!-- the snicker's screwed-up eyes: a second lid, lowered by chefPose's squint -->
						{#if rig.squint > 0.01}
							<div class="lid lid--squint" style={`transform:translateY(${((rig.squint - 1) * 101).toFixed(1)}%)`}></div>
						{/if}
					</div>
				{/each}
				<!-- Brows over the lids, so a blink closes under the brow. -->
				<img class="man-brows" src={manBrows} alt="" draggable="false" style={manBox(MAN.brows) + rig.brows} />
			</div>
			<!-- The bow tie, in front of the neck, wobbling on its knot. -->
			<img class="man-part" src={manBow} alt="" draggable="false" style={manBox(MAN.bow) + origin(MAN.knot, MAN.bow) + rig.bow} />
		</div>
		</div>
		</div>
		<!-- Mobile only: the Press Play wordmark (desktop has none; mobile has no character). -->
		<img class="pp-mark" src={pressPlay} alt="Press Play" draggable="false" />

		{#snippet cardEl(card: (typeof CARDS)[number])}
			<div class="card {card.cls}">
				<!-- Cream panel + the design's frame (vector, so it stays sharp at any size). -->
				<div class="card-panel" aria-hidden="true"></div>
				<img class="card-frame" src={cardFrame} alt="" draggable="false" />
				<!-- Corner sauce, drawn in code: the blob + both tendrils dripping. Sits OVER the copy so a
				     drop can splat onto the title; the wrap sags as a whole. -->
				<div class="drip-wrap">
					<SauceCorner spec={card.sauce} artH={CARD_ART_H} frameR={20} />
				</div>
				<div class="card-inner">
					<h3 class="card-title" use:fitFont={i18nDerived.translate(card.title)}>
						{i18nDerived.translate(card.title)}
					</h3>
					<div class="card-body">
						{#each card.body as line (line)}<p>{i18nDerived.translate(line)}</p>{/each}
					</div>
				</div>
			</div>
		{/snippet}

		<div class="cards" class:cards--single={isPortrait}>
			{#if isPortrait}
				<!-- one slot per slide: the old card slides out left while the next slides in from the
				     right (both share one grid cell). The first card keeps its rise-up entrance. -->
				{#key slide}
					<div class="card-slot" class:card-slot--swap={swapped} in:cardSlide={{ dir: 1 }} out:cardSlide={{ dir: -1 }}>
						{@render cardEl(currentCard)}
					</div>
				{/key}
			{:else}
				{#each CARDS as card (card.cls)}
					{@render cardEl(card)}
				{/each}
			{/if}
		</div>

		{#if isPortrait}
			<div class="dots">
				{#each CARDS as _, i (i)}
					<span class="dot" class:dot--on={slide === i}></span>
				{/each}
			</div>
		{/if}

		<p class="press-label">{i18nDerived.translate('PRESS TO CONTINUE')}&nbsp;→</p>
	</div>
</div>

<style>
	/* still under the pre-loader: hold every entrance at its first frame (see `revealed`) */
	.splash-intro.waiting :global(*) {
		animation-play-state: paused !important;
	}
	.splash-intro {
		position: absolute;
		inset: 0;
		z-index: 10;
		cursor: pointer;
		outline: none;
		user-select: none;
		overflow: hidden;
		background: #f0bd7f;
	}

	/* Cover-scaled 16:9 stage — the artwork keeps its aspect and the long axis overhangs. */
	.stage {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		width: max(100vw, calc(100vh * 16 / 9));
		height: max(100vh, calc(100vw * 9 / 16));
		/* Wide screens draw the panorama (.pano) behind the stage; portrait uses the mobile bg (below). */
		background-repeat: no-repeat;
		container-type: size;
	}
	/* Narrower than 16:9 (4:3, 16:10 …): covering the screen cropped the stage's sides, and the chef
	   (bottom right, already 2.7% past the edge by design) went off-screen with them. Fit the stage to
	   the width instead, overhanging by at most ~6% in all — the cards row fills 13–87% of it, so that
	   keeps the cards and the chef in view; the panorama behind still fills the screen above and below. */
	@media (min-aspect-ratio: 1 / 1) and (max-aspect-ratio: 16 / 9) {
		.stage {
			--sw: max(100vw, min(100vh * 16 / 9, 106vw));
			width: var(--sw);
			height: calc(var(--sw) * 9 / 16);
		}
	}

	/* The diner panorama, positioned in px from panoramaRect (same maths as the game's background).
	   The camera pan is a translateX to the base-game view. */
	.pano {
		position: absolute;
		max-width: none;
		transition: transform var(--pan-ms) cubic-bezier(0.65, 0, 0.35, 1);
		will-change: transform;
		pointer-events: none;
	}
	/* Lantern (background-panorama.webp, 2172×724): the bulb's core is at 248.5, 276 px, the glass
	   ~227–270 × 250–303. Positions are % of the art; sizes are % of its width.
	   The blend sits on the .pano layers themselves: .pano's will-change makes each one its own
	   stacking context, so a blend on a child would mix with that empty layer, not the painting. */
	.pano-lamp {
		pointer-events: none;
	}
	/* the light thrown on the wall: overlay warms + brightens the lit wall, keeps the dark metal dark */
	.pano-lamp--halo {
		mix-blend-mode: overlay;
	}
	/* the flame: screen only ever brightens the glass */
	.pano-lamp--core {
		mix-blend-mode: screen;
	}
	.lamp-halo,
	.lamp-core {
		position: absolute;
		left: calc(248.5 / 2172 * 100%);
		top: calc(276 / 724 * 100%);
		translate: -50% -50%;
		aspect-ratio: 1;
		border-radius: 50%;
	}
	.lamp-halo {
		width: calc(260 / 2172 * 100%);
		background: radial-gradient(circle, rgba(255, 214, 120, 0.85) 0%, rgba(255, 190, 90, 0.5) 30%, rgba(255, 170, 70, 0) 68%);
		animation:
			lamp-flicker 3.7s linear infinite,
			lamp-breathe 5.3s ease-in-out infinite alternate;
	}
	/* the flame itself, inside the glass only */
	.lamp-core {
		width: calc(34 / 2172 * 100%);
		background: radial-gradient(circle, rgba(255, 252, 225, 0.9) 0%, rgba(255, 226, 140, 0.5) 45%, rgba(255, 200, 90, 0) 75%);
		animation: lamp-flicker 3.7s linear -0.15s infinite;
	}
	/* a gas flame: steady, with the odd quick dip-and-catch */
	@keyframes lamp-flicker {
		0%, 100% { opacity: 1; }
		6% { opacity: 0.86; }
		8% { opacity: 1; }
		31% { opacity: 0.93; }
		34% { opacity: 0.68; }
		36% { opacity: 0.97; }
		38% { opacity: 0.8; }
		41% { opacity: 1; }
		63% { opacity: 0.9; }
		66% { opacity: 1; }
		84% { opacity: 0.88; }
		87% { opacity: 1; }
	}
	@keyframes lamp-breathe {
		from { scale: 0.94; }
		to { scale: 1.06; }
	}
	@media (prefers-reduced-motion: reduce) {
		.lamp-halo,
		.lamp-core {
			animation: none;
		}
	}

	/* The base game's background carries a 16% dark wash — fade it in during the pan so the handover
	   to the game background is seamless. */
	.pano-dim {
		position: absolute;
		inset: 0;
		background: #180903;
		opacity: 0;
		transition: opacity var(--pan-ms) ease-in-out;
		pointer-events: none;
	}
	.exiting .pano-dim {
		opacity: 0.16;
	}

	/* Same as the board's shine (Background.svelte): wide band at 11% white + a narrow core (4% of the
	   width) on top, tilted 0.32 rad, sweeping −20% → 120% over 2.8s of every 10s with a sine fade. */
	.shine {
		position: absolute;
		inset: 0;
		overflow: hidden;
		pointer-events: none;
	}
	.shine__band {
		position: absolute;
		top: -35%;
		left: -20%;
		width: 11%;
		height: 170%;
		transform: translateX(-50%) rotate(18.3deg);
		background: linear-gradient(
			to right,
			rgba(255, 255, 255, 0.11) 0 31.8%,
			rgba(255, 255, 255, 0.25) 31.8% 68.2%,
			rgba(255, 255, 255, 0.11) 68.2%
		);
		opacity: 0;
		animation: shine-sweep 13s linear 2.5s infinite;
	}
	@keyframes shine-sweep {
		0% {
			left: -20%;
			opacity: 0;
		}
		7% {
			opacity: 0.71;
		}
		14% {
			opacity: 1;
		}
		21% {
			opacity: 0.71;
		}
		28% {
			left: 120%;
			opacity: 0;
		}
		100% {
			left: 120%;
			opacity: 0;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.shine {
			display: none;
		}
	}
	.logo {
		position: absolute;
		/* Redesign (8888:28541, 1200×670): the wordmark spans ~265–955 px, letters from y≈75 — big, and
		   OVER the top of the cards and their corner sauce (the design's layer order). */
		z-index: 4;
		left: 50.8%;
		top: 11.2%;
		transform: translateX(-50%);
		/* squash about the bottom edge — it lands on the cards */
		transform-origin: 50% 100%;
		width: 61%;
		filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.35));
		/* Entrance: once the cards are in, it drops in from the top, HITS and squashes (the splats
		   squeeze out — LogoHtml), springs back, then stays put. */
		animation: logo-in 1.4s ease-in-out 1.75s both;
	}

	.man {
		position: absolute;
		/* Redesign (8888:28612): bottom-right, frame 956–1232 × 318–677.5 of the 1200×670 stage — a
		   little past the right and bottom edges, so the stage edge crops his lower torso. */
		right: -2.7%;
		bottom: -1.1%;
		height: 53.7%;
		aspect-ratio: 1304 / 1699;
		/* The real art's frame includes the raised bottle on its right, so the figure is wider than
		   the old cut — sit him IN FRONT of the card stack (a foreground character) so the bottle
		   isn't swallowed behind the first card. */
		z-index: 3;
		/* Alive: a slow breath on the whole figure; the eyes glance around and blink, and the ketchup
		   bottle gets a little shake — each its own layer (see the script constants). */
		transform-origin: 50% 100%;
		animation:
			chef-breathe 5s ease-in-out infinite alternate,
			man-in 1.1s cubic-bezier(0.22, 1, 0.36, 1) 2.7s both;
	}
	.man-base,
	.bottle img {
		display: block;
		width: 100%;
		height: 100%;
	}
	/* Frame-wide, natural height: the art (1304×1800) runs past the 1304×1699 frame so the relaxed
	   hand isn't cut off. */
	.man-base {
		position: absolute;
		left: 0;
		top: 0;
		width: 100%;
		height: auto;
		max-width: none;
	}
	.pupil,
	.eye,
	.bottle,
	.man-part {
		position: absolute;
	}
	.man-part {
		display: block;
		max-width: none;
	}
	.man-flip,
	.man-rig,
	.man-head {
		position: absolute;
		inset: 0;
	}
	.man-flip {
		transform: scaleX(-1);
	}
	.man-rig {
		transform-origin: 50% 100%;
	}
	/* Pupils: dark disc + a glint, sitting where the erased ones were; they dart around now and then. */
	.pupil {
		border-radius: 50%;
		background: radial-gradient(circle at 50% 50%, #1a1512 0 62%, #0d0a08 100%);
		animation: eyes-look 13s ease-in-out infinite;
	}
	.pupil .glint {
		position: absolute;
		left: 28%;
		top: 20%;
		width: 34%;
		height: 32%;
		border-radius: 50%;
		background: #fff;
	}
	/* Eyelids: each eye opening is a clipped ellipse and its skin-coloured lid slides down inside it
	   for a blink — mid-blink it reads as a lid over the eye, never as a bar on the forehead. */
	.eye {
		border-radius: 50%;
		overflow: hidden;
		pointer-events: none;
	}
	.lid {
		position: absolute;
		inset: 0;
		background: var(--skin);
		box-shadow: inset 0 -2px 0 #2b1a10;
		transform: translateY(-101%);
		animation: eyes-blink 7s linear infinite;
	}
	.bottle {
		animation: bottle-shake 9s ease-in-out infinite;
	}
	.lid--squint {
		animation: none;
	}
		.man-brows {
		position: absolute;
	}
	/* Nametag jiggles on its pin (pin = top-centre of the plate: 38.04% / 60.45% of the frame). */
	.man-label {
		position: absolute;
		transform-origin: 50.02% 2.95%; /* the pin: frame 38.04% / 60.45% */
		scale: -1 1; /* reads the right way round inside the flipped rig */
		animation: label-jiggle 2.2s ease-in-out infinite alternate;
	}
	@keyframes label-jiggle {
		from {
			transform: rotate(-1.6deg);
		}
		to {
			transform: rotate(1.6deg);
		}
	}

	/* Press Play wordmark — mobile only (see portrait media query); hidden on desktop. */
	.pp-mark {
		display: none;
	}

	/* Three cards in a row under the logo (8896:40967: 879.5 × 384.9 at 160, 217 of the 1200×670
	   stage, 15 px apart). */
	.cards {
		position: absolute;
		left: 50%;
		top: 61.1%;
		transform: translate(-50%, -50%);
		height: 57.4%;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 1.25cqw;
	}

	.card {
		position: relative;
		height: 100%;
		/* The three frames are identical (283.154 × 384.895). */
		aspect-ratio: 283.154 / 384.895;
		filter: drop-shadow(0 6px 12px rgba(0, 0, 0, 0.22));
		/* Each card is its own query container so the copy scales with the card in ANY orientation
		   (on portrait the row shrinks the cards, and the text has to follow). */
		container-type: size;
		/* Entrance choreography: the cards fly in from three sides — left card from the left, right
		   card from the right, centre card up from the bottom — while the logo drops in from the top.
		   Both flat rows keep the position rules above (transform is only used by the entrance). */
		/* Slow, one after another: left, centre, right. */
		animation: card-in-bottom 1.15s cubic-bezier(0.22, 1, 0.36, 1) both;
		animation-delay: 0.25s;
	}
	/* Staggered arrival (logo first, then left → centre → right) so the eye can follow each one. */
	.cards:not(.cards--single) .card:nth-child(1) {
		animation-name: card-in-left;
		animation-delay: 0.45s;
	}
	.cards:not(.cards--single) .card:nth-child(2) {
		animation-delay: 0.6s;
	}
	.cards:not(.cards--single) .card:nth-child(3) {
		animation-name: card-in-right;
		animation-delay: 0.95s;
	}

	/* Leaving (camera pan → right): the cards all slide off to the LEFT, the way the view leaves
	   them behind, left card first; the chef goes left too. */
	/* (Same specificity as the per-card entrance rules above, so this replaces their animation-name.) */
	.exiting .cards:not(.cards--single) .card {
		animation: card-out-left 0.7s cubic-bezier(0.55, 0, 0.9, 0.4) forwards;
	}
	.exiting .cards:not(.cards--single) .card:nth-child(2) {
		animation-delay: 0.07s;
	}
	.exiting .cards:not(.cards--single) .card:nth-child(3) {
		animation-delay: 0.14s;
	}
	.exiting .logo {
		animation: logo-out 0.55s cubic-bezier(0.55, 0, 0.9, 0.4) forwards;
	}
	/* …while the logo flies onto the board's logo (measured in measureLogoFly), landing as the pan ends
	   so the splash fades out over the identical pixi logo. */
	.exiting.logo-fly .logo {
		transform-origin: 50% 50%; /* measureLogoFly scales about the centre */
		animation: logo-fly 1.45s cubic-bezier(0.6, 0, 0.3, 1) 0.1s forwards;
	}
	.exiting .man {
		animation: man-out 0.6s cubic-bezier(0.55, 0, 0.9, 0.4) forwards;
	}
	.exiting .press-label,
	.exiting .shine {
		animation: none;
		opacity: 0;
		transition: opacity 0.25s ease;
	}

	/* The corner sauce fills the card box exactly like the frame. The wrap sags as a whole (slow). */
	.drip-wrap {
		position: absolute;
		inset: 0;
		/* Above the copy: a falling drop lands on the title and splats over the letters. */
		z-index: 1;
		transform-origin: 0 0;
		animation: sauce-sag 9.5s ease-in-out infinite alternate;
	}
	.card--yellow .drip-wrap {
		animation-delay: -2.2s;
	}
	.card--green .drip-wrap {
		animation-delay: -4.4s;
	}

	/* Copy in the design's two zones (card px of 384.9): the title centred in 50–222, the description
	   in 222–335 — so every card's title and body line up across the row whatever their length. */
	.card-inner {
		position: absolute;
		inset: 0;
		display: grid;
		grid-template-rows: 13cqh 44.7cqh 29.3cqh;
		justify-items: center;
		text-align: center;
		font-family: 'Nunito', sans-serif;
		padding: 0 10.5%;
	}
	.card-inner > .card-title {
		grid-row: 2;
		align-self: center;
	}
	.card-inner > .card-body {
		grid-row: 3;
		align-self: center;
	}

	/* Titles: the design's 42 px on a 283-px card (14.8cqw), line-height 1.2, 0.03em, in the brush
	   face (`fitFont` shrinks a long word to the frame). */
	.card-title {
		margin: 0;
		max-width: 100%;
		/* Titles may carry explicit line breaks (card 2: the number on its own line, as designed). */
		white-space: pre-line;
		font-family: var(--font-brush);
		-webkit-text-stroke: var(--brush-stroke) currentColor;
		font-weight: 400;
		line-height: 1.2;
		letter-spacing: 0.03em;
		font-size: calc(12cqw * var(--fit, 1));
	}
	/* The cream panel (8888:28566/7: 2.6% in from the sides, 0.8% top, 2.2% bottom) under the frame
	   art, whose middle is cut out. */
	.card-panel {
		position: absolute;
		left: 2.62%;
		right: 2.96%;
		top: 0.83%;
		bottom: 2.24%;
		border-radius: 2.6cqw;
		background: #fef4d5;
	}
	.card-frame {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
	}
	/* (No coloured inner rule: its left side ran right under each corner drip and read as a thread
	   hanging from the sauce.) */
	.card--red .card-title {
		color: #c41e0a;
	}
	.card--yellow .card-title {
		color: #e2b700;
	}
	.card--green .card-title {
		color: #75ac10;
	}

	/* Description = Nunito Medium 20 px on the 384.9-px card, 0.03em. */
	.card-body {
		font-family: 'Nunito', sans-serif;
		color: #232323;
		font-weight: 500;
		font-size: 5.2cqh;
		line-height: 1.36;
		letter-spacing: 0.03em;
	}
	.card-body p {
		margin: 0;
	}
	/* the chef's bottle comes in over this card's right edge (from ~76% of its width): keep the
	   centred copy clear of it (desktop row only — portrait has no chef) */
	.cards:not(.cards--single) .card--green .card-body {
		max-width: 52cqw;
	}

	/* Carousel dot indicators (portrait only). */
	.dots {
		position: absolute;
		left: 50%;
		bottom: 8.5%;
		transform: translateX(-50%);
		z-index: 2;
		display: flex;
		gap: 10px;
	}
	.dot {
		width: 9px;
		height: 9px;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.4);
		transition: background 0.2s ease;
	}
	.dot--on {
		background: #ffffff;
	}

	.press-label {
		position: absolute;
		left: 50%;
		/* 8888:28586: Nunito Bold 18 px, 0.03em, 18 px off the bottom of the 670-px stage */
		bottom: 2.7%;
		transform: translateX(-50%);
		margin: 0;
		white-space: nowrap;
		font-family: 'Nunito', sans-serif;
		font-weight: 700;
		font-size: clamp(13px, 2.7cqh, 26px);
		letter-spacing: 0.03em;
		color: #fff;
		text-shadow: 0 2px 5px rgba(0, 0, 0, 0.55);
		animation: blink 2.4s ease-in-out infinite;
	}

	/* Portrait: the 16:9 scene can't cover-scale without cropping the cards off, so let the background
	   cover the viewport and lay the three cards in a row that fits the width. Card text scales with
	   the (smaller) cards via their own container, bumped up here so it stays legible. */
	@media (max-aspect-ratio: 1 / 1) {
		.stage {
			top: 0;
			left: 0;
			transform: none;
			width: 100%;
			height: 100%;
			/* Portrait keeps the original mobile bg until the new mobile art is supplied. */
			background-image: var(--sbg-mobile);
			background-size: cover;
			background-position: center 22%;
		}
		/* Mobile: no character; the Press Play wordmark at the top and the logo OVER the card's top
		   edge (Figma 8259:3928 / logo 8878:2010: its art ~97% of the card frame's width, centre ~9% of
		   its height above the frame's top, tilted 2.03° clockwise). The card is --card-w wide at
		   283.154:384.895, centred at 46% (.cards), so this is pure CSS. */
		.stage {
			--card-w: min(66vw, 340px);
		}
		.man {
			display: none;
		}
		.logo {
			width: calc(var(--card-w) * 1.045);
			top: calc(46cqh - var(--card-w) * 384.895 / 283.154 / 2 - var(--card-w) * 1.045 / 3.97 * 0.59);
			/* its own property, so the drop / fly keyframes (transform) leave the tilt alone */
			rotate: 2.03deg;
			filter: drop-shadow(0 3px 8px rgba(0, 0, 0, 0.3));
			/* over the card (and its corner sauce), not behind it */
			z-index: 5;
		}
		/* Leaving: the card drops away and the dots / mark fade while the logo flies onto the board's
		   (logo-fly, measured in measureLogoFly — the same exit as desktop, minus the pan). */
		.exiting .cards--single .card {
			animation: card-out-down 0.6s cubic-bezier(0.55, 0, 0.9, 0.4) forwards;
		}
		/* …and straightens on the way: the board logo is level */
		.exiting.logo-fly .logo {
			animation-duration: 0.8s;
			rotate: 0deg;
			transition: rotate 0.7s cubic-bezier(0.6, 0, 0.3, 1) 0.1s;
		}
		.exiting .dots,
		.exiting .pp-mark {
			opacity: 0;
			transition: opacity 0.25s ease;
		}
		.pp-mark {
			display: block;
			position: absolute;
			left: 50%;
			top: 5.5%;
			transform: translateX(-50%);
			width: min(38%, 150px);
			height: auto;
			object-fit: contain;
			filter: drop-shadow(0 2px 6px rgba(0, 0, 0, 0.3));
		}
		.cards {
			left: 50%;
			top: 46%;
			transform: translate(-50%, -50%);
			width: 98%;
			height: auto;
			gap: 4%;
		}
		.card {
			height: auto;
			flex: 1 1 0;
			min-width: 0;
		}
		/* One card at a time on mobile: a single, larger centred card. */
		.cards--single {
			width: auto;
			/* the carousel's outgoing + incoming slots overlap in one cell while they slide */
			display: grid;
		}
		.card-slot {
			grid-area: 1 / 1;
		}
		.card-slot--swap .card {
			animation: none;
		}
		/* the logo's drop lands ON the card (logo-in hits 43% into its 1.4s, after a 1.75s delay):
		   the first card takes the blow — knocked down a touch, squashed, springs back */
		.card-slot:not(.card-slot--swap) {
			transform-origin: 50% 100%;
			animation: card-hit 0.55s ease-out calc(1.75s + 0.43 * 1.4s) both;
		}
		.cards--single .card {
			flex: 0 0 auto;
			width: var(--card-w);
		}
		.man {
			height: 30%;
			left: -7%;
		}
		.press-label {
			bottom: 3%;
			font-size: clamp(12px, 4.2vw, 20px);
		}
	}

	/* Offsets are in stage container units (cqw/cqh of `.stage`), so every start point is fully
	   off-screen at any viewport size. */
	@keyframes card-in-left {
		from {
			transform: translateX(-90cqw);
		}
		to {
			transform: translateX(0);
		}
	}
	@keyframes card-in-right {
		from {
			transform: translateX(90cqw);
		}
		to {
			transform: translateX(0);
		}
	}
	@keyframes card-in-bottom {
		from {
			transform: translateY(110cqh);
		}
		to {
			transform: translateY(0);
		}
	}
	/* Drop from above the stage, HIT, squash wide + flat, spring back, settle. */
	@keyframes logo-in {
		0% {
			transform: translate(-50%, -70cqh);
			animation-timing-function: cubic-bezier(0.55, 0, 1, 0.45); /* falling: accelerate */
		}
		43% {
			transform: translate(-50%, 0) scale(1);
			animation-timing-function: cubic-bezier(0, 0.55, 0.45, 1);
		}
		53% {
			transform: translate(-50%, 0) scale(1.14, 0.8);
		}
		68% {
			transform: translate(-50%, 0) scale(0.95, 1.07);
		}
		84% {
			transform: translate(-50%, 0) scale(1.02, 0.98);
		}
		100% {
			transform: translate(-50%, 0) scale(1);
		}
	}
	/* Rest → board logo: a slight lift as it sets off, a small overshoot in size, then settle. The
	   drop-shadow fades since the pixi logo has none. */
	@keyframes logo-fly {
		0% {
			transform: translate(-50%, 0) scale(1);
			filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.35));
		}
		18% {
			transform: translate(-50%, -1.5cqh) scale(1.04);
		}
		85% {
			transform: translate(calc(-50% + var(--fly-x)), var(--fly-y)) scale(calc(var(--fly-k) * 1.04));
		}
		100% {
			transform: translate(calc(-50% + var(--fly-x)), var(--fly-y)) scale(var(--fly-k));
			filter: drop-shadow(0 0 0 rgba(0, 0, 0, 0));
		}
	}
	@keyframes logo-out {
		from {
			transform: translate(-50%, 0);
		}
		to {
			transform: translate(-50%, -80cqh);
		}
	}
	@keyframes man-in {
		from {
			translate: 120% 0;
		}
		to {
			translate: 0 0;
		}
	}
	@keyframes man-out {
		from {
			translate: 0 0;
		}
		to {
			translate: 130% 0;
		}
	}
	/* Far enough that the RIGHT card (≈ the stage's right third) also clears the left edge. */
	@keyframes card-out-left {
		to {
			transform: translateX(-120cqw);
		}
	}

	@keyframes card-hit {
		0% {
			translate: 0 0;
			scale: 1;
		}
		22% {
			translate: 0 1.6cqh;
			scale: 1.025 0.965;
		}
		55% {
			translate: 0 -0.4cqh;
			scale: 0.992 1.01;
		}
		100% {
			translate: 0 0;
			scale: 1;
		}
	}
	@keyframes card-out-down {
		to {
			transform: translateY(110cqh);
		}
	}

	/* A tendril slowly lengthens (and thins a touch, like sauce does), then eases back. */
	@keyframes sauce-sag {
		from {
			transform: scaleY(1);
		}
		to {
			transform: scaleY(1.02);
		}
	}
	@keyframes eyes-look {
		0%,
		38%,
		78%,
		100% {
			transform: translate(0, 0);
		}
		41%,
		56% {
			transform: translate(-13%, 5%);
		}
		59%,
		75% {
			transform: translate(11%, -3%);
		}
	}
	@keyframes eyes-blink {
		0%,
		90%,
		100% {
			transform: translateY(-101%);
		}
		92.5% {
			transform: translateY(0);
		}
		95% {
			transform: translateY(-101%);
		}
	}
	/* the arm swings from the strap seam now, ~1.4x farther from the bottle than the old wrist pivot:
	   angles x0.72 keep the bottle's travel */
	@keyframes bottle-shake {
		0%,
		48%,
		66%,
		100% {
			transform: rotate(0deg);
		}
		51% {
			transform: rotate(-2.3deg);
		}
		54% {
			transform: rotate(1.9deg);
		}
		57% {
			transform: rotate(-1.45deg);
		}
		60% {
			transform: rotate(0.85deg);
		}
		63% {
			transform: rotate(-0.35deg);
		}
	}
	@keyframes chef-breathe {
		from {
			scale: 1 1;
		}
		to {
			scale: 1.008 1.018;
		}
	}

	@keyframes blink {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.55;
		}
	}
</style>
