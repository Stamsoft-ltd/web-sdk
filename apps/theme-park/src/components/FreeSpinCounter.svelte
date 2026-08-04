<script lang="ts" module>
	export type EmitterEventFreeSpinCounter =
		| { type: 'freeSpinCounterShow' }
		| { type: 'freeSpinCounterHide' }
		| { type: 'freeSpinCounterUpdate'; current?: number; total?: number };
</script>

<script lang="ts">
	import { MainContainer } from 'components-layout';
	import { FadeContainer } from 'components-pixi';
	import { Container, Graphics, Text } from 'pixi-svelte';
	import { stateBet, stateI18nDerived } from 'state-shared';
	import { bookEventAmountToCurrencyString } from 'utils-shared/amount';
	import { Tween } from 'svelte/motion';
	import { backOut } from 'svelte/easing';

	import { getContext } from '../game/context';

	const context = getContext();

	// ── FREE SPINS / TOTAL WIN plates, Figma 6074:3067 ───────────────────────────────────────────
	//
	// Two 205x103 plates stacked in the gutter right of the grid, the upper one top-aligned with it.
	// Everything is a fraction of the GRID WIDTH (691 in the design) rather than of the frame: the
	// grid is the one thing laid out per layout type, and the plates have to stay pinned to its edge
	// whatever the canvas shape does. Offsets are from the grid's centre, which is what boardLayout
	// reports.
	const DESIGN_GRID_W = 691;
	const PLATE = {
		width: 205 / DESIGN_GRID_W,
		height: 103 / DESIGN_GRID_W,
		x: 471 / DESIGN_GRID_W,
		freeSpinsY: -178 / DESIGN_GRID_W,
		// The design leaves 2 between the plates, which reads as a gap only because its plate art
		// fades out at the edge. A drawn hairline has no such falloff, so the two borders merged into
		// one line — 12 is the smallest gap that keeps them reading as separate plates.
		totalWinY: -63 / DESIGN_GRID_W,
	};
	// Within a plate, as a fraction of its own height.
	const LABEL = { y: -19 / 103, size: 18 / 103 };
	const VALUE = { y: 11 / 103, size: 32 / 103 };
	const RADIUS = 12 / 103;
	// The violet the design shares with the bonus panels, over a white value.
	const LABEL_FILL = 0xb934f6;
	const VALUE_FILL = 0xffffff;
	// Sampled from the design: a near-black violet well behind a magenta hairline — the same pair the
	// bonus panels use for their count and amount wells. Drawn rather than shipped as art: the plate
	// is a plain rounded rectangle, drawing it keeps the hairline crisp at every size, and Figma's
	// export of the layer bakes in an opaque white margin that the design itself never shows (the
	// layer blends against the scene, which the flat PNG cannot).
	const PLATE_FILL = 0x160139;
	const PLATE_STROKE = 0xab34f4;

	const main = $derived(context.stateLayoutDerived.mainLayout());
	const board = $derived(context.stateGameDerived.boardLayout());
	const gridWidth = $derived(board.width * board.boardScale);
	const plateWidth = $derived(gridWidth * PLATE.width);
	const plateHeight = $derived(gridWidth * PLATE.height);
	// A canvas narrower than the design's 1.79 leaves less gutter than the design assumes, so the
	// stack is held inside the frame rather than allowed to run off the right edge.
	const plateX = $derived(
		Math.min(board.x + gridWidth * PLATE.x, main.width - plateWidth * 0.5 - plateHeight * 0.1),
	);

	const textStyle = (fontSize: number, fill: number) => ({
		fontFamily: 'Helvetica, Arial, sans-serif',
		fontWeight: '700' as const,
		fontSize,
		fill,
		align: 'center' as const,
		letterSpacing: fontSize * 0.02,
	});

	let show = $state(false);
	let current = $state(0);
	let total = $state(0);
	let totalWinWidth = $state(0);
	// Widths of the two halves of the "N OF M" line, so it can stay centred as a unit while
	// only the number carries the pop.
	let numWidth = $state(0);
	let restWidth = $state(0);

	// Each tick of the spin counter pops the CURRENT NUMBER only: snap small, overshoot back to 1.
	const POP_MS = 320;
	const valuePop = new Tween(1, { duration: POP_MS, easing: backOut });
	const popValue = () => {
		valuePop.set(0.55, { duration: 0 });
		valuePop.set(1, { duration: POP_MS, easing: backOut });
	};

	const totalWinText = $derived(bookEventAmountToCurrencyString(stateBet.winBookEventAmount));
	// Long currency strings are scaled down rather than allowed to spill past the neon border.
	const totalWinFit = $derived(
		totalWinWidth > plateWidth * 0.82 ? (plateWidth * 0.82) / totalWinWidth : 1,
	);

	context.eventEmitter.subscribeOnMount({
		freeSpinCounterShow: () => {
			show = false;
			current = 0;
		},
		freeSpinCounterHide: () => {
			show = false;
		},
		freeSpinCounterUpdate: (emitterEvent) => {
			if (emitterEvent.current !== undefined) {
				if (emitterEvent.current !== current) popValue();
				current = emitterEvent.current;
				show = true;
			}
			if (emitterEvent.total !== undefined) total = emitterEvent.total;
		},
	});
