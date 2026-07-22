<script lang="ts" module>
	export type EmitterEventBonusSymbolPanel =
		| { type: 'bonusSymbolRollAwait' };
</script>

<script lang="ts">
	import { BitmapText, Container, Sprite, AnimatedSprite } from 'pixi-svelte';
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
	// Shrink + pull-in on short desktop laptop canvases so the rail fits alongside the enlarged board.
	const railAdj = $derived(context.stateGameDerived.bonusRailAdjust());
	// Mobile-landscape: the rail becomes a full-height LEFT column (rendered in MainContainer).
	const isLandscape = $derived(context.stateLayoutDerived.layoutType() === 'landscape');
	const lsRail = $derived(context.stateGameDerived.landscapeRail());
	const scale = $derived(
		isLandscape
			? lsRail.refWidth / PANEL_W
			: (context.stateLayoutDerived.isStacked() ? 1.28 : 1) * railAdj.scale,
	);

	const boardW = $derived(context.stateGameDerived.boardLayout().width);
	const position = $derived(
		isLandscape
			? { x: lsRail.x, y: lsRail.symbolY }
			: context.stateLayoutDerived.isStacked()
				? { x: boardW - PANEL_W * 0.5 - 10, y: -SYMBOL_SIZE * 0.6 }
				: { x: boardW + 40 + railAdj.x, y: SYMBOL_SIZE * 0.3 },
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
						<AnimatedSprite
							textures={displayIdle}
							anchor={{ x: 0.5, y: 0.5 }}
							height={SYM_SIZE}
							width={SYM_SIZE * (IDLE_ASPECT[displaySymbol!] ?? 1)}
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

{#if isLandscape}
	<MainContainer>{@render panel()}</MainContainer>
{:else}
	<BoardContainer>{@render panel()}</BoardContainer>
{/if}
