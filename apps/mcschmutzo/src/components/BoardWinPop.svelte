<script lang="ts" module>
	export type EmitterEventBoardWinPop = { type: 'boardWinPop'; amount: number };
</script>

<script lang="ts">
	import { Container } from 'pixi-svelte';
	import { ResponsiveText } from 'components-pixi';
	import { MainContainer } from 'components-layout';
	import { bookEventAmountToCurrencyString } from 'utils-shared/amount';

	import { SYMBOL_SIZE, SYMBOL_WIDTH } from '../game/constants';
	import { getContext } from '../game/context';

	// Ordinary wins (no win screen): a small amount pops up over the middle of the winning symbols —
	// the symbols stay the event — holds, then rises and fades, while the WIN readout counts the same
	// amount up and the win lines keep playing. The text is set once per pop; only the container's
	// transform / alpha animate.
	const context = getContext();
	const board = $derived(context.stateGameDerived.boardLayout());

	const POP_IN_MS = 280;
	const FADE_FROM_MS = 820;
	const TOTAL_MS = 1150;
	const RISE = SYMBOL_SIZE * 0.22;
	const FONT_SIZE = SYMBOL_SIZE * 0.36;

	let text = $state('');
	// where it pops: the centre of the winning cells (board-local), or the board centre without lines
	let at = $state({ x: 0, y: 0 });
	let start = $state(-1);
	let now = $state(0);
	let raf = 0;

	context.eventEmitter.subscribeOnMount({
		boardWinPop: ({ amount }) => {
			text = bookEventAmountToCurrencyString(amount);
			const cells = context.stateGame.paylineWins.flatMap((win) => win.path);
			at = cells.length
				? {
						x: (cells.reduce((sum, c) => sum + c.reel + 0.5, 0) / cells.length) * SYMBOL_WIDTH - board.pivot.x,
						y: (cells.reduce((sum, c) => sum + c.row + 0.5, 0) / cells.length) * SYMBOL_SIZE - board.pivot.y,
					}
				: { x: 0, y: 0 };
			cancelAnimationFrame(raf);
			start = performance.now();
			now = start;
			const loop = (ts: number) => {
				now = ts;
				if (ts - start < TOTAL_MS) raf = requestAnimationFrame(loop);
				else start = -1;
			};
			raf = requestAnimationFrame(loop);
		},
	});
	$effect(() => () => cancelAnimationFrame(raf));

	const anim = $derived.by(() => {
		const ms = now - start;
		// pop in on a back-out curve (0.55 → ~1.1 → 1)
		const p = Math.min(1, ms / POP_IN_MS);
		const c = 1.7;
		const backOut = 1 + (c + 1) * (p - 1) ** 3 + c * (p - 1) ** 2;
		// go: swell to 1.1 while rising, then shrink away as it fades (1 → 1.1 → 0)
		const f = Math.max(0, (ms - FADE_FROM_MS) / (TOTAL_MS - FADE_FROM_MS));
		const out = f < 0.4 ? 1 + 0.1 * Math.sin((f / 0.4) * (Math.PI / 2)) : 1.1 * (1 - ((f - 0.4) / 0.6) ** 2);
		return {
			scale: (0.55 + 0.45 * backOut) * out,
			y: -RISE * f * f,
			alpha: Math.min(1, ms / 90) * (f < 0.4 ? 1 : 1 - ((f - 0.4) / 0.6) ** 2),
		};
	});
</script>

{#if start >= 0 && text}
	<MainContainer>
		<Container x={board.x + at.x} y={board.y + at.y + anim.y} scale={anim.scale} alpha={anim.alpha}>
			<ResponsiveText
				anchor={0.5}
				maxWidth={board.width * 0.5}
				{text}
				style={{
					fontFamily: 'Bowlby One SC',
					fontWeight: '400',
					fill: 0xfff1cf,
					fontSize: FONT_SIZE,
					letterSpacing: FONT_SIZE * 0.03,
					align: 'center',
					stroke: { color: 0x7a1608, width: FONT_SIZE * 0.16, join: 'round' },
					dropShadow: { color: 0x000000, alpha: 0.45, blur: 4, distance: FONT_SIZE * 0.08, angle: Math.PI / 2 },
				}}
			/>
		</Container>
	</MainContainer>
{/if}
