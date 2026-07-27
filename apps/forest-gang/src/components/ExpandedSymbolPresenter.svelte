<script lang="ts" module>
	import type { SymbolName } from '../game/types';

	export type EmitterEventExpandedSymbolPresenter =
		| { type: 'expandedPresenterShow'; symbol: SymbolName }
		| { type: 'expandedPresenterHide' }
		| { type: 'expandedPresenterAwaitClose' };
</script>

<script lang="ts">
	import { Tween } from 'svelte/motion';
	import { sineInOut, backOut } from 'svelte/easing';

	import { MainContainer, CanvasSizeRectangle, OnPressFullScreen } from 'components-layout';
	import { OnHotkey } from 'components-shared';
	import { FadeContainer } from 'components-pixi';
	import { anchorToPivot, AnimatedSprite, Container, Graphics, Sprite } from 'pixi-svelte';
	import type { Texture } from 'pixi-svelte';

	import { getContext } from '../game/context';
	import { spriteKeyByName } from '../game/utils';

	const context = getContext();

	// Portrait uses a taller full-body deer (deer_presenter_mobile.png 360×730) that rises
	// from the bottom; desktop uses deer_presenter.png (1087×1447, clean transparent bg — the
	// previous art had a baked cream halo that read as a cut glow) and zooms in centred.
	const isPortrait = $derived(context.stateLayoutDerived.layoutType() === 'portrait');
	const isLandscape = $derived(context.stateLayoutDerived.layoutType() === 'landscape');
	const deerKey = $derived(isPortrait ? 'deerPresenterMobile' : 'deerPresenter');
	// Animated deer (background-removed video frames) — now used in BOTH orientations when loaded;
	// only falls back to the static full-body sprite if the frames aren't ready.
	const deerFrames = $derived((context.stateApp.loadedAssets?.deerPresenterAnim ?? []) as Texture[]);
	const useAnimDeer = $derived(deerFrames.length > 0);
	const MOBILE_RATIO = 360 / 730;
	const ANIM_RATIO = 300 / 500; // animated frame aspect (measured — new deer sheet)
	// Portrait: the deer's bottom rests ON the HTML HUD bar (rising from behind it), not floating in
	// mid-air. The bar's top is computed from the canvas bottom minus the HUD block (bar 0.15u +
	// gap 6 + stats ≈0.132u + 10px padding, u = the HUD unit), then converted into main-layout
	// coordinates (the MainContainer maps mainY → screen via the centred scale transform).
	const portraitDeerBottomY = $derived.by(() => {
		const canvas = context.stateLayoutDerived.canvasSizes();
		const ml = context.stateLayoutDerived.mainLayout();
		const u = Math.min(412, canvas.width * 0.97);
		// Subtract only the NAV bar band (not the full bar+stats block) so the deer's feet drop
		// LOWER — tucking behind the top of the wooden nav bar instead of floating in the glow gap
		// above it. (0.282+16 landed her feet at the top of the whole HUD block, ~a bar-height too
		// high, so she read as hovering.)
		const hudH = u * 0.22 + 6;
		// Anchor to the GAME-AREA bottom, not the full canvas: when the canvas is letterboxed the
		// HTML HUD sits at the game-area bottom (above the bottom letterbox), so using canvas.height
		// dropped the deer's feet past the bar into the letterbox. gameBottom = top offset + game height.
		const offset = (canvas.height - ml.height * ml.scale) / 2;
		const gameBottom = offset + ml.height * ml.scale;
		const screenY = gameBottom - hudH + 10; // slight overlap so the dress meets the wood
		return (screenY - offset) / (ml.scale || 1);
	});
	// Desktop: rest the deer's feet on the TOP of the wooden HUD bar (not the game-area bottom, which
	// let her dress sink below/behind the bar). Bar height = 176·u (36 top pad + 104 nav + 36 bottom
	// pad, matching HudHtml's --u), placed relative to the game-area bottom so letterbox is handled.
	const desktopDeerBottomY = $derived.by(() => {
		const canvas = context.stateLayoutDerived.canvasSizes();
		const ml = context.stateLayoutDerived.mainLayout();
		const u = Math.min(1860, canvas.width * 0.97) / 1860;
		const hudH = u * 176 + 8; // bar body + hud-shell bottom padding
		const offset = (canvas.height - ml.height * ml.scale) / 2;
		const gameBottom = offset + ml.height * ml.scale;
		const screenY = gameBottom - hudH + 10; // slight overlap so the feet tuck behind the bar top
		return (screenY - offset) / (ml.scale || 1);
	});
	const DEER_RATIO = $derived(useAnimDeer ? ANIM_RATIO : isPortrait ? MOBILE_RATIO : 1087 / 1447);
	// Empty-board interior centre + height as a fraction of the deer image (per art).
	const PLACEHOLDER = $derived(
		useAnimDeer
			? { cx: 0.496, cy: 0.612, h: 0.185 }
			: isPortrait
				? { cx: 0.486, cy: 0.575, h: 0.1 }
				: { cx: 0.488, cy: 0.622, h: 0.18 },
	);
	const LETTER_ASPECT = $derived(isPortrait ? 1.34 : 1.17); // symbol sprites ~cell aspect

	// Per-type size compensation so every symbol reads at the same visual size on the board.
	// Card letters / emblems fill their tile less than the framed animals, so scale them up to match.
	const HIGH_SYMBOLS_SET = new Set<SymbolName>(['FOX', 'WOLF', 'BEAR', 'RABBIT', 'SQUIRREL']);
	const symScale = (name: SymbolName | null) => {
		if (name === 'WILD') return 1.22;
		if (name === 'SCATTER') return 1.26;
		if (name && HIGH_SYMBOLS_SET.has(name)) return 1.15; // framed animals — match the card size
		return 1.19; // A / K / Q / J / T card letters
	};

	const main = $derived(context.stateLayoutDerived.mainLayout());
	// Portrait: much bigger (height-capped full body). Desktop: fit both ways.
	const deerH = $derived(
		useAnimDeer
			? isPortrait
				// Portrait animated deer: sized to fill, then scaled to 77% (was 0.7 — bumped ~10%
				// per request "increase the deer a bit"); rises from the bottom like the static one.
				? Math.min(main.height * 0.9, (main.width * 0.98) / ANIM_RATIO) * 0.62
				// Desktop: 82% of the fill size (was 0.75 — bumped ~10% per request; board + symbol
				// scale down with it).
				: Math.min(main.height * 0.82, main.width * 0.9) * 0.82
			: isPortrait
				? Math.min(main.height * 0.92, (main.width / MOBILE_RATIO) * 0.98)
				: Math.min(main.height * 0.92, main.width * 0.62) * 0.75,
	);
	const deerW = $derived(deerH * DEER_RATIO);

	// Symbols the board rolls through before landing on the chosen one.
	const ALL_SYMBOLS: SymbolName[] = ['FOX', 'WOLF', 'BEAR', 'RABBIT', 'SQUIRREL', 'A', 'K', 'Q', 'J', 'T'];
	const ROLL_MS = 600;

	let show = $state(false);
	// displaySymbol cycles during the roll, then settles on the real symbol.
	let displaySymbol = $state<SymbolName | null>(null);
	const letterKey = $derived(displaySymbol ? (spriteKeyByName[displaySymbol] ?? null) : null);
	// Animals use the new animated idle art (same cutouts as the reels) instead of the old tile.
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
	// Bust framing (mirrors BonusSymbolPanel / Board IDLE_BUST): zoom the full-body idle cutout
	// onto the face so the deer's board shows the same close-up portrait as the side panel card,
	// masked to the board interior (top opens up so ears can poke above the rail).
	const IDLE_BUST: Partial<Record<SymbolName, { zoom: number; yOff: number; xOff: number }>> = {
		WOLF: { zoom: 1.45, yOff: 0.097, xOff: 0 },
		FOX: { zoom: 1.5, yOff: 0.11, xOff: 0 },
		SQUIRREL: { zoom: 1.65, yOff: 0.157, xOff: -0.03 },
		BEAR: { zoom: 1.35, yOff: 0.098, xOff: 0 },
		RABBIT: { zoom: 1.65, yOff: 0.102, xOff: 0 },
	};
	// Board-interior mask geometry, derived from the BonusSymbolPanel ratios (inner panel is
	// ~1.5:1, the bust sprite is ~1.08× the interior height before its per-animal zoom).
	const BUST_INNER_ASPECT = 1.5;
	const BUST_TOP_OVERFLOW = 0.3;
	const BUST_SYM_FRAC = 1.08;
	const displayIdle = $derived(
		displaySymbol && IDLE_ANIM_KEY[displaySymbol]
			? ((context.stateApp.loadedAssets?.[IDLE_ANIM_KEY[displaySymbol]!] ?? []) as Texture[])
			: [],
	);
	// All symbols centre on the board (no per-symbol vertical nudge).
	const symbolCy = $derived(PLACEHOLDER.cy);

	const letterH = $derived(deerH * PLACEHOLDER.h * symScale(displaySymbol));
	const letterW = $derived(letterH * LETTER_ASPECT);

	// Deer zoom-out entrance (both orientations).
	let deerScale = new Tween(1);
	// Letter rotation (jiggle, after landing) and scale (settle pop on landing).
	let rot = new Tween(0);
	let sc = new Tween(1);
	let wiggling = false;
	let rollTimer = 0;

	// Skip support: land the roll instantly and release the book's hold on space / tap.
	let finalSymbol: SymbolName | null = null;
	let skipped = false;
	let closeResolve: (() => void) | null = null;
	let holdTimer = 0;
	// The roll must LAND on the chosen symbol before the presenter closes — otherwise the deer was
	// hidden mid-roll on a random symbol (mismatching the reels / bonus panel).
	let rollSettled = false;
	let rollResolve: (() => void) | null = null;
	const markRollSettled = () => {
		rollSettled = true;
		rollResolve?.();
		rollResolve = null;
	};

	const skip = () => {
		if (!show || skipped) return;
		skipped = true;
		clearTimeout(rollTimer);
		wiggling = false;
		if (finalSymbol) displaySymbol = finalSymbol;
		markRollSettled();
		sc.set(1, { duration: 120, easing: backOut });
		rot.set(0, { duration: 120 });
		clearTimeout(holdTimer);
		closeResolve?.();
		closeResolve = null;
	};

	const startWiggle = async () => {
		if (wiggling) return;
		wiggling = true;
		while (wiggling) {
			await rot.set(0.07, { duration: 320, easing: sineInOut });
			if (!wiggling) break;
			await rot.set(-0.07, { duration: 320, easing: sineInOut });
		}
	};

	// Slot-style roll: cycle symbols, slowing down, then land + settle-pop + jiggle.
	const startRoll = (finalSymbol: SymbolName) => {
		clearTimeout(rollTimer);
		let elapsed = 0;
		let idx = 0;
		displaySymbol = ALL_SYMBOLS[0];
		const step = () => {
			elapsed += 80;
			const progress = elapsed / ROLL_MS;
			if (progress >= 1) {
				displaySymbol = finalSymbol;
				markRollSettled();
				sc.set(1.18, { duration: 0 });
				sc.set(1, { duration: 320, easing: backOut });
				startWiggle();
				return;
			}
			idx = (idx + 1) % ALL_SYMBOLS.length;
			displaySymbol = ALL_SYMBOLS[idx];
			const interval = 48 + progress * progress * 200;
			rollTimer = setTimeout(step, interval) as unknown as number;
		};
		rollTimer = setTimeout(step, 55) as unknown as number;
	};

	context.eventEmitter.subscribeOnMount({
		expandedPresenterShow: (emitterEvent) => {
			show = true;
			skipped = false;
			rollSettled = false;
			rollResolve = null;
			finalSymbol = emitterEvent.symbol;
			wiggling = false;
			rot.set(0, { duration: 0 });
			sc.set(1, { duration: 0 });
			// deer ZOOMS OUT in both orientations: appears oversized (close-up) and settles back to
			// its resting size. Portrait keeps its bottom-centre anchor, so it scales down onto the
			// HUD bar instead of floating.
			deerScale.set(1.55, { duration: 0 });
			deerScale.set(1, { duration: 520, easing: backOut });
			// roll through symbols, then land on the chosen one
			startRoll(emitterEvent.symbol);
		},
		// The book awaits this before hiding. First wait for the roll to LAND on the chosen symbol,
		// then hold briefly on it — so the deer never closes on a mid-roll (wrong) symbol.
		expandedPresenterAwaitClose: async () => {
			if (skipped) return;
			if (!rollSettled) {
				await new Promise<void>((resolve) => (rollResolve = resolve));
			}
			if (skipped) return;
			await new Promise<void>((resolve) => {
				closeResolve = resolve;
				holdTimer = setTimeout(() => {
					closeResolve?.();
					closeResolve = null;
				}, 400) as unknown as number;
			});
		},
		// Space / tap (broadcast as stopButtonClick) lands the roll and ends the hold.
		stopButtonClick: () => skip(),
		expandedPresenterHide: () => {
			show = false;
			wiggling = false;
			skipped = false;
			clearTimeout(rollTimer);
			clearTimeout(holdTimer);
			closeResolve?.();
			closeResolve = null;
		},
	});
