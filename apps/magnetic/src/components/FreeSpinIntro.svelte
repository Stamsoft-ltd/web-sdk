<script lang="ts" module>
	export type EmitterEventFreeSpinIntro =
		| { type: 'freeSpinIntroShow' }
		| { type: 'freeSpinIntroHide' }
		| { type: 'freeSpinIntroUpdate'; totalFreeSpins: number };
</script>

<script lang="ts">
	import { CanvasSizeRectangle, MainContainer, OnPressFullScreen } from 'components-layout';
	import { OnHotkey } from 'components-shared';
	import { FadeContainer } from 'components-pixi';
	import { waitForResolve } from 'utils-shared/wait';
	import { AnimatedSprite, Container, Graphics, Sprite, Text, type LoadedSpriteSheet } from 'pixi-svelte';
	import { Tween } from 'svelte/motion';
	import { cubicOut, backOut } from 'svelte/easing';

	import { getContext } from '../game/context';
	import { i18nDerived } from '../i18n/i18nDerived';
	import { ICON_STROKE_GRADIENT } from '../game/goldGradient';
	import LightningStorm from './LightningStorm.svelte';
	import SparkBurst from './SparkBurst.svelte';

	const context = getContext();
	// Animated medallion (lightning flipbook; falls back to the static sprite until loaded).
	const magnetFrames = $derived(
		(context.stateApp.loadedAssets?.popupMagnetAnim ?? []) as LoadedSpriteSheet,
	);

	let show = $state(false);
	let freeSpinsFromEvent = $state(0);
	let oncomplete = $state(() => {});

	context.eventEmitter.subscribeOnMount({
		freeSpinIntroShow: () => (show = true),
		freeSpinIntroHide: () => (show = false),
		freeSpinIntroUpdate: async (emitterEvent) => {
			freeSpinsFromEvent = emitterEvent.totalFreeSpins;
			await waitForResolve((resolve) => (oncomplete = resolve));
		},
	});

	// Popup sized to the screen (slightly portrait to fit the CONGRATULATIONS -> magnet -> FREE SPINS
	// vertical stack), centred on the stage.
	const main = $derived(context.stateLayoutDerived.mainLayout());
	const isPortrait = $derived(context.stateLayoutDerived.layoutType() === 'portrait');
	// Portrait has width to spare on both sides (the popup only used half the narrow dimension), so it
	// gets a larger share for a more readable CONGRATULATIONS / FREE SPINS stack. Landscape/desktop keep
	// the original 0.5 of the (smaller) height so the popup still clears the reels there.
	const PW = $derived(Math.min(main.width, main.height) * (isPortrait ? 0.68 : 0.5));
	const PH = $derived(PW * 1.05);

	// Which bonus was won + its blurb (same wording as the buy-bonus cards). bonusMode is set
	// before this intro shows: superspin = MAGNETIC MEGA CHAIN, freegame = DROP-O-MAGNET.
	const isMegaChain = $derived(context.stateGame.bonusMode === 'superspin');
	const bonusName = $derived(isMegaChain ? 'MAGNETIC MEGA CHAIN' : 'DROP-O-MAGNET');

	// Number-frame reuses the capsule/HUD panel border; box height drives the number size.
	const numBoxW = $derived(PW * 0.32);
	const numBoxH = $derived(numBoxW * (98 / 200));
	// Medallion centred VERTICALLY between the bonus-name text (bottom edge: centre −0.235·PH +
	// half the 0.046·PH font) and the free-spins frame's top edge (centre 0.27·PH − numBoxH/2).
	const magnetY = $derived(((-0.235 + 0.023) * PH + (0.27 * PH - numBoxH / 2)) / 2);
	const magnetW = $derived(PW * 0.34);

	// ── Entry animation: the panel + content slide UP from below the screen (settling with a slight
	//    overshoot) while the CONGRATULATIONS heading drops in from the top with a scale punch, a
	//    one-shot white flash and a spark burst sell the "landing". ──
	const slideUp = new Tween(0, { duration: 720, easing: backOut });
	const slideDown = new Tween(0, { duration: 720, easing: backOut });
	const popScale = new Tween(1, { duration: 760, easing: backOut }); // card grows into place
	const headingPop = new Tween(1, { duration: 820, easing: backOut }); // heading punch on arrival
	const flash = new Tween(0, { duration: 420, easing: cubicOut }); // entry brighten
	const countUp = new Tween(0, { duration: 650, easing: cubicOut }); // spin-count ticks up
	let burst = $state(false); // one-shot spark burst on entry
	$effect(() => {
		if (!show) {
			burst = false;
			return;
		}
		slideUp.set(main.height * 0.75, { duration: 0 });
		slideDown.set(-main.height * 0.6, { duration: 0 });
		popScale.set(0.9, { duration: 0 });
		headingPop.set(1.18, { duration: 0 });
		flash.set(0.55, { duration: 0 });
		slideUp.set(0);
		slideDown.set(0);
		popScale.set(1);
		headingPop.set(1);
		flash.set(0);
		burst = true;
	});

	// Spin count ticks up 0 -> N once the total arrives.
	$effect(() => {
		if (!show || freeSpinsFromEvent <= 0) return;
		countUp.set(0, { duration: 0 });
		countUp.set(freeSpinsFromEvent);
	});

	// ── Live animation clock (border runners, count pulse, press-hint pulse). ──
	let animT = $state(0);
	$effect(() => {
		if (!show) return;
		let raf = 0;
		const t0 = performance.now();
		const tick = (now: number) => {
			animT = (now - t0) / 1000;
			raf = requestAnimationFrame(tick);
		};
		raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
	});
	// Border runners: fast loop, top-middle -> (left/right) -> bottom-middle.
	const runT = $derived((animT / 1.3) % 1);
	// "10" pulses in scale + flickers slightly to draw the eye.
	const countScale = $derived(1 + 0.06 * Math.sin(animT * 5.2));
	const countAlpha = $derived(0.86 + 0.14 * Math.sin(animT * 9.3));
	// Press hint breathes so it reads as interactive.
	const pressAlpha = $derived(0.75 + 0.25 * Math.sin(animT * 3.2));
	// Medallion gently floats while the aura/rays sweep behind it.
	const magnetBob = $derived(Math.sin(animT * 1.5) * PH * 0.012);
	// CONGRATULATIONS is "electrified" with a pulsing cyan GLOW layer under the crisp text —
	// aggressive: deep fast surges with a high-frequency shimmer riding on top, and the whole
	// heading breathes ±10% in scale.
	const glowPulse = $derived(0.25 + 0.9 * (0.5 + 0.5 * Math.sin(animT * 9.4) * Math.sin(animT * 3.7)) + 0.2 * Math.sin(animT * 47));
	const congratsScale = $derived(1 + 0.1 * Math.sin(animT * 3.4));
	// Electric-cyan glow behind the crisp CONGRATULATIONS. Built from offset copies of the text
	// (a manual bloom) rather than a pixi `dropShadow` filter — that filter renders as a large dark
	// quad over the panel on some GPUs/drivers, which is the "black shadow on top of the popup".
	const congratsGlowStyle = (fontSize: number) => ({
		fontFamily: 'IBM Plex Sans Condensed',
		fontWeight: '700' as const,
		fontSize,
		fill: 0x8fd8ff,
		letterSpacing: fontSize * 0.03,
		align: 'center' as const,
	});
	// 8 directions × 2 rings → a soft halo without any filter.
	const glowOffsets = [
		{ x: 1, y: 0, r: 1, a: 0.85 }, { x: -1, y: 0, r: 1, a: 0.85 },
		{ x: 0, y: 1, r: 1, a: 0.85 }, { x: 0, y: -1, r: 1, a: 0.85 },
		{ x: 0.7, y: 0.7, r: 1, a: 0.7 }, { x: -0.7, y: 0.7, r: 1, a: 0.7 },
		{ x: 0.7, y: -0.7, r: 1, a: 0.7 }, { x: -0.7, y: -0.7, r: 1, a: 0.7 },
		{ x: 1, y: 0, r: 2, a: 0.4 }, { x: -1, y: 0, r: 2, a: 0.4 },
		{ x: 0, y: 1, r: 2, a: 0.4 }, { x: 0, y: -1, r: 2, a: 0.4 },
	];
	// Point along the half-perimeter path (top-mid -> corner -> side -> bottom-mid); dir = ±1.
	const runnerPoint = (t: number, dir: number, W2: number, H2: number) => {
		const total = W2 + 2 * H2 + W2;
		const d = t * total;
		if (d < W2) return { x: dir * d, y: -H2 };
		if (d < W2 + 2 * H2) return { x: dir * W2, y: -H2 + (d - W2) };
		return { x: dir * (W2 - (d - W2 - 2 * H2)), y: H2 };
	};

	const congratsStyle = (fontSize: number) => ({
		fontFamily: 'IBM Plex Sans Condensed',
		fontWeight: '700' as const,
		fontSize,
		fill: 0xffffff,
		letterSpacing: fontSize * 0.03,
		align: 'center' as const,
	});
	// Figma "YOU WON": IBM Plex Sans Condensed 700, letter-spacing 0.72px and a 0/2.78/2.78 black
	// 25% shadow at a 24px design size, filled with --Icon-stroke. Sizes here stay panel-relative
	// (fontSize is derived from PH), so the design's px values are applied as ratios of 24 —
	// hardcoding 24 would render tiny on desktop and oversized in portrait.
	const blueStyle = (fontSize: number) => ({
		fontFamily: 'IBM Plex Sans Condensed',
		fontWeight: '700' as const,
		fontSize,
		fill: ICON_STROKE_GRADIENT,
		letterSpacing: fontSize * 0.03,
		align: 'center' as const,
		dropShadow: {
			color: 0x000000,
			alpha: 0.25,
			angle: Math.PI / 2,
			distance: fontSize * 0.1158,
			blur: fontSize * 0.1158,
		},
	});
	const numberStyle = (fontSize: number) => ({
		fontFamily: 'Inter',
		fontWeight: '700' as const,
		fontSize,
		fill: 0xffffff,
		align: 'center' as const,
	});
	// Figma: white IBM Plex Sans Condensed bold, modest tracking; black outline so it stays readable on any bg.
	const pressStyle = (fontSize: number) => ({
		fontFamily: 'IBM Plex Sans Condensed',
		fontWeight: '900' as const,
		fontSize,
		fill: 0xffffff,
		letterSpacing: fontSize * 0.04,
		align: 'center' as const,
		stroke: { color: 0x000000, width: Math.max(2, Math.round(fontSize * 0.12)) },
	});
