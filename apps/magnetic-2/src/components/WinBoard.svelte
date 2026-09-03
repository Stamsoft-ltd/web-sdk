<script lang="ts">
	import { Container } from 'pixi-svelte';
	import { bookEventAmountToBetAmountMultiplier } from 'utils-shared/amount';

	import WinCard from './WinCard.svelte';
	import { WIN_CARD_TIERS } from '../game/winCardTiers';

	// The tiered win board. ONE board is shown for the whole presentation — the tier for the final
	// win — and WinCard assembles it from the MOTHERSHIP plate, saucer and alien.
	//
	// The tier used to be derived from the LIVE counting amount, so a big win climbed through every
	// intermediate board on its way up (SWEET collapsing into WILD into EPIC...). That read as the
	// game changing its mind about how much the player had won. `tierAmount` is the settled total
	// and is fixed for the presentation; `amount` is the counting value and only drives the text.
	//
	// Two earlier rendering paths stood here and are gone: a single baked board sprite plus
	// WinBoardFx frame lights (retired once every tier had loose parts), and the five-part-per-tier
	// sign of WinSign.svelte + game/winSignTiers.ts, which the MOTHERSHIP card replaced on
	// 2026-09-03. The tier now decides only a wordmark and an accent colour.
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
		mult >= 25000
			? 'max'
			: mult >= 500
				? 'legendary'
				: mult >= 200
					? 'mythic'
					: mult >= 100
						? 'epic'
						: mult >= 50
							? 'wild'
							: 'sweet',
	);
</script>

<!-- The assembled card, centred on the SCREEN like the design frame. WinCard owns its whole
     entrance (plate up from the bottom, texts down from the top, saucer in from far away). -->
<Container x={maxOffX} y={maxOffY}>
	<WinCard tier={WIN_CARD_TIERS[targetKey]} {amount} {screenW} {screenH} />
</Container>
