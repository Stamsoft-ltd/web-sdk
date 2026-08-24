<script lang="ts" module>
	import type { DuckKind } from '../game/types';

	export type DuckPondPrize = { kind: DuckKind; value: number };

	export type EmitterEventDuckPond =
		| { type: 'duckPondShow'; totalPicks: number; pool: DuckPondPrize[]; seed: number }
		| {
				type: 'duckPondPick';
				pickIndex: number;
				kind: DuckKind;
				value: number;
				runningTotal: number;
		  }
		| { type: 'duckPondFinish'; amount: number }
		| { type: 'duckPondHide' };
</script>

<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { Container, Sprite, Text } from 'pixi-svelte';
	import { Button, FadeContainer } from 'components-pixi';
	import { MainContainer } from 'components-layout';
	import { waitForResolve, waitForTimeout } from 'utils-shared/wait';
	import { bookEventAmountToCurrencyString } from 'utils-shared/amount';
	import { stateI18nDerived } from 'state-shared';

	import { getContext } from '../game/context';
	import { stripEmptyCurrencyDecimals } from '../game/currency';
	import { duckLookForIndex, duckVariantForIndex } from '../game/duckVisual';
	import DuckPondDuck from './DuckPondDuck.svelte';
	import PondPanel from './PondPanel.svelte';
	import {
		BOARD_DIMENSIONS,
		BOARD_GRID_OFFSET_Y,
		BOARD_SIZES,
		SYMBOL_H,
		CELL_W,
		SYMBOL_W,
	} from '../game/constants';

	type PendingPick = { pickIndex: number; kind: DuckKind; value: number; runningTotal: number };
	type PondDuck = {
		prize: DuckPondPrize | null;
		selected: boolean;
		variant: number;
		look: number;
	};

	const POND_SIZE = 25;
	const context = getContext();
	const layout = $derived(context.stateGameDerived.boardLayout());
	const turnReady = $derived(!!context.stateApp.loadedAssets?.duckPondTurn);
	let show = $state(false);
	let totalPicks = $state(10);
	let prizePool = $state<DuckPondPrize[]>([]);
	let ducks = $state<PondDuck[]>([]);
	let pendingPick = $state<PendingPick | null>(null);
	let revealingPick = $state<PendingPick | null>(null);
	let revealingIndex = $state<number | null>(null);
	let finalRevealIndices = $state<number[]>([]);
	let runningTotal = $state(0);
	let resolveSelection: () => void = () => {};
	let resolveFinalReveal: () => void = () => {};
	let skipAllowedAt = 0;

	const emptyPond = (eventId: number) =>
		Array.from(
			{ length: POND_SIZE },
			(_, index): PondDuck => ({
				prize: null,
				selected: false,
				// Event-seeded variety stays unchanged for the complete bonus and replay.
				variant: duckVariantForIndex(eventId, index),
				look: duckLookForIndex(eventId, index),
			}),
		);

	const releasePending = () => {
		const resolve = resolveSelection;
		resolveSelection = () => {};
		resolve();
	};
	const releaseFinalReveal = () => {
		const resolve = resolveFinalReveal;
		resolveFinalReveal = () => {};
		resolve();
	};

	onDestroy(() => {
		releasePending();
		releaseFinalReveal();
	});

	context.eventEmitter.subscribeOnMount({
		duckPondShow: (event) => {
			releasePending();
			releaseFinalReveal();
			totalPicks = event.totalPicks;
			prizePool = [...event.pool];
			ducks = emptyPond(event.seed);
			pendingPick = null;
			revealingPick = null;
			revealingIndex = null;
			finalRevealIndices = [];
			runningTotal = 0;
			show = true;
		},
		// Book playback remains blocked until the user picks an actual reel cell.
		duckPondPick: async (event) => {
			pendingPick = { ...event };
			await waitForResolve((resolve) => (resolveSelection = resolve));
		},
		duckPondFinish: async (event) => {
			runningTotal = event.amount;
			const hiddenIndices = ducks.flatMap((duck, index) => (duck.selected ? [] : [index]));
			const fakePrizes = prizePool.slice(totalPicks);
			let fakeIndex = 0;
			ducks = ducks.map((duck) =>
				duck.selected
					? duck
					: {
							...duck,
							prize: fakePrizes[fakeIndex++] ??
								prizePool[(totalPicks + fakeIndex - 1) % prizePool.length] ?? {
									kind: 'mult',
									value: 0,
								},
						},
			);
			finalRevealIndices = hiddenIndices;
			context.eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_duck_land' });
			if (hiddenIndices.length > 0 && turnReady) {
				await waitForResolve((resolve) => (resolveFinalReveal = resolve));
			} else if (hiddenIndices.length > 0) {
				await waitForTimeout(400);
				finalRevealIndices = [];
			}
			// Let the complete fake board read before the normal win/outro sequence takes over.
			await waitForTimeout(2000);
		},
		duckPondHide: () => {
			releasePending();
			releaseFinalReveal();
			show = false;
			prizePool = [];
			ducks = [];
			pendingPick = null;
			revealingPick = null;
			revealingIndex = null;
			finalRevealIndices = [];
		},
	});

	const chooseDuck = async (pondIndex: number) => {
		if (!pendingPick || ducks[pondIndex]?.selected || revealingIndex !== null) return;
		const result = pendingPick;
		pendingPick = null;
		revealingPick = result;
		revealingIndex = pondIndex;
		// The native click generated after Pixi's pointer-up is the same click that selected the duck.
		// Do not let the global skip handler consume the turn animation in that same event sequence.
		skipAllowedAt = performance.now() + 140;
		// The clicked duck turns in its own cell; its rear pose and butt prize remain visible.
		ducks = ducks.map((duck, index) =>
			index === pondIndex
				? {
						...duck,
						prize: { kind: result.kind, value: result.value },
						selected: true,
					}
				: duck,
		);
		context.eventEmitter.broadcast({
			type: 'soundOnce',
			name: 'sfx_duck_click',
			forcePlay: true,
		});
		// Asset failure must never leave the book waiting forever for a Spine completion event.
		if (!turnReady) {
			await waitForTimeout(400);
			finishDuckReveal(pondIndex);
		}
	};

	function finishDuckReveal(pondIndex: number) {
		if (revealingIndex !== pondIndex || !revealingPick) return;
		runningTotal = revealingPick.runningTotal;
		revealingPick = null;
		revealingIndex = null;
		releasePending();
	}

	function finishFinalDuckReveal(pondIndex: number) {
		if (!finalRevealIndices.includes(pondIndex)) return;
		finalRevealIndices = finalRevealIndices.filter((index) => index !== pondIndex);
		if (finalRevealIndices.length === 0) releaseFinalReveal();
	}

	const skipDuckReveal = () => {
		if (revealingIndex === null) return;
		finishDuckReveal(revealingIndex);
	};

	onMount(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.code !== 'Space' || revealingIndex === null) return;
			event.preventDefault();
			event.stopImmediatePropagation();
			skipDuckReveal();
		};
		const onClick = (event: MouseEvent) => {
			if (revealingIndex === null) return;
			if (performance.now() < skipAllowedAt) return;
			event.preventDefault();
			event.stopImmediatePropagation();
			skipDuckReveal();
		};
		window.addEventListener('keydown', onKeyDown, { capture: true });
		window.addEventListener('click', onClick, { capture: true });
		return () => {
			window.removeEventListener('keydown', onKeyDown, { capture: true });
			window.removeEventListener('click', onClick, { capture: true });
		};
	});

	const pickedCount = $derived(ducks.filter((duck) => duck.selected).length);
	const remainingPicks = $derived(Math.max(0, totalPicks - pickedCount));
	// Columns squeeze symmetrically toward the centre (outer columns move in ~14px, middle stays)
	// so the edge ducks' splashes stay on the water instead of clipping the side rails — the water
	// opening is narrower than the reel grid.
	const cellX = (index: number) => {
		const col = index % BOARD_DIMENSIONS.x;
		return (
			CELL_W * (col + 0.5) +
			(14 * ((BOARD_DIMENSIONS.x - 1) / 2 - col)) / ((BOARD_DIMENSIONS.x - 1) / 2)
		);
	};
	// Sized off the reference: the duck-and-ring art takes ~85% of the row pitch, leaving open water
	// between rows. (The desktop mock's nominal 1.2× pitch reads far too big against real art.)
	const DUCK_SIZE = SYMBOL_H * 1;
	// Splash disc, as fractions of the duck: how far its centre sits below the duck's, how wide it
	// is drawn and the aspect it is drawn at. Named because the grid below has to know how far the
	// pond's ink reaches, and the splash — not the ring — is its lowest point.
	const SPLASH_DROP = 0.28;
	const SPLASH_WIDTH = 1.28;
	const SPLASH_ASPECT = 1.484;

	// Where the pond's ink sits against a duck's own centre, in duck-sizes. The rig is a 384 square
	// and the bird is NOT centred in it: its crown is 142/384 above the middle, while the splash
	// reaches further below than the swim ring does.
	const DUCK_RISE = (192 - 50) / 384;
	const DUCK_DROP = SPLASH_DROP + SPLASH_WIDTH / SPLASH_ASPECT / 2;

	// Rows sit on their own pitch, centred as one block on the board — not on the reel grid's cell
	// centres. Two things used to push the pond up: the rows were laid out on SYMBOL_H (the art
	// size) rather than the board's taller row pitch, and a lift then raised each successive row up
	// to a further ~26% of a cell to keep the bottom splash off the frame's rail. Together they left
	// a band of empty water along the bottom roughly five times the gap at the top. Centring the ink
	// gives the bottom row that clearance on its own, and gives the top row the same.
	const GRID_PITCH = SYMBOL_H;
	const GRID_TOP = (BOARD_SIZES.height -
		((BOARD_DIMENSIONS.y - 1) * GRID_PITCH + (DUCK_RISE + DUCK_DROP) * DUCK_SIZE)) / 2;
	const cellY = (index: number) =>
		GRID_TOP + DUCK_RISE * DUCK_SIZE + GRID_PITCH * Math.floor(index / BOARD_DIMENSIONS.x);

	// ── Figma chrome layout ────────────────────────────────────────────────────────────────────────
	//
	// Everything below maps the three mocks into board space (origin = grid top-left). The desktop
	// mock's board interior is 579px wide against BOARD_SIZES.width, so K converts its px 1:1; the
	// portrait/landscape mocks get their own X/Y factors because their (mobile-frame) interiors have
	// a different cell aspect than the game grid — positions land on the same board-relative spots.
	const K = BOARD_SIZES.width / 579;
	const BW = BOARD_SIZES.width;
	const BH = BOARD_SIZES.height;

	type Placed = { x: number; y: number; w: number; h: number };
	/** Counter plate: `length` along the duck row, `thick` across it; vertical rotates the plate. */
	type Counter = { x: number; y: number; length: number; thick: number; vertical: boolean };
	type PondUi = {
		logo: Placed;
		counter: Counter;
		pick: Placed & { textY: number; base: number; num: number };
		total: Placed & { titleY: number; valueY: number; title: number; value: number };
	};

	/** Counter plate proportions, from the reference shot: ~5.1:1 plate, ducks padded in from the
	 * neon edge, with clear space between neighbours (the gap is ~18% of a duck). */
	const COUNTER_ASPECT = 5.1;
	const COUNTER_ROW_SPAN = 0.92;
	const COUNTER_GAP = 0.08;

	const layoutType = $derived(context.stateLayoutDerived.layoutType());
	const mode = $derived(
		layoutType === 'portrait' ? 'portrait' : layoutType === 'landscape' ? 'landscape' : 'desktop',
	);

	// Side chrome sits outside the grid; on canvases narrower than the mocks it scales toward the
	// board edge instead of running off screen. Portrait keeps 1 — its chrome stacks above/below.
	const sideRooms = $derived.by(() => {
		if (mode === 'portrait') return { left: 1, right: 1 };
		const bs = layout.boardScale || 1;
		const mainW = context.stateLayoutDerived.mainLayout().width;
		const roomL = layout.x / bs - layout.pivot.x;
		const roomR = (mainW - layout.x) / bs - layout.pivot.x;
		const need = mode === 'desktop' ? { left: 420, right: 330 } : { left: 440, right: 210 };
		const clamp = (room: number, needed: number) => Math.max(0.55, Math.min(1, room / needed));
		return { left: clamp(roomL, need.left), right: clamp(roomR, need.right) };
	});

	// Pull an element placed outside the board toward the nearer edge by the side scale factor.
	const place = (x: number, y: number, w: number, h: number): Placed & { s: number } => {
		const s = x < 0 ? sideRooms.left : x > BW ? sideRooms.right : 1;
		const anchor = x < 0 ? 0 : BW;
		return { x: anchor + (x - anchor) * s, y, w: w * s, h: h * s, s };
	};

	const ui = $derived.by((): PondUi => {
		if (mode === 'portrait') {
			// Figma 6692:4403 — chrome above/below the board, gold-gradient numbers.
			return {
				logo: { x: 34, y: -116, w: 110, h: 112 },
				counter: {
					x: BW / 2,
					y: BH + 52,
					length: 463,
					thick: 463 / COUNTER_ASPECT,
					vertical: false,
				},
				pick: { x: 169, y: BH + 156, w: 383, h: 146, textY: BH + 148, base: 27, num: 55 },
				total: {
					x: 604,
					y: BH + 156,
					w: 374,
					h: 143,
					titleY: BH + 122,
					valueY: BH + 166,
					title: 27,
					value: 71,
				},
			};
		}
		if (mode === 'landscape') {
			// Figma 6449:3212 — panels stacked on the left rail, counter runs vertically on the right.
			const pickP = place(-272, 104, 260, 184);
			const totalP = place(-272, 279, 260, 174);
			const counterP = place(945, 161, 372 / COUNTER_ASPECT, 372);
			const logoP = place(-385, -53, 97, 98);
			return {
				logo: logoP,
				counter: {
					x: counterP.x,
					y: counterP.y,
					length: counterP.h,
					thick: counterP.w,
					vertical: true,
				},
				pick: { ...pickP, textY: pickP.y, base: 24 * pickP.s, num: 47 * pickP.s },
				total: {
					...totalP,
					titleY: totalP.y - 31 * totalP.s,
					valueY: totalP.y + 17 * totalP.s,
					title: 24 * totalP.s,
					value: 50 * totalP.s,
				},
			};
		}
		// Figma 6471:6288 — desktop: logo + counter + pick on the left, TOTAL WIN on the right.
		const logoP = place(-229.5 * K, -20.4 * K, 112 * K, 113 * K);
		const counterP = place(-169.5 * K, 81 * K, 240 * K, (240 * K) / COUNTER_ASPECT);
		const pickP = place(-169.5 * K, 161.8 * K, 234.6 * K, 109 * K);
		const totalP = place(711 * K, 148 * K, 194 * K, 133 * K);
		return {
			logo: logoP,
			counter: {
				x: counterP.x,
				y: counterP.y,
				length: counterP.w,
				thick: counterP.h,
				vertical: false,
			},
			pick: {
				...pickP,
				textY: pickP.y - 4.7 * K * pickP.s,
				base: 18 * K * pickP.s,
				num: 38 * K * pickP.s,
			},
			total: {
				...totalP,
				titleY: totalP.y - 34.9 * K * totalP.s,
				valueY: totalP.y + 14.1 * K * totalP.s,
				title: 18 * K * totalP.s,
				value: 48 * K * totalP.s,
			},
		};
	});

	const NUM_PURPLE = 0xe471f6;

	// Figma 6471:6347 and 6503:7416: the numbers and PICK ... DUCKS are the display face, Lilita
	// One; only the TOTAL WIN caption above the value is body type. Letter-spacing is 3% of the
	// size at every specced size (0.54/18, 1.14/38, 1.44/48). Both faces are self-hosted in
	// app.html, and <Game> fonts.load()s them so canvas text does not fall back.
	const textStyle = (fontSize: number, fill: number) => ({
		fontFamily: 'Lilita One',
		fontWeight: '400' as const,
		fontSize,
		align: 'center' as const,
		fill,
		letterSpacing: fontSize * 0.03,
	});
	const captionStyle = (fontSize: number, fill: number) => ({
		...textStyle(fontSize, fill),
		fontFamily: 'Nunito Sans',
		fontWeight: '700' as const,
	});

	// PICK <n> DUCKS is three runs (the number is bigger and coloured), centred as one line off
	// their measured widths — same trick as <FreeSpinCounter>. The words are BASELINE-aligned to
	// the number (per the mock), not box-centred: everything bottom-anchors at the number's half
	// height, with the words lifted by the descent-padding difference between the two font sizes
	// (Inter's bbox descent is ~24% of the size) so the baselines meet.
	let pickW = $state(0);
	let numW = $state(0);
	let numH = $state(0);
	let ducksW = $state(0);
	const pickLineW = $derived(pickW + numW + ducksW);
	const wordsY = $derived(numH / 2 - 0.24 * (ui.pick.num - ui.pick.base));

	// "PICK %count% DUCKS" as one catalogue string, split around the number so the big purple count
	// keeps its own style while the words localise AND reorder — languages that place the number first
	// (Turkish, Hindi) get an empty leading part and all the text after it.
	const pickParts = $derived(stateI18nDerived.translate('PICK N DUCKS').split('%count%'));
	const pickBefore = $derived(pickParts[0] ?? '');
	const pickAfter = $derived(pickParts.length > 1 ? pickParts[pickParts.length - 1] : '');

	const totalLabel = $derived(
		stripEmptyCurrencyDecimals(bookEventAmountToCurrencyString(runningTotal)),
	);
	const totalValueSize = $derived(
		Math.round(
			Math.max(ui.total.value * 0.48, ui.total.value * Math.min(1, 6.5 / totalLabel.length)),
		),
	);

	// The pond art is in the deferred tier. <Sprite> width/height are synced against whatever
	// texture is current at the time, so mounting these against Texture.EMPTY and having the real
	// texture land later leaves the sprites at a garbage scale (the giant-duck bug). Nothing pond
	// renders until its art is actually loaded.
	const artReady = $derived(
		!!context.stateApp.loadedAssets?.duckPondWater &&
			!!context.stateApp.loadedAssets?.duckPondDuck1 &&
			!!context.stateApp.loadedAssets?.duckPondSplash &&
			!!context.stateApp.loadedAssets?.duckPondMiniYellow &&
			!!context.stateApp.loadedAssets?.duckPondLogo,
	);

	// A duck the player never picked, already landed on its rear pose: the fake prize is on show but
	// the duck reads as somebody else's. Ducks mid-flip stay bright so the turn itself is not muddied.
	const isUnpicked = (duck: PondDuck, index: number) =>
		!!duck.prize && !duck.selected && !finalRevealIndices.includes(index);
	const SPLASH_DIM_TINT = 0x8d88a4;
	// The pip is the rig's bird with no ring around it (scripts/build-duck-pond-stills.py), which
	// is a good deal narrower than the ringed duck the counter used to reuse.
	const MINI_DUCK_ASPECT = 104 / 128;
	// Ducks padded inside the plate: duck size comes FROM the row — N ducks plus their gaps fill
	// COUNTER_ROW_SPAN of the plate's length — so neighbours never touch, whatever N is.
	const miniRow = $derived.by(() => {
		const { length, thick, x, y, vertical } = ui.counter;
		const span = length * COUNTER_ROW_SPAN;
		const mini = Math.min(thick * 0.62, span / ((1 + COUNTER_GAP) * totalPicks - COUNTER_GAP));
		const pitch = mini * (1 + COUNTER_GAP);
		const rowW = mini + (totalPicks - 1) * pitch;
		return { start: (vertical ? y : x) - rowW / 2 + mini / 2, mini, pitch, vertical, x, y };
	});
