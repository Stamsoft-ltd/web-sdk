<script lang="ts">
	import SymbolSpine from './SymbolSpine.svelte';
	import SymbolSprite from './SymbolSprite.svelte';
	import SymbolSpineIntroLoop from './SymbolSpineIntroLoop.svelte';
	import { getSymbolInfo } from '../game/utils';
	import type { SymbolState, RawSymbol } from '../game/types';
	import { getContext } from '../game/context';
	import { BitmapText, Container } from 'pixi-svelte';
	import { stateBet } from 'state-shared';
	import { SYMBOL_SIZE } from '../game/constants';

	type Props = {
		x?: number;
		y?: number;
		state: SymbolState;
		rawSymbol: RawSymbol;
		oncomplete?: () => void;
		loop?: boolean;
	};

	const props: Props = $props();
	const context = getContext();
	const symbolInfo = $derived(getSymbolInfo({ rawSymbol: props.rawSymbol, state: props.state }));
	const isSprite = $derived(symbolInfo.type === 'sprite');
	const isSpineIntroLoop = $derived(symbolInfo.type === 'spineIntroLoop');

	// ── Scatter swing: the medallion rocks like a hanging ornament, pinned at its TOP edge
	//    (mirrors the buy-menu card icons). Active while a bonus-buy mode is on AND during the
	//    bonus itself, so the scatters never sit dead through the bonus presentation. ──
	// Any non-base mode: CHANCE/FEATURE activations AND bought bonuses (BONUS/SUPER) while
	// their triggering spin plays, plus the bonus rounds themselves.
	const swingActive = $derived(
		props.rawSymbol.name === 'SCATTER' &&
			(stateBet.activeBetModeKey !== 'BASE' || !!context.stateGame.bonusMode),
	);
	const swingPhase = Math.random() * Math.PI * 2;
	let swingT = $state(0);
	$effect(() => {
		if (!swingActive) return;
		let raf = 0;
		const t0 = performance.now();
		const tick = (now: number) => {
			swingT = (now - t0) / 1000;
			raf = requestAnimationFrame(tick);
		};
		raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
	});
	const swingRot = $derived(swingActive ? Math.sin(swingT * 2.6 + swingPhase) * 0.1 : 0);
	const pivotX = $derived(props.x ?? 0);
	const pivotY = $derived((props.y ?? 0) - SYMBOL_SIZE * 0.5);
</script>

{#snippet body()}
{#if isSpineIntroLoop}
	{@const il = symbolInfo as { assetKey: string; introAnimation: string; loopAnimation: string; sizeRatios: { height: number } }}
	<SymbolSpineIntroLoop
		assetKey={il.assetKey}
		introAnimation={il.introAnimation}
		loopAnimation={il.loopAnimation}
		sizeRatio={il.sizeRatios.height}
		x={props.x}
		y={props.y}
	/>
{:else if isSprite}
	<SymbolSprite {symbolInfo} x={props.x} y={props.y} oncomplete={props.oncomplete} />
{:else}
	<SymbolSpine
		loop={props.loop}
		{symbolInfo}
		x={props.x}
		y={props.y}
		showWinFrame={props.state === 'win' && !['SCATTER', 'T'].includes(props.rawSymbol.name)}
		listener={{
			complete: props.oncomplete,
			event: (_, event) => {
				if (event.data?.name === 'wildExplode') {
					context.eventEmitter?.broadcast({ type: 'soundOnce', name: 'sfx_symbol_expand' });
				}
			},
		}}
	/>
{/if}

{#if props.rawSymbol.multiplier}
	<BitmapText
		anchor={0.5}
		x={props.x}
		y={props.y}
		text={`${props.rawSymbol.multiplier}X`}
		style={{
			fontFamily: 'gold',
			fontSize: 50,
		}}
	/>
{/if}
{/snippet}

{#if swingActive}
	<!-- Rotate about the symbol's top-centre: outer container sits at the pivot, inner one
	     cancels the offset so the chain renders in its normal position. -->
	<Container x={pivotX} y={pivotY} rotation={swingRot}>
		<Container x={-pivotX} y={-pivotY}>
			{@render body()}
		</Container>
	</Container>
{:else}
	{@render body()}
{/if}
