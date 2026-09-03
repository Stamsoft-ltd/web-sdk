<script lang="ts">
	import { Container, Sprite, Text, type Sizes } from 'pixi-svelte';
	import { Tween } from 'svelte/motion';
	import { backOut } from 'svelte/easing';
	import { bookEventAmountToCurrencyString } from 'utils-shared/amount';

	// The amount readout for an ORDINARY win — the one the player sees on most paying spins, as
	// opposed to the assembled big-win card in WinCard.svelte.
	//
	// MOTHERSHIP redesign: this is the design's own violet plate (art-src/ui/win_plaque.png, built by
	// scripts/build-ui-art.py) with the amount in plain white Chakra Petch. It replaces a plate that
	// was DRAWN here — a dark bed with a gold hairline and gold-gradient text — which belonged to the
	// old palette and was the last gold left on the board.
	const props: {
		amount: number;
		/** Plaque width in main-container units. */
		width: number;
	} = $props();

	// The trimmed art's own pixel box, so the sprite is never stretched.
	const PLATE = { w: 485, h: 287 };
	// Font size as a fraction of the plate HEIGHT (the design sets the number about a third of the
	// plate tall), and how much of its width the longest amount may occupy before it is scaled down.
	const FONT_OF_H = 0.37;
	// Longest sensible run ("$1,234,567.89") still has to clear the plate's inner border.
	const TEXT_FILL = 0.7;

	const w = $derived(props.width);
	const h = $derived((props.width * PLATE.h) / PLATE.w);
	const fontSize = $derived(h * FONT_OF_H);

	// Entry: a single short backOut pop. Small wins come thick and fast, so anything longer than
	// this starts stacking up behind the next spin.
	const pop = new Tween(0, { duration: 260, easing: backOut });
	$effect(() => {
		pop.set(1);
	});
	const enter = $derived(pop.current);

	let textSizes = $state<Sizes>({ width: 0, height: 0 });
	const fit = $derived(
		textSizes.width > w * TEXT_FILL && textSizes.width > 0 ? (w * TEXT_FILL) / textSizes.width : 1,
	);
</script>

<Container alpha={Math.min(1, enter * 1.6)} scale={0.72 + 0.28 * enter}>
	<Sprite key="winPlaque" anchor={0.5} width={w} height={h} />
	<Container scale={fit}>
		<Text
			anchor={0.5}
			onresize={(s) => (textSizes = s)}
			text={bookEventAmountToCurrencyString(props.amount)}
			style={{
				// Audiowide (Figma 9076:28690 — 90.87px, 2.7261 tracking, which is the 0.03em below).
				// Regular is the family's only weight; 700 here would ask PIXI for a synthesised bold.
				fontFamily: 'Audiowide, Chakra Petch, Inter, sans-serif',
				fontWeight: '400',
				fontSize,
				fill: 0xffffff,
				align: 'center',
				letterSpacing: fontSize * (1.92 / 64),
			}}
		/>
	</Container>
</Container>
