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
	import { Sprite, Text } from 'pixi-svelte';

	import { getContext } from '../game/context';
	import PressToContinue from './PressToContinue.svelte';
	import FreeSpinAnimation from './FreeSpinAnimation.svelte';

	const context = getContext();
	const t = (key: string) => stateI18nDerived.translate(key);

	let show = $state(false);
	let freeSpinsFromEvent = $state(0);
	let oncomplete = $state(() => {});

	// Which bonus was played (superspin = ALL IN, freegame = DEAL IT) + its description from the buy
	// bonus screen. bonusMode is set before this intro shows (see freeSpinTrigger).
	const isAllIn = $derived(context.stateGame.bonusMode === 'superspin');
	const bonusName = $derived(isAllIn ? 'ALL IN BONUS' : 'DEAL IT BONUS');
	const bonusDesc = $derived(
		isAllIn
			? '10 Free Spins with random expanding symbol and multiplier start at 2x and doubles on every connection.'
			: '10 Free Spins with random expanding symbol and a random multiplier up to 1024x.',
	);

	// Paragraph style for the bonus description (wrapped, lighter than the Cinzel headings).
	const descStyle = (fontSize: number) => ({
		fontFamily: 'Cinzel',
		fontWeight: '700' as const,
		fontSize,
		fill: 0xe9dcc0,
		align: 'center' as const,
		letterSpacing: fontSize * 0.02,
		wordWrap: true,
		wordWrapWidth: 1100 * 0.6,
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

	<FreeSpinAnimation xOffset={120}>
		{#snippet children(_)}
			{@const BW = 1100}

			<!-- Square wooden board centred on slot pivot -->
			<Sprite key="fsBoardBg" anchor={{ x: 0.5, y: 0.5 }} width={BW} height={BW} />

			<!-- CONGRATULATIONS! (gold) — live translatable text -->
			<Text
				anchor={{ x: 0.5, y: 0.5 }}
				text={t('FS CONGRATS')}
				style={textStyle(Math.round(BW * 0.042), 0xf1c14a)}
				y={Math.round(-BW * 0.318)}
			/>
			<!-- YOU WON (green) -->
			<Text
				anchor={{ x: 0.5, y: 0.5 }}
				text={t('FS YOU WON')}
				style={textStyle(Math.round(BW * 0.029), 0x7cc23f)}
				y={Math.round(-BW * 0.268)}
			/>
			<!-- Bonus name (gold) — which bonus was played -->
			<Text
				anchor={{ x: 0.5, y: 0.5 }}
				text={bonusName}
				style={textStyle(Math.round(BW * 0.028), 0xf1c14a)}
				y={Math.round(-BW * 0.226)}
			/>
			<!-- Bonus description (from the buy bonus screen) — wrapped, right under the bonus name -->
			<Text
				anchor={{ x: 0.5, y: 0.5 }}
				text={bonusDesc}
				style={descStyle(Math.round(BW * 0.023))}
				y={Math.round(-BW * 0.168)}
			/>

			<!-- Scatter medallion — shrunk to make room for the name + description -->
			<Sprite
				key="fsMedallion"
				anchor={{ x: 0.5, y: 0.5 }}
				width={Math.round(BW * 0.15)}
				height={Math.round(BW * 0.15 * (273 / 300))}
				y={Math.round(-BW * 0.035)}
			/>

			<!-- Number frame (no baked-in number) -->
			<Sprite
				key="bonusBuyButtonFrame"
				anchor={{ x: 0.5, y: 0.5 }}
				width={Math.round(BW * 0.32)}
				height={Math.round(BW * 0.32 * (1084 / 3065))}
				y={Math.round(BW * 0.135)}
			/>
			<Text
				anchor={{ x: 0.5, y: 0.5 }}
				text={freeSpinsFromEvent}
				style={textStyle(Math.round(BW * 0.07), 0xf1c14a)}
				y={Math.round(BW * 0.13)}
			/>

			<!-- FREE SPINS (green) — live translatable text -->
			<Text
				anchor={{ x: 0.5, y: 0.5 }}
				text={t('FS FREE SPINS')}
				style={textStyle(Math.round(BW * 0.044), 0x7cc23f)}
				y={Math.round(BW * 0.275)}
			/>
		{/snippet}
	</FreeSpinAnimation>

	<PressToContinue onpress={() => oncomplete()} />
</FadeContainer>