</script>

<MainContainer>
	<FadeContainer {show}>
		{@const labelSize = Math.round(plateHeight * LABEL.size)}
		{@const valueSize = Math.round(plateHeight * VALUE.size)}
		<Container x={plateX} y={board.y + gridWidth * PLATE.freeSpinsY}>
			<Graphics
				draw={(graphics) => {
					graphics
						.roundRect(
							-plateWidth / 2,
							-plateHeight / 2,
							plateWidth,
							plateHeight,
							plateHeight * RADIUS,
						)
						.fill({ color: PLATE_FILL })
						.stroke({ width: Math.max(1, plateHeight * 0.02), color: PLATE_STROKE, alpha: 0.9 });
				}}
			/>
			<Text
				anchor={0.5}
				y={plateHeight * LABEL.y}
				text={stateI18nDerived.translate('FREE SPINS')}
				style={textStyle(labelSize, LABEL_FILL)}
			/>
			{@const lineWidth = numWidth + restWidth}
			<Container y={plateHeight * VALUE.y}>
				<Container x={-lineWidth / 2 + numWidth / 2} scale={valuePop.current}>
					<Text
						anchor={0.5}
						text={`${current}`}
						onresize={({ width }) => (numWidth = width)}
						style={textStyle(valueSize, VALUE_FILL)}
					/>
				</Container>
				<Text
					anchor={{ x: 0, y: 0.5 }}
					x={-lineWidth / 2 + numWidth}
					text={` ${stateI18nDerived.translate('OF')} ${total}`}
					onresize={({ width }) => (restWidth = width)}
					style={textStyle(valueSize, VALUE_FILL)}
				/>
			</Container>
		</Container>

		<Container x={plateX} y={board.y + gridWidth * PLATE.totalWinY}>
			<Graphics
				draw={(graphics) => {
					graphics
						.roundRect(
							-plateWidth / 2,
							-plateHeight / 2,
							plateWidth,
							plateHeight,
							plateHeight * RADIUS,
						)
						.fill({ color: PLATE_FILL })
						.stroke({ width: Math.max(1, plateHeight * 0.02), color: PLATE_STROKE, alpha: 0.9 });
				}}
			/>
			<Text
				anchor={0.5}
				y={plateHeight * LABEL.y}
				text={stateI18nDerived.translate('TOTAL WIN')}
				style={textStyle(labelSize, LABEL_FILL)}
			/>
			<Container y={plateHeight * VALUE.y} scale={totalWinFit}>
				<Text
					anchor={0.5}
					onresize={({ width }) => (totalWinWidth = width)}
					text={totalWinText}
					style={textStyle(valueSize, VALUE_FILL)}
				/>
			</Container>
		</Container>
	</FadeContainer>
</MainContainer>
