<script lang="ts" module>
	export type EmitterEventBonusSymbolPanel =
		| { type: 'bonusSymbolRollAwait' };
</script>

<script lang="ts">
	import { BitmapText, Container, Sprite, AnimatedSprite, Graphics } from 'pixi-svelte';
	import type { Texture } from 'pixi-svelte';
	import { FadeContainer } from 'components-pixi';
	import { MainContainer } from 'components-layout';

	import BoardContainer from './BoardContainer.svelte';
	import { getContext } from '../game/context';
	import { SYMBOL_SIZE, SYMBOL_W, SYMBOL_H } from '../game/constants';
	import { spriteKeyByName } from '../game/utils';
	import type { SymbolName } from '../game/types';

	// symbolPad.png is 624×420
	const PAD_ASPECT = 624 / 420;
	const PANEL_W = SYMBOL_W * 1.1;
	const PANEL_H = PANEL_W / PAD_ASPECT;
	const SYM_SIZE = PANEL_W * 0.52;

	const context = getContext();
	const selectedSymbol = $derived(context.stateGame.selectedBonusSymbol);
	const mode = $derived(context.stateGame.bonusMode);
	// Hidden while the deer presenter is on screen; revealed once it finishes.
	let presenterActive = $state(false);
	const show = $derived(!!selectedSymbol && !!mode && !presenterActive);

	// Gentle idle motion on the selected symbol while the panel is up — a slow tilt left/right
	// (a scale "breath" distorted the framed animal art, so we rock it instead).
	let animT = $state(0);
	$effect(() => {
		if (!show) return;
		let raf = 0;
		const t0 = performance.now();
		const tick = (now: number) => {
			animT = (now - t0) / 1000;
			raf = requestAnimationFrame(tick);
		};
		raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
	});
	// ±0.045 rad ≈ ±2.6° — a brisk rock, no scale/position change so the image never distorts.
	const symTilt = $derived(Math.sin(animT * 5.5) * 0.045);
	// Mobile-landscape: the rail becomes a full-height LEFT column (rendered in MainContainer).
	const isLandscape = $derived(context.stateLayoutDerived.layoutType() === 'landscape');
	// Desktop: SYMBOL sits in the RIGHT strip beside the board, aligned with the FREE SPINS card on the
	// left (both render in MainContainer / main-layout units — see the two-margin design reference).
	const isDesktop = $derived(context.stateLayoutDerived.layoutType() === 'desktop');
	const lsRail = $derived(context.stateGameDerived.landscapeRail());

	// FS card geometry (mirror FreeSpinCounter.svelte) so SYMBOL lines up with it across the board.
	const FS_SIZE = 0.72;
	const fsPanelW = SYMBOL_SIZE * 2.0 * FS_SIZE;
	const fsPanelH = fsPanelW / (372 / 248);
	const desktopMainPosition = $derived.by(() => {
		const bl = context.stateGameDerived.boardLayout();
		const main = context.stateLayoutDerived.mainLayout();
		// Right strip centre between the board's right grid edge and the canvas right edge (mirror of
		// the FreeSpinCounter / EARNED left strip).
		// Right column inset from the strip centre. GlobalMultiplier derives its own X from the same
		// expression (minus the same 0.1·SYMBOL_SIZE), so keeping this inset identical is what makes
		// the SYMBOL board line up vertically with the multiplier board below it.
		const rightStripCenterX = (bl.x + bl.width * 0.522 * bl.boardScaleX + main.width) / 2 - SYMBOL_SIZE * 0.1;
		// Align the SYMBOL panel centre with the FREE SPINS card centre.
		const fsTopY = main.height * 0.03 + (main.width * 0.12) / (1176 / 572) + SYMBOL_SIZE * 0.15;
		return { x: rightStripCenterX, y: fsTopY + fsPanelH * 0.5 };
	});
	const scale = $derived(
		isLandscape
			? lsRail.refWidth / PANEL_W
			: isDesktop
				? fsPanelW / PANEL_W // match the FREE SPINS / EARNED card width
				: 1.28, // portrait / tablet stacked
	);

	const boardW = $derived(context.stateGameDerived.boardLayout().width);
	const position = $derived(
		isLandscape
			? { x: lsRail.x, y: lsRail.symbolY }
			: isDesktop
				? desktopMainPosition
				: { x: boardW - PANEL_W * 0.5 - 10, y: -SYMBOL_SIZE * 0.6 },
	);

	const modeLabel = $derived(mode === 'superspin' ? 'ALL IN' : mode === 'feature' ? 'FEATURE' : 'DEAL IT');

	let displaySymbol = $state<SymbolName | null>(null);
	let rollDone = $state(false);
	let rollAwaitResolve: (() => void) | null = null;

	// No roll animation on the panel — the deer presenter already reveals the symbol, so the panel
	// simply shows the final symbol (a second slot-roll here read as an unwanted extra animation).
	$effect(() => {
		const sym = selectedSymbol;
		const currentMode = mode;
		if (!sym || !currentMode) {
			displaySymbol = null;
			rollDone = false;
			return;
		}
		displaySymbol = sym;
		rollDone = true;
		rollAwaitResolve?.();
		rollAwaitResolve = null;
	});

	context.eventEmitter.subscribeOnMount({
		bonusSymbolRollAwait: async () => {
			if (rollDone) return;
			await new Promise<void>((resolve) => { rollAwaitResolve = resolve; });
		},
		stopButtonClick: () => {
			// Skip: land on the final symbol immediately and release any pending roll-await.
			if (selectedSymbol) displaySymbol = selectedSymbol;
			rollDone = true;
			rollAwaitResolve?.();
			rollAwaitResolve = null;
		},
		expandedPresenterShow: () => (presenterActive = true),
		expandedPresenterHide: () => (presenterActive = false),
	});

	const spriteKey = $derived(displaySymbol ? (spriteKeyByName[displaySymbol] ?? 'aTile') : 'aTile');
	// Animals use the new animated idle art (same as the reels) instead of the old crowned tile.
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
	// Bust framing (mirrors Board.svelte IDLE_BUST) — zoom the full-body idle cutout onto the face so
	// the panel shows the same close-up portrait as the main board, masked to the inner wood panel.
	const IDLE_BUST: Partial<Record<SymbolName, { zoom: number; yOff: number; xOff: number }>> = {
		WOLF: { zoom: 1.45, yOff: 0.097, xOff: 0 },
		FOX: { zoom: 1.5, yOff: 0.11, xOff: 0 },
		SQUIRREL: { zoom: 1.65, yOff: 0.157, xOff: -0.03 },
		BEAR: { zoom: 1.35, yOff: 0.098, xOff: 0 },
		RABBIT: { zoom: 1.65, yOff: 0.102, xOff: 0 },
	};
	// symbolPad inner wood panel (excludes the leaf corners / wood rails) — the zoomed bust is masked
	// to this rect so it can't paint over the frame; the top opens up so ears can poke above the rail.
	const PANEL_INNER_W = PANEL_W * 0.72;
	const PANEL_INNER_H = PANEL_H * 0.70;
	const PANEL_TOP_OVERFLOW = 0.3;
	const displayIdle = $derived(
		displaySymbol && IDLE_ANIM_KEY[displaySymbol]
			? ((context.stateApp.loadedAssets?.[IDLE_ANIM_KEY[displaySymbol]!] ?? []) as Texture[])
			: [],
	);
