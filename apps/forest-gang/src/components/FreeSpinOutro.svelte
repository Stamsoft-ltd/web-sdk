<script lang="ts" module>
	import type { WinLevelData } from '../game/winLevelMap';

	export type EmitterEventFreeSpinOutro =
		| { type: 'freeSpinOutroShow' }
		| { type: 'freeSpinOutroHide' }
		| { type: 'freeSpinOutroCountUp'; amount: number; winLevelData: WinLevelData };
</script>

<script lang="ts">
	import { AnimatedSprite, Container, Sprite, Text } from 'pixi-svelte';
	import type { Texture } from 'pixi-svelte';
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
	import CurvedCinzelText from './CurvedCinzelText.svelte';

	const context = getContext();
	const t = (key: string) => stateI18nDerived.translate(key);
	const layoutType = $derived(context.stateLayoutDerived.layoutType());
	const isPortrait = $derived(layoutType === 'portrait');
	// Every layout except mobile landscape draws the press line BELOW the board (glow ledge) like
	// portrait — the wooden panel is opaque planks with the spine leaf-frame over the bottom band,
	// so any in-panel press reads as "on the background". Only landscape keeps the in-panel copy
	// (below-board placement collides with its side rails).
	const isLandscape = $derived(layoutType === 'landscape');
	// Animated scatter medallion (seamless loop; falls back to the static sprite until loaded).
	const medallionFrames = $derived(
		(context.stateApp.loadedAssets?.fsMedallionAnim ?? []) as Texture[],
	);

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
	const congratsPulse = $derived(slideIn.current >= 0.99 ? 1 + 0.035 * Math.sin(animT * 3.7) : 1);
	// Medallion zoom in/out breathe.
	const medallionPulse = $derived(1 + 0.06 * Math.sin(animT * 2.6));

	context.eventEmitter.subscribeOnMount({
		freeSpinOutroShow: () => {
			show = true;
			context.stateGame.freeSpinPopupShowing = true; // block the HUD (fullscreen-modal feel)
		},
		freeSpinOutroHide: async () => {
			show = false;
			context.stateGame.freeSpinPopupShowing = false;
		},
		freeSpinOutroCountUp: async (emitterEvent) => {
			amount = emitterEvent.amount;
			winLevelData = emitterEvent.winLevelData;
			// Wait for a manual press/tap to continue — no auto-advance (design ask: the congrats
			// screen stays up until the player acknowledges it). The count-up still caps its duration
			// (see `duration` below) so the total is fully shown while the player reads it.
			await waitForResolve((resolve) => {
				oncomplete = resolve;
			});
		},
	});
</script>

