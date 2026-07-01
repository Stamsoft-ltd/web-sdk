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
	import { anchorToPivot, Container, Sprite } from 'pixi-svelte';

	import { getContext } from '../game/context';
	import { spriteKeyByName } from '../game/utils';

	const context = getContext();

	// Portrait uses a taller full-body deer (deer_presenter_mobile.png 360×730) that rises
	// from the bottom; desktop uses deer_presenter.png (792×670) that zooms in centred.
	const isPortrait = $derived(context.stateLayoutDerived.layoutType() === 'portrait');
	const deerKey = $derived(isPortrait ? 'deerPresenterMobile' : 'deerPresenter');
	const MOBILE_RATIO = 360 / 730;
	const DEER_RATIO = $derived(isPortrait ? MOBILE_RATIO : 792 / 670);
	// Empty-board interior centre + height as a fraction of the deer image.
	const PLACEHOLDER = $derived(
		isPortrait ? { cx: 0.486, cy: 0.585, h: 0.14 } : { cx: 0.494, cy: 0.645, h: 0.18 },
	);
	// Per-symbol vertical nudge (fraction of deer height). The animal tiles are content-centred,
	// so they sit right at PLACEHOLDER.cy; some letter glyphs read low and need a small lift.
	const CY_NUDGE: Partial<Record<SymbolName, number>> = { J: -0.03 };
	const LETTER_ASPECT = $derived(isPortrait ? 1.34 : 1.17); // symbol sprites ~cell aspect

	const main = $derived(context.stateLayoutDerived.mainLayout());
	// Portrait: much bigger (height-capped full body). Desktop: fit both ways.
	const deerH = $derived(
		isPortrait
			? Math.min(main.height * 0.92, (main.width / MOBILE_RATIO) * 0.98)
			: Math.min(main.height * 0.92, main.width * 0.62),
	);
	const deerW = $derived(deerH * DEER_RATIO);

	// Symbols the board rolls through before landing on the chosen one.
	const ALL_SYMBOLS: SymbolName[] = ['FOX', 'WOLF', 'BEAR', 'RABBIT', 'SQUIRREL', 'A', 'K', 'Q', 'J', 'T'];
	const ROLL_MS = 1700;

	let show = $state(false);
	// displaySymbol cycles during the roll, then settles on the real symbol.
	let displaySymbol = $state<SymbolName | null>(null);
	const letterKey = $derived(displaySymbol ? (spriteKeyByName[displaySymbol] ?? null) : null);
	const symbolCy = $derived(PLACEHOLDER.cy + (displaySymbol ? (CY_NUDGE[displaySymbol] ?? 0) : 0));

	const letterH = $derived(deerH * PLACEHOLDER.h);
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

	const skip = () => {
		if (!show || skipped) return;
		skipped = true;
		clearTimeout(rollTimer);
		wiggling = false;
		if (finalSymbol) displaySymbol = finalSymbol;
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
				sc.set(1.18, { duration: 0 });
				sc.set(1, { duration: 320, easing: backOut });
				startWiggle();
				return;
			}
			idx = (idx + 1) % ALL_SYMBOLS.length;
			displaySymbol = ALL_SYMBOLS[idx];
			const interval = 55 + progress * progress * 320;
			rollTimer = setTimeout(step, interval) as unknown as number;
		};
		rollTimer = setTimeout(step, 55) as unknown as number;
	};

	context.eventEmitter.subscribeOnMount({
		expandedPresenterShow: (emitterEvent) => {
			show = true;
			skipped = false;
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
				// deer zooms in
				slideY.set(0, { duration: 0 });
				deerScale.set(0.82, { duration: 0 });
				deerScale.set(1, { duration: 420, easing: backOut });
			}
			// roll through symbols, then land on the chosen one
			startRoll(emitterEvent.symbol);
		},
		// The book awaits this before hiding — resolve after a short hold, or instantly if skipped.
		expandedPresenterAwaitClose: async () => {
			if (skipped) return;
			await new Promise<void>((resolve) => {
				closeResolve = resolve;
				holdTimer = setTimeout(() => {
					closeResolve?.();
					closeResolve = null;
				}, 1100) as unknown as number;
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
			<Sprite key={deerKey} width={deerW} height={deerH} />
			{#if letterKey}
				<Container
					x={deerW * PLACEHOLDER.cx}
					y={deerH * symbolCy}
					scale={sc.current}
					rotation={rot.current}
				>
					<Sprite key={letterKey} anchor={0.5} width={letterW} height={letterH} />
				</Container>
			{/if}
		</Container>
	</MainContainer>
</FadeContainer>

{#if show}
	<OnHotkey hotkey="Space" onpress={() => context.eventEmitter.broadcast({ type: 'stopButtonClick' })} />
	<OnPressFullScreen onpress={() => context.eventEmitter.broadcast({ type: 'stopButtonClick' })} />
{/if}
