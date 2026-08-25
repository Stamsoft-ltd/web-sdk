<script lang="ts" module>
	export type EmitterEventFreeSpinCounter =
		| { type: 'freeSpinCounterShow' }
		| { type: 'freeSpinCounterHide' }
		| { type: 'freeSpinCounterUpdate'; current?: number; total?: number };
</script>

<script lang="ts">
	import { MainContainer } from 'components-layout';
	import { FadeContainer } from 'components-pixi';
	import { Container, Graphics, PIXI, Text } from 'pixi-svelte';
	import { stateBet, stateI18nDerived } from 'state-shared';
	import { bookEventAmountToCurrencyString } from 'utils-shared/amount';
	import { Tween } from 'svelte/motion';
	import { backOut } from 'svelte/easing';

	import { getContext } from '../game/context';
	import { BOARD_SIZES, BOARD_GRID_OFFSET_Y } from '../game/constants';
	import { FRAME_OVER_GRID_X, GRID_OFFSET_X } from '../game/boardArt';

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

	/** Clearance kept between the stack and the edge of the screen, as a fraction of grid width. */
	const EDGE_MARGIN = 0.02;
	/**
	 * Share of the gutter the stack may take, on either side.
	 *
	 * A gutter is not a slot to fill: a plate drawn edge to edge in it reads as a second panel bolted
	 * to the board rather than as a card floating beside it, and on a narrow desktop window that is
	 * far bigger than the design ever shows — the pair end up competing with the reels. Leaving a
	 * margin of gutter on both sides is also what lets the stack be CENTRED in it.
	 */
	const GUTTER_SHARE = 0.72;

	const main = $derived(context.stateLayoutDerived.mainLayout());
	const canvas = $derived(context.stateLayoutDerived.canvasSizes());
	const board = $derived(context.stateGameDerived.boardLayout());
	const gridWidth = $derived(board.width * board.boardScale);

	// The visible screen in main-layout units. main.width is the DESIGN width, which on most canvases
	// is not what the player can actually see — MainContainer scales main-space to fit and lets the
	// long axis overhang — so clamping against it puts the stack off screen or leaves room unused.
	const halfView = $derived(canvas.width / (2 * (main.scale || 1)));
	const viewLeft = $derived(main.width * 0.5 - halfView);
	const viewRight = $derived(main.width * 0.5 + halfView);

	/**
	 * Which side of the grid the stack sits on.
	 *
	 * The design puts it in the right gutter, which is empty on desktop. The small-popout landscape
	 * layout is the exception: there the HUD's control rail owns the right edge, and the plates were
	 * being clamped straight on top of it. That layout's left gutter is clear — the balance and bet
	 * pills sit at the bottom of it, well below where the stack hangs.
	 */
	const onLeft = $derived(context.stateLayoutDerived.layoutType() === 'landscape');

	/**
	 * The board's DRAWN edges, which is what the plates must not run under — the frame is wider than
	 * the grid inside it.
	 *
	 * Derived the way <BoardFrame> derives what it paints (the grid blown up by FRAME_OVER_GRID_X,
	 * shifted by the art's off-centre opening), NOT from boardLayout's frameCx/frameW: the desktop
	 * layout leaves frameCx at 0, so reading it there puts the board's centre at the origin and the
	 * gutter comes out meaningless.
	 */
	const frameWidth = $derived(gridWidth * FRAME_OVER_GRID_X);
	const frameCx = $derived(board.x + frameWidth * GRID_OFFSET_X);
	const frameLeft = $derived(frameCx - frameWidth * 0.5);
	const frameRight = $derived(frameCx + frameWidth * 0.5);
	const gutter = $derived(onLeft ? frameLeft - viewLeft : viewRight - frameRight);
	// A window narrow enough to leave no gutter falls back to the design's own offset over the reels:
	// sizing the plates against a gutter of zero would shrink them away to nothing. Portrait never
	// reaches this — it lays its own row below the board (see PORTRAIT further down).
	const hasGutter = $derived(gutter > gridWidth * 0.12);
	const plateWidth = $derived(
		hasGutter ? Math.min(gridWidth * PLATE.width, gutter * GUTTER_SHARE) : gridWidth * PLATE.width,
	);
	const plateHeight = $derived(plateWidth * (PLATE.height / PLATE.width));
	/**
	 * Centred in whichever gutter the stack is in, on both sides.
	 *
	 * The design's own x (471 of 691) is a measurement of ITS canvas, where the grid leaves exactly
	 * one plate's worth of room to the right. Every other window shape leaves a different gutter, and
	 * pinning to that x put the pair hard against the screen edge with all the slack between them and
	 * the board. Halfway between the frame and the edge of what the player can see is the placement
	 * the design is describing, and it holds at any width.
	 *
	 * With no gutter to centre in, the stack keeps the design's offset over the reels, clamped to stay
	 * on screen.
	 */
	const plateX = $derived(
		hasGutter
			? (onLeft ? viewLeft + frameLeft : frameRight + viewRight) * 0.5
			: Math.min(
					board.x + gridWidth * PLATE.x,
					viewRight - plateWidth * 0.5 - gridWidth * EDGE_MARGIN,
				),
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

	// ── PORTRAIT ─────────────────────────────────────────────────────────────────────────────────
	//
	// A full-bleed board has no side gutter, so the desktop/landscape stack would ride over the reels.
	// Portrait instead lays the two plates in a ROW *below* the board — the same board-local band the
	// duck-pond bonus puts its PICK / TOTAL WIN boxes in (DuckPondBonus `y: BH + …`), so the two
	// bonuses line up and the row always clears the control bar. Units here are the board's own
	// (0..BW, 0..BH), rendered through the board's transform.
	const isPortrait = $derived(context.stateLayoutDerived.layoutType() === 'portrait');
	const BW = BOARD_SIZES.width;
	const BH = BOARD_SIZES.height;
	const PT_PLATE = { w: 372, h: 150, y: BH + 140 };
	// Two plates centred under the board with a small gap between them.
	const PT_GAP = 34;
	const PT_LEFT_X = BW / 2 - PT_GAP / 2 - PT_PLATE.w / 2;
	const PT_RIGHT_X = BW / 2 + PT_GAP / 2 + PT_PLATE.w / 2;
	const PT_LABEL_SIZE = Math.round(PT_PLATE.h * LABEL.size);
	const PT_VALUE_SIZE = Math.round(PT_PLATE.h * VALUE.size);
	// Fit long currency strings to the portrait plate width (board-local units, matching the Text's
	// own font units) rather than the desktop plateWidth.
	const ptTotalWinFit = $derived(
		totalWinWidth > PT_PLATE.w * 0.82 ? (PT_PLATE.w * 0.82) / totalWinWidth : 1,
	);
	const drawPtPlate = (graphics: InstanceType<typeof PIXI.Graphics>) => {
		graphics
			.roundRect(-PT_PLATE.w / 2, -PT_PLATE.h / 2, PT_PLATE.w, PT_PLATE.h, PT_PLATE.h * RADIUS)
			.fill({ color: PLATE_FILL })
			.stroke({ width: Math.max(1, PT_PLATE.h * 0.02), color: PLATE_STROKE, alpha: 0.9 });
	};

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
		{#if isPortrait}
			<!-- Portrait: two plates in a row below the board, rendered through the board's transform so
			     they sit in the same band as the duck-pond bonus boxes. -->
			<Container
				x={board.x}
				y={board.y + BOARD_GRID_OFFSET_Y}
				pivot={board.pivot}
				scale={board.boardScale}
			>
				<Container x={PT_LEFT_X} y={PT_PLATE.y}>
					<Graphics draw={drawPtPlate} />
					<Text
						anchor={0.5}
						y={PT_PLATE.h * LABEL.y}
						text={stateI18nDerived.translate('FREE SPINS')}
						style={textStyle(PT_LABEL_SIZE, LABEL_FILL)}
					/>
					{@const lineWidth = numWidth + restWidth}
					<Container y={PT_PLATE.h * VALUE.y}>
						<Container x={-lineWidth / 2 + numWidth / 2} scale={valuePop.current}>
							<Text
								anchor={0.5}
								text={`${current}`}
								onresize={({ width }) => (numWidth = width)}
								style={textStyle(PT_VALUE_SIZE, VALUE_FILL)}
							/>
						</Container>
						<Text
							anchor={{ x: 0, y: 0.5 }}
							x={-lineWidth / 2 + numWidth}
							text={` ${stateI18nDerived.translate('OF')} ${total}`}
							onresize={({ width }) => (restWidth = width)}
							style={textStyle(PT_VALUE_SIZE, VALUE_FILL)}
						/>
					</Container>
				</Container>

				<Container x={PT_RIGHT_X} y={PT_PLATE.y}>
					<Graphics draw={drawPtPlate} />
					<Text
						anchor={0.5}
						y={PT_PLATE.h * LABEL.y}
						text={stateI18nDerived.translate('TOTAL WIN')}
						style={textStyle(PT_LABEL_SIZE, LABEL_FILL)}
					/>
					<Container y={PT_PLATE.h * VALUE.y} scale={ptTotalWinFit}>
						<Text
							anchor={0.5}
							onresize={({ width }) => (totalWinWidth = width)}
							text={totalWinText}
							style={textStyle(PT_VALUE_SIZE, VALUE_FILL)}
						/>
					</Container>
				</Container>
			</Container>
		{:else}
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
		{/if}
	</FadeContainer>
</MainContainer>
