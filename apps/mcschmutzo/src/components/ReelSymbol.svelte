<script lang="ts">
	import { untrack } from 'svelte';
	import Symbol from './Symbol.svelte';
	import SymbolWrap from './SymbolWrap.svelte';
	import { getSymbolInfo, getSymbolX } from '../game/utils';
	import { getContext } from '../game/context';
	import { reelLandedAt } from '../game/reelLanding.svelte';
	import { potState } from '../game/potState.svelte';
	import { BOARD_DIMENSIONS, scatterLandRate } from '../game/constants';
	import { focusAlpha, teaseAlpha } from '../game/winFocus.svelte';
	import { idleSpotlight } from '../game/idleSpotlight.svelte';
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
	// The landing ripples up the reel: the bottom row settles first, each row above ROW_LAND_STAGGER_MS
	// later — the column reads as settling under its own weight instead of moving as one rigid strip.
	const ROW_LAND_STAGGER_MS = 28;
	// a win line's symbols pulse left to right, one reel after another
	const WIN_STAGGER_MS = 35;
	const rowFromBottom = $derived(
		Math.min(BOARD_DIMENSIONS.y - 1, Math.max(0, BOARD_DIMENSIONS.y - (props.symbolIndex ?? BOARD_DIMENSIONS.y))),
	);
	// Which scatter of the spin this one is (1st, 2nd, …): counted over the visible rows of the reels
	// to its left plus the rows above it. Each extra scatter lands bigger (Symbol landBoost).
	const isVisibleScatter = (reel: number, row: number) =>
		context.stateGame.board[reel]?.reelState.symbols[row]?.rawSymbol?.name === 'S';
	const scatterOrdinal = $derived.by(() => {
		if (rawSymbol?.name !== 'S' || props.symbolIndex === undefined) return 0;
		let n = 1;
		for (let r = 0; r < props.reelIndex; r += 1)
			for (let row = 1; row <= BOARD_DIMENSIONS.y; row += 1) if (isVisibleScatter(r, row)) n += 1;
		for (let row = 1; row < props.symbolIndex; row += 1) if (isVisibleScatter(props.reelIndex, row)) n += 1;
		return n;
	});
	const landedAt = $derived.by(() => {
		const stamp = reelLandedAt[props.reelIndex];
		return stamp === undefined ? -1 : stamp + rowFromBottom * ROW_LAND_STAGGER_MS;
	});
	// A symbol comes alive on the board while a paying line runs through it (paylineWins stays set
	// while the win is shown). Locked cells are additionally animated, pinned, by LockedCells.svelte
	// on top of the board. paylineWins.row is 0-based (grid row = symbols-array index - 1).
	const winning = $derived(
		context.stateGame.paylineWins.some((win) =>
			win.path.some((p) => p.reel === props.reelIndex && p.row === (props.symbolIndex ?? -1) - 1),
		),
	);
	// the board at rest: this cell's turn to come alive (game/idleSpotlight)
	const spotlight = $derived(idleSpotlight.key === `${props.reelIndex}:${props.symbolIndex}`);
</script>

{#if symbolInfo && rawSymbol}
	<!-- alpha: dims while another cell's win is on show (winFocus) or a reel is teasing the bonus
	     (teaseAlpha), fades out while PotShots shows this cell's soup shooting (potState.hidden) -->
	<SymbolWrap
		x={getSymbolX(props.reelIndex)}
		y={props.reelSymbol.symbolY()}
		animating={false /* every symbol is a sprite (no spine land/win animations to lift) */}
		alpha={focusAlpha(winning) *
			teaseAlpha(motion === 'stopped', rawSymbol.name === 'S') *
			(1 - (potState.hidden[`${props.reelIndex}:${props.symbolIndex}`] ?? 0))}
	>
		<Symbol
			state={props.reelSymbol.symbolState}
			{rawSymbol}
			{winning}
			{spotlight}
			{landedAt}
			winDelay={props.reelIndex * WIN_STAGGER_MS}
			landBoost={1 + 0.15 * (Math.min(Math.max(scatterOrdinal, 1), 5) - 1)}
			landRate={scatterOrdinal > 0 ? scatterLandRate(scatterOrdinal) : 1}
			spinning={motion === 'spinning'}
			oncomplete={() => {
				if (props.reelSymbol.symbolState === 'win') props.reelSymbol.oncomplete();
				if (props.reelSymbol.symbolState === 'land') props.reelSymbol.symbolState = 'static';
			}}
		/>
	</SymbolWrap>
{/if}