</script>

{#snippet panel()}
	<FadeContainer {show}>
		<Container
			x={position.x}
			y={position.y}
			{scale}
			pivot={{ x: PANEL_W * 0.5, y: PANEL_H * 0.5 }}
		>
			<!-- Frame background -->
			<Sprite key="symbolPad" anchor={{ x: 0.5, y: 0.5 }} x={PANEL_W * 0.5} y={PANEL_H * 0.5} width={PANEL_W} height={PANEL_H} />

			<!-- Symbol sprite, centred — rocks gently left/right around its centre (no scale/bob). -->
			{#if displaySymbol}
				<Container x={PANEL_W * 0.5} y={PANEL_H * 0.5} rotation={symTilt}>
					{#if displayIdle.length}
						{@const bust = IDLE_BUST[displaySymbol!] ?? { zoom: 1, yOff: 0, xOff: 0 }}
						{@const idleH = SYM_SIZE * bust.zoom}
						<!-- Zoomed bust masked to the inner wood panel (top opens up for ears), same as the board. -->
						<Graphics
							isMask
							draw={(graphics) => {
								graphics.rect(
									-PANEL_INNER_W / 2,
									-PANEL_INNER_H / 2 - PANEL_INNER_H * PANEL_TOP_OVERFLOW,
									PANEL_INNER_W,
									PANEL_INNER_H * (1 + PANEL_TOP_OVERFLOW),
								);
								graphics.fill({ color: 0xffffff });
							}}
						/>
						<AnimatedSprite
							textures={displayIdle}
							x={bust.xOff * PANEL_INNER_W}
							y={idleH * bust.yOff}
							anchor={{ x: 0.5, y: 0.5 }}
							height={idleH}
							width={idleH * (IDLE_ASPECT[displaySymbol!] ?? 1)}
							animationSpeed={0.28}
							loop={true}
							play={true}
						/>
					{:else}
						<Sprite
							key={spriteKey}
							anchor={{ x: 0.5, y: 0.5 }}
							width={SYM_SIZE}
							height={SYM_SIZE * (SYMBOL_H / SYMBOL_W)}
						/>
					{/if}
				</Container>
			{/if}
		</Container>
	</FadeContainer>
{/snippet}

{#if isLandscape || isDesktop}
	<MainContainer>{@render panel()}</MainContainer>
{:else}
	<BoardContainer>{@render panel()}</BoardContainer>
{/if}
