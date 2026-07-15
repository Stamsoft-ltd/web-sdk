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
	import { Container, Sprite, Text } from 'pixi-svelte';
	import { Tween } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';

	import { getContext } from '../game/context';
	import PressToContinue from './PressToContinue.svelte';
	import PressAnywhereText from './PressAnywhereText.svelte';
	import FreeSpinAnimation from './FreeSpinAnimation.svelte';

	const context = getContext();
	const t = (key: string) => stateI18nDerived.translate(key);
	const isPortrait = $derived(context.stateLayoutDerived.layoutType() === 'portrait');

	// Per-element layout (fractions of BW): y = offset from board centre, f = font size,
	// w = number-frame width. Portrait enlarges every line and spreads them further apart —
	// the medallion is hidden there, so the freed middle absorbs the extra gaps while the
	// outermost lines stay inside the wooden interior (≈ ±0.44).
	const L = $derived(
		isPortrait
			? {
					congratsY: -0.33, congratsF: 0.048,
					wonY: -0.275, wonF: 0.034,
					nameY: -0.225, nameF: 0.032,
					descY: -0.145, descF: 0.023,
					frameY: 0.12, frameW: 0.37,
					numY: 0.112, numF: 0.082,
					fsY: 0.30, fsF: 0.051,
				}
			: {
					congratsY: -0.318, congratsF: 0.042,
					wonY: -0.268, wonF: 0.029,
					nameY: -0.226, nameF: 0.028,
					descY: -0.168, descF: 0.023,
					frameY: 0.135, frameW: 0.32,
					numY: 0.13, numF: 0.07,
					fsY: 0.275, fsF: 0.044,
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
	// CONGRATULATIONS pulses once it has settled inside; the 10 counter pulses continuously.
	const congratsPulse = $derived(
		slideIn.current >= 0.99 ? 1 + 0.07 * Math.sin(animT * 3.7) : 1,
	);
	// Aggressive heartbeat on the count: fast double-beat (big swell + echo) instead of a soft sine.
	const numPulse = $derived.by(() => {
		const p = (animT * 1.4) % 1;
		const beat =
			Math.exp(-((p - 0.14) * (p - 0.14)) / 0.008) + 0.6 * Math.exp(-((p - 0.38) * (p - 0.38)) / 0.014);
		return 1 + 0.22 * beat;
	});

	context.eventEmitter.subscribeOnMount({
		freeSpinIntroShow: () => (show = true),
		freeSpinIntroHide: () => (show = false),
		freeSpinIntroUpdate: async (emitterEvent) => {
			freeSpinsFromEvent = emitterEvent.totalFreeSpins;
			await waitForResolve((resolve) => (oncomplete = resolve));
		},
	});
</script>

<FadeContainer {show}>
	<CanvasSizeRectangle backgroundColor={0x000000} backgroundAlpha={0.5} />

	<FreeSpinAnimation xOffset={120} portraitScale={1.3}>
		{#snippet children(_)}
			{@const BW = 1100}
			{@const fromBottom = (1 - slideIn.current) * BW * 0.55}
			{@const fromTop = (1 - slideIn.current) * -BW * 0.7}

			<Container>
			<!-- Everything except CONGRATULATIONS rises from the bottom -->
			<Container y={fromBottom}>
			<!-- Square wooden board centred on slot pivot -->
			<Sprite key="fsBoardBg" anchor={{ x: 0.5, y: 0.5 }} width={BW} height={BW} />

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

			<!-- Scatter medallion — shrunk to make room for the name + description.
			     Hidden in portrait (per request) so the text reads bigger/clearer. -->
			{#if !isPortrait}
				<!-- Gentle breathing zoom, same feel as the outro medallion. -->
				<Container y={Math.round(-BW * 0.035)} scale={1 + 0.06 * Math.sin(animT * 2.6)}>
					<Sprite
						key="fsMedallion"
						anchor={{ x: 0.5, y: 0.5 }}
						width={Math.round(BW * 0.15)}
						height={Math.round(BW * 0.15 * (273 / 300))}
					/>
				</Container>
			{/if}

			<!-- Number frame (no baked-in number) -->
			<Sprite
				key="bonusBuyButtonFrame"
				anchor={{ x: 0.5, y: 0.5 }}
				width={Math.round(BW * L.frameW)}
				height={Math.round(BW * L.frameW * (1084 / 3065))}
				y={Math.round(BW * L.frameY)}
			/>
			<Container y={Math.round(BW * L.numY)} scale={numPulse}>
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
			</Container>

			<!-- CONGRATULATIONS! (gold) drops in from the top, then pulses in place -->
			<Container y={fromTop}>
				<Container y={Math.round(BW * L.congratsY)} scale={congratsPulse}>
					<Text
						anchor={{ x: 0.5, y: 0.5 }}
						text={t('FS CONGRATS')}
						style={textStyle(Math.round(BW * L.congratsF), 0xf1c14a)}
					/>
				</Container>
			</Container>

			<!-- Anchored to the board so it always sits just below its bottom edge, clear of
			     the leaves and the HTML HUD regardless of window shape. -->
			{#if !isPortrait}
				<PressAnywhereText y={Math.round(BW * 0.465)} fontSize={Math.round(BW * 0.042)} />
			{/if}
			</Container>
		{/snippet}
	</FreeSpinAnimation>

	<PressToContinue showText={isPortrait} onpress={() => oncomplete()} />
</FadeContainer>
