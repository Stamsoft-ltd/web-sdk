<script lang="ts" module>
	import type { RawSymbol, Position } from '../game/types';

	export type EmitterEventBoard =
		| { type: 'boardSettle'; board: RawSymbol[][] }
		| { type: 'boardShow' }
		| { type: 'boardHide' }
		| { type: 'boardWithAnimateSymbols'; symbolPositions: Position[] }
		| { type: 'skipToAnticipation' };
</script>

<script lang="ts">
	import { AnimatedSprite, BaseSprite, Container, Graphics, Rectangle, Sprite } from 'pixi-svelte';
	import { OnPressFullScreen } from 'components-layout';
	import type { Texture } from 'pixi-svelte';

	import { getContext } from '../game/context';
	import { SYMBOL_W, SYMBOL_H, SYMBOL_SIZE, BOARD_DIMENSIONS, BOARD_GRID_OFFSET_Y } from '../game/constants';
	import {
		spriteKeyByName,
		bonusSpriteKeyByName,
		winSpriteKeyByName,
		spriteKeyByNameLandscape,
		winSpriteKeyByNameLandscape,
	} from '../game/utils';
	import type { SymbolName } from '../game/types';
	import { HIGH_SYMBOLS_SET, isWinState, anyPulsingWin } from '../game/boardPulse';
	import PaylineVine from './PaylineVine.svelte';

	const LOW_SYMBOLS_SET = new Set<SymbolName>(['T', 'J', 'Q', 'K', 'A']);

	const context = getContext();
	const board = $derived(context.stateGame.board);
	const layout = $derived(context.stateGameDerived.boardLayout());
	const isAnyReelSpinning = $derived(board.some((r) => r.reelState.motion !== 'stopped'));
	// Freeze the reel animations (wild / scatter / win-anims) while the Buy Bonus modal is open,
	// so nothing moves behind its blurred backdrop.
	const boardAnimate = $derived(!context.stateGame.buyModalOpen);
	let show = $state(true);

	// Mobile-landscape uses dedicated framed symbol art; desktop/portrait keep the standard maps.
	const isLandscape = $derived(context.stateLayoutDerived.layoutType() === 'landscape');
	const isPortrait = $derived(context.stateLayoutDerived.layoutType() === 'portrait');
	const activeMap = $derived(
		isLandscape
			? spriteKeyByNameLandscape
			: context.stateGame.bonusMode
				? bonusSpriteKeyByName
				: spriteKeyByName,
	);
	const activeWinMap = $derived(isLandscape ? winSpriteKeyByNameLandscape : winSpriteKeyByName);
	const getSpriteKey = (name: SymbolName, state?: string) => {
		if (state === 'win') return activeWinMap[name] ?? activeMap[name] ?? activeMap.A;
		return activeMap[name] ?? activeMap.A;
	};

	// Premium (animal) win-state cards play the animated "win state" frames (from the Magnific
	// videos, card border baked in — generate_win_anim.py). Ping-ponged since the clips don't loop.
	// ANIMALS ONLY: the letters (T/A/J/K/Q) have no win sheet — a winning letter renders its clean
	// base tile with the continuous letterPulse in the final {:else} below. Letter win sheets used
	// to be listed here, loaded, trimmed and ping-ponged into arrays nothing ever drew.
	const WIN_ANIM_KEY: Partial<Record<SymbolName, string>> = {
		RABBIT: 'rabbitWinAnim',
		BEAR: 'bearWinAnim',
		FOX: 'foxWinAnim',
		WOLF: 'wolfWinAnim',
		SQUIRREL: 'squirrelWinAnim',
	};
	const winAnimTextures = $derived.by(() => {
		const map: Partial<Record<SymbolName, Texture[]>> = {};
		for (const [sym, key] of Object.entries(WIN_ANIM_KEY) as [SymbolName, string][]) {
			const t = (context.stateApp.loadedAssets?.[key] ?? []) as Texture[];
			if (t.length) map[sym as SymbolName] = [...t, ...t.slice(1, -1).reverse()];
		}
		return map;
	});

	// The clips don't loop seamlessly (the glint sweep is one-directional), so the textures are
	// ping-ponged — same treatment as the win anims above.
	const pingPong = (t: Texture[]) => (t.length > 2 ? [...t, ...t.slice(1, -1).reverse()] : t);
	// The scatter plays its own emblem clip now (luma-keyed video frames — generate_emblem_anim.py).
	// Falls back to the static scatter sprite until it loads.
	const scatterFrames = $derived(pingPong((context.stateApp.loadedAssets?.scatterAnim ?? []) as Texture[]));
	// Animated WILD emblem (same pipeline). Falls back to static.
	const wildFrames = $derived(pingPong((context.stateApp.loadedAssets?.wildAnim ?? []) as Texture[]));

	// Animated base-state (idle blink) animals. Each cutout is trimmed to its subject so it keeps a
	// native (non-cell) aspect — width is derived from height with the same board non-uniform-scale
	// correction used for wild/scatter. Animals without an idle sheet (bear/rabbit) fall back to the
	// static tile. All animals share the brown frame drawn behind them (animalBorder).
	const IDLE_ANIM_KEY: Partial<Record<SymbolName, string>> = {
		WOLF: 'wolfIdleAnim',
		FOX: 'foxIdleAnim',
		SQUIRREL: 'squirrelIdleAnim',
		BEAR: 'bearIdleAnim',
		RABBIT: 'rabbitIdleAnim',
	};
	const IDLE_ASPECT: Partial<Record<SymbolName, number>> = {
		WOLF: 337 / 360,
		FOX: 249 / 360,
		SQUIRREL: 282 / 360,
		BEAR: 360 / 327,
		RABBIT: 284 / 360,
	};
	const idleAnimTextures = $derived.by(() => {
		const map: Partial<Record<SymbolName, Texture[]>> = {};
		for (const [sym, key] of Object.entries(IDLE_ANIM_KEY) as [SymbolName, string][]) {
			const t = (context.stateApp.loadedAssets?.[key] ?? []) as Texture[];
			if (t.length) map[sym as SymbolName] = t;
		}
		return map;
	});
	const BORDER_SIZE = 0.8; // brown frame footprint relative to the cell — tune THIS one
	// Frame art (516×388) native aspect — width follows height so the wooden rails never squish.
	const FRAME_ASPECT = 516 / 388;
	// Desktop/landscape: fit the frame INSIDE the cell by height (~98% of it) and derive the width
	// at the art's native aspect. The old draw made frames ~7% taller than the cell, so each row's
	// opaque frame painted over the neighbouring row's top/bottom rails (they read as "cut" — only
	// the side rails survived). Portrait cells are tall/narrow — keep the old stretched fit there.
	// Portrait: 0.88 keeps the NATIVE-aspect frame within the narrow cell width (the old
	// cell-aspect stretch squashed the art into a near-square and distorted the animals).
	const FRAME_H_MULT = $derived(isPortrait ? 0.88 : 0.826);
	// Portrait animal frames read too short (native 516×388 is wide) inside the tall/narrow cell:
	// stretch only the HEIGHT of the frame + its mask panel + the bust so the card fills the cell
	// vertically without getting any wider (width already looks right). Desktop/landscape untouched.
	const ANIMAL_H_STRETCH = $derived(isPortrait ? 1.16 : 1.0);
	// Landscape cells use a uniform pitch (no X spread like desktop), so the native-aspect frame
	// spans the whole column and hides the dividers — trim its width there (design ask).
	const FRAME_W_MULT = $derived(
		FRAME_H_MULT * (SYMBOL_H / SYMBOL_W) * FRAME_ASPECT * (isLandscape ? 0.93 : 1),
	);
	// Animals sit INSIDE the frame's inner panel so the brown border stays visible on every side.
	// Idle busts are tall/narrow → fit by HEIGHT (uses the shorter portrait height); win busts are
	// full-frame/wide → fit by WIDTH. Both derive from BORDER_SIZE so the border margin is automatic.
	const INNER_FRAC = 0.86; // fraction of the frame the idle animal fills (the rest shows the forest scene)
	// The win videos are full-frame and (for the squirrel) opaque, so they'd cover the border if they
	// filled the frame like the idle. Keep them a bit smaller so the wooden frame stays visible on a win.
	const WIN_INNER_FRAC = 0.76;
	// Bust framing: the idle cutouts are full-body, so each one is zoomed onto the face and
	// re-centred (mockup target: portrait-style close-up inside the frame). zoom multiplies
	// the old full-body fit; yOff drops the sprite centre by this fraction of its own height
	// so the face sits in the panel centre; xOff nudges sideways as a fraction of the panel
	// width. Tuned per animal against offline composites — by design the ears poke out above
	// the frame's top rail (the mask's top edge extends past the panel to allow it).
	const IDLE_BUST: Partial<Record<SymbolName, { zoom: number; yOff: number; xOff: number }>> = {
		WOLF: { zoom: 1.45, yOff: 0.097, xOff: 0 },
		FOX: { zoom: 1.5, yOff: 0.11, xOff: 0 },
		SQUIRREL: { zoom: 1.65, yOff: 0.157, xOff: -0.03 },
		BEAR: { zoom: 1.35, yOff: 0.098, xOff: 0 },
		RABBIT: { zoom: 1.65, yOff: 0.102, xOff: 0 },
	};
	// Inner panel of the frame art (516×388): side rails ≈26px, top/bottom rails ≈22–24px,
	// panel centred. The zoomed bust is masked to this rect so it can't paint over the side
	// rails or past the bottom rail — but the mask's top edge is raised by PANEL_TOP_OVERFLOW
	// so ears may stick out over the top rail (per the design mockup).
	const PANEL_W_FRAC = 464 / 516;
	const PANEL_H_FRAC = 342 / 388;
	const PANEL_TOP_OVERFLOW = 0.35; // fraction of the panel height the mask opens above it
	const idleFit = $derived(BORDER_SIZE * FRAME_H_MULT * INNER_FRAC);
	const winFit = $derived(BORDER_SIZE * FRAME_W_MULT * WIN_INNER_FRAC);
	// Portrait cells are narrow and the idle busts (fit by height) read too thin — widen them a touch
	// so they fill the frame better (a small deliberate stretch, only in portrait).
	const IDLE_W_STRETCH = $derived(isPortrait ? 1.18 : 1.0);
	// Animal WIN animations (new videos): kept full-frame (no crop) so nothing is clipped.
	// Aspect (w/h) of each animal's WIN sheet frame — measured from the new keyed win videos.
	const WIN_ASPECT: Partial<Record<SymbolName, number>> = {
		WOLF: 373 / 320,
		FOX: 313 / 320,
		BEAR: 419 / 320,
		RABBIT: 283 / 320,
		SQUIRREL: 367 / 320,
	};

	const getX = (reelIndex: number) => SYMBOL_W * (reelIndex + 0.5);

	// Landscape spreads the reel pitch on each axis (boardScaleX/Y) to fill the panel. Compensate
	// each symbol's width/height so it renders at the uniform boardScale size (undistorted).
	const scaleX = $derived(layout.boardScaleX ?? layout.boardScale);
	const scaleY = $derived(layout.boardScaleY ?? layout.boardScale);
	// Desktop symbols carry a lot of built-in tile padding, so enlarge them to fill the cell more
	// (reduces the gaps between symbols). Landscape/portrait keep their own tuned sizing.
	const isDesktop = $derived(context.stateLayoutDerived.layoutType() === 'desktop');
	const SIZE_BOOST = $derived(isDesktop ? 1.1 : 1);
	const symbolW = $derived(SYMBOL_W * (layout.boardScale / scaleX) * SIZE_BOOST);
	const symbolH = $derived(SYMBOL_H * (layout.boardScale / scaleY) * SIZE_BOOST);
	// Column divider width in LOCAL units, chosen so it renders ~2.5px wide after the container's
	// scaleX (the line stays thin at any board size).
	const DIVIDER_W = $derived(2.5 / scaleX);

	// Per-type visual balance: card (low) letters fill their tile much more than the framed
	// animal / wild / scatter art, so they read bigger. Shrink the low cards and nudge the
	// wild/scatter emblems up so all symbol types appear a similar size on the reels.
	// (HIGH_SYMBOLS_SET is imported from ../game/boardPulse — the pulse predicate is its complement.)
	const symScale = (name: SymbolName) => {
		// Portrait: the 1.15 overdraw (tuned for the old padded mobile PNGs) crams the redesigned
		// art — letters touched across cells and clipped at the frame. Draw at the cell size.
		// Premium animals carry built-in margin (read small), so draw them bigger than the
		// letters. WILD / SCATTER emblems also read small in portrait — draw them larger (design ask).
		if (isPortrait) {
			if (HIGH_SYMBOLS_SET.has(name)) return 1.18;
			if (name === 'WILD') return 1.4;
			if (name === 'SCATTER') return 1.3;
			return 1.02;
		}
		// Desktop lows: the redesigned letter art is cropped tight (glyph ≈92% of the tile), so the
		// draw scale must come DOWN to keep the glyph at its old visual size (~0.7 of the cell —
		// the previous padded art reached the same size at 0.86). Landscape keeps the old fit.
		if (LOW_SYMBOLS_SET.has(name)) return isDesktop ? 0.72 : 0.86;
		// WILD reads small on mobile — enlarge it in landscape (design ask, "wild bigger on all
		// mobile"). Everything else (desktop included) takes no WILD-specific bump; desktop still
		// gets the shared SIZE_BOOST above. SCATTER keeps the tuned 1.1 outside portrait.
		if (name === 'WILD') return isLandscape ? 1.25 : 1.0;
		if (name === 'SCATTER') return 1.1;
		// Premium animals: the art has built-in margin (reads small) so enlarge it — landscape
		// uses the same busts/frame as desktop now (Figma 3451-2143), drawn a touch bigger
		// there so the card fills its cell (design ask).
		if (HIGH_SYMBOLS_SET.has(name)) return isLandscape ? 1.26 : 1.32;
		return 1;
	};

	// ── Winning letters, wilds and scatters pulse continuously (normal ↔ +10%) while their win is
	//    shown — a gentle, repeating "pop", not a one-shot. A single rAF clock runs for all of them.
	//    The predicate lives in ../game/boardPulse as a pure function so it is directly testable
	//    (N4: excluding WILD/SCATTER there left them frozen at a stale scale). ──
	const pulsingWin = $derived(anyPulsingWin(board));
	let letterPulseT = $state(0);
	$effect(() => {
		if (!pulsingWin) {
			letterPulseT = 0; // never let the next win read a stale phase
			return;
		}
		let raf = 0;
		const t0 = performance.now();
		const tick = (now: number) => {
			letterPulseT = (now - t0) / 1000;
			raf = requestAnimationFrame(tick);
		};
		raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
	});
	// 1.0 → 1.1 → 1.0, ~1.15 Hz — a clear, repeating breathe.
	const letterPulse = $derived(1 + 0.1 * (0.5 - 0.5 * Math.cos(letterPulseT * 7.2)));
	// Scatter draws a bit smaller than a full cell so the medallion + leaves sit clear of neighbours.
	const SCATTER_SIZE = 0.72;
	// The animated scatter frames are 336×306 (Scatter.mp4, luma-keyed + trimmed — see
	// generate_emblem_anim.py). Height derives from width via this ratio (with the board's
	// per-axis scale compensation) so the emblem stays undistorted.
	const SCATTER_ASPECT = 306 / 336;
	// WILD animated frames are 224×223 (WILD.mp4, same pipeline) — effectively square. Sized by
	// cell HEIGHT; width derives from height at the frame's native aspect (square → 1).
	const WILD_ASPECT = 1; // w/h
	const WILD_SIZE = 0.78;

	// True while any symbol is in 'win' state — used to dim non-winning symbols
	const hasWinState = $derived(
		context.stateGame.board.some((reel) =>
			reel.reelState.symbols.some((s) => isWinState(s.symbolState)),
		),
	);


	// After the expanded-column reveal has finished playing, the overlay stops drawing and the reels
	// it covered render the expanded symbol themselves (see `swapName` in the markup). Null while the
	// expansion is still animating — the overlay owns those columns until then.
	const expandedSwap = $derived.by(() => {
		const expanded = context.stateGame.expandedSymbol;
		if (!expanded || !context.stateGame.expandedSettled || expanded.reels.length === 0) return null;
		// LOW (card) expands ONLY. An animal's expanded column is one big animated animal — that is
		// the feature's hero art, and it stays on screen for the whole round; swapping it for four
		// separate symbols the moment the reveal landed threw the whole animation away.
		if (!LOW_SYMBOLS_SET.has(expanded.symbol)) return null;
		return { symbol: expanded.symbol, reels: new Set(expanded.reels) };
	});

	// Cells the expanded-column overlay is currently painting over, published per reel by
	// ExpandedSymbolOverlay as [firstRow, endRow). Hiding exactly these cells replaces the old
	// "hide the whole reel 80ms after it starts expanding" timer, which caused two artefacts: for
	// those 80ms the reel's own symbol drew UNDER the half-transparent expanded tile and the two
	// glyphs merged into one garbled shape, and once it fired every row the reveal had not reached
	// yet went bare. It also removes the timer's restart race entirely. Null once the reveal has
	// settled — from there `expandedSwap` below renders those reels as normal win symbols. Read
	// straight from state rather than gating on `expandedSettled`: the overlay publishes {} exactly
	// when it stops drawing, so coverage always tracks what is actually painted. An ANIMAL expand
	// keeps drawing after it settles, and keeps its rows covered with it.
	const expandedCoverage = $derived(context.stateGame.expandedCoverage);

	const hasActiveAnticipation = () =>
		context.stateGame.board.some((reel) => reel.reelState.anticipating);

	const stopReelsForSkip = () => {
		// Normal/autoplay skip should still resolve through the reel landing path (bounce + final
		// symbol position).  Only anticipation/noStop reels need forceStop, otherwise they keep
		// waiting and the round can feel stuck.
		if (hasActiveAnticipation()) {
			context.stateGameDerived.enhancedBoard.forceStop();
			return;
		}
		context.stateGameDerived.enhancedBoard.stop();
	};

	const requestSpinSkip = () => {
		if (context.stateGame.awaitingFirstReveal) {
			context.stateGame.pendingStop = true;
			return;
		}
		if (context.stateGame.hasAnticipationPending && !hasActiveAnticipation()) {
			context.stateGame.hasAnticipationPending = false;
			context.eventEmitter.broadcast({ type: 'skipToAnticipation' });
			return;
		}
		context.eventEmitter.broadcast({ type: 'stopButtonClick' });
	};

	context.eventEmitter.subscribeOnMount({
		stopButtonClick: () => stopReelsForSkip(),
		skipToAnticipation: () => {
			context.stateGame.board.forEach((reel) => reel.stop());
		},
		boardSettle: ({ board }) => context.stateGameDerived.enhancedBoard.settle(board),
		boardShow: () => (show = true),
		boardHide: () => (show = false),
		boardWithAnimateSymbols: async ({ symbolPositions }) => {
			for (const position of symbolPositions) {
				const reelSymbol = context.stateGame.board[position.reel].reelState.symbols[position.row];
				reelSymbol.symbolState = 'win';
			}
		},
	});

	context.stateGameDerived.enhancedBoard.readyToSpinEffect();
