<script lang="ts" module>
	export type EmitterEventCapsulePanel = { type: 'capsulePanelNoop' };
</script>

<script lang="ts">
	import { Tween } from 'svelte/motion';
	import { backOut, cubicOut } from 'svelte/easing';
	import { MainContainer } from 'components-layout';
	import { FadeContainer } from 'components-pixi';
	import { Container, Sprite, Text } from 'pixi-svelte';
	import { stateBet } from 'state-shared';
	import { bookEventAmountToCurrencyString } from 'utils-shared/amount';

	import { getContext } from '../game/context';
	import { getSpriteKeyByName } from '../game/utils';
	import type { SymbolName } from '../game/types';
	import { i18nDerived } from '../i18n/i18nDerived';
	import CapsuleBolts from './CapsuleBolts.svelte';

	const context = getContext();
	const board = $derived(context.stateGameDerived.boardLayout());
	const scale = $derived(board.boardScale);

	// This tall vertical capsule is the DESKTOP/tablet column only. Portrait and mobile-landscape use
	// their own compact HUDs, so the whole panel is hidden in both of those.
	const layoutType = $derived(context.stateLayoutDerived.layoutType());
	const isPortrait = $derived(layoutType === 'portrait' || layoutType === 'landscape');
	// The capsule tube is ALWAYS shown (outside portrait) — clusters (and their magnet series) can
	// happen in the base game too. The TOTAL WIN / FREE SPINS boxes only appear during bought bonuses.
	const isBonus = $derived(
		(context.stateGame.bonusMode === 'freegame' || context.stateGame.bonusMode === 'superspin') &&
			!isPortrait,
	);
	// Running total win across the round. Some bonuses only send the cumulative `setTotalWin` at the
	// very end (0 each spin), so we also accumulate every spin's win (winUpdate) and show whichever is
	// larger — the box then grows each time a spin pays instead of only showing the final total.
	let runningWin = $state(0);
	const winTarget = $derived(Math.max(runningWin, stateBet.winBookEventAmount));
	// A new bet resets winBookEventAmount to 0 (a bonus is ONE bet, so it never hits 0 mid-bonus) —
	// use that to clear the base-game running total each spin.
	$effect(() => {
		if (stateBet.winBookEventAmount === 0) runningWin = 0;
	});
	// Count the box up smoothly whenever the total grows, so it visibly sums up on every spin.
	const winDisplay = new Tween(0, { duration: 500, easing: cubicOut });
	$effect(() => {
		winDisplay.set(winTarget);
	});
	const totalWin = $derived(bookEventAmountToCurrencyString(Math.round(winDisplay.current)));

	// Element inside the capsule = the symbol currently being combined: the magnet's target when a
	// magnet series runs, else the active cluster's symbol (natural clusters don't set a magnet
	// target). Empty tube (just electricity) when nothing is combining.
	const displaySymbol = $derived(
		(context.stateGame.magnetTargetSymbol ??
			context.stateGame.activeSeries[0]?.symbol ??
			null) as SymbolName | null,
	);
	const symbolKey = $derived(displaySymbol ? getSpriteKeyByName({ name: displaySymbol }) : null);

	// Pop-in: the symbol zooms from tiny to full size (slight overshoot) whenever it (re)appears.
	const symbolScale = new Tween(0, { duration: 450, easing: backOut });
	$effect(() => {
		if (symbolKey) {
			symbolScale.set(0.08, { duration: 0 });
			symbolScale.set(1, { duration: 450, easing: backOut });
		} else {
			symbolScale.set(0, { duration: 0 });
		}
	});

	// Free-spins counter (mirrors FreeSpinCounter events). Shown as spins REMAINING (10 → 0):
	// `current` is the 1-based spin being played, so remaining = total - current.
	let fsCurrent = $state(0);
	let fsTotal = $state(0);
	const fsRemaining = $derived(Math.max(0, fsTotal - fsCurrent));
	context.eventEmitter.subscribeOnMount({
		freeSpinIntroShow: () => (runningWin = 0),
		freeSpinCounterShow: () => (fsCurrent = 0),
		freeSpinCounterUpdate: (e) => {
			if (e.current !== undefined) fsCurrent = e.current;
			if (e.total !== undefined) fsTotal = e.total;
		},
		winUpdate: (e) => (runningWin += e.amount),
	});

	// Column geometry — a vertical stack to the RIGHT of the board, spanning its full height.
	// The capsule is one tall piece running top-to-bottom; TOTAL WIN caps its top and FREE SPINS
	// caps its bottom, both tucked slightly over the capsule's metal ends so they connect (no gap).
	const PANEL_ASPECT = 200 / 98;
	const gridHalfW = $derived(board.width * 0.5 * scale);
	const gridHalfH = $derived(board.height * 0.5 * scale);
	const PANEL_W = $derived(board.width * 0.32 * scale);
	const PANEL_H = $derived(PANEL_W / PANEL_ASPECT);
	const botY = $derived(board.y + gridHalfH);
	// True screen edges in main-layout coordinates (the layout is centred on the canvas), so the
	// capsule's top pipe touches the top edge of the SCREEN, per Figma.
	const main = $derived(context.stateLayoutDerived.mainLayout());
	const canvasTopY = $derived(
		main.height * 0.5 - context.stateLayoutDerived.canvasSizes().height / (2 * (main.scale || 1)),
	);
	const canvasRightX = $derived(
		main.width * 0.5 + context.stateLayoutDerived.canvasSizes().width / (2 * (main.scale || 1)),
	);
	// Column centred horizontally in the space between the board's right edge and the screen edge.
	const colX = $derived((board.x + gridHalfW + canvasRightX) * 0.5);
	// FREE SPINS stays at the board's bottom edge; the capsule runs from the screen top down past
	// it (FREE SPINS sits on top of and covers a bit of the capsule's base).
	const fsY = $derived(botY - PANEL_H * 0.5);
	const tubeTop = $derived(canvasTopY);
	const tubeBot = $derived(fsY + PANEL_H * 0.1);
	const tubeH = $derived(Math.max(1, tubeBot - tubeTop));
	// TOTAL WIN overlays the capsule's top pipe (Figma: plaque ~15% down the column).
	const totalWinY = $derived(tubeTop + tubeH * 0.155);
	// Wider tube so the symbol sits comfortably inside the glass instead of overflowing its walls.
	const tubeW = $derived(PANEL_W * 1.08);
	const tubeY = $derived((tubeTop + tubeBot) * 0.5);
	const symSize = $derived(tubeW * 0.50);

	// The capsule is a STATIC shell plus an additive lightning layer, not one baked flipbook — the
	// source video wobbles ~1px, so animating the whole capsule made the housing drift.
	//
	// The capsule is a STATIC shell (per-pixel median of the original flipbook — the source video
	// wobbles ~1px, so animating the whole capsule made the housing drift) plus PROCEDURAL bolts.
	// The lightning was a baked 25-frame loop; however well the seam was hidden, a fixed cycle
	// eventually reads as a loop. CapsuleBolts generates fresh geometry per strike instead.

	// Electric agitation of the tube symbol: tiny jitter + scale pulse + brightness flicker,
	// all amplified while a surge is arcing.
	let symFx = $state({ dx: 0, dy: 0, s: 1, a: 1 });
	$effect(() => {
		let raf = 0;
		const t0 = performance.now();
		// Random SURGES: every couple of seconds everything slams to full brightness and decays fast.
		let nextSurge = performance.now() + 800 + Math.random() * 1500;
		let surgeStart = -1;
		const tick = (now: number) => {
			const t = (now - t0) / 1000;
			if (surgeStart < 0 && now >= nextSurge) surgeStart = now;
			let surge = 0;
			if (surgeStart >= 0) {
				const st = (now - surgeStart) / 1000;
				surge = Math.max(0, (0.6 + 0.4 * Math.sin(st * 70)) * Math.exp(-st / 0.11));
				if (st > 0.4) {
					surgeStart = -1;
					nextSurge = now + 900 + Math.random() * 2200;
				}
			}
			// the electricity "grips" the symbol: faster/larger shake during surges
			const grip = 1 + surge * 3;
			symFx = {
				dx: Math.sin(t * 23.7) * 0.012 * grip,
				dy: Math.cos(t * 17.3) * 0.014 * grip,
				s: 1 + 0.02 * Math.sin(t * 9.1) + surge * 0.05,
				a: Math.min(1, 0.93 + 0.07 * Math.sin(t * 37) + surge * 0.3),
			};
			raf = requestAnimationFrame(tick);
		};
		raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
	});

	const labelStyle = (fontSize: number) => ({
		fontFamily: 'Inter',
		fontWeight: '700' as const,
		fontSize,
		fill: 0x8ec7ff,
		letterSpacing: fontSize * 0.14,
		align: 'center' as const,
	});
	const valueStyle = (fontSize: number) => ({
		fontFamily: 'Inter',
		fontWeight: '700' as const,
		fontSize,
		fill: 0xffffff,
		align: 'center' as const,
	});
