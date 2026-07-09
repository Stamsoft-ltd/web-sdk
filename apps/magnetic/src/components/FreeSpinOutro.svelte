<script lang="ts" module>
	import type { WinLevelData } from '../game/winLevelMap';

	export type EmitterEventFreeSpinOutro =
		| { type: 'freeSpinOutroShow' }
		| { type: 'freeSpinOutroHide' }
		| { type: 'freeSpinOutroCountUp'; amount: number; winLevelData: WinLevelData };
</script>

<script lang="ts">
	import { Container, Graphics, Sprite, Text } from 'pixi-svelte';
	import { FadeContainer, WinCountUpProvider } from 'components-pixi';
	import { bookEventAmountToCurrencyString } from 'utils-shared/amount';
	import { waitForResolve } from 'utils-shared/wait';
	import { CanvasSizeRectangle, MainContainer } from 'components-layout';
	import { OnMount } from 'components-shared';

	import { getContext } from '../game/context';
	import LightningStorm from './LightningStorm.svelte';
	import PressToContinue from './PressToContinue.svelte';
	import WinCoins from './WinCoins.svelte';

	const context = getContext();

	let show = $state(true);
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
	const pressStyle = (fontSize: number) => ({
		fontFamily: 'Inter',
		fontWeight: '700' as const,
		fontSize,
		fill: 0xbcd6f2,
		letterSpacing: fontSize * 0.16,
		align: 'center' as const,
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

						<!-- Opaque backing: the panel art is semi-transparent, so without this the additive
						     bolts shine THROUGH the dialog instead of staying behind it. -->
						<Graphics
							draw={(g) => {
								g.clear();
								g.rect(-PW * 0.48, -PH * 0.48, PW * 0.96, PH * 0.96);
								g.fill(0x08122b);
							}}
						/>

						<!-- Dark-blue tech panel -->
						<Sprite key="fsPanel" anchor={0.5} width={PW} height={PH} />

						<!-- CONGRATULATIONS / YOU WON -->
						<Text anchor={0.5} y={-PH * 0.36} text="CONGRATULATIONS" style={congratsStyle(PH * 0.072)} />
						<Text anchor={0.5} y={-PH * 0.27} text="YOU WON" style={blueStyle(PH * 0.04)} />

						<!-- Full magnet element (magnet + base + energy baked in) -->
						<Container y={-PH * 0.06}>
							<Sprite
								key="popupMagnet"
								anchor={0.5}
								width={magnetW * 1.28}
								height={magnetW * 1.28 * (103 / 114)}
							/>
						</Container>

						<!-- Win amount counting up in its frame -->
						<Container y={PH * 0.26}>
							<Sprite key="panelBorder" anchor={0.5} width={amountBoxW} height={amountBoxH} />
							<Text
								anchor={0.5}
								y={-amountBoxH * 0.04}
								text={bookEventAmountToCurrencyString(countUpAmount)}
								style={amountStyle(amountBoxH * 0.42)}
							/>
						</Container>

						<!-- Press-anywhere-to-continue hint (below the card) with the arrow -->
						<Container y={PH * 0.55}>
							<Text
								anchor={0.5}
								x={-PW * 0.03}
								text="PRESS ANYWHERE TO CONTINUE"
								style={pressStyle(PH * 0.028)}
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
				</MainContainer>

				<WinCoins emit={!countUpCompleted} levelAlias={winLevelData?.alias} />

				<PressToContinue onpress={() => (countUpCompleted ? oncomplete() : finishCountUp())} />
			{/snippet}
		</WinCountUpProvider>
	{/if}
</FadeContainer>
