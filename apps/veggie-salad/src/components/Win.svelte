<script lang="ts" module>
	import type { WinLevelData } from '../game/winLevelMap';

	export type EmitterEventWin =
		| { type: 'winShow' }
		| { type: 'winHide' }
		| { type: 'winUpdate'; amount: number; winLevelData: WinLevelData };
</script>

<script lang="ts">
	import { Container, Rectangle, Text } from 'pixi-svelte';
	import { FadeContainer, WinCountUpProvider } from 'components-pixi';
	import { waitForResolve, waitForTimeout } from 'utils-shared/wait';
	import { bookEventAmountToCurrencyString } from 'utils-shared/amount';
	import { CanvasSizeRectangle, MainContainer } from 'components-layout';
	import { OnMount } from 'components-shared';

	import WinCoins from './WinCoins.svelte';
	import PressToContinue from './PressToContinue.svelte';
	import { getContext } from '../game/context';

	const context = getContext();

	let show = $state(false);
	let amount = $state(0);
	let winLevelData = $state<WinLevelData>();
	let oncomplete = $state(() => {});
	let onCountUpComplete = $state(() => {});
	const pixelTitle = $derived(winLevelData?.text ?? 'CONGRATS!');

	context.eventEmitter.subscribeOnMount({
		winShow: () => (show = true),
		winHide: () => (show = false),
		winUpdate: async (emitterEvent) => {
			amount = emitterEvent.amount;
			winLevelData = emitterEvent.winLevelData;
			await waitForResolve((resolve) => (oncomplete = resolve));
		},
	});
</script>

<FadeContainer {show}>
	{#if winLevelData}
		{@const isBigWin = winLevelData.type === 'big'}
		{@const duration = winLevelData.presentDuration}
		<WinCountUpProvider {amount} {duration} oncomplete={() => onCountUpComplete()}>
			{#snippet children({ countUpAmount, startCountUp, finishCountUp, countUpCompleted })}
				{#if isBigWin}
					<CanvasSizeRectangle backgroundColor={0x000000} backgroundAlpha={0.5} />
				{/if}

				<OnMount
					onmount={async () => {
						await startCountUp();
						await waitForTimeout(300);
						oncomplete();
					}}
				/>

				<MainContainer>
					<Container
						x={context.stateLayoutDerived.mainLayout().width * 0.5}
						y={context.stateLayoutDerived.mainLayout().height * 0.5}
					>
						<!-- Pixel plaque: Pixi primitives, no HTML/CSS overlay, no legacy Spine win art. -->
						<Rectangle x={-360} y={-190} width={720} height={380} backgroundColor={0x6d2b12} />
						<Rectangle x={-348} y={-178} width={696} height={356} backgroundColor={0xd69a2d} />
						<Rectangle
							x={-336}
							y={-166}
							width={672}
							height={332}
							backgroundColor={winLevelData.alias === 'max'
								? 0x8d1d16
								: winLevelData.alias === 'epic'
									? 0x4f2078
									: 0x315318}
						/>
						<Text
							anchor={0.5}
							y={-92}
							text={pixelTitle}
							style={{
								fontFamily: 'monospace',
								fontSize: 58,
								fontWeight: '900',
								fill: 0xffe24e,
								stroke: { color: 0x4c2008, width: 8 },
							}}
						/>
						<Text
							anchor={0.5}
							y={34}
							text={bookEventAmountToCurrencyString(countUpAmount, amount)}
							style={{
								fontFamily: 'monospace',
								fontSize: 62,
								fontWeight: '900',
								fill: 0xffffff,
								stroke: { color: 0x4c2008, width: 7 },
							}}
						/>
					</Container>
				</MainContainer>

				<WinCoins emit={!countUpCompleted} levelAlias={winLevelData?.alias} />

				<PressToContinue onpress={() => (countUpCompleted ? oncomplete() : finishCountUp())} />
			{/snippet}
		</WinCountUpProvider>
	{/if}
</FadeContainer>
