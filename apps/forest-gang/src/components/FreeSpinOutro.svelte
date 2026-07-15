<script lang="ts" module>
	import type { WinLevelData } from '../game/winLevelMap';

	export type EmitterEventFreeSpinOutro =
		| { type: 'freeSpinOutroShow' }
		| { type: 'freeSpinOutroHide' }
		| { type: 'freeSpinOutroCountUp'; amount: number; winLevelData: WinLevelData };
</script>

<script lang="ts">
	import { Container, Sprite, Text } from 'pixi-svelte';
	import { Tween } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';
	import { FadeContainer, WinCountUpProvider } from 'components-pixi';
	import { bookEventAmountToCurrencyString } from 'utils-shared/amount';
	import { waitForResolve } from 'utils-shared/wait';
	import { CanvasSizeRectangle } from 'components-layout';
	import { OnMount } from 'components-shared';
	import { stateI18nDerived } from 'state-shared';

	import { getContext } from '../game/context';
	import { WIN_GRADIENT } from '../game/goldGradient';
	import PressToContinue from './PressToContinue.svelte';
	import PressAnywhereText from './PressAnywhereText.svelte';
	import FreeSpinAnimation from './FreeSpinAnimation.svelte';

	const context = getContext();
	const t = (key: string) => stateI18nDerived.translate(key);
	const isPortrait = $derived(context.stateLayoutDerived.layoutType() === 'portrait');

	// Same Cinzel styling as the free-spins intro (Figma: Cinzel 900, soft drop shadow, proportional spacing).
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

	let show = $state(true);
	let amount = $state(0);
	let winLevelData = $state<WinLevelData>();
	let oncomplete = $state(() => {});
	let amountSizes = $state({ width: 0, height: 0 });

	// ── Entry choreography (same as the intro): CONGRATULATIONS drops from the TOP while the
	//    rest of the layout rises from the BOTTOM. ──
	const slideIn = new Tween(0, { duration: 750, easing: cubicOut });
	$effect(() => {
		if (show) {
			slideIn.set(0, { duration: 0 });
			slideIn.set(1, { duration: 750, easing: cubicOut });
		}
	});

	// Live clock for the pulses while the popup is up.
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
	const congratsPulse = $derived(slideIn.current >= 0.99 ? 1 + 0.07 * Math.sin(animT * 3.7) : 1);
	// Medallion zoom in/out breathe.
	const medallionPulse = $derived(1 + 0.06 * Math.sin(animT * 2.6));

	context.eventEmitter.subscribeOnMount({
		freeSpinOutroShow: () => (show = true),
		freeSpinOutroHide: async () => (show = false),
		freeSpinOutroCountUp: async (emitterEvent) => {
			amount = emitterEvent.amount;
			winLevelData = emitterEvent.winLevelData;
			await waitForResolve((resolve) => (oncomplete = resolve));
		},
	});
</script>

<FadeContainer {show}>
	{#if winLevelData}
		{@const duration = winLevelData.presentDuration}
		<WinCountUpProvider {amount} {duration} oncomplete={() => { context.eventEmitter.broadcast({ type: 'soundStop', name: 'sfx_win_coins_loop' }); context.eventEmitter.broadcast({ type: 'soundStop', name: 'bgm_win_animation' }); context.eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_win_count_end' }); }}>
			{#snippet children({ countUpAmount, startCountUp, finishCountUp, countUpCompleted })}
				<OnMount onmount={() => startCountUp()} />

				<CanvasSizeRectangle backgroundColor={0x000000} backgroundAlpha={0.5} />

				<FreeSpinAnimation portraitScale={1.3}>
					{#snippet children({ sizes })}
						<!-- Portrait: fixed BW (like the intro) so the board scales LINEARLY with the
						     portrait factor — deriving it from `sizes` (which already scales with the
						     factor) compounded to factor² and overflowed. Other layouts unchanged. -->
						{@const BW = isPortrait ? 1100 : sizes.width * 1.8}
						{@const fromBottom = (1 - slideIn.current) * BW * 0.55}
						{@const fromTop = (1 - slideIn.current) * -BW * 0.7}

						<Container y={fromBottom}>
						<Sprite key="fsBoardBg" anchor={{ x: 0.5, y: 0.5 }} width={BW} height={BW} />

						<!-- YOU WON (green) — live translatable Cinzel text -->
						<Text
							anchor={{ x: 0.5, y: 0.5 }}
							text={t('FS YOU WON')}
							style={textStyle(Math.round(BW * 0.031), 0x7cc23f)}
							y={Math.round(-BW * 0.238)}
						/>

						<!-- Scatter medallion — zooms in/out gently -->
						<Container y={Math.round(-BW * 0.051)} scale={medallionPulse}>
							<Sprite
								key="fsMedallion"
								anchor={{ x: 0.5, y: 0.5 }}
								width={Math.round(BW * 0.28)}
								height={Math.round(BW * 0.28 * (273 / 300))}
							/>
						</Container>

						<!-- Win amount — Cinzel 900 gold with black outline; scales down to fit the board width -->
						{@const winFont = Math.round(BW * 0.072)}
						{@const winMaxW = BW * 0.6}
						{@const winScale = amountSizes.width > winMaxW ? winMaxW / amountSizes.width : 1}
						<Container y={Math.round(BW * 0.22)} scale={winScale}>
							<Text
								anchor={0.5}
								onresize={(s) => (amountSizes = s)}
								text={bookEventAmountToCurrencyString(countUpAmount)}
								style={{
									fontFamily: 'Cinzel',
									fontWeight: '900',
									fontSize: winFont,
									fill: WIN_GRADIENT,
									align: 'center',
									letterSpacing: winFont * 0.03,
									stroke: { color: 0x000000, width: Math.max(1, Math.round(winFont * 0.023)) },
								}}
							/>
						</Container>
						</Container>

						<!-- CONGRATULATIONS! drops in from the top, then pulses in place -->
						<Container y={fromTop}>
							<Container y={Math.round(-BW * 0.31)} scale={congratsPulse}>
								<Text
									anchor={{ x: 0.5, y: 0.5 }}
									text={t('FS CONGRATS')}
									style={textStyle(Math.round(BW * 0.044), 0xf1c14a)}
								/>
							</Container>
						</Container>

						<!-- Anchored to the board so it always sits just below its bottom edge, clear
						     of the leaves and the HTML HUD regardless of window shape. -->
						{#if !isPortrait}
							<PressAnywhereText y={Math.round(BW * 0.465)} fontSize={Math.round(BW * 0.042)} />
						{/if}
					{/snippet}
				</FreeSpinAnimation>

				<PressToContinue
					showText={isPortrait}
					onpress={() => (countUpCompleted ? oncomplete() : finishCountUp())}
				/>
			{/snippet}
		</WinCountUpProvider>
	{/if}
</FadeContainer>
