<script lang="ts" module>
	export type EmitterEventLandscapeCapsule = { type: 'landscapeCapsuleNoop' };
</script>

<script lang="ts">
	import { Tween } from 'svelte/motion';
	import { backOut, cubicOut } from 'svelte/easing';
	import { FillGradient } from 'pixi-svelte';
	import { MainContainer } from 'components-layout';
	import { Container, Graphics, Sprite, Text } from 'pixi-svelte';
	import { stateBet } from 'state-shared';
	import { bookEventAmountToCurrencyString } from 'utils-shared/amount';

	import { getContext } from '../game/context';
	import { i18nDerived } from '../i18n/i18nDerived';
	import { getSpriteKeyByName } from '../game/utils';
	import type { SymbolName } from '../game/types';
	import CapsuleBeam from './CapsuleBeam.svelte';

	// Centre of the tube's clear glass, as a fraction of the shell sprite's height measured from
	// its centre. Version2 pillar (695x1488): glass runs y ~0.33..0.78 -> centre 0.555.
	const GLASS_CENTRE_OFFSET = 0.055;

	const context = getContext();
	const main = $derived(context.stateLayoutDerived.mainLayout());
	const board = $derived(context.stateGameDerived.boardLayout());

	// Only in mobile-landscape. The tall vertical capsule (mobile art, lightning baked in) sits in the
	// gutter right of the board; the ALL WINS / FREE SPINS boxes stack in the left gutter during bonus.
	const isLandscape = $derived(context.stateLayoutDerived.layoutType() === 'landscape');
	const isBonus = $derived(
		context.stateGame.bonusMode === 'freegame' || context.stateGame.bonusMode === 'superspin',
	);
	// TOTAL WIN — mirrors the desktop CapsulePanel: the running win counts up to the total each spin.
	// (globalMultiplier is the wrong value here: it resets to 1 before every freegame spin, so the
	// box would read "x1" for the whole bonus.)
	let runningWin = $state(0);
	const winTarget = $derived(Math.max(runningWin, stateBet.winBookEventAmount));
	$effect(() => {
		if (stateBet.winBookEventAmount === 0) runningWin = 0;
	});
	const winDisplay = new Tween(0, { duration: 500, easing: cubicOut });
	$effect(() => {
		winDisplay.set(winTarget);
	});
	const totalWin = $derived(bookEventAmountToCurrencyString(Math.round(winDisplay.current)));

	// Element inside the capsule = the symbol currently being combined (magnet target, else the active
	// cluster's symbol); empty tube otherwise — mirrors the desktop CapsulePanel.
	const displaySymbol = $derived(
		(context.stateGame.magnetTargetSymbol ??
			context.stateGame.activeSeries[0]?.symbol ??
			null) as SymbolName | null,
	);
	const symbolKey = $derived(displaySymbol ? getSpriteKeyByName({ name: displaySymbol }) : null);
	const symbolScale = new Tween(0, { duration: 450, easing: backOut });
	$effect(() => {
		if (symbolKey) {
			symbolScale.set(0.08, { duration: 0 });
			symbolScale.set(1, { duration: 450, easing: backOut });
		} else {
			symbolScale.set(0, { duration: 0 });
		}
	});

	// The old live tube electricity (crackle/flicker rAF loop feeding CapsuleBolts and symbol
	// jitter) is removed with the Version2 empty-tube pillar — no per-frame loop runs here until
	// the new in-tube animation is designed.

	// Free-spins counter (spins REMAINING = total - current).
	let fsCurrent = $state(0);
	let fsTotal = $state(0);
	const fsRemaining = $derived(Math.max(0, fsTotal - fsCurrent));
	context.eventEmitter.subscribeOnMount({
		freeSpinCounterShow: () => (fsCurrent = 0),
		freeSpinCounterUpdate: (e) => {
			if (e.current !== undefined) fsCurrent = e.current;
			if (e.total !== undefined) fsTotal = e.total;
		},
		freeSpinIntroShow: () => (runningWin = 0),
		winUpdate: (e) => (runningWin += e.amount),
	});

	// ── geometry ──
	// Capsule column comes from the shared derived (stateGameDerived) so the HTML buy-bonus button can
	// compute the exact same on-screen position and stay centred beneath the capsule at any ratio.
	const cap = $derived(context.stateGameDerived.landscapeCapsuleLayout());
	const colX = $derived(cap.colX);
	const tubeH = $derived(cap.tubeH);
	const tubeW = $derived(cap.tubeW);
	// New animated tesla tube (mp4 → keyed flipbook), rotated 90° to run vertically. The old glass was
	// only ~94% wide × ~43% tall opaque within its box, so draw the (trimmed) animation at those
	// fractions to land in the same on-screen tube. Falls back to the static glass + crackle.
	const tubeY = $derived(cap.tubeY);
	const gridHalfW = $derived(cap.gridHalfW);
	const canvasLeftX = $derived(
		main.width * 0.5 - context.stateLayoutDerived.canvasSizes().width / (2 * (main.scale || 1)),
	);

	// ALL WINS / FREE SPINS boxes — left gutter, stacked, vertically centred on the board.
	const BOX_ASPECT = 323 / 228;
	// 0.49 (was 0.52): keep the 3-box column (TOTAL WIN / FREE SPINS / RESPIN, all equal-sized) compact
	// enough to fit between the logo and the balance/bet control on the LARGEST landscapes (e.g. 932×430),
	// where the pixi stack scales with the board but the HTML controls scale more slowly.
	const boxW = $derived(gridHalfW * 0.49);
	const boxH = $derived(boxW / BOX_ASPECT);
	const boardLeftX = $derived(board.x - gridHalfW);
	const boxX = $derived((canvasLeftX + boardLeftX) * 0.5);
	const boxGap = $derived(boxH * 0.12);
	// Stack the bonus boxes from the TOP (just below the logo) instead of centring them on the board, so
	// the RESPIN box (RespinPanel) can sit BENEATH FREE SPINS instead of being overlapped by it. The
	// logo/gutter geometry mirrors RespinPanel so the three boxes read as one left-gutter column.
	// Anchored just under the logo so TOTAL WIN sits below it and the three-box column (incl. RESPIN)
	// clears the balance/bet control on the shortest landscapes. Both the logo height and the offset
	// now come from stateGame — RespinPanel reads the SAME function, so the two can no longer drift
	// apart, and the offset tightens on popout S where there is least vertical room.
	const stackTopY = $derived(context.stateGameDerived.landscapeStackTopY());

	// Cyan→blue vertical gradient for the ALL WINS / FREE SPINS label text (top #00FCFF → bottom
	// #0046A9). textureSpace 'local' maps 0..1 to each Text's own bounds, so both labels gradient
	// independently top-to-bottom.
	const labelGradient = new FillGradient({
		type: 'linear',
		start: { x: 0, y: 0 },
		end: { x: 0, y: 1 },
		colorStops: [
			{ offset: 0, color: 0x00fcff },
			{ offset: 1, color: 0x0046a9 },
		],
		textureSpace: 'local',
	});

	const labelStyle = (fontSize: number) => ({
		fontFamily: 'Inter',
		fontWeight: '700' as const,
		fontSize,
		fill: labelGradient,
		letterSpacing: fontSize * 0.12,
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

{#if isLandscape}
	<MainContainer zIndex={25}>
		<!-- Vertical capsule (right gutter): the portrait glass tube (magnetic_tube.webp) ROTATED 90° so it
		     runs top-to-bottom, with live electricity arcing INSIDE the clear window (masked) — inherits
		     the portrait/desktop animation. Tube (transparent) -> symbol -> lightning on top. -->
		<Container x={colX} y={tubeY}>
			<!-- Version2 empty-tube pillar (695x1488 keyed cutout), aspect-true: height drives, width
			     follows the canvas ratio (capped by the gutter width so it can't reach the board).
			     The old CapsuleBolts lightning + electric-jitter rAF loop are removed with the art —
			     a new in-tube animation will be built against this empty glass. -->
			{@const shellH = tubeH * 0.941}
			{@const shellW = Math.min(tubeW, shellH * (695 / 1488))}
			<Sprite key="capsuleTubeShell" anchor={0.5} width={shellW} height={shellH} />
			{@const glassCY = shellH * GLASS_CENTRE_OFFSET}
			<!-- In-tube laser + sparkles + the held symbol, all inside CapsuleBeam (small, bobbing,
			     beam terminating on it with an impact flare). Glass = 0.58 of the shell width x
			     0.45 of its height (measured on the 695x1488 art). -->
			<CapsuleBeam
				y={glassCY}
				glassW={shellW * 0.58}
				glassH={shellH * 0.45}
				{symbolKey}
				symbolScale={symbolScale.current}
				symbolW={shellW * 0.58 * 0.55}
			/>
		</Container>

		<!-- ALL WINS (reward) + FREE SPINS boxes, left gutter — only during a bonus. -->
		{#if isBonus}
			<Container x={boxX} y={stackTopY + boxH * 0.5}>
				<Sprite key="smallPadMobile" anchor={0.5} width={boxW} height={boxH} />
				<Text anchor={0.5} y={-boxH * 0.15} text={i18nDerived.translate('TOTAL WIN')} style={labelStyle(boxH * 0.16)} />
				<Text
					anchor={0.5}
					y={boxH * 0.165}
					text={totalWin}
					style={valueStyle(boxH * (totalWin.length >= 8 ? 0.19 : totalWin.length >= 6 ? 0.23 : 0.28))}
				/>
			</Container>
			<Container x={boxX} y={stackTopY + boxH * 1.5 + boxGap}>
				<Sprite key="smallPadMobile" anchor={0.5} width={boxW} height={boxH} />
				<Text anchor={0.5} y={-boxH * 0.15} text={i18nDerived.translate('FREE SPINS')} style={labelStyle(boxH * 0.15)} />
				<Text anchor={0.5} y={boxH * 0.165} text={`${fsRemaining}`} style={valueStyle(boxH * 0.28)} />
			</Container>
		{/if}
	</MainContainer>
{/if}
