<script lang="ts" module>
	export type EmitterEventLandscapeCapsule = { type: 'landscapeCapsuleNoop' };
</script>

<script lang="ts">
	import { Tween } from 'svelte/motion';
	import { backOut, cubicOut } from 'svelte/easing';
	import { FillGradient } from 'pixi.js';
	import { MainContainer } from 'components-layout';
	import { Container, Graphics, Sprite, Text } from 'pixi-svelte';
	import { stateBet } from 'state-shared';
	import { bookEventAmountToCurrencyString } from 'utils-shared/amount';

	import { getContext } from '../game/context';
	import { i18nDerived } from '../i18n/i18nDerived';
	import { getSpriteKeyByName } from '../game/utils';
	import type { SymbolName } from '../game/types';

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

	// ── live tube electricity (mirrors the desktop CapsulePanel) ──
	// Additive crackle web + central bolt flickered on top of the baked tube, with random SURGES that
	// slam everything bright then decay fast. The tube symbol gets a synced jitter + scale/alpha pulse.
	let arcFlicker = $state(0.8);
	let crackleA = $state(0.6);
	let crackleB = $state(0.3);
	let symFx = $state({ dx: 0, dy: 0, s: 1, a: 1 });
	$effect(() => {
		if (!isLandscape) return;
		let raf = 0;
		const t0 = performance.now();
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
			arcFlicker = Math.min(1, 0.6 + 0.24 * Math.sin(t * 19) * Math.sin(t * 6.3) + 0.12 * Math.sin(t * 47) + surge * 0.5);
			crackleA = Math.min(1, 0.42 + 0.5 * (0.5 + 0.5 * Math.sin(t * 13.7)) * (0.5 + 0.5 * Math.sin(t * 4.4)) + surge);
			crackleB = Math.min(1, 0.6 * (0.5 + 0.5 * Math.sin(t * 11.2 + 2.4)) * (0.5 + 0.5 * Math.sin(t * 3.3 + 1.1)) + surge * 0.8);
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
	const tubeY = $derived(cap.tubeY);
	const symSize = $derived(cap.symSize);
	const gridHalfW = $derived(cap.gridHalfW);
	const canvasLeftX = $derived(
		main.width * 0.5 - context.stateLayoutDerived.canvasSizes().width / (2 * (main.scale || 1)),
	);

	// ALL WINS / FREE SPINS boxes — left gutter, stacked, vertically centred on the board.
	const BOX_ASPECT = 323 / 228;
	const boxW = $derived(gridHalfW * 0.52);
	const boxH = $derived(boxW / BOX_ASPECT);
	const boardLeftX = $derived(board.x - gridHalfW);
	const boxX = $derived((canvasLeftX + boardLeftX) * 0.5);
	const boxGap = $derived(boxH * 0.32);

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
		<!-- Vertical capsule (right gutter): the portrait glass tube (magnetic_tube.png) ROTATED 90° so it
		     runs top-to-bottom, with live electricity arcing INSIDE the clear window (masked) — inherits
		     the portrait/desktop animation. Tube (transparent) -> symbol -> lightning on top. -->
		<Container x={colX} y={tubeY}>
			<!-- Rotated tube: the sprite's width becomes the on-screen HEIGHT and its height the WIDTH. -->
			<Sprite key="capsuleTubeGlass" anchor={0.5} rotation={Math.PI / 2} width={tubeH} height={tubeW} />
			{#if symbolKey}
				<Container
					x={symSize * symFx.dx}
					y={symSize * symFx.dy}
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
			<!-- Live electricity in the clear window, clipped to the glass interior. The bolt art is
			     naturally vertical, so (unlike the horizontal portrait bar) it is NOT rotated here. -->
			<Container>
				<Graphics
					isMask
					draw={(g) => {
						g.clear();
						g.beginFill(0xffffff);
						g.rect(-tubeW * 0.2, -tubeH * 0.24, tubeW * 0.4, tubeH * 0.48);
						g.endFill();
					}}
				/>
				<!-- Pulsing core glow (tall ellipse) so the charge reads between bolt flickers. -->
				<Graphics
					blendMode="add"
					draw={(g) => {
						g.clear();
						const steps = 8;
						for (let s = steps; s >= 1; s--) {
							const t = s / steps;
							g.beginFill(0x59b7ff, 0.06 * (1 - t) + 0.015);
							g.drawEllipse(0, 0, tubeW * 0.15 * t, tubeH * 0.24 * t);
							g.endFill();
						}
					}}
				/>
				<Sprite key="capsuleCrackle" anchor={0.5} width={tubeW * 0.42} height={tubeH * 0.5} alpha={crackleA} blendMode="add" />
				<Sprite key="capsuleCrackle" anchor={0.5} width={-tubeW * 0.42} height={tubeH * 0.5} alpha={crackleB} blendMode="add" />
				<Sprite key="capsuleLightning" anchor={0.5} width={tubeW * 0.46} height={tubeH * 0.56} alpha={arcFlicker} blendMode="add" />
				<Sprite key="capsuleLightning" anchor={0.5} width={tubeW * 0.34} height={tubeH * 0.46} alpha={arcFlicker} />
			</Container>
		</Container>

		<!-- ALL WINS (reward) + FREE SPINS boxes, left gutter — only during a bonus. -->
		{#if isBonus}
			<Container x={boxX} y={board.y - boxH * 0.5 - boxGap * 0.5}>
				<Sprite key="smallPadMobile" anchor={0.5} width={boxW} height={boxH} />
				<Text anchor={0.5} y={-boxH * 0.17} text={i18nDerived.translate('TOTAL WIN')} style={labelStyle(boxH * 0.16)} />
				<Text
					anchor={0.5}
					y={boxH * 0.15}
					text={totalWin}
					style={valueStyle(boxH * (totalWin.length >= 8 ? 0.19 : totalWin.length >= 6 ? 0.23 : 0.28))}
				/>
			</Container>
			<Container x={boxX} y={board.y + boxH * 0.5 + boxGap * 0.5}>
				<Sprite key="smallPadMobile" anchor={0.5} width={boxW} height={boxH} />
				<Text anchor={0.5} y={-boxH * 0.17} text={i18nDerived.translate('FREE SPINS')} style={labelStyle(boxH * 0.15)} />
				<Text anchor={0.5} y={boxH * 0.15} text={`${fsRemaining}`} style={valueStyle(boxH * 0.28)} />
			</Container>
		{/if}
	</MainContainer>
{/if}
