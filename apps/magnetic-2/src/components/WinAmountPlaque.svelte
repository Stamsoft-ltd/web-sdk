<script lang="ts">
	import { Container, Sprite, Text, type Sizes } from 'pixi-svelte';
	import { Tween } from 'svelte/motion';
	import { backOut } from 'svelte/easing';
	import { bookEventAmountToCurrencyString } from 'utils-shared/amount';

	// The amount readout for an ORDINARY win — the one the player sees on most paying spins, as
	// opposed to the assembled big-win card in WinCard.svelte.
	//
	// MOTHERSHIP: the design's purple hex plate with four lime bulbs (Figma 9185:9638, the image
	// fill trimmed to its alpha) with the amount in white Audiowide. It replaced the Version2 navy
	// plate with pink dashes, which in turn replaced a plate DRAWN here with a gold hairline.
	const props: {
		amount: number;
		/** Plaque width in main-container units. */
		width: number;
	} = $props();

	// The trimmed art's own pixel box, so the sprite is never stretched.
	const PLATE = { w: 1591, h: 663 };
	// Font size as a fraction of the plate HEIGHT: the design's 90.87px number sits in a plate whose
	// trimmed art is 177.8 design px tall (the node box is 243.5, but that includes the image's
	// transparent padding), which is the 0.51 here.
	const FONT_OF_H = 0.51;
	// Longest sensible run ("$1,234,567.89") still has to clear the plate's inner bed, which runs
	// from about 16% to 84% of the trimmed width — the bulbs sit outside it.
	const TEXT_FILL = 0.66;

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
