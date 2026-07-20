<script lang="ts" module>
	import type { WinLevelData } from '../game/winLevelMap';

	export type EmitterEventFreeSpinOutro =
		| { type: 'freeSpinOutroShow' }
		| { type: 'freeSpinOutroHide' }
		| { type: 'freeSpinOutroCountUp'; amount: number; winLevelData: WinLevelData };
</script>

<script lang="ts">
	import { AnimatedSprite, Container, Graphics, Sprite, Text, type LoadedSpriteSheet } from 'pixi-svelte';
	import { Tween } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';
	import { FadeContainer, WinCountUpProvider } from 'components-pixi';
	import { bookEventAmountToCurrencyString } from 'utils-shared/amount';
	import { waitForResolve } from 'utils-shared/wait';
	import { CanvasSizeRectangle, MainContainer } from 'components-layout';
	import { OnMount } from 'components-shared';

	import { getContext } from '../game/context';
	import { i18nDerived } from '../i18n/i18nDerived';
	import LightningStorm from './LightningStorm.svelte';
	import PressToContinue from './PressToContinue.svelte';

	const context = getContext();
	// Animated medallion (lightning flipbook; falls back to the static sprite until loaded).
	const magnetFrames = $derived(
		(context.stateApp.loadedAssets?.popupMagnetAnim ?? []) as LoadedSpriteSheet,
	);

	// Hidden until freeSpinOutroShow — starting true meant the slide-in $effect never
	// fired on the session's FIRST outro (show never changed), so the panel just popped.
	let show = $state(false);
	let amount = $state(0);
	let winLevelData = $state<WinLevelData>();
	let oncomplete = $state(() => {});

	context.eventEmitter.subscribeOnMount({
		freeSpinOutroShow: () => (show = true),
		freeSpinOutroHide: async () => (show = false),
		freeSpinOutroCountUp: async (emitterEvent) => {
			amount = emitterEvent.amount;
			winLevelData = emitterEvent.winLevelData;
			await waitForResolve((resolve) => (oncomplete = resolve));
		},
	});

	// Same blue tech popup as FreeSpinIntro (panel, lightning, typography) — the outro simply swaps
	// the free-spins count for the counted-up win amount.
	const main = $derived(context.stateLayoutDerived.mainLayout());
	const PW = $derived(Math.min(main.width, main.height) * 0.5);
	const PH = $derived(PW * 1.05);

	// Amount frame reuses the capsule/HUD panel border — wider than the intro's spin-count box so
	// long currency strings fit.
	const amountBoxW = $derived(PW * 0.52);
	const amountBoxH = $derived(amountBoxW * (98 / 200) * 0.72);
	const magnetW = $derived(PW * 0.34);

	// ── Entry animation (mirrors the intro): panel + content slide UP from below while the
	//    CONGRATULATIONS heading drops in from the top. ──
	const slideUp = new Tween(0, { duration: 700, easing: cubicOut });
	const slideDown = new Tween(0, { duration: 700, easing: cubicOut });
	$effect(() => {
		if (!show) return;
		slideUp.set(main.height * 0.75, { duration: 0 });
		slideDown.set(-main.height * 0.6, { duration: 0 });
		slideUp.set(0, { duration: 700, easing: cubicOut });
		slideDown.set(0, { duration: 700, easing: cubicOut });
	});

	// ── Live animation clock (border arcs, heading glow/zoom, amount pulse, press-hint pulse). ──
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
	const runT = $derived((animT / 1.3) % 1);
	const amountScale = $derived(1 + 0.06 * Math.sin(animT * 5.2));
	const amountAlpha = $derived(0.86 + 0.14 * Math.sin(animT * 9.3));
	const pressAlpha = $derived(0.75 + 0.25 * Math.sin(animT * 3.2));
	const glowPulse = $derived(0.25 + 0.9 * (0.5 + 0.5 * Math.sin(animT * 9.4) * Math.sin(animT * 3.7)) + 0.2 * Math.sin(animT * 47));
	const congratsScale = $derived(1 + 0.1 * Math.sin(animT * 3.4));
	// Point along the half-perimeter border path (top-mid -> corner -> side -> bottom-mid); dir = ±1.
	const runnerPoint = (t: number, dir: number, W2: number, H2: number) => {
		const total = W2 + 2 * H2 + W2;
		const d = t * total;
		if (d < W2) return { x: dir * d, y: -H2 };
		if (d < W2 + 2 * H2) return { x: dir * W2, y: -H2 + (d - W2) };
		return { x: dir * (W2 - (d - W2 - 2 * H2)), y: H2 };
	};
	// Electric-cyan glow behind the crisp CONGRATULATIONS. Built from offset copies of the text
	// (a manual bloom) rather than a pixi `dropShadow` filter — that filter renders as a large dark
	// quad over the panel on some GPUs/drivers, which is the "black shadow on top of the popup".
	const congratsGlowStyle = (fontSize: number) => ({
		fontFamily: 'Cinzel',
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

	const congratsStyle = (fontSize: number) => ({
		fontFamily: 'Cinzel',
		fontWeight: '700' as const,
		fontSize,
		fill: 0xffffff,
		letterSpacing: fontSize * 0.03,
		align: 'center' as const,
	});
	const blueStyle = (fontSize: number) => ({
		fontFamily: 'Inter',
		fontWeight: '700' as const,
		fontSize,
		fill: 0x4c9be0,
		letterSpacing: fontSize * 0.18,
		align: 'center' as const,
	});
	const amountStyle = (fontSize: number) => ({
		fontFamily: 'Inter',
		fontWeight: '700' as const,
		fontSize,
		fill: 0xffffff,
		align: 'center' as const,
	});
	// Figma: white Cinzel bold, modest tracking; black outline so it stays readable on any bg.
	const pressStyle = (fontSize: number) => ({
		fontFamily: 'Cinzel',
		fontWeight: '900' as const,
		fontSize,
		fill: 0xffffff,
		letterSpacing: fontSize * 0.04,
		align: 'center' as const,
		stroke: { color: 0x000000, width: Math.max(2, Math.round(fontSize * 0.12)) },
	});
</script>

<FadeContainer {show}>
	{#if winLevelData}
		{@const duration = winLevelData.presentDuration}
		<WinCountUpProvider {amount} {duration} oncomplete={() => {}}>
			{#snippet children({ countUpAmount, startCountUp, finishCountUp, countUpCompleted })}
				<OnMount onmount={() => startCountUp()} />

				<CanvasSizeRectangle backgroundColor={0x000000} backgroundAlpha={0.6} />

				<MainContainer>
					<Container x={main.width / 2} y={main.height / 2}>
						<!-- Random lightning storm behind the panel (same as the intro) -->
						<LightningStorm active={show} panelWidth={PW} screenHeight={main.height} count={18} />

						<!-- Everything except CONGRATULATIONS slides UP from below the screen -->
						<Container y={slideUp.current}>
							<!-- Opaque backing: the panel art is semi-transparent, so without this the additive
							     bolts shine THROUGH the dialog instead of staying behind it. Kept inside the
							     frame's inner edge so it never pokes out as a dark rectangle beyond the border. -->
							<Graphics
								draw={(g) => {
									g.clear();
									g.rect(-PW * 0.435, -PH * 0.44, PW * 0.87, PH * 0.88);
									g.fill(0x08122b);
								}}
							/>

							<!-- Dark-blue tech panel -->
							<Sprite key="fsPanel" anchor={0.5} width={PW} height={PH} />

							<!-- Border electricity: crawling jagged arcs (re-jittered every frame), glow + core,
							     with random offshoot branches. Two pairs, top-middle -> around -> bottom-middle. -->
							<Graphics
								blendMode="add"
								draw={(g) => {
									g.clear();
									const W2 = PW * 0.485;
									const H2 = PH * 0.485;
									const SEG = 0.11;
									const N = 14;
									for (const off of [0, 0.5]) {
										const tt = (runT + off) % 1;
										for (const dir of [-1, 1]) {
											const pts: { x: number; y: number }[] = [];
											for (let i = 0; i <= N; i++) {
												const tp = tt - (i / N) * SEG;
												if (tp < 0) break;
												const p = runnerPoint(tp, dir, W2, H2);
												const env = i === 0 ? 0.25 : 0.5 + 0.8 * (i / N);
												const amp = PH * 0.011 * env;
												pts.push({
													x: p.x + (Math.random() - 0.5) * 2 * amp,
													y: p.y + (Math.random() - 0.5) * 2 * amp,
												});
											}
											if (pts.length < 2) continue;
											g.moveTo(pts[0].x, pts[0].y);
											for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
											g.stroke({ width: PH * 0.016, color: 0x2fa8ff, alpha: 0.4, cap: 'round', join: 'round' });
											g.moveTo(pts[0].x, pts[0].y);
											for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
											g.stroke({ width: PH * 0.005, color: 0xeffaff, alpha: 0.95, cap: 'round', join: 'round' });
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
											const head = pts[0];
											g.circle(head.x, head.y, PH * 0.011 * (0.8 + 0.4 * Math.random()));
											g.fill({ color: 0xffffff, alpha: 0.95 });
										}
									}
								}}
							/>

							<!-- YOU WON -->
							<Text anchor={0.5} y={-PH * 0.27} text={i18nDerived.translate('YOU WON')} style={blueStyle(PH * 0.04)} />

							<!-- Full magnet element (magnet + energy) — animated lightning flipbook -->
							<Container y={-PH * 0.06}>
								{#if magnetFrames.length > 0}
									<AnimatedSprite
										textures={magnetFrames}
										anchor={0.5}
										width={magnetW * 1.28}
										height={magnetW * 1.28 * (425 / 465)}
										animationSpeed={0.16}
										loop={true}
										play={true}
									/>
								{:else}
									<Sprite
										key="popupMagnet"
										anchor={0.5}
										width={magnetW * 1.28}
										height={magnetW * 1.28 * (103 / 114)}
									/>
								{/if}
							</Container>

							<!-- Win amount counting up in its frame — pulses/flickers to draw the eye -->
							<Container y={PH * 0.26}>
								<Sprite key="panelBorder" anchor={0.5} width={amountBoxW} height={amountBoxH} />
								<Container y={-amountBoxH * 0.04} scale={amountScale}>
									<Text
										anchor={0.5}
										alpha={amountAlpha}
										text={bookEventAmountToCurrencyString(countUpAmount)}
										style={amountStyle(amountBoxH * 0.42)}
									/>
								</Container>
							</Container>

							<!-- Press-anywhere-to-continue hint (below the card) with the arrow — breathing alpha -->
							<Container y={PH * 0.55} alpha={pressAlpha}>
								<Text
									anchor={0.5}
									x={-PW * 0.03}
									text={i18nDerived.translate('PRESS ANYWHERE')}
									style={pressStyle(PH * 0.034)}
								/>
								<Sprite
									key="pressArrow"
									anchor={0.5}
									x={PW * 0.32}
									width={PH * 0.038 * (18 / 15)}
									height={PH * 0.038}
								/>
							</Container>
						</Container>

						<!-- CONGRATULATIONS drops in from the TOP — glowing/zooming like the intro -->
						<Container y={slideDown.current}>
							<Container y={-PH * 0.36} scale={congratsScale}>
								{#each glowOffsets as o}
									<Text
										anchor={0.5}
										x={o.x * PH * 0.008 * o.r}
										y={o.y * PH * 0.008 * o.r}
										alpha={Math.min(1, Math.max(0, glowPulse)) * o.a}
										text={i18nDerived.translate('CONGRATULATIONS')}
										style={congratsGlowStyle(PH * 0.072)}
									/>
								{/each}
								<Text anchor={0.5} text={i18nDerived.translate('CONGRATULATIONS')} style={congratsStyle(PH * 0.072)} />
							</Container>
						</Container>
					</Container>
				</MainContainer>


				<PressToContinue onpress={() => (countUpCompleted ? oncomplete() : finishCountUp())} />
			{/snippet}
		</WinCountUpProvider>
	{/if}
</FadeContainer>