</script>

<MainContainer zIndex={25}>
	<FadeContainer show={!isPortrait}>
		<!-- Capsule: one tall piece drawn first, BEHIND the panels so its metal caps connect under
		     TOTAL WIN (top) and FREE SPINS (bottom). Tube (back) -> symbol -> lightning ON TOP so the
		     electricity arcs over the element. -->
		<Container x={colX} y={tubeY}>
			<Sprite key="capsuleTubeShell" anchor={0.5} width={tubeW} height={tubeH} />
			<CapsuleBolts width={tubeW} height={tubeH} />
			{#if symbolKey}
				<Container
					x={symSize * symFx.dx}
					y={tubeH * 0.055 + symSize * symFx.dy}
					scale={symbolScale.current * symFx.s}
				>
					<Sprite
						key={symbolKey}
						anchor={0.5}
						width={symSize}
						height={symSize * (264 / 328)}
						alpha={symFx.a}
					/>
				</Container>
			{/if}
			<!-- Lightning is baked into the animated tube frames — no procedural overlay needed. -->
		</Container>

		<!-- TOTAL WIN / FREE SPINS boxes only during a bonus — in base game the capsule stands alone -->
		{#if isBonus}
			<!-- TOTAL WIN caps the top of the capsule. The panel art's visible box is offset from the
			     sprite centre (glow padding is asymmetric: core centre −1.25% W, −4.6% H), so the text
			     block is shifted to the box's TRUE centre. -->
			<Container x={colX} y={totalWinY}>
				<Sprite key="panelBorder" anchor={0.5} width={PANEL_W} height={PANEL_H} />
				<Container x={-PANEL_W * 0.0125} y={-PANEL_H * 0.046}>
					<Text anchor={0.5} y={-PANEL_H * 0.11} text={i18nDerived.translate('TOTAL WIN')} style={labelStyle(PANEL_H * 0.14)} />
					<Text anchor={0.5} y={PANEL_H * 0.11} text={totalWin} style={valueStyle(PANEL_H * 0.24)} />
				</Container>
			</Container>

			<!-- FREE SPINS caps the bottom of the capsule (same visible-box centring as TOTAL WIN) -->
			<Container x={colX} y={fsY}>
				<Sprite key="panelBorder" anchor={0.5} width={PANEL_W} height={PANEL_H} />
				<Container x={-PANEL_W * 0.0125} y={-PANEL_H * 0.046}>
					<Text anchor={0.5} y={-PANEL_H * 0.11} text={i18nDerived.translate('FREE SPINS')} style={labelStyle(PANEL_H * 0.14)} />
					<Text anchor={0.5} y={PANEL_H * 0.11} text={`${fsRemaining}`} style={valueStyle(PANEL_H * 0.24)} />
				</Container>
			</Container>
		{/if}
	</FadeContainer>
</MainContainer>
