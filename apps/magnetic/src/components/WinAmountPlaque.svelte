<script lang="ts">
	import { Container, Graphics, PIXI, Text, type Sizes } from 'pixi-svelte';
	import { Tween } from 'svelte/motion';
	import { backOut } from 'svelte/easing';
	import { bookEventAmountToCurrencyString } from 'utils-shared/amount';

	import { WIN_GRADIENT } from '../game/goldGradient';

	// The amount readout for an ORDINARY win — the one the player sees on most paying spins, as
	// opposed to the assembled big-win sign in WinSign.svelte.
	//
	// This used to be a bare 128px Orbitron number in flat white, centred on the board with no
	// backing: over a full 7x7 grid of symbols it had nothing to separate it from the art, and
	// Orbitron appears nowhere else in the game (everything is Chakra Petch), so the most-repeated
	// moment in the whole session read as an unstyled overlay.
	//
	// It is now the SAME plaque the big-win sign carries (373x99, #100f0b at a #f1b303 hairline,
	// Chakra Petch 700 in the shared gold gradient) so small wins and big wins are visibly the same
	// family — just sized off the board instead of the sign, and popped in rather than assembled.
	const props: {
		amount: number;
		/** Plaque width in main-container units. */
		width: number;
	} = $props();

	// Design box, shared verbatim with WinSign's amount plaque.
	const PLATE = { w: 373, h: 99, r: 10 };
	const FONT = 64;
	// Longest sensible run ("$1,234,567.89") still has to clear the gold hairline.
	const TEXT_FILL = 0.86;

	const S = $derived(props.width / PLATE.w);
	const w = $derived(PLATE.w * S);
	const h = $derived(PLATE.h * S);

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

	const drawPlate = (g: InstanceType<typeof PIXI.Graphics>) => {
		g.clear();
		if (w <= 0 || h <= 0) return;
		const r = PLATE.r * S;
		// Soft dark bed first: the board underneath is busy and high-contrast, and the plate alone
		// left the gold hairline fighting symbol edges.
		for (let i = 3; i >= 1; i--) {
			const pad = i * 5 * S;
			g.roundRect(-w / 2 - pad, -h / 2 - pad, w + pad * 2, h + pad * 2, r + pad);
			g.fill({ color: 0x000000, alpha: 0.13 });
		}
		g.roundRect(-w / 2, -h / 2, w, h, r);
		g.fill({ color: 0x100f0b, alpha: 0.96 });
		g.roundRect(-w / 2, -h / 2, w, h, r);
		g.stroke({ width: Math.max(1, 1.5 * S), color: 0xf1b303 });
	};
</script>

<Container alpha={Math.min(1, enter * 1.6)} scale={0.72 + 0.28 * enter}>
	<Graphics draw={drawPlate} />
	<Container scale={fit}>
		<Text
			anchor={0.5}
			onresize={(s) => (textSizes = s)}
			text={bookEventAmountToCurrencyString(props.amount)}
			style={{
				fontFamily: 'Chakra Petch, Inter, sans-serif',
				fontWeight: '700',
				fontSize: FONT * S,
				fill: WIN_GRADIENT,
				align: 'center',
				letterSpacing: FONT * S * (1.92 / 64),
			}}
		/>
	</Container>
</Container>
