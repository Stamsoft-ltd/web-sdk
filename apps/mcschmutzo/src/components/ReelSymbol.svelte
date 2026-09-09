<script lang="ts">
	import Symbol from './Symbol.svelte';
	import SymbolWrap from './SymbolWrap.svelte';
	import { getSymbolInfo, getSymbolX } from '../game/utils';
	import type { ReelSymbol } from '../game/stateGame.svelte';

	type Props = {
		reelIndex: number;
		reelSymbol: ReelSymbol;
	};

	const props: Props = $props();
	// Off-frame spin padding can carry an undefined rawSymbol (large anticipation padding runs the
	// reel index far negative); skip those slots so getSymbolInfo never dereferences undefined.
	const rawSymbol = $derived(props.reelSymbol.rawSymbol);
	const symbolInfo = $derived(
		rawSymbol ? getSymbolInfo({ rawSymbol, state: props.reelSymbol.symbolState }) : undefined,
	);
	// The come-alive animation fires only when a symbol becomes "yellow" (locked/active), handled by
	// LockedCells.svelte on top of the board. The board copy never animates — this game locks every
	// winning symbol, so animating on the win too would play it twice (win, then lock).
</script>

{#if symbolInfo && rawSymbol}
	<SymbolWrap
		x={getSymbolX(props.reelIndex)}
		y={props.reelSymbol.symbolY()}
		animating={symbolInfo.type === 'spine' &&
			(props.reelSymbol.symbolState === 'land' || props.reelSymbol.symbolState === 'win')}
	>
		<Symbol
			state={props.reelSymbol.symbolState}
			{rawSymbol}
			oncomplete={() => {
				if (props.reelSymbol.symbolState === 'win') props.reelSymbol.oncomplete();
				if (props.reelSymbol.symbolState === 'land') props.reelSymbol.symbolState = 'static';
			}}
		/>
	</SymbolWrap>
{/if}
