<script lang="ts" module>
	export type EmitterEventBonusSymbolPanel =
		| { type: 'bonusSymbolRollAwait' };
</script>

<script lang="ts">
	import { BitmapText, Container, Sprite } from 'pixi-svelte';
	import { FadeContainer } from 'components-pixi';
	import { MainContainer } from 'components-layout';

	import BoardContainer from './BoardContainer.svelte';
	import { getContext } from '../game/context';
	import { SYMBOL_SIZE, SYMBOL_W, SYMBOL_H } from '../game/constants';
	import { spriteKeyByName } from '../game/utils';
	import type { SymbolName } from '../game/types';

	// symbolPad.png is 624×420
	const PAD_ASPECT = 624 / 420;
	const PANEL_W = SYMBOL_W * 1.1;
	const PANEL_H = PANEL_W / PAD_ASPECT;
	const SYM_SIZE = PANEL_W * 0.52;

	const context = getContext();
	const selectedSymbol = $derived(context.stateGame.selectedBonusSymbol);
	const mode = $derived(context.stateGame.bonusMode);
	// Hidden while the deer presenter is on screen; revealed once it finishes.
	let presenterActive = $state(false);
	const show = $derived(!!selectedSymbol && !!mode && !presenterActive);
	// Shrink + pull-in on short desktop laptop canvases so the rail fits alongside the enlarged board.
	const railAdj = $derived(context.stateGameDerived.bonusRailAdjust());
	// Mobile-landscape: the rail becomes a full-height LEFT column (rendered in MainContainer).
	const isLandscape = $derived(context.stateLayoutDerived.layoutType() === 'landscape');
	const lsRail = $derived(context.stateGameDerived.landscapeRail());
	const scale = $derived(
		isLandscape
			? lsRail.refWidth / PANEL_W
			: (context.stateLayoutDerived.isStacked() ? 1.28 : 1) * railAdj.scale,
	);

	const boardW = $derived(context.stateGameDerived.boardLayout().width);
	const position = $derived(
		isLandscape
			? { x: lsRail.x, y: lsRail.symbolY }
			: context.stateLayoutDerived.isStacked()
				? { x: boardW - PANEL_W * 0.5 - 10, y: -SYMBOL_SIZE * 0.6 }
				: { x: boardW + 40 + railAdj.x, y: SYMBOL_SIZE * 0.3 },
	);

	const modeLabel = $derived(mode === 'superspin' ? 'ALL IN' : mode === 'feature' ? 'FEATURE' : 'DEAL IT');

	let displaySymbol = $state<SymbolName | null>(null);
	let rollDone = $state(false);
	let rollAwaitResolve: (() => void) | null = null;

	// No roll animation on the panel — the deer presenter already reveals the symbol, so the panel
	// simply shows the final symbol (a second slot-roll here read as an unwanted extra animation).
	$effect(() => {
		const sym = selectedSymbol;
		const currentMode = mode;
		if (!sym || !currentMode) {
			displaySymbol = null;
			rollDone = false;
			return;
		}
		displaySymbol = sym;
		rollDone = true;
		rollAwaitResolve?.();
		rollAwaitResolve = null;
	});

	context.eventEmitter.subscribeOnMount({
		bonusSymbolRollAwait: async () => {
			if (rollDone) return;
			await new Promise<void>((resolve) => { rollAwaitResolve = resolve; });
		},
		stopButtonClick: () => {
			// Skip: land on the final symbol immediately and release any pending roll-await.
			if (selectedSymbol) displaySymbol = selectedSymbol;
			rollDone = true;
			rollAwaitResolve?.();
			rollAwaitResolve = null;
		},
		expandedPresenterShow: () => (presenterActive = true),
		expandedPresenterHide: () => (presenterActive = false),
	});

	const spriteKey = $derived(displaySymbol ? (spriteKeyByName[displaySymbol] ?? 'aTile') : 'aTile');
</script>

{#snippet panel()}
	<FadeContainer {show}>
		<Container
			x={position.x}
			y={position.y}
			{scale}
			pivot={{ x: PANEL_W * 0.5, y: PANEL_H * 0.5 }}
		>
			<!-- Frame background -->
			<Sprite key="symbolPad" anchor={{ x: 0.5, y: 0.5 }} x={PANEL_W * 0.5} y={PANEL_H * 0.5} width={PANEL_W} height={PANEL_H} />

			<!-- Symbol sprite, centred (no mode label) -->
			{#if displaySymbol}
				<Sprite
					key={spriteKey}
					anchor={{ x: 0.5, y: 0.5 }}
					x={PANEL_W * 0.5}
					y={PANEL_H * 0.5}
					width={SYM_SIZE}
					height={SYM_SIZE * (SYMBOL_H / SYMBOL_W)}
				/>
			{/if}
		</Container>
	</FadeContainer>
{/snippet}

{#if isLandscape}
	<MainContainer>{@render panel()}</MainContainer>
{:else}
	<BoardContainer>{@render panel()}</BoardContainer>
{/if}
