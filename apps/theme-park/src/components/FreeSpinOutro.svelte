<script lang="ts" module>
	import type { WinLevelData } from '../game/winLevelMap';

	export type EmitterEventFreeSpinOutro =
		| { type: 'freeSpinOutroShow' }
		| { type: 'freeSpinOutroHide' }
		| { type: 'freeSpinOutroCountUp'; amount: number; winLevelData: WinLevelData };
</script>

<script lang="ts">
	import { Container, Sprite, Text } from 'pixi-svelte';
	import { FadeContainer, WinCountUpProvider } from 'components-pixi';
	import { bookEventAmountToCurrencyString } from 'utils-shared/amount';
	import { waitForResolve } from 'utils-shared/wait';
	import { CanvasSizeRectangle } from 'components-layout';
	import { OnMount } from 'components-shared';
	import { stateI18nDerived } from 'state-shared';

	import { getContext } from '../game/context';
	import { getSpecialSymbolKey } from '../game/utils';
	import PressToContinue from './PressToContinue.svelte';
	import FreeSpinAnimation from './FreeSpinAnimation.svelte';

	const context = getContext();

	let show = $state(false);
	let amount = $state(0);
	let winLevelData = $state<WinLevelData>();
	let oncomplete = $state(() => {});
	let amountWidth = $state(0);
	const layoutType = $derived(context.stateLayoutDerived.layoutType());
	const badgeKey = $derived(
		getSpecialSymbolKey(
			context.stateGame.bonusType === 'coaster' ? 'coasterScatter' : 'rollerScatter',
			layoutType,
		),
	);

	const headingStyle = (fontSize: number, fill: number) => ({
		fontFamily: 'Cinzel',
		fontWeight: '900' as const,
		fontSize,
		fill,
		align: 'center' as const,
		letterSpacing: fontSize * 0.03,
		stroke: { color: 0x2b082f, width: Math.max(2, Math.round(fontSize * 0.05)) },
	});

	context.eventEmitter.subscribeOnMount({
		freeSpinOutroShow: () => {
			show = true;
			context.stateGame.freeSpinPopupShowing = true;
		},
		freeSpinOutroHide: async () => {
			show = false;
			context.stateGame.freeSpinPopupShowing = false;
		},
		freeSpinOutroCountUp: async (emitterEvent) => {
			amount = emitterEvent.amount;
			winLevelData = emitterEvent.winLevelData;
			await waitForResolve((resolve) => (oncomplete = resolve));
		},
	});
</script>

<FadeContainer {show}>
	{#if winLevelData}
		<!-- Forest Gang contract: dedicated bonus-total board, capped count-up,
		     manual acknowledgement. Per-spin tier boards are handled by Win.svelte. -->
		{@const duration = Math.min(winLevelData.presentDuration, 2000)}
		<WinCountUpProvider {amount} {duration} oncomplete={() => {}}>
			{#snippet children({ countUpAmount, startCountUp, finishCountUp, countUpCompleted })}
				<OnMount onmount={() => startCountUp()} />

				<CanvasSizeRectangle backgroundColor={0x000000} backgroundAlpha={0.5} />

				<FreeSpinAnimation portraitScale={0.9}>
					{@const BW = 900}
					<Text
						anchor={0.5}
						y={Math.round(-BW * 0.29)}
						text={stateI18nDerived.translate('BONUS COMPLETE')}
						style={headingStyle(Math.round(BW * 0.06), 0xf1c14a)}
					/>

					<Sprite
						key={badgeKey}
						anchor={0.5}
						y={Math.round(-BW * 0.09)}
						width={Math.round(BW * 0.31)}
						height={Math.round(BW * 0.25)}
					/>

					<Text
						anchor={0.5}
						y={Math.round(BW * 0.09)}
						text={stateI18nDerived.translate('TOTAL WIN')}
						style={headingStyle(Math.round(BW * 0.038), 0x7cc23f)}
					/>

					{@const amountScale = amountWidth > BW * 0.58 ? (BW * 0.58) / amountWidth : 1}
					<Container y={Math.round(BW * 0.22)} scale={amountScale}>
						<Text
							anchor={0.5}
							onresize={({ width }) => (amountWidth = width)}
							text={bookEventAmountToCurrencyString(countUpAmount)}
							style={headingStyle(Math.round(BW * 0.075), 0xffffff)}
						/>
					</Container>
				</FreeSpinAnimation>

				<PressToContinue onpress={() => (countUpCompleted ? oncomplete() : finishCountUp())} />
			{/snippet}
		</WinCountUpProvider>
	{/if}
</FadeContainer>