<FadeContainer {show}>
	{#if winLevelData}
		<!-- Count-up capped so the total is fully shown before the 3s auto-advance fires. -->
		{@const duration = Math.min(winLevelData.presentDuration, 2000)}
		<WinCountUpProvider {amount} {duration} oncomplete={() => { context.eventEmitter.broadcast({ type: 'soundStop', name: 'sfx_win_coins_loop' }); context.eventEmitter.broadcast({ type: 'soundStop', name: 'bgm_win_animation' }); context.eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_win_count_end' }); }}>
			{#snippet children({ countUpAmount, startCountUp, finishCountUp, countUpCompleted })}
				<OnMount onmount={() => startCountUp()} />

				<CanvasSizeRectangle backgroundColor={0x000000} backgroundAlpha={0.5} />

				<FreeSpinAnimation portraitScale={1.04}>
					{#snippet children({ sizes })}
						<!-- Fixed BW on EVERY layout (like the intro): deriving it from `sizes` (which
						     already scales with the popup factor) compounded to factor² and overflowed —
						     on desktop that overflow made the wooden board fail to render (text floated over
						     the reels). Pinning 1100 keeps the popup proportional and the board visible. -->
						{@const BW = 1100}
						{@const fromBottom = (1 - slideIn.current) * BW * 0.55}
						{@const fromTop = (1 - slideIn.current) * -BW * 0.7}
						<!-- Portrait: lift the WHOLE board (heading + win + amount) up a touch. The press line
						     is canvas-anchored (PressToContinue at 0.78·height) and stays put, so this just
						     opens up padding between the board's bottom leaves and "PRESS ANYWHERE". -->
						{@const boardLift = isPortrait ? Math.round(BW * 0.08) : 0}

						<Container y={-boardLift}>
						<Container y={fromBottom}>
						<!-- Board a touch larger than the BW layout reference so the enlarged heading fits with margin. -->
						<Sprite key="fsBoardBg" anchor={{ x: 0.5, y: 0.5 }} width={Math.round(BW * 1.12)} height={Math.round(BW * 1.12)} />

						<!-- YOU WON (green) — live translatable Cinzel text -->
						<Text
							anchor={{ x: 0.5, y: 0.5 }}
							text={t('FS YOU WON')}
							style={textStyle(Math.round(BW * 0.045), 0x7cc23f)}
							y={Math.round(-BW * 0.205)}
						/>

						<!-- Scatter medallion — zooms in/out gently. Pulled up (was 0.02) so the medallion +
						     amount group sits higher and the amount no longer hugs the bottom rail. -->
						<Container y={Math.round(-BW * 0.03)} scale={medallionPulse}>
							{#if medallionFrames.length > 0}
								<AnimatedSprite
									textures={medallionFrames}
									anchor={0.5}
									width={Math.round(BW * 0.322)}
									height={Math.round(BW * 0.322 * (443 / 485))}
									animationSpeed={0.3}
									loop={true}
									play={true}
								/>
							{:else}
								<Sprite
									key="fsMedallion"
									anchor={{ x: 0.5, y: 0.5 }}
									width={Math.round(BW * 0.322)}
									height={Math.round(BW * 0.322 * (273 / 300))}
								/>
							{/if}
						</Container>

						<!-- Win amount — Cinzel 900 gold with black outline; scales down to fit the board width -->
						{@const winFont = Math.round(BW * 0.072)}
						{@const winMaxW = BW * 0.6}
						{@const winScale = amountSizes.width > winMaxW ? winMaxW / amountSizes.width : 1}
						<Container y={Math.round(BW * 0.17)} scale={winScale}>
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
						{#if isLandscape}
							<!-- Mobile landscape only: press text in PANEL space so it tracks the board and
							     clears the side rails. All other layouts draw it BELOW the board instead
							     (see PressToContinue), so it sits in the glow ledge, not over the planks. -->
							<PressAnywhereText y={Math.round(BW * 0.47)} fontSize={Math.round(BW * 0.032)} />
						{/if}
						</Container>

						<!-- CONGRATULATIONS! drops in from the top, then pulses in place. With BW pinned to
						     1100 the popup proportions are consistent across layouts, so −0.34·BW lifts it
						     closer to the top rail (closing the empty-wood gap above) without touching it. -->
						<Container y={fromTop}>
							<Container y={Math.round(-BW * 0.34)} scale={congratsPulse}>
								<CurvedCinzelText
									text={t('FS CONGRATS')}
									radius={BW * 1.1}
									gap={Math.round(BW * 0.05) * 0.03}
									style={textStyle(Math.round(BW * 0.05), 0xf1c14a)}
								/>
							</Container>
						</Container>
						</Container>

					{/snippet}
				</FreeSpinAnimation>

				<!-- Every layout except mobile landscape draws the canvas-anchored press text below the
				     board (glow ledge); landscape draws it in panel space (above) to clear its side rails. -->
				<PressToContinue
					onpress={() => (countUpCompleted ? oncomplete() : finishCountUp())}
					showText={!isLandscape}
					hudClearFactor={0.2}
				/>
			{/snippet}
		</WinCountUpProvider>
	{/if}
</FadeContainer>
