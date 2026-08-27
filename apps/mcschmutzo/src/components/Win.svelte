<script lang="ts" module>
	import type { WinLevelData } from '../game/winLevelMap';

	export type EmitterEventWin =
		| { type: 'winShow' }
		| { type: 'winHide' }
		| { type: 'winUpdate'; amount: number; winLevelData: WinLevelData };
</script>

<script lang="ts">
	import { onMount } from 'svelte';
	import { Container, Graphics, PIXI } from 'pixi-svelte';
	import { FadeContainer, WinCountUpProvider, ResponsiveBitmapText, Button } from 'components-pixi';
	import { waitForResolve, waitForTimeout } from 'utils-shared/wait';
	import { bookEventAmountToCurrencyString } from 'utils-shared/amount';
	import { CanvasSizeRectangle, MainContainer } from 'components-layout';
	import { OnMount } from 'components-shared';

	import WinCoins from './WinCoins.svelte';
	import WinPad from './WinPad.svelte';
	import PressToContinue from './PressToContinue.svelte';
	import { SYMBOL_SIZE } from '../game/constants';
	import { winLevelMap, type WinLevel } from '../game/winLevelMap';
	import { getContext } from '../game/context';

	const context = getContext();

	let show = $state(false);
	let amount = $state(0);
	let winLevelData = $state<WinLevelData>();
	let oncomplete = $state(() => {});
	let onCountUpComplete = $state(() => {});

	context.eventEmitter.subscribeOnMount({
		winShow: () => (show = true),
		winHide: () => (show = false),
		winUpdate: async (emitterEvent) => {
			amount = emitterEvent.amount;
			winLevelData = emitterEvent.winLevelData;
			await waitForResolve((resolve) => (oncomplete = resolve));
		},
	});

	// ── ✕ close button, top-right of the canvas ──────────────────────────────────────────────────
	const main = $derived(context.stateLayoutDerived.mainLayout());
	const canvas = $derived(context.stateLayoutDerived.canvasSizes());
	const closeX = $derived(main.width * 0.5 + canvas.width / (2 * (main.scale || 1)));
	const closeYtop = $derived(main.height * 0.5 - canvas.height / (2 * (main.scale || 1)));
	const closeSize = $derived(Math.min(main.width, main.height) * 0.07);
	const drawClose = (g: InstanceType<typeof PIXI.Graphics>, s: number) => {
		g.circle(0, 0, s * 0.5).fill({ color: 0x000000, alpha: 0.4 });
		const a = s * 0.2;
		g.moveTo(-a, -a)
			.lineTo(a, a)
			.moveTo(a, -a)
			.lineTo(-a, a)
			.stroke({ width: s * 0.1, color: 0xffffff, cap: 'round' });
	};

	// ── Dev-only tier preview: press 1–5 to force SWEET/LEGENDARY/EPIC/WILD/MYTHIC ────────────────
	onMount(() => {
		if (!import.meta.env.DEV) return;
		const keyToLevel: Record<string, WinLevel> = {
			Digit1: 6,
			Digit2: 7,
			Digit3: 8,
			Digit4: 9,
			Digit5: 10,
		};
		const onKey = (e: KeyboardEvent) => {
			const level = keyToLevel[e.code];
			if (!level) return;
			winLevelData = winLevelMap[level];
			amount = 154300;
			show = true;
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
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
						x={context.stateGameDerived.boardLayout().x}
						y={context.stateGameDerived.boardLayout().y}
					>
						{#if winLevelData?.pad}
							<WinPad padKey={winLevelData.pad}>
								<ResponsiveBitmapText
									anchor={0.5}
									maxWidth={context.stateGameDerived.boardLayout().width * 0.42}
									text={bookEventAmountToCurrencyString(countUpAmount)}
									style={{
										fontFamily: 'gold',
										fontSize: SYMBOL_SIZE * 1.9,
										align: 'center',
										fontWeight: 'bold',
										letterSpacing: 0,
									}}
								/>
							</WinPad>
						{:else}
							<ResponsiveBitmapText
								anchor={0.5}
								maxWidth={context.stateLayoutDerived.canvasSizes().width /
									context.stateLayoutDerived.mainLayout().scale}
								text={bookEventAmountToCurrencyString(countUpAmount)}
								style={{
									fontFamily: 'gold',
									fontSize: SYMBOL_SIZE,
									align: 'center',
									fontWeight: 'bold',
									letterSpacing: 0,
								}}
							/>
						{/if}
					</Container>
				</MainContainer>

				<WinCoins emit={!countUpCompleted} levelAlias={winLevelData?.alias} />

				{#if isBigWin}
					<MainContainer>
						<Button
							x={closeX - closeSize}
							y={closeYtop + closeSize}
							anchor={0.5}
							sizes={{ width: closeSize, height: closeSize }}
							onpress={() => (countUpCompleted ? oncomplete() : finishCountUp())}
						>
							{#snippet children({ center })}
								<Container x={center.x} y={center.y}>
									<Graphics draw={(graphics) => drawClose(graphics, closeSize)} />
								</Container>
							{/snippet}
						</Button>
					</MainContainer>
				{/if}

				<PressToContinue onpress={() => (countUpCompleted ? oncomplete() : finishCountUp())} />
			{/snippet}
		</WinCountUpProvider>
	{/if}
</FadeContainer>
