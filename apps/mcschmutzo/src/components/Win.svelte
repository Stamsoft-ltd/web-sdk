<script lang="ts" module>
	import type { WinLevelData } from '../game/winLevelMap';

	export type EmitterEventWin =
		| { type: 'winShow' }
		| { type: 'winHide' }
		| { type: 'winUpdate'; amount: number; winLevelData: WinLevelData };
</script>

<script lang="ts">
	import { onMount } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { Container, Sprite } from 'pixi-svelte';
	import { FadeContainer, WinCountUpProvider, ResponsiveText, Button } from 'components-pixi';
	import { waitForResolve, waitForTimeout } from 'utils-shared/wait';
	import { bookEventAmountToCurrencyString } from 'utils-shared/amount';
	import { CanvasSizeRectangle, MainContainer } from 'components-layout';
	import { OnMount } from 'components-shared';

	import WinPad from './WinPad.svelte';
	import PressToContinue from './PressToContinue.svelte';
	import WinReadoutSync from './WinReadoutSync.svelte';
	import { SYMBOL_SIZE } from '../game/constants';
	import { winLevelMap, type WinLevel } from '../game/winLevelMap';
	import { getContext } from '../game/context';
	import { shake } from '../game/screenShake.svelte';
	import FoodChaos from './FoodChaos.svelte';

	const context = getContext();

	// Shade behind a small/medium win plaque (big wins keep 0.6). Was 0.402 — a full-screen blackout
	// for every win; the win focus now dims the losing cells instead.
	const SMALL_WIN_DIM = 0.18;
	let show = $state(false);
	let amount = $state(0);
	let winLevelData = $state<WinLevelData>();
	let oncomplete = $state(() => {});
	// Share the dim with the HTML layers (HUD etc. sit above the canvas, so the pixi overlay misses them).
	$effect(() => {
		context.stateGame.winDim = show && winLevelData ? (winLevelData.type === 'big' ? 0.6 : SMALL_WIN_DIM) : 0;
	});
	let onCountUpComplete = $state(() => {});

	// The plaque's exit while FadeContainer fades the layer out (its 400ms): it swells to 1.1, then
	// collapses to nothing (1 → 1.1 → 0) instead of just thinning away.
	const EXIT_MS = 400;
	const exit = new Tween(0);
	$effect(() => {
		if (show) exit.set(0, { duration: 0 });
		else exit.set(1, { duration: EXIT_MS });
	});
	const padScale = $derived.by(() => {
		const u = exit.current;
		return u < 0.35 ? 1 + 0.1 * Math.sin((u / 0.35) * (Math.PI / 2)) : 1.1 * (1 - ((u - 0.35) / 0.65) ** 2);
	});

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

	// ── Dev-only tier preview: press 1–5 to force SWEET/WILD/EPIC/MYTHIC/LEGENDARY ────────────────
	onMount(() => {
		if (!import.meta.env.DEV) return;
		// Tier + a representative amount spanning the 3 font sizes (<100, <1000, above).
		const keyToPreview: Record<string, { level: WinLevel; amount: number }> = {
			Digit1: { level: 6, amount: 550 }, // ~5.5 (<10)
			Digit2: { level: 7, amount: 3500 }, // ~35 (<100)
			Digit3: { level: 8, amount: 41200 }, // ~412 (<1000)
			Digit4: { level: 9, amount: 154300 }, // ~1,543
			Digit5: { level: 10, amount: 812500 }, // ~8,125
		};
		const onKey = (e: KeyboardEvent) => {
			const preview = keyToPreview[e.code];
			if (!preview) return;
			winLevelData = winLevelMap[preview.level];
			amount = preview.amount;
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
					<CanvasSizeRectangle backgroundColor={0x000000} backgroundAlpha={0.6} />
					<!-- food chaos behind the plaque, more of it the bigger the win -->
					<FoodChaos level={winLevelData?.level ?? 6} />
				{:else}
					<!-- Small/medium win plaque: only a light shade — the losing symbols are already dimmed by
					     the win focus, so the board (and the win lines) stay readable behind it. -->
					<CanvasSizeRectangle backgroundColor={0x000000} backgroundAlpha={SMALL_WIN_DIM} />
				{/if}

				<WinReadoutSync amount={countUpAmount} />
				<OnMount
					onmount={async () => {
						// big wins hit the board: a thump as the screen lands, the full shake on the final hit
						const px = isBigWin ? ((winLevelData?.level ?? 0) >= 9 ? 8 : (winLevelData?.level ?? 0) >= 8 ? 7 : 5) : 0;
						if (px) shake(px * 0.6, 260);
						await startCountUp();
						if (px) shake(px, 420);
						// (big wins: let the win track ring out — winLevelMap holdDuration)
						await waitForTimeout(winLevelData?.holdDuration ?? 300);
						oncomplete();
					}}
				/>

				<MainContainer>
					<Container
						x={context.stateGameDerived.boardLayout().x}
						y={context.stateGameDerived.boardLayout().y}
						scale={padScale}
					>
						{#if winLevelData?.pad}
							<!-- Amount in the win-box-amount plaque: Bowlby One SC (the game's display face), cream. Fixed base size so every
							     tier renders the SAME size (short or long); maxWidth scales the longest amounts
							     down so even large values stay inside the red panel. -->
							{@const amountFontSize = SYMBOL_SIZE * 0.48}
							<WinPad padKey={winLevelData.pad}>
								<ResponsiveText
									anchor={0.5}
									maxWidth={context.stateGameDerived.boardLayout().width * 0.4}
									text={bookEventAmountToCurrencyString(Math.round(countUpAmount))}
									style={{
										fontFamily: 'Bowlby One SC',
										fontWeight: '400',
										fill: 0xfff1cf,
										fontSize: amountFontSize,
										letterSpacing: amountFontSize * 0.003,
										align: 'center',
									}}
								/>
							</WinPad>
						{:else}
							<!-- Small/medium wins: value on the red plaque, in Bowlby One SC sized to fill the box
							     (~76px on the design box → 0.18 of the box width; scales with the box per layout).
							     maxWidth lets very long amounts shrink so they stay inside the red panel. -->
							{@const isPt = context.stateLayoutDerived.layoutType() === 'portrait'}
							{@const smallBoxW =
								context.stateGameDerived.boardLayout().width * (isPt ? 0.82 : 0.66)}
							{@const smallFontSize = smallBoxW * 0.18}
							<WinPad>
								<ResponsiveText
									anchor={0.5}
									maxWidth={smallBoxW * 0.8}
									text={bookEventAmountToCurrencyString(Math.round(countUpAmount))}
									style={{
										fontFamily: 'Bowlby One SC',
										fontWeight: '400',
										fill: 0xffffff,
										fontSize: smallFontSize,
										letterSpacing: smallFontSize * 0.03,
										align: 'center',
									}}
								/>
							</WinPad>
						{/if}
					</Container>
				</MainContainer>

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
									<Sprite key="closeButton" anchor={0.5} width={closeSize} height={closeSize} />
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
