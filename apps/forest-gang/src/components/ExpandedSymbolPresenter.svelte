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
	import { anchorToPivot, AnimatedSprite, Container, Sprite } from 'pixi-svelte';
	import type { Texture } from 'pixi.js';

	import { getContext } from '../game/context';
	import { spriteKeyByName } from '../game/utils';

	const context = getContext();

	// Portrait uses a taller full-body deer (deer_presenter_mobile.png 360×730) that rises
	// from the bottom; desktop uses deer_presenter.png (1087×1447, clean transparent bg — the
	// previous art had a baked cream halo that read as a cut glow) and zooms in centred.
	const isPortrait = $derived(context.stateLayoutDerived.layoutType() === 'portrait');
	const deerKey = $derived(isPortrait ? 'deerPresenterMobile' : 'deerPresenter');
	// Animated desktop deer (background-removed video frames). Portrait keeps the full-body mobile art.
	const deerFrames = $derived((context.stateApp.loadedAssets?.deerPresenterAnim ?? []) as Texture[]);
	const useAnimDeer = $derived(!isPortrait && deerFrames.length > 0);
	const MOBILE_RATIO = 360 / 730;
	const ANIM_RATIO = 273 / 444; // animated frame aspect (measured)
	const DEER_RATIO = $derived(isPortrait ? MOBILE_RATIO : useAnimDeer ? ANIM_RATIO : 1087 / 1447);
	// Empty-board interior centre + height as a fraction of the deer image (per art).
	const PLACEHOLDER = $derived(
		isPortrait
			? { cx: 0.486, cy: 0.575, h: 0.1 }
			: useAnimDeer
				? { cx: 0.496, cy: 0.612, h: 0.185 }
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
		isPortrait
			? Math.min(main.height * 0.92, (main.width / MOBILE_RATIO) * 0.98)
			: useAnimDeer
				? Math.min(main.height * 0.82, main.width * 0.9)
				: Math.min(main.height * 0.92, main.width * 0.62),
	);
	const deerW = $derived(deerH * DEER_RATIO);

	// Symbols the board rolls through before landing on the chosen one.
	const ALL_SYMBOLS: SymbolName[] = ['FOX', 'WOLF', 'BEAR', 'RABBIT', 'SQUIRREL', 'A', 'K', 'Q', 'J', 'T'];
	const ROLL_MS = 1300;

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
	const displayIdle = $derived(
		displaySymbol && IDLE_ANIM_KEY[displaySymbol]
			? ((context.stateApp.loadedAssets?.[IDLE_ANIM_KEY[displaySymbol]!] ?? []) as Texture[])
			: [],
	);
	// All symbols centre on the board (no per-symbol vertical nudge).
	const symbolCy = $derived(PLACEHOLDER.cy);

	const letterH = $derived(deerH * PLACEHOLDER.h * symScale(displaySymbol));
	const letterW = $derived(letterH * LETTER_ASPECT);

	// Deer zooms + fades in (desktop) or rises from the bottom (portrait).
	let deerScale = new Tween(1);
	let slideY = new Tween(0);
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
			if (isPortrait) {
				// deer rises up from the bottom
				deerScale.set(1, { duration: 0 });
				slideY.set(deerH, { duration: 0 });
				slideY.set(0, { duration: 520, easing: backOut });
			} else {
				// deer zooms in from SMALL to full size with a springy settle
				slideY.set(0, { duration: 0 });
				deerScale.set(0.08, { duration: 0 });
				deerScale.set(1, { duration: 560, easing: backOut });
			}
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
				}, 700) as unknown as number;
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
			y={isPortrait ? main.height + slideY.current : main.height / 2}
			scale={isPortrait ? 1 : deerScale.current}
			pivot={anchorToPivot({
				anchor: isPortrait ? { x: 0.5, y: 1 } : 0.5,
				sizes: { width: deerW, height: deerH },
			})}
		>
			{#if useAnimDeer}
				<AnimatedSprite
					textures={deerFrames}
					width={deerW}
					height={deerH}
					animationSpeed={0.12}
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
					{#if displayIdle.length}
						<AnimatedSprite
							textures={displayIdle}
							anchor={0.5}
							height={letterH}
							width={letterH * (IDLE_ASPECT[displaySymbol!] ?? 1)}
							animationSpeed={0.28}
							loop={true}
							play={true}
						/>
					{:else}
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
