<script lang="ts" module>
	export type EmitterEventFreeSpinIntro =
		| { type: 'freeSpinIntroShow' }
		| { type: 'freeSpinIntroHide' }
		| { type: 'freeSpinIntroUpdate'; totalFreeSpins: number };
</script>

<script lang="ts">
	import { CanvasSizeRectangle } from 'components-layout';
	import { stateI18nDerived } from 'state-shared';
	import { FadeContainer } from 'components-pixi';
	import { waitForResolve } from 'utils-shared/wait';
	import { AnimatedSprite, Container, Sprite, Text } from 'pixi-svelte';
	import type { Texture } from 'pixi-svelte';
	import { Tween } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';

	import { getContext } from '../game/context';
	import PressToContinue from './PressToContinue.svelte';
	import PressAnywhereText from './PressAnywhereText.svelte';
	import FreeSpinAnimation from './FreeSpinAnimation.svelte';
	import CurvedCinzelText from './CurvedCinzelText.svelte';

	const context = getContext();
	const t = (key: string) => stateI18nDerived.translate(key);
	const layoutType = $derived(context.stateLayoutDerived.layoutType());
	const isPortrait = $derived(layoutType === 'portrait');
	// Everything except mobile landscape draws the press line BELOW the board (in the glow ledge),
	// like portrait — the wooden panel is fully opaque planks with the spine leaf-frame overlaying
	// the bottom band, so any in-panel press line reads as sitting "on the background". Only mobile
	// landscape keeps the in-panel copy (below-board placement collides with its side rails).
	const isLandscape = $derived(layoutType === 'landscape');
	// Animated scatter medallion (seamless loop; falls back to the static sprite until loaded).
	const medallionFrames = $derived(
		(context.stateApp.loadedAssets?.fsMedallionAnim ?? []) as Texture[],
	);

	// Per-element layout (fractions of BW): y = offset from board centre, f = font size,
	// w = number-frame width. Portrait enlarges every line and spreads them further apart —
	// the medallion is hidden there, so the freed middle absorbs the extra gaps while the
	// outermost lines stay inside the wooden interior (≈ ±0.44).
	const L = $derived(
		isPortrait
			? {
					congratsY: -0.36, congratsF: 0.056,
					wonY: -0.28, wonF: 0.04,
					nameY: -0.20, nameF: 0.032,
					descY: -0.12, descF: 0.023,
					medY: 0.02, medW: 0.16,
					frameY: 0.20, frameW: 0.42,
					numY: 0.112, numF: 0.092,
					fsY: 0.37, fsF: 0.051,
				}
			: {
					congratsY: -0.35, congratsF: 0.05,
					wonY: -0.27, wonF: 0.034,
					nameY: -0.20, nameF: 0.028,
					descY: -0.14, descF: 0.023,
					medY: 0.01, medW: 0.20,
					frameY: 0.20, frameW: 0.36,
					numY: 0.13, numF: 0.078,
					fsY: 0.35, fsF: 0.044,
				},
	);

	let show = $state(false);
	let freeSpinsFromEvent = $state(0);
	let oncomplete = $state(() => {});

	// Which bonus was played (superspin = ALL IN, freegame = DEAL IT) + its description from the buy
	// bonus screen. bonusMode is set before this intro shows (see freeSpinTrigger).
	const isAllIn = $derived(context.stateGame.bonusMode === 'superspin');
	// Route the heading + description through i18n. These reuse the existing localized keys
	// (INFO *  TITLE = "<feature> BONUS"; CARD * DESC = the same blurb as the buy-bonus cards)
	// so the feature name matches everywhere and English output is unchanged.
	const bonusName = $derived(t(isAllIn ? 'INFO ALL IN TITLE' : 'INFO DEAL IT TITLE'));
	const bonusDesc = $derived(t(isAllIn ? 'CARD ALLIN DESC' : 'CARD DEALIT DESC'));

	// Paragraph style for the bonus description (wrapped, lighter than the Cinzel headings).
	const descStyle = (fontSize: number) => ({
		fontFamily: 'Cinzel',
		fontWeight: '700' as const,
		fontSize,
		fill: 0xe9dcc0,
		align: 'center' as const,
		letterSpacing: fontSize * 0.02,
		wordWrap: true,
		wordWrapWidth: 1100 * (isPortrait ? 0.56 : 0.6),
		lineHeight: fontSize * 1.34,
	});

	// Live (translatable) text styled per Figma: Cinzel 900, soft drop shadow (offset/blur 2.78 @ 25%
	// alpha, straight down) and letter-spacing 0.72 — all kept proportional to the font size.
	const textStyle = (fontSize: number, fill: number) => ({
		fontFamily: 'Cinzel',
		fontWeight: '900' as const,
		fontSize,
		fill,
		align: 'center' as const,
		letterSpacing: fontSize * 0.03,
		dropShadow: {
			color: 0x000000,
			alpha: 0.25,
			angle: Math.PI / 2,
			blur: fontSize * 0.116,
			distance: fontSize * 0.116,
		},
	});

	// ── Entry choreography: CONGRATULATIONS drops in from the TOP while the rest of the layout
	//    rises from the BOTTOM. slideIn goes 0 -> 1 each time the popup shows. ──
	const slideIn = new Tween(0, { duration: 750, easing: cubicOut });
	$effect(() => {
		if (show) {
			slideIn.set(0, { duration: 0 });
			slideIn.set(1, { duration: 750, easing: cubicOut });
		}
	});

	// ── Live clock for the flicker + pulses, running only while the popup is up. ──
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
	// CONGRATULATIONS pulses once it has settled inside. (The 10 counter no longer pulses.)
	const congratsPulse = $derived(
		slideIn.current >= 0.99 ? 1 + 0.035 * Math.sin(animT * 3.7) : 1,
	);

	context.eventEmitter.subscribeOnMount({
		freeSpinIntroShow: () => (show = true),
		freeSpinIntroHide: () => (show = false),
		freeSpinIntroUpdate: async (emitterEvent) => {
			freeSpinsFromEvent = emitterEvent.totalFreeSpins;
			// Wait for a manual press/tap to continue — no auto-advance (design ask: the congrats
			// screen stays up until the player acknowledges it).
			await waitForResolve((resolve) => {
				oncomplete = resolve;
			});
		},
	});
