<script lang="ts">
	import Symbol from './Symbol.svelte';
	import SymbolWrap from './SymbolWrap.svelte';
	import { getSymbolInfo, getSymbolX } from '../game/utils';
	import { getContext } from '../game/context';
	import type { ReelSymbol } from '../game/stateGame.svelte';

	type Props = {
		reelIndex: number;
		symbolIndex?: number;
		reelSymbol: ReelSymbol;
	};

	const props: Props = $props();
	const context = getContext();
	// Off-frame spin padding can carry an undefined rawSymbol (large anticipation padding runs the
	// reel index far negative); skip those slots so getSymbolInfo never dereferences undefined.
	const rawSymbol = $derived(props.reelSymbol.rawSymbol);
	const symbolInfo = $derived(
		rawSymbol ? getSymbolInfo({ rawSymbol, state: props.reelSymbol.symbolState }) : undefined,
	);
	// A symbol comes alive on the board while a paying line runs through it (paylineWins stays set
	// while the win is shown). Locked cells are additionally animated, pinned, by LockedCells.svelte
	// on top of the board. paylineWins.row is 0-based (grid row = symbols-array index - 1).
	const winning = $derived(
		context.stateGame.paylineWins.some((win) =>
			win.path.some((p) => p.reel === props.reelIndex && p.row === (props.symbolIndex ?? -1) - 1),
		),
	);
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