</script>

{#if isAnyReelSpinning}
	<OnPressFullScreen onpress={requestSpinSkip} />
{/if}

{#if show}
	<!-- sortableChildren: the payline vine is drawn as a SIBLING of the symbols (below) so it can sit
	     at a depth BETWEEN them — above the losing symbols it connects across, but under the winning
	     ones it links, whose animations must never be crossed by a leaf. Draw order is therefore
	     zIndex, not markup order: 0 = board furniture + non-winning symbols, 1 = vine, 2 = winning
	     symbols. Children that share a zIndex keep their insertion order (Array#sort is stable). -->
	<Container sortableChildren x={layout.x} y={layout.y + BOARD_GRID_OFFSET_Y} pivot={layout.pivot} scale={{ x: scaleX, y: scaleY }}>
		<Graphics
			isMask
			draw={(graphics) => {
				// Inset the mask a few units top & bottom so the top slivers of the buffer symbols
				// (just outside the visible rows) don't bleed in as thin lines at the grid edge.
				const inset = isDesktop ? 2 : 0;
				graphics.rect(0, inset, SYMBOL_W * BOARD_DIMENSIONS.x, SYMBOL_H * BOARD_DIMENSIONS.y - inset * 2);
				graphics.fill({ color: 0xffffff });
			}}
		/>
		<!-- Thin vertical divider lines between the reel columns (behind the symbols). -->
		{#each Array.from({ length: BOARD_DIMENSIONS.x - 1 }) as _, i (i)}
			<Sprite
				key="reelDivider"
				x={SYMBOL_W * (i + 1)}
				y={0}
				anchor={{ x: 0.5, y: 0 }}
				width={DIVIDER_W}
				height={SYMBOL_H * BOARD_DIMENSIONS.y}
				alpha={0.55}
			/>
		{/each}
		{#each board as reel, reelIndex (reelIndex)}
			{@const swapName = expandedSwap?.reels.has(reelIndex) ? expandedSwap.symbol : null}
			{@const covered = swapName ? null : expandedCoverage?.[reelIndex]}
			{#each reel.reelState.symbols as reelSymbol, symbolIndex (symbolIndex)}
				{@const y = reelSymbol.symbolY()}
				<!-- Row this symbol currently occupies. Buffer symbols sit outside 0..rows-1 and so are
				     never "covered"; the board mask clips them as before. -->
				{@const row = Math.round(y / SYMBOL_H - 0.5)}
				{#if !covered || row < covered[0] || row >= covered[1]}
				<!-- Once the expanded column's reveal has played out the overlay hands the reel back to
				     the board: every row draws the EXPANDED symbol in its win state (normal frames and
				     win animations) instead of the reel's own landed symbols. Without the swap the reel
				     stays hidden behind an overlay that is no longer drawing and the column reads as an
				     empty forest cell. `swapName` is null on every other reel, so nothing else changes. -->
				{@const symName = swapName ?? reelSymbol.rawSymbol.name}
				{@const symState = swapName ? 'win' : reelSymbol.symbolState}
				{@const isWin = swapName ? true : isWinState(reelSymbol.symbolState)}
				<!-- One wrapper per symbol so the whole cell (frame + art) moves as a unit relative to
				     the vine at zIndex 1. The wrapper has no transform of its own, so every child keeps
				     its absolute grid x/y.
				     ONLY the animal win ANIMATIONS rise above the vine — they are the art a leaf must
				     never cross. Everything else, winning letters included, stays below it, because the
				     vine is meant to read as growing OVER the board (lifting every winning cell put the
				     vine behind the J's it was threading through). Gated on the animal being a winner
				     rather than on its win sheet having loaded, so a cell can't pop between layers the
				     moment the sheet streams in. -->
				<Container zIndex={isWin && HIGH_SYMBOLS_SET.has(symName) ? 2 : 0}>
				<Rectangle
					x={getX(reelIndex) - SYMBOL_W * 0.5}
					y={y - SYMBOL_H * 0.5}
					width={SYMBOL_W}
					height={SYMBOL_H}
					backgroundColor={0x000000}
					alpha={0.02}
				/>
				{@const s = symScale(symName)}
				<!-- Winning wild/scatter pulse continuously like the winning letters (design ask),
				     replacing the old one-shot spring pop. -->
				{@const specialPop = isWin ? letterPulse : 1}
				{#if symName === 'SCATTER' && scatterFrames.length > 0}
					<!-- Scatter shimmers with its animated emblem clip and pulses continuously while it
					     wins. Drawn a bit smaller than a cell. animationSpeed 0.14 (~8fps) stepped
					     visibly and read as "laggy"; 0.36 (~22fps) plays smoothly and stays under the
					     30fps idle render cap so no frames drop. -->
					<AnimatedSprite
						textures={scatterFrames}
						x={getX(reelIndex)}
						y={y}
						anchor={0.5}
						width={symbolW * s * SCATTER_SIZE * specialPop}
						height={symbolH * s * SCATTER_SIZE * specialPop * (SYMBOL_W / SYMBOL_H) * SCATTER_ASPECT}
						animationSpeed={0.36}
						loop={true}
						play={boardAnimate}
						alpha={hasWinState && !isWin ? 0.35 : 1}
					/>
				{:else if symName === 'WILD' && wildFrames.length > 0}
					<!-- Animated WILD: plays its loop briskly on every spin; pulses continuously on a win.
					     Multiplied by symScale (s) like the scatter so per-layout sizing applies —
					     desktop s=1.0 keeps the tuned size; mobile draws it larger (design ask). -->
					<AnimatedSprite
						textures={wildFrames}
						x={getX(reelIndex)}
						y={y}
						anchor={0.5}
						height={symbolH * s * WILD_SIZE * 0.9 * specialPop}
						width={symbolW * s * WILD_SIZE * specialPop * (SYMBOL_H / SYMBOL_W) * WILD_ASPECT}
						animationSpeed={0.4}
						loop={true}
						play={boardAnimate}
						alpha={hasWinState && !isWin ? 0.35 : 1}
					/>
				{:else if symName === 'SCATTER'}
					<!-- Fallback until the animation frames load: static medallion (no tilt). Still takes
					     specialPop — a bonus trigger inside the load window must not show a dead scatter. -->
					<Sprite
						key={getSpriteKey(symName, symState)}
						x={getX(reelIndex)}
						y={y}
						anchor={{ x: 0.5, y: 0.5 }}
						width={symbolW * s * SCATTER_SIZE * specialPop}
						height={symbolH * s * SCATTER_SIZE * specialPop}
						alpha={hasWinState && !isWin ? 0.35 : 1}
					/>
				{:else if isWin && HIGH_SYMBOLS_SET.has(symName) && winAnimTextures[symName]}
					<!-- The HIGH_SYMBOLS_SET guard is explicit rather than implied by WIN_ANIM_KEY's contents,
					     so nothing but an animal can ever reach the animalBorder + win-sheet pair.
					     Animal win: same brown frame + the full (uncropped) win animation on top. The
					     frame carries the OPAQUE forest panel the bust sits on, so it must always draw —
					     hiding it during anticipation left the transparent bust floating on the bare
					     board background (the "empty forest cell" seen while waiting for the 3rd scatter).
					     The additive glow column is wider/taller than the cell, so it still reads around
					     the framed symbols. -->
					<Sprite
						key="animalBorder"
						x={getX(reelIndex)}
						y={y}
						anchor={{ x: 0.5, y: 0.5 }}
						width={symbolW * s * BORDER_SIZE * FRAME_W_MULT}
						height={symbolH * s * BORDER_SIZE * FRAME_H_MULT}
					/>
					<!-- Bottom-anchored to the frame: the win art's feet sit on the card's bottom rail,
					     so taller clips grow upward out of the card instead of spilling below it. -->
					<!-- Desktop: lift the win art ~2-3px so its feet clear the frame's bottom rail
					     (the enlarged desktop animals pushed it onto the border). -->
					<AnimatedSprite
						textures={winAnimTextures[symName]}
						x={getX(reelIndex)}
						y={y + (symbolH * s * BORDER_SIZE * FRAME_H_MULT) / 2 - (isDesktop ? symbolH * 0.02 : isLandscape ? symbolH * 0.05 : 0)}
						anchor={{ x: 0.5, y: 1 }}
						width={symbolW * s * winFit}
						height={symbolW * s * winFit * (SYMBOL_W / SYMBOL_H) / (WIN_ASPECT[symName] ?? 1)}
						animationSpeed={0.36}
						loop={true}
						play={boardAnimate}
					/>
				{:else if isWin && LOW_SYMBOLS_SET.has(symName)}
					<!-- Letter (low) win: there is no letter win sheet - the CLEAN base tile pulses
					     continuously (normal <-> +10%) for as long as the win is shown. Gated on
					     LOW_SYMBOLS_SET rather than a bare `isWin`: a bare catch-all would also swallow a
					     winning ANIMAL whose win sheet has not streamed in yet and draw it with no frame,
					     leaving the transparent bust cutout floating on the bare board background. Animals
					     must keep falling through to the animalBorder branch below. -->
					<Sprite
						key={getSpriteKey(symName, undefined)}
						x={getX(reelIndex)}
						y={y}
						anchor={{ x: 0.5, y: 0.5 }}
						width={symbolW * s * letterPulse}
						height={symbolH * s * letterPulse}
					/>
				{:else if HIGH_SYMBOLS_SET.has(symName)}
					<!-- Base-state animal: shared brown frame + animated idle blink (or static tile for
					     the animals without an idle sheet yet). The frame carries the OPAQUE forest panel
					     the bust sits on, so it must ALWAYS draw: hiding it during anticipation left the
					     transparent bust cutout floating on the bare board background — the "empty forest
					     cell" the user hit while the board waits for the 3rd scatter. The additive glow
					     column is wider/taller than the cell, so it still reads around the framed symbol. -->
					<Sprite
						key="animalBorder"
						x={getX(reelIndex)}
						y={y}
						anchor={{ x: 0.5, y: 0.5 }}
						width={symbolW * s * BORDER_SIZE * FRAME_W_MULT}
						height={symbolH * s * BORDER_SIZE * FRAME_H_MULT * ANIMAL_H_STRETCH}
						alpha={hasWinState && !isWin ? 0.35 : 1}
					/>
					{#if idleAnimTextures[symName]}
						{@const bust = IDLE_BUST[symName] ?? { zoom: 1, yOff: 0, xOff: 0 }}
						{@const idleH = symbolH * s * idleFit * bust.zoom * ANIMAL_H_STRETCH}
						{@const panelW = symbolW * s * BORDER_SIZE * FRAME_W_MULT * PANEL_W_FRAC}
						{@const panelH = symbolH * s * BORDER_SIZE * FRAME_H_MULT * PANEL_H_FRAC * ANIMAL_H_STRETCH}
						<!-- Bust framing: zoom the full-body cutout onto the face, masked to the
						     frame's inner panel so the zoomed animal can't paint over the rails. -->
						<Container x={getX(reelIndex)} y={y}>
							<Graphics
								isMask
								draw={(graphics) => {
									graphics.rect(
										-panelW / 2,
										-panelH / 2 - panelH * PANEL_TOP_OVERFLOW,
										panelW,
										panelH * (1 + PANEL_TOP_OVERFLOW),
									);
									graphics.fill({ color: 0xffffff });
								}}
							/>
							<!-- Static frame-0 underlay: guarantees the animal is NEVER a blank frame even
							     when the AnimatedSprite fails to paint a frame (shared-ticker freeze / a
							     race the moment the idle sheet streams in). Same geometry + mask as the
							     animation, so the blink plays on top with identical content (no ghosting);
							     if the animation ever goes blank, this rest pose still shows. -->
							<BaseSprite
								texture={idleAnimTextures[symName]?.[0]}
								x={bust.xOff * panelW}
								y={idleH * bust.yOff - (isPortrait ? symbolH * 0.015 : 0)}
								anchor={0.5}
								height={idleH}
								width={idleH * (SYMBOL_H / SYMBOL_W) * (IDLE_ASPECT[symName] ?? 1) * IDLE_W_STRETCH}
								alpha={hasWinState && !isWin ? 0.35 : 1}
							/>
							<!-- Portrait: lift the bust ~2px so its bottom clears the frame's bottom rail
							     (the ANIMAL_H_STRETCH pushed it down onto the wood). -->
							<AnimatedSprite
								textures={idleAnimTextures[symName]}
								x={bust.xOff * panelW}
								y={idleH * bust.yOff - (isPortrait ? symbolH * 0.015 : 0)}
								anchor={0.5}
								height={idleH}
								width={idleH * (SYMBOL_H / SYMBOL_W) * (IDLE_ASPECT[symName] ?? 1) * IDLE_W_STRETCH}
								animationSpeed={0.28 + ((reelIndex * 2 + symbolIndex) % 4) * 0.008}
								startFrame={(reelIndex * 13 + symbolIndex * 7) % (idleAnimTextures[symName]?.length ?? 1)}
								loop={true}
								play={boardAnimate}
								alpha={hasWinState && !isWin ? 0.35 : 1}
							/>
						</Container>
					{:else}
						<Sprite
							key={getSpriteKey(symName, symState)}
							x={getX(reelIndex)}
							y={y}
							anchor={{ x: 0.5, y: 0.5 }}
							width={symbolW * s * idleFit}
							height={symbolH * s * idleFit}
							alpha={hasWinState && !isWin ? 0.35 : 1}
						/>
					{/if}
				{:else}
					<!-- Non-winning symbols (their normal state art) plus a winning WILD whose animated
					     sheet hasn't loaded yet — WIN_ANIM_KEY has no WILD/SCATTER entry, so it falls past
					     every branch above; specialPop keeps it pulsing.
					     A win reaching this branch shows the CLEAN base tile, never the old cracked,
					     undersized `*WinTile` art (getSpriteKey(name,'win')), which read as a smaller "old
					     win state" with an ugly size jump.
					     No ANIMAL can reach here: a winning animal takes the win-anim branch, one whose sheet
					     hasn't loaded takes the animalBorder branch, so the opaque forest panel always draws
					     and the transparent bust cutout is never left floating on the bare board. -->
					<Sprite
						key={getSpriteKey(symName, isWin ? undefined : symState)}
						x={getX(reelIndex)}
						y={y}
						anchor={{ x: 0.5, y: 0.5 }}
						width={symbolW * s * specialPop}
						height={symbolH * s * specialPop}
						alpha={hasWinState && !isWin ? 0.35 : 1}
					/>
				{/if}
				</Container>
				{/if}
			{/each}
		{/each}
		{#if context.stateGame.paylineWins.length > 0}
			<!-- Payline vines live INSIDE the board container (was a separate MainContainer in
			     Game.svelte, which forced them entirely above the reels — leaves kept crossing the
			     winning animals' win animations). Same transform as before, so the geometry is
			     unchanged; only the depth moved. They now also hide with `boardHide` during the
			     free-spin transitions, which is what we want. -->
			<Container zIndex={1}>
				<PaylineVine wins={context.stateGame.paylineWins} snap={context.stateGame.paylineSnap} />
			</Container>
		{/if}
	</Container>
{/if}
