<script lang="ts" module>
	import type { WinLevelData } from '../game/winLevelMap';

	export type EmitterEventFreeSpinOutro =
		| { type: 'freeSpinOutroShow' }
		| { type: 'freeSpinOutroHide' }
		| { type: 'freeSpinOutroCountUp'; amount: number; winLevelData: WinLevelData };
</script>

<script lang="ts">
	import { BitmapText } from 'pixi-svelte';
	import { FadeContainer, WinCountUpProvider, ResponsiveBitmapText } from 'components-pixi';
	import { bookEventAmountToCurrencyString } from 'utils-shared/amount';
	import { waitForResolve } from 'utils-shared/wait';
	import { CanvasSizeRectangle } from 'components-layout';
	import { OnMount } from 'components-shared';

	import { getContext } from '../game/context';
	import PressToContinue from './PressToContinue.svelte';
	import FreeSpinAnimation from './FreeSpinAnimation.svelte';

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
</script>

<FadeContainer {show}>
	{#if winLevelData}
		{@const duration = winLevelData.presentDuration}
		<WinCountUpProvider {amount} {duration} oncomplete={() => {}}>
			{#snippet children({ countUpAmount, startCountUp, finishCountUp, countUpCompleted })}
				<OnMount onmount={() => startCountUp()} />

				<CanvasSizeRectangle backgroundColor={0x000000} backgroundAlpha={0.5} />

				<FreeSpinAnimation>
					{#snippet children({ sizes })}
						{@const BW = sizes.width}

						<BitmapText
							anchor={{ x: 0.5, y: 0.5 }}
							y={Math.round(-sizes.height * 0.25)}
							text="BONUS COMPLETE"
							style={{ fontFamily: 'gold', fontSize: Math.round(BW * 0.07) }}
						/>
						<BitmapText
							anchor={{ x: 0.5, y: 0.5 }}
							y={Math.round(-sizes.height * 0.04)}
							text="TOTAL WIN"
							style={{ fontFamily: 'silver', fontSize: Math.round(BW * 0.045) }}
						/>

						<!-- Win amount -->
						<ResponsiveBitmapText
							anchor={0.5}
							y={Math.round(sizes.height * 0.22)}
							maxWidth={Math.round(BW * 0.60)}
							text={bookEventAmountToCurrencyString(countUpAmount)}
							style={{
								fontFamily: 'gold',
								fontSize: Math.round(BW * 0.065),
								align: 'center',
								fontWeight: 'bold',
								letterSpacing: 0,
							}}
						/>
					{/snippet}
				</FreeSpinAnimation>

				<PressToContinue onpress={() => (countUpCompleted ? oncomplete() : finishCountUp())} />
			{/snippet}
		</WinCountUpProvider>
	{/if}
</FadeContainer>