</script>

<FadeContainer show={show && artReady}>
	<MainContainer>
		<Container
			x={layout.x}
			y={layout.y + BOARD_GRID_OFFSET_Y}
			pivot={layout.pivot}
			scale={layout.boardScale}
		>
			<!-- The pool fills the frame's opening, which IS the grid rect: the frame is cut around its
			     own opening and scaled so the two coincide. The insets this used to carry were for a
			     rail that overlapped the first and last cells; there is no such overlap now. Rounded
			     corners are baked into the art. -->
			<Sprite
				key="duckPondWater"
				x={0}
				y={0}
				width={BOARD_SIZES.width}
				height={BOARD_SIZES.height}
			/>

			<!-- 25 interactive ducks occupy the exact 5×5 reel cells. -->
			{#each ducks as duck, index (index)}
				<Button
					x={cellX(index)}
					y={cellY(index)}
					anchor={0.5}
					sizes={{ width: SYMBOL_W, height: SYMBOL_H }}
					disabled={!pendingPick || duck.selected || revealingIndex !== null}
					onpress={() => chooseDuck(index)}
				>
					{#snippet children({ center, hovered, pressed })}
						{@const duckSize = DUCK_SIZE * (pressed ? 0.94 : hovered && !duck.selected ? 1.06 : 1)}
						<!-- Splash stays in world space while Spine squashes/swaps the duck front to back. -->
						{@const splashW = duckSize * SPLASH_WIDTH}
						{@const unpicked = isUnpicked(duck, index)}
						<Sprite
							key="duckPondSplash"
							x={center.x}
							y={center.y + duckSize * SPLASH_DROP}
							anchor={0.5}
							width={splashW}
							height={splashW / SPLASH_ASPECT}
							tint={unpicked ? SPLASH_DIM_TINT : 0xffffff}
						/>
						<DuckPondDuck
							x={center.x}
							y={center.y}
							size={duckSize}
							variant={duck.variant}
							look={duck.look}
							prize={duck.prize}
							revealing={revealingIndex === index || finalRevealIndices.includes(index)}
							batch={finalRevealIndices.includes(index)}
							dimmed={unpicked}
							onrevealcomplete={() => {
								finishDuckReveal(index);
								finishFinalDuckReveal(index);
							}}
						/>
					{/snippet}
				</Button>
			{/each}

			<!-- DUCK YOUR LUCK logo: the same drawing the scatter symbol wears (Figma 7057:7971),
			     rebuilt at this size by scripts/duck-sign/build_duck_pond_logo.py. It replaces a
			     bulb-lit, coin-stacked lockup carrying the pre-redraw duck, which opened the bonus on
			     a duck that matched none of the twenty-five bobbing below it. -->
			<Sprite
				key="duckPondLogo"
				x={ui.logo.x}
				y={ui.logo.y}
				anchor={0.5}
				width={ui.logo.w}
				height={ui.logo.h}
			/>

			<!-- Pick counter: one mini duck per pick, remaining picks yellow, spent picks grey, on the
			     same plate as the panels. Landscape runs it vertically down the right rail. -->
			<Container x={ui.counter.x} y={ui.counter.y} rotation={ui.counter.vertical ? Math.PI / 2 : 0}>
				<PondPanel width={ui.counter.length} height={ui.counter.thick} />
			</Container>
			{#each [...Array(totalPicks).keys()] as index (index)}
				<Sprite
					key={index < remainingPicks ? 'duckPondMiniYellow' : 'duckPondMiniGray'}
					x={miniRow.vertical ? miniRow.x : miniRow.start + index * miniRow.pitch}
					y={miniRow.vertical ? miniRow.start + index * miniRow.pitch : miniRow.y}
					anchor={0.5}
					width={miniRow.mini * MINI_DUCK_ASPECT}
					height={miniRow.mini}
				/>
			{/each}

			<!-- PICK N DUCKS panel: the design's flat inset plate (Figma 7032:19188). -->
			<Container x={ui.pick.x} y={ui.pick.y}>
				<PondPanel width={ui.pick.w} height={ui.pick.h} />
			</Container>
			<Container x={ui.pick.x} y={ui.pick.textY}>
				<Text
					anchor={{ x: 0, y: 1 }}
					x={-pickLineW / 2}
					y={wordsY}
					text={pickBefore}
					onresize={({ width }) => (pickW = width)}
					style={textStyle(ui.pick.base, 0xffffff)}
				/>
				<Text
					anchor={{ x: 0, y: 1 }}
					x={-pickLineW / 2 + pickW}
					y={numH / 2}
					text={`${remainingPicks}`}
					onresize={({ width, height }) => {
						numW = width;
						numH = height;
					}}
					style={textStyle(ui.pick.num, NUM_PURPLE)}
				/>
				<Text
					anchor={{ x: 0, y: 1 }}
					x={-pickLineW / 2 + pickW + numW}
					y={wordsY}
					text={pickAfter}
					onresize={({ width }) => (ducksW = width)}
					style={textStyle(ui.pick.base, 0xffffff)}
				/>
			</Container>

			<!-- TOTAL WIN panel: running book cents converted through the active bet/currency. -->
			<Container x={ui.total.x} y={ui.total.y}>
				<PondPanel width={ui.total.w} height={ui.total.h} />
			</Container>
			<Text
				anchor={0.5}
				x={ui.total.x}
				y={ui.total.titleY}
				text={stateI18nDerived.translate('TOTAL WIN')}
				style={captionStyle(ui.total.title, 0xffffff)}
			/>
			<Text
				anchor={0.5}
				x={ui.total.x}
				y={ui.total.valueY}
				text={totalLabel}
				style={textStyle(totalValueSize, NUM_PURPLE)}
			/>
		</Container>
	</MainContainer>
</FadeContainer>
