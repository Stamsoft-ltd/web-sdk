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
	// A win line over a symbol makes it come alive. Locked cells are pinned + animated separately by
	// LockedCells.svelte (drawn on top of the board), so the board itself only reacts to wins.
	const winning = $derived(props.reelSymbol.symbolState === 'win');
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
			{winning}
			oncomplete={() => {
				if (props.reelSymbol.symbolState === 'win') props.reelSymbol.oncomplete();
				if (props.reelSymbol.symbolState === 'land') props.reelSymbol.symbolState = 'static';
			}}
		/>
	</SymbolWrap>
{/if}
