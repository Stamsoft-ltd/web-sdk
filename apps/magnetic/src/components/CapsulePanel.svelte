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
	import { SYMBOL_H, SYMBOL_W } from '../game/constants';
	import type { SymbolName } from '../game/types';
	import { i18nDerived } from '../i18n/i18nDerived';
	import CapsuleBeam from './CapsuleBeam.svelte';
	import InfoBox from './InfoBox.svelte';

	// Inner glass of the Version2 pillar art (695x1488, measured): x 0.21..0.79 → 0.58 of the
	// shell width; y 0.33..0.78 → 0.45 of the height, centred 0.055 below the sprite centre.
	const GLASS_W_FRAC = 0.58;
	const GLASS_H_FRAC = 0.45;
	const GLASS_CY_FRAC = 0.055;

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

	// ── board → tube flight ──
	// The held symbol FLIES out of its board cell into the glass instead of popping into existence
	// (user request). On appear we grab the matching board cell nearest the capsule, tween a copy
	// along an arc to the tube, and only then let the in-tube symbol pop in.
	const FLIGHT_MS = 520;
	let flight = $state<{ key: string; fromX: number; fromY: number } | null>(null);
	const flightT = new Tween(0, { duration: FLIGHT_MS, easing: cubicOut });

	// Screen position (main-layout coords) of the board cell we should launch from: a cell holding
	// this symbol, preferring locked cluster cells, and among those the one closest to the capsule.
	const sourceCellPos = (name: SymbolName) => {
		const cells = context.stateGame.board.flat().filter((cell) => cell.name === name);
		if (!cells.length) return null;
		const locked = cells.filter((cell) => cell.locked);
		const pool = locked.length ? locked : cells;
		const pick = pool.reduce((a, b) => (b.position.reel > a.position.reel ? b : a));
		const gridW = board.width * scale;
		const gridH = board.height * scale;
		return {
			x: board.x - gridW / 2 + (pick.position.reel + 0.5) * SYMBOL_W * scale,
			y: board.y - gridH / 2 + (pick.position.row + 0.5) * SYMBOL_H * scale,
		};
	};

	// Pop-in: the symbol zooms from tiny to full size (slight overshoot) once it has arrived.
	const symbolScale = new Tween(0, { duration: 450, easing: backOut });
	let lastKey: string | null = null;
	$effect(() => {
		const key = symbolKey;
		if (key === lastKey) return;
		lastKey = key;
		if (!key) {
			flight = null;
			symbolScale.set(0, { duration: 0 });
			return;
		}
		const from = displaySymbol ? sourceCellPos(displaySymbol) : null;
		if (from && !isPortrait) {
			flight = { key, fromX: from.x, fromY: from.y };
			symbolScale.set(0, { duration: 0 });
			flightT.set(0, { duration: 0 });
			void flightT.set(1, { duration: FLIGHT_MS, easing: cubicOut }).then(() => {
				// Guard: a newer symbol (or a clear) may have replaced this flight mid-air.
				if (flight?.key !== key || lastKey !== key) return;
				flight = null;
				// HAND OFF AT FULL SIZE. Re-running the 0.08 -> 1 pop here made the symbol shrink away
				// and grow back the instant it landed, which read as a second, separate animation. The
				// flight already ends at the in-tube size, so all that is left is a small settle as the
				// beam catches it.
				symbolScale.set(1.08, { duration: 0 });
				symbolScale.set(1, { duration: 220, easing: cubicOut });
			});
		} else {
			flight = null;
			symbolScale.set(0.08, { duration: 0 });
			symbolScale.set(1, { duration: 450, easing: backOut });
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
	// Left-rail stack (shared with RespinPanel) — FREE SPINS / TOTAL WIN sit in slots 1 and 2.
	const rail = $derived(context.stateGameDerived.desktopRailStack());
	const tubeTop = $derived(canvasTopY);
	// The pillar's bottom lands exactly on the board FRAME's bottom edge (user round) — mirror
	// BoardFrame's INTERIOR_MARGIN (1.01) / ART_INNER_H (0.9033) to find the visible bezel edge.
	// The pillar art is tight-trimmed, so the sprite bottom IS the visible base bottom.
	const tubeBot = $derived(board.y + (board.height * scale * 1.01) / 0.9033 / 2);
	const tubeH = $derived(Math.max(1, tubeBot - tubeTop));
	const tubeY = $derived((tubeTop + tubeBot) * 0.5);

	// The in-tube visuals (laser, particles and the held symbol itself) all live in <CapsuleBeam>.
</script>

<MainContainer zIndex={25}>
	<FadeContainer show={!isPortrait}>
		<!-- Capsule: one tall piece drawn first, BEHIND the panels so its metal caps connect under
		     TOTAL WIN (top) and FREE SPINS (bottom). Order is tube (back) -> lightning -> symbol IN
		     FRONT, so the beam passes BEHIND the held element instead of cutting across its face.
		     This still leaves the focus arcs visible: they run from the trunk above/below the symbol
		     and terminate ON its silhouette, so the whole approach is outside the object and only the
		     contact point itself is clipped by it. -->
		<Container x={colX} y={tubeY}>
			<!-- Version2 pillar (695x1488 keyed cutout, empty glass tube) must keep its aspect —
			     stretching it to the tubeW x tubeH column box was the reported wrong-proportion
			     pillar. Height drives; width follows the canvas ratio.
			     Order: shell -> beam+particles (CapsuleBeam, additive) -> symbol IN FRONT, so the
			     laser passes behind the held element instead of cutting across its face. -->
			{@const shellW = tubeH * (695 / 1488)}
			<Sprite key="capsuleTubeShell" anchor={0.5} width={shellW} height={tubeH} />
			<!-- The held symbol lives INSIDE CapsuleBeam now: much smaller, bobbing in the beam,
			     with the laser terminating on it + an impact flare (user: "realistically inside
			     and laser is hitting it"). -->
			<CapsuleBeam
				y={tubeH * GLASS_CY_FRAC}
				glassW={shellW * GLASS_W_FRAC}
				glassH={tubeH * GLASS_H_FRAC}
				symbolKey={flight ? null : symbolKey}
				symbolScale={symbolScale.current}
				symbolW={shellW * GLASS_W_FRAC * 0.55}
			/>
		</Container>

		<!-- Symbol in flight from its board cell into the glass: eased along an arc (it lifts on the
		     way across) and shrinking from board size to in-tube size. It BANKS and levels out again
		     rather than turning through a fixed angle — landing at a rotation the in-tube symbol does
		     not share made the arrival snap back upright, so the trip read as two animations. -->
		{#if flight}
			{@const u = flightT.current}
			{@const destX = colX}
			{@const destY = tubeY + tubeH * GLASS_CY_FRAC}
			{@const shellW = tubeH * (695 / 1488)}
			{@const symTarget = shellW * GLASS_W_FRAC * 0.55}
			{@const symStart = SYMBOL_W * scale}
			{@const w = symStart + (symTarget - symStart) * u}
			<Container
				x={flight.fromX + (destX - flight.fromX) * u}
				y={flight.fromY + (destY - flight.fromY) * u - Math.sin(u * Math.PI) * tubeH * 0.1}
				rotation={Math.sin(u * Math.PI) * 0.38}
				alpha={0.35 + 0.65 * Math.min(1, u * 3)}
			>
				<Sprite key={flight.key} anchor={0.5} width={w} height={w * (264 / 328)} />
			</Container>
		{/if}

		<!-- FREE SPINS / TOTAL WIN live in the LEFT RAIL now (Version2 design): slots 1 and 2 under
		     RESPIN, same box art and size. They used to cap the capsule's top and bottom on the
		     right, which the design does not do. Bonus only — in base game the capsule stands alone. -->
		{#if isBonus}
			<InfoBox
				x={rail.x}
				y={rail.slotY(1)}
				width={rail.boxW}
				label={i18nDerived.translate('FREE SPINS')}
				value={`${fsRemaining}`}
			/>
			<InfoBox
				x={rail.x}
				y={rail.slotY(2)}
				width={rail.boxW}
				label={i18nDerived.translate('TOTAL WIN')}
				value={totalWin}
			/>
		{/if}
	</FadeContainer>
</MainContainer>