</script>

<FadeContainer {show}>
	<CanvasSizeRectangle backgroundColor={0x000000} backgroundAlpha={0.6} />

	<MainContainer>
		<Container x={main.width / 2} y={main.height / 2}>
			<!-- Lightning storm UNDER the card: full-height random strikes behind the panel. -->
			<LightningStorm active={show} panelWidth={PW} screenHeight={main.height} count={18} />

			<!-- Everything except CONGRATULATIONS slides UP from below the screen (and pops into place) -->
			<Container y={slideUp.current} scale={popScale.current}>
				<!-- Opaque backing: the panel art is semi-transparent, so without this the additive
				     bolts shine THROUGH the dialog instead of staying behind it. Kept inside the frame's
				     inner edge so it never pokes out as a dark rectangle beyond the panel border. -->
				<Graphics
					draw={(g) => {
						g.clear();
						g.rect(-PW * 0.435, -PH * 0.44, PW * 0.87, PH * 0.88);
						g.fill(0x08122b);
					}}
				/>

				<!-- Dark-blue tech panel — shown as-is (no interior fill overlay). -->
				<Sprite key="fsPanel" anchor={0.5} width={PW} height={PH} />

				<!-- Entry flash: a brief additive brighten across the panel face as the card lands. -->
				<Graphics
					blendMode="add"
					draw={(g) => {
						g.clear();
						if (flash.current <= 0.001) return;
						g.rect(-PW * 0.435, -PH * 0.44, PW * 0.87, PH * 0.88);
						g.fill({ color: 0xffffff, alpha: flash.current });
					}}
				/>

				<!-- Border electricity: crawling ARCS, not dots. Each runner is a jagged polyline that
				     hugs the border and re-jitters EVERY FRAME (that per-frame randomness is what makes
				     it shimmer like a live arc): a wide soft glow pass under a thin white-hot core, plus
				     random offshoot branches. Two pairs, top-middle -> around -> bottom-middle. -->
				<Graphics
					blendMode="add"
					draw={(g) => {
						g.clear();
						const W2 = PW * 0.485;
						const H2 = PH * 0.485;
						const SEG = 0.11; // trailing arc length (fraction of the half-perimeter)
						const N = 14;
						for (const off of [0, 0.5]) {
							const tt = (runT + off) % 1;
							for (const dir of [-1, 1]) {
								// jittered points from the head backwards along the border
								const pts: { x: number; y: number }[] = [];
								for (let i = 0; i <= N; i++) {
									const tp = tt - (i / N) * SEG;
									if (tp < 0) break;
									const p = runnerPoint(tp, dir, W2, H2);
									const env = i === 0 ? 0.25 : 0.5 + 0.8 * (i / N); // head stays on the rail
									const amp = PH * 0.011 * env;
									pts.push({
										x: p.x + (Math.random() - 0.5) * 2 * amp,
										y: p.y + (Math.random() - 0.5) * 2 * amp,
									});
								}
								if (pts.length < 2) continue;
								// soft glow pass
								g.moveTo(pts[0].x, pts[0].y);
								for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
								g.stroke({ width: PH * 0.016, color: 0x2fa8ff, alpha: 0.4, cap: 'round', join: 'round' });
								// white-hot core
								g.moveTo(pts[0].x, pts[0].y);
								for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
								g.stroke({ width: PH * 0.005, color: 0xeffaff, alpha: 0.95, cap: 'round', join: 'round' });
								// occasional offshoot branch forking away from the arc
								if (Math.random() < 0.45) {
									const b = pts[1 + Math.floor(Math.random() * (pts.length - 1))];
									const a1 = Math.random() * Math.PI * 2;
									const len = PH * (0.02 + Math.random() * 0.03);
									const mx = b.x + Math.cos(a1) * len * 0.6 + (Math.random() - 0.5) * PH * 0.01;
									const my = b.y + Math.sin(a1) * len * 0.6 + (Math.random() - 0.5) * PH * 0.01;
									g.moveTo(b.x, b.y);
									g.lineTo(mx, my);
									g.lineTo(b.x + Math.cos(a1) * len, b.y + Math.sin(a1) * len);
									g.stroke({ width: PH * 0.004, color: 0x9fdcff, alpha: 0.7, cap: 'round' });
								}
								// flickering head spark
								const head = pts[0];
								g.circle(head.x, head.y, PH * 0.011 * (0.8 + 0.4 * Math.random()));
								g.fill({ color: 0xffffff, alpha: 0.95 });
							}
						}
					}}
				/>

				<!-- YOU WON / bonus name + description -->
				<Text anchor={0.5} y={-PH * 0.3} text={i18nDerived.translate('YOU WON')} style={blueStyle(PH * 0.036)} />
				<Text anchor={0.5} y={-PH * 0.235} text={bonusName} style={congratsStyle(PH * 0.046)} />

				<!-- Full magnet element (magnet + base + blue/orange energy baked in), floating over a
				     rotating energy aura, with a one-shot spark burst on entry. -->
				<Container y={magnetY}>
					<Container y={magnetBob}>
						{#if magnetFrames.length > 0}
							<AnimatedSprite
								textures={magnetFrames}
								anchor={0.5}
								width={magnetW * 0.9}
								height={magnetW * 0.9 * (425 / 465)}
								animationSpeed={0.16}
								loop={true}
								play={true}
							/>
						{:else}
							<Sprite
								key="popupMagnet"
								anchor={0.5}
								width={magnetW * 0.9}
								height={magnetW * 0.9 * (103 / 114)}
							/>
						{/if}
					</Container>
					<SparkBurst active={burst} radius={magnetW * 1.2} />
				</Container>

				<!-- Free-spins count in its frame — the number pulses/flickers to draw attention -->
				<Container y={PH * 0.27}>
					<Sprite key="panelBorder" anchor={0.5} width={numBoxW} height={numBoxH} />
					<Container y={-numBoxH * 0.04} scale={countScale}>
						<Text
							anchor={0.5}
							alpha={countAlpha}
							text={`${Math.round(countUp.current)}`}
							style={numberStyle(numBoxH * 0.62)}
						/>
					</Container>
				</Container>

				<!-- FREE SPINS -->
				<Text anchor={0.5} y={PH * 0.395} text={i18nDerived.translate('FREE SPINS')} style={blueStyle(PH * 0.036)} />

				<!-- Press-anywhere-to-continue hint (below the card) with the arrow — breathing alpha.
				     The text is RIGHT-anchored to a seam and the arrow LEFT-anchored just after it, so a
				     fixed gap is kept no matter how long the translated string is (a fixed-x arrow used to
				     collide with the end of the text). -->
				<Container y={PH * 0.55} alpha={pressAlpha}>
					<Text
						anchor={{ x: 1, y: 0.5 }}
						x={PW * 0.285}
						text={i18nDerived.translate('PRESS ANYWHERE')}
						style={pressStyle(PH * (isPortrait ? 0.037 : 0.034))}
					/>
					<Sprite
						key="pressArrow"
						anchor={{ x: 0, y: 0.5 }}
						x={PW * 0.315}
						width={PH * 0.038 * (18 / 15)}
						height={PH * 0.038}
					/>
				</Container>
			</Container>

			<!-- CONGRATULATIONS drops in from the TOP, over the rising panel — a pulsing electric-blue
			     glow layer breathes under the crisp white text. -->
			<Container y={slideDown.current}>
				<Container y={-PH * 0.38} scale={congratsScale * headingPop.current}>
					{#each glowOffsets as o}
						<Text
							anchor={0.5}
							x={o.x * PH * 0.008 * o.r}
							y={o.y * PH * 0.008 * o.r}
							alpha={Math.min(1, Math.max(0, glowPulse)) * o.a}
							text={i18nDerived.translate('CONGRATULATIONS')}
							style={congratsGlowStyle(PH * 0.066)}
						/>
					{/each}
					<Text anchor={0.5} text={i18nDerived.translate('CONGRATULATIONS')} style={congratsStyle(PH * 0.066)} />
				</Container>
			</Container>
		</Container>
	</MainContainer>

	<OnHotkey hotkey="Space" onpress={() => oncomplete()} />
	<OnPressFullScreen onpress={() => oncomplete()} />
</FadeContainer>