</script>

<FadeContainer {show}>
	<CanvasSizeRectangle backgroundColor={0x000000} backgroundAlpha={0.5} />

	<FreeSpinAnimation xOffset={120} portraitScale={1.04}>
		{#snippet children(_)}
			{@const BW = 1100}
			{@const fromBottom = (1 - slideIn.current) * BW * 0.55}
			{@const fromTop = (1 - slideIn.current) * -BW * 0.7}

			<!-- Whole popup nudged up so the "press anywhere" line clears the bottom HUD. -->
			<Container y={-Math.round(BW * 0.06)}>
			<!-- Everything except CONGRATULATIONS rises from the bottom -->
			<Container y={fromBottom}>
			<!-- Square wooden board centred on slot pivot. Sized a touch larger than the BW layout
			     reference so the (enlarged) heading, panel and medallion sit inside with margin. -->
			<Sprite key="fsBoardBg" anchor={{ x: 0.5, y: 0.5 }} width={Math.round(BW * 1.12)} height={Math.round(BW * 1.12)} />

			<!-- YOU WON (green) -->
			<Text
				anchor={{ x: 0.5, y: 0.5 }}
				text={t('FS YOU WON')}
				style={textStyle(Math.round(BW * L.wonF), 0x7cc23f)}
				y={Math.round(BW * L.wonY)}
			/>
			<!-- Bonus name (gold) — which bonus was played -->
			<Text
				anchor={{ x: 0.5, y: 0.5 }}
				text={bonusName}
				style={textStyle(Math.round(BW * L.nameF), 0xf1c14a)}
				y={Math.round(BW * L.nameY)}
			/>
			<!-- Bonus description (from the buy bonus screen) — wrapped, right under the bonus name -->
			<Text
				anchor={{ x: 0.5, y: 0.5 }}
				text={bonusDesc}
				style={descStyle(Math.round(BW * L.descF))}
				y={Math.round(BW * L.descY)}
			/>

			<!-- Scatter medallion (animated) — gentle breathing zoom, same feel as the outro medallion.
			     Sits in the gap between the description and the counter. Shown in every layout; its
			     size/position per-layout comes from L.medW / L.medY. -->
			<Container y={Math.round(BW * L.medY)} scale={1 + 0.06 * Math.sin(animT * 2.6)}>
				{#if medallionFrames.length > 0}
					<AnimatedSprite
						textures={medallionFrames}
						anchor={0.5}
						width={Math.round(BW * L.medW)}
						height={Math.round(BW * L.medW * (443 / 485))}
						animationSpeed={0.3}
						loop={true}
						play={true}
					/>
				{:else}
					<Sprite
						key="fsMedallion"
						anchor={{ x: 0.5, y: 0.5 }}
						width={Math.round(BW * L.medW)}
						height={Math.round(BW * L.medW * (273 / 300))}
					/>
				{/if}
			</Container>

			<!-- Number frame (no baked-in number) -->
			<Sprite
				key="bonusBuyButtonFrame"
				anchor={{ x: 0.5, y: 0.5 }}
				width={Math.round(BW * L.frameW)}
				height={Math.round(BW * L.frameW * (1084 / 3065))}
				y={Math.round(BW * L.frameY)}
			/>
			<!-- Number sits at the green box's visual centre (the box sits ~5% of its height above the
			     sprite centre; leaves extend below). No pulse — it stays static and centred. -->
			<Container y={Math.round(BW * L.frameY - BW * L.frameW * (1084 / 3065) * 0.05)}>
				<Text
					anchor={{ x: 0.5, y: 0.5 }}
					text={freeSpinsFromEvent}
					style={textStyle(Math.round(BW * L.numF), 0xf1c14a)}
				/>
			</Container>

			<!-- FREE SPINS (green) — live translatable text -->
			<Text
				anchor={{ x: 0.5, y: 0.5 }}
				text={t('FS FREE SPINS')}
				style={textStyle(Math.round(BW * L.fsF), 0x7cc23f)}
				y={Math.round(BW * L.fsY)}
			/>
			{#if isLandscape}
				<!-- Mobile landscape only: press text in PANEL space so it tracks the board and clears
				     the side rails. All other layouts draw it BELOW the board instead (see
				     PressToContinue), so it sits in the glow ledge rather than over the wooden planks. -->
				<PressAnywhereText y={Math.round(BW * 0.45)} fontSize={Math.round(BW * 0.032)} />
			{/if}
			</Container>

			<!-- CONGRATULATIONS! (gold) drops in from the top, then pulses in place — on a gentle arc. -->
			<Container y={fromTop}>
				<Container y={Math.round(BW * L.congratsY)} scale={congratsPulse}>
					<CurvedCinzelText
						text={t('FS CONGRATS')}
						radius={BW * 1.1}
						gap={Math.round(BW * L.congratsF) * 0.03}
						style={textStyle(Math.round(BW * L.congratsF), 0xf1c14a)}
					/>
				</Container>
			</Container>

			</Container>
		{/snippet}
	</FreeSpinAnimation>

	<!-- Every layout except mobile landscape draws the canvas-anchored press text below the board
	     (in the glow ledge); landscape draws it in panel space (above) to clear its side rails. -->
	<PressToContinue onpress={() => oncomplete()} showText={!isLandscape} />
</FadeContainer>
