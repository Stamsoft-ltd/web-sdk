<script lang="ts" module>
	export type EmitterEventCapsulePanel = { type: 'capsulePanelNoop' };
</script>

<script lang="ts">
	import { onMount } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';
	import { MainContainer } from 'components-layout';
	import { FadeContainer } from 'components-pixi';
	import { Container, Sprite, Text } from 'pixi-svelte';
	import { stateBet } from 'state-shared';
	import { bookEventAmountToCurrencyString } from 'utils-shared/amount';

	import { getContext } from '../game/context';
	import { PAY_SYMBOLS } from '../game/constants';
	import { getSpriteKeyByName } from '../game/utils';
	import type { SymbolName } from '../game/types';

	const context = getContext();
	const board = $derived(context.stateGameDerived.boardLayout());
	const scale = $derived(board.boardScale);

	// Only for the two SPECIAL (bought) bonuses — 3rd bonus (BONUS = freegame) and 4th bonus
	// (SUPER = superspin). Not shown for base / chance / feature. Removed automatically when the
	// round ends (bonusMode -> null).
	const isBonus = $derived(
		(context.stateGame.bonusMode === 'freegame' || context.stateGame.bonusMode === 'superspin') &&
			context.stateLayoutDerived.layoutType() !== 'portrait',
	);
	// Running total win across the bonus. Some bonuses only send the cumulative `setTotalWin` at the
	// very end (0 each spin), so we also accumulate every spin's win (winUpdate) and show whichever is
	// larger — the box then grows each time a spin pays instead of only showing the final total.
	let runningWin = $state(0);
	const winTarget = $derived(Math.max(runningWin, stateBet.winBookEventAmount));
	// Count the box up smoothly whenever the total grows, so it visibly sums up on every spin.
	const winDisplay = new Tween(0, { duration: 500, easing: cubicOut });
	$effect(() => {
		winDisplay.set(winTarget);
	});
	const totalWin = $derived(bookEventAmountToCurrencyString(Math.round(winDisplay.current)));

	// Element inside the capsule = a RANDOM pay symbol, using the new hi-res, frameless desktop
	// symbols. Prefer the game's magnet target when set; otherwise a random one of the pay symbols.
	let randomSymbol = $state<SymbolName>('H1');
	onMount(() => {
		randomSymbol = PAY_SYMBOLS[Math.floor(Math.random() * PAY_SYMBOLS.length)] as SymbolName;
	});
	const displaySymbol = $derived(
		(context.stateGame.magnetTargetSymbol ??
			context.stateGame.selectedBonusSymbol ??
			randomSymbol) as SymbolName,
	);
	const symbolKey = $derived(getSpriteKeyByName({ name: displaySymbol }));

	// Free-spins counter (mirrors FreeSpinCounter events).
	let fsCurrent = $state(0);
	let fsTotal = $state(0);
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
	const PANEL_W = $derived(board.width * 0.29 * scale);
	const PANEL_H = $derived(PANEL_W / PANEL_ASPECT);
	const MARGIN = $derived(board.width * 0.05 * scale);

	const colX = $derived(board.x + gridHalfW + MARGIN + PANEL_W * 0.5);
	const topY = $derived(board.y - gridHalfH);
	const botY = $derived(board.y + gridHalfH);
	// TOTAL WIN sits a bit below the logo on the left — fully on-screen, never clipped.
	// FREE SPINS stays at the board's bottom edge.
	const totalWinY = $derived(topY + PANEL_H * 1.15);
	const fsY = $derived(botY - PANEL_H * 0.5);
	// Capsule runs from just under TOTAL WIN down well past FREE SPINS, which sits on top of and
	// covers a bit of the capsule's base.
	const tubeTop = $derived(totalWinY + PANEL_H * 0.24);
	const tubeBot = $derived(fsY + PANEL_H * 0.1);
	const tubeH = $derived(Math.max(1, tubeBot - tubeTop));
	// Wider tube so the symbol sits comfortably inside the glass instead of overflowing its walls.
	const tubeW = $derived(PANEL_W * 1.08);
	const tubeY = $derived((tubeTop + tubeBot) * 0.5);
	const symSize = $derived(tubeW * 0.6);

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
	<FadeContainer show={isBonus}>
		<!-- Capsule: one tall piece drawn first, BEHIND the panels so its metal caps connect under
		     TOTAL WIN (top) and FREE SPINS (bottom). Tube (back) -> symbol -> lightning ON TOP so the
		     electricity arcs over the element. -->
		<Container x={colX} y={tubeY}>
			<Sprite key="capsuleTube" anchor={0.5} width={tubeW} height={tubeH} />
			<Sprite
				key={symbolKey}
				anchor={0.5}
				y={tubeH * 0.02}
				width={symSize}
				height={symSize * (264 / 328)}
			/>
			<Sprite
				key="capsuleLightning"
				anchor={0.5}
				width={tubeW * 0.48}
				height={tubeH * 0.6}
				alpha={0.8}
			/>
		</Container>

		<!-- TOTAL WIN caps the top of the capsule -->
		<Container x={colX} y={totalWinY}>
			<Sprite key="panelBorder" anchor={0.5} width={PANEL_W} height={PANEL_H} />
			<Text anchor={0.5} y={-PANEL_H * 0.11} text="TOTAL WIN" style={labelStyle(PANEL_H * 0.14)} />
			<Text anchor={0.5} y={PANEL_H * 0.11} text={totalWin} style={valueStyle(PANEL_H * 0.24)} />
		</Container>

		<!-- FREE SPINS caps the bottom of the capsule -->
		<Container x={colX} y={fsY}>
			<Sprite key="panelBorder" anchor={0.5} width={PANEL_W} height={PANEL_H} />
			<Text anchor={0.5} y={-PANEL_H * 0.11} text="FREE SPINS" style={labelStyle(PANEL_H * 0.14)} />
			<Text anchor={0.5} y={PANEL_H * 0.11} text={`${fsCurrent}`} style={valueStyle(PANEL_H * 0.24)} />
		</Container>
	</FadeContainer>
</MainContainer>
