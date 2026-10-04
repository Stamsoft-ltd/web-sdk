<script lang="ts">
	import { untrack } from 'svelte';
	import Symbol from './Symbol.svelte';
	import SymbolWrap from './SymbolWrap.svelte';
	import { getSymbolInfo, getSymbolX } from '../game/utils';
	import { getContext } from '../game/context';
	import { reelLandedAt } from '../game/reelLanding.svelte';
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
	// The reel lands (motion enters 'bouncing') → stamp the time; every symbol on it bounces from that.
	const motion = $derived(context.stateGame.board[props.reelIndex]?.reelState.motion);
	// Triggered by `motion` only; the stamp is read untracked so writing it can't re-trigger this
	// effect (and every other symbol's on the same reel).
	$effect.pre(() => {
		if (motion !== 'bouncing') return;
		const i = props.reelIndex;
		untrack(() => {
			const now = performance.now();
			if (now - (reelLandedAt[i] ?? -1e9) > 400) reelLandedAt[i] = now;
		});
	});
	const landedAt = $derived(reelLandedAt[props.reelIndex] ?? -1);
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
		animating={false /* every symbol is a sprite (no spine land/win animations to lift) */}
	>
		<Symbol
			state={props.reelSymbol.symbolState}
			{rawSymbol}
			{winning}
			{landedAt}
			oncomplete={() => {
				if (props.reelSymbol.symbolState === 'win') props.reelSymbol.oncomplete();
				if (props.reelSymbol.symbolState === 'land') props.reelSymbol.symbolState = 'static';
			}}
		/>
	</SymbolWrap>
{/if}
