<script lang="ts">
	import { Container } from 'pixi-svelte';
	import { bookEventAmountToBetAmountMultiplier } from 'utils-shared/amount';

	import WinSign from './WinSign.svelte';
	import { WIN_SIGN_TIERS } from '../game/winSignTiers';

	// The tiered win board. ONE board is shown for the whole presentation — the tier for the final
	// win — and WinSign assembles it from loose parts.
	//
	// The tier used to be derived from the LIVE counting amount, so a big win climbed through every
	// intermediate board on its way up (SWEET collapsing into WILD into EPIC...). That read as the
	// game changing its mind about how much the player had won. `tierAmount` is the settled total
	// and is fixed for the presentation; `amount` is the counting value and only drives the text.
	//
	// This used to carry a SECOND rendering path for tiers still on the pre-Version2 baked board art
	// (a single sprite plus WinBoardFx frame lights, medallion gems, bay-fitted amount text). MAX WIN
	// was the last key on it; with its Version2 parts in place every key `targetKey` can produce is
	// in WIN_SIGN_TIERS, so that path was unreachable and is gone. WinBoardFx.svelte and
	// game/winBoardLogoPaths.ts were its only consumers and are now unreferenced.
	const {
		amount,
		tierAmount,
		screenW,
		screenH,
		maxOffX,
		maxOffY,
	}: {
		amount: number;
		tierAmount: number;
		screenW: number;
		screenH: number;
		maxOffX: number;
		maxOffY: number;
	} = $props();

	// Win multiplier = book amount ÷ 100 (100 book units = 1× bet).
	// Tier thresholds (× bet): <50 SWEET · 50 WILD · 100 EPIC · 200 MYTHIC · 500 LEGENDARY.
	// MAX WIN is reserved for the TRUE 25000x win cap.
	const mult = $derived(bookEventAmountToBetAmountMultiplier(tierAmount));
	const targetKey = $derived(
		mult >= 25000 ? 'maxWinBoard'
		: mult >= 500 ? 'legendaryWinBoard'
		: mult >= 200 ? 'mythicWinBoard'
		: mult >= 100 ? 'epicWinBoard'
		: mult >= 50 ? 'wildWinBoard'
		: 'sweetWinBoard',
	);
</script>

<!-- The assembled sign, centred on the SCREEN like the design frame. WinSign owns its whole
     entrance (parts flying in from the sides/top/bottom + landing impacts). -->
<Container x={maxOffX} y={maxOffY}>
	<WinSign tier={WIN_SIGN_TIERS[targetKey]} {amount} {screenW} {screenH} />
</Container>