</script>

<FadeContainer {show}>
	<CanvasSizeRectangle backgroundColor={0x000000} backgroundAlpha={0.5} />
	<MainContainer>
		<Container
			x={main.width / 2}
			y={isPortrait
				? portraitDeerBottomY
				: context.stateLayoutDerived.layoutType() === 'desktop'
					? desktopDeerBottomY
					: (() => {
							// No bottom bar in mobile landscape / tablet — the deer rises from behind the
							// board's bottom rail: anchored at the GRID bottom (the rail's top edge), so
							// her feet tuck behind the rail instead of dangling past the frame.
							const bl = context.stateGameDerived.boardLayout();
							const gridH = bl.height * (bl.boardScaleY ?? bl.boardScale);
							return bl.y + gridH / 2;
						})()}
			scale={deerScale.current}
			pivot={anchorToPivot({
				anchor: { x: 0.5, y: 1 },
				sizes: { width: deerW, height: deerH },
			})}
		>
			{#if letterKey}
				{@const cardInnerH = deerH * PLACEHOLDER.h}
				{@const cardInnerW = cardInnerH * BUST_INNER_ASPECT}
				<!-- Opaque wood backing for the deer's HELD CARD. The luma-keyed deer animation washed the
				     card's dark wood to semi-transparent (the source video is fully opaque), so the reels
				     showed through it — worst at the bottom rail band. Drawn BEHIND the deer sprite and sized
				     to the card's full interior (wider + taller than the symbol window) so the card's own wood
				     grain still renders on top; this only fills the see-through. Applies to BOTH letters and
				     animals. Colour matches the static deer card's dark wood. -->
				<Container x={deerW * PLACEHOLDER.cx} y={deerH * PLACEHOLDER.cy}>
					<Graphics
						draw={(graphics) => {
							// Sized to sit INSIDE the sign's wood (measured span ~0.48–0.73 of the deer
							// height): the +0.12 downward offset was dropped so it no longer bled a strip
							// below the sign, and the TOP now reaches up to the sign's top rail (0.70 vs
							// the earlier 0.65) so the see-through band just under the top border is
							// covered too. Bottom stays put (0.65) to avoid poking past the bottom rail;
							// the top edge hides behind the deer's opaque arms/collar that grip the sign.
							graphics.rect(-cardInnerW * 0.85, -cardInnerH * 0.7, cardInnerW * 1.7, cardInnerH * 1.35);
							graphics.fill({ color: 0x2e1608 });
						}}
					/>
				</Container>
			{/if}
			{#if useAnimDeer}
				<AnimatedSprite
					textures={deerFrames}
					width={deerW}
					height={deerH}
					animationSpeed={0.2}
					loop={true}
					play={true}
				/>
			{:else}
				<Sprite key={deerKey} width={deerW} height={deerH} />
			{/if}
			{#if letterKey}
				<Container
					x={deerW * PLACEHOLDER.cx}
					y={deerH * symbolCy}
					scale={sc.current}
					rotation={rot.current}
				>
					{@const innerH = deerH * PLACEHOLDER.h}
					{@const innerW = innerH * BUST_INNER_ASPECT}
					<!-- The mask wrapper (and its Graphics) stay MOUNTED for the whole roll — the roll
					     flips displaySymbol between animals and letters every few frames, and tearing the
					     mask down with the branch left the wrapper pointing at a destroyed Graphics for a
					     frame (PIXI: null context .uid crash in StencilMaskPipe). Only the sprites toggle. -->
					<Container>
						<Graphics
							isMask
							draw={(graphics) => {
								graphics.rect(
									-innerW / 2,
									-innerH / 2 - innerH * BUST_TOP_OVERFLOW,
									innerW,
									innerH * (1 + BUST_TOP_OVERFLOW),
								);
								graphics.fill({ color: 0xffffff });
							}}
						/>
						{#if displayIdle.length}
							{@const bust = IDLE_BUST[displaySymbol!] ?? { zoom: 1, yOff: 0, xOff: 0 }}
							{@const bustH = innerH * BUST_SYM_FRAC * bust.zoom}
							<!-- Zoomed bust masked to the board interior — same close-up as the side panel card.
							     (The opaque card backing is drawn behind the deer sprite above, so nothing shows
							     through the card here.) -->
							<AnimatedSprite
								textures={displayIdle}
								x={bust.xOff * innerW}
								y={bustH * bust.yOff}
								anchor={0.5}
								height={bustH}
								width={bustH * (IDLE_ASPECT[displaySymbol!] ?? 1)}
								animationSpeed={0.28}
								loop={true}
								play={true}
							/>
						{/if}
					</Container>
					{#if !displayIdle.length}
						<Sprite key={letterKey} anchor={0.5} width={letterW} height={letterH} />
					{/if}
				</Container>
			{/if}
		</Container>
	</MainContainer>
</FadeContainer>

{#if show}
	<OnHotkey hotkey="Space" onpress={() => context.eventEmitter.broadcast({ type: 'stopButtonClick' })} />
	<OnPressFullScreen onpress={() => context.eventEmitter.broadcast({ type: 'stopButtonClick' })} />
{/if}
