<script lang="ts" module>
	export type EmitterEventPortraitTopBar = { type: 'portraitTopBarNoop' };
</script>

<script lang="ts">
	import { Tween } from 'svelte/motion';
	import { backOut, cubicOut } from 'svelte/easing';
	import { FadeContainer } from 'components-pixi';
	import { MainContainer } from 'components-layout';
	import { Container, FillGradient, Sprite, Text } from 'pixi-svelte';
	import { stateBet } from 'state-shared';
	import { bookEventAmountToCurrencyString } from 'utils-shared/amount';

	import CapsuleBolts from './CapsuleBolts.svelte';
	import { getContext } from '../game/context';
	import { i18nDerived } from '../i18n/i18nDerived';
	import { getSpriteKeyByName } from '../game/utils';
	import type { SymbolName } from '../game/types';

	const context = getContext();
	const main = $derived(context.stateLayoutDerived.mainLayout());
	// The capsule bar shows in portrait ALWAYS (mirrors the desktop CapsulePanel, whose tube is always
	// visible). The ALL WINS (reward) / FREE SPINS boxes flanking it only appear during the two
	// SPECIAL (bought) bonuses.
	const isPortrait = $derived(context.stateLayoutDerived.layoutType() === 'portrait');
	const isBonus = $derived(
		context.stateGame.bonusMode === 'freegame' || context.stateGame.bonusMode === 'superspin',
	);
	// TOTAL WIN — mirrors the desktop CapsulePanel: the running win counts up smoothly to the total on
	// every spin. A new bet resets winBookEventAmount to 0, which clears the running total.
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
	// cluster's symbol); empty tube when nothing is combining — same as the desktop CapsulePanel.
	const displaySymbol = $derived(
		(context.stateGame.magnetTargetSymbol ??
			context.stateGame.activeSeries[0]?.symbol ??
			null) as SymbolName | null,
	);
	const symbolKey = $derived(displaySymbol ? getSpriteKeyByName({ name: displaySymbol }) : null);

	// Free-spins counter (mirrors FreeSpinCounter events). Shown as spins REMAINING (total - current).
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


	// Horizontal bar centred at the top of the portrait area, above the board.
	const CY = $derived(main.height * 0.186);
	// magnetic_tube.webp is 2004×1336 (fully transparent, see-through interior).
	const TUBE_ASPECT = 2004 / 1336;
	const BOX_ASPECT = 323 / 228;
	const capsuleW = $derived(main.width * 0.56);
	const capsuleH = $derived(capsuleW / TUBE_ASPECT);
	const boxW = $derived(main.width * 0.22);
	const boxH = $derived(boxW / BOX_ASPECT);
	// A small gap between the capsule ends and the ALL WINS / FREE SPINS boxes.
	const gap = $derived(-main.width * 0.006);
	const capsuleX = $derived(main.width * 0.5);
	const leftX = $derived(capsuleX - capsuleW * 0.5 - gap - boxW * 0.5);
	const rightX = $derived(capsuleX + capsuleW * 0.5 + gap + boxW * 0.5);
	const symSize = $derived(capsuleH * 0.42);

	// Symbol pop-in + electric agitation — the same treatment the desktop and landscape capsules
	// give their held symbol. Portrait was drawing it as a plain static Sprite, so the element sat
	// dead still in a tube full of live current.
	const symbolScale = new Tween(0, { duration: 450, easing: backOut });
	$effect(() => {
		if (symbolKey) {
			symbolScale.set(0.08, { duration: 0 });
			symbolScale.set(1, { duration: 450, easing: backOut });
		} else {
			symbolScale.set(0, { duration: 0 });
		}
	});
	let symFx = $state({ dx: 0, dy: 0, s: 1, a: 1 });
	$effect(() => {
		if (!isPortrait) return;
		let raf = 0;
		const t0 = performance.now();
		// Random SURGES: every couple of seconds the grip slams tight then decays fast.
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

	// RESPIN indicator, portrait. RespinPanel.svelte is gated `{#if !isPortrait}` and PortraitTopBar
	// had no RESPIN of its own, so portrait showed nothing at all during a cluster-growth respin.
	// It lives here rather than in RespinPanel because this component owns the portrait top-bar
	// layout (leftX/CY/boxW/boxH); RespinPanel keeps desktop and landscape.
	const showRespin = $derived(context.stateGame.respinIndicator);
	const RESPIN_GRADIENT = new FillGradient({
		type: 'linear',
		start: { x: 0, y: 0 },
		end: { x: 0, y: 1 },
		colorStops: [
			{ offset: 0, color: 0x00fcff },
			{ offset: 1, color: 0x0046a9 },
		],
		textureSpace: 'local',
	});
	const respinStyle = (fontSize: number) => ({
		fontFamily: 'Inter',
		fontWeight: '700' as const,
		fontSize,
		fill: RESPIN_GRADIENT,
		letterSpacing: fontSize * 0.03,
		align: 'center' as const,
	});

	const labelStyle = (fontSize: number) => ({
		fontFamily: 'Inter',
		fontWeight: '700' as const,
		fontSize,
		fill: 0x8ec7ff,
		letterSpacing: fontSize * 0.1,
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

{#if isPortrait}
	<MainContainer zIndex={25}>
		<!-- RESPIN indicator — sits above TOTAL WIN in the left column. Shown only while a cluster
		     grew and earned a free re-spin (stateGame.respinIndicator). -->
		<FadeContainer show={showRespin}>
			<Container x={leftX} y={CY - boxH * 1.12}>
				<Sprite key="smallPadMobile" anchor={0.5} width={boxW} height={boxH} />
				<!-- Label pulled up off the bottom rail (0.27 sat it right on the frame edge); the icon
				     lifts with it so the pair stays optically centred in the bay. -->
				<Sprite key="respinIcon" anchor={0.5} y={-boxH * 0.17} width={boxH * 0.28} height={boxH * 0.28} />
				<Text anchor={0.5} y={boxH * 0.17} text={i18nDerived.translate('RESPIN')} style={respinStyle(boxH * 0.16)} />
			</Container>
		</FadeContainer>

		<!-- TOTAL WIN (running win, counts up each spin) — only during a bonus -->
		{#if isBonus}
			<Container x={leftX} y={CY}>
				<Sprite key="smallPadMobile" anchor={0.5} width={boxW} height={boxH} />
				<Text anchor={0.5} y={-boxH * 0.17} text={i18nDerived.translate('TOTAL WIN')} style={labelStyle(boxH * 0.16)} />
				<Text
					anchor={0.5}
					y={boxH * 0.15}
					text={totalWin}
					style={valueStyle(boxH * (totalWin.length >= 8 ? 0.19 : totalWin.length >= 6 ? 0.23 : 0.28))}
				/>
			</Container>
		{/if}

		<!-- Capsule — ALWAYS shown. Fully transparent tube; the combining symbol (when any) and a live
		     crackle/bolt web arc INSIDE the clear window (masked to the interior), like the desktop. -->
		<Container x={capsuleX} y={CY}>
			<!-- Same treatment as desktop/landscape: STATIC glass housing plus PROCEDURAL bolts, replacing
			     the baked capsule_tube_mobile_anim flipbook (a fixed cycle that visibly looped).
			     magnetic_tube.webp is already the horizontal see-through tube, so it stays as the shell. -->
			<Sprite key="capsuleTubeGlass" anchor={0.5} width={capsuleW} height={capsuleH} />
			<!-- CapsuleBolts always draws a VERTICAL trunk, so the whole thing is rotated 90deg to run along
			     this tube. Under that rotation local +x maps to screen +y and local +y to screen -x, so the
			     props are passed SWAPPED: `width` is the trunk's thickness axis (screen height) and `height`
			     is its length axis (screen width). Footprint matches the baked tube this replaces
			     (capsuleW * 0.941 by capsuleH * 0.427).
			     spanTop/spanBot confine the beam to the CLEAR GLASS. Measured off magnetic_tube.webp:
			     the metal caps are opaque (ink density ~1.0) over x 0.04-0.26 and 0.74-0.96, and the
			     see-through glass is the 0.27-0.74 band — a half-extent of 0.235 of the tube. Divided
			     by the 0.941 length factor and inset slightly, that is 0.239. The component's desktop
			     defaults spanned far more and ran the beam straight over both caps. -->
			<Container rotation={Math.PI / 2}>
				<CapsuleBolts
					width={capsuleH * 0.427}
					height={capsuleW * 0.941}
					charged={!!symbolKey}
					focusY={0}
					symRx={symSize * (152 / 184) * 0.5}
					symRy={symSize * 0.5}
					spanTop={-0.239}
					spanBot={0.239}
				/>
			</Container>
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
						height={symSize * (152 / 184)}
						alpha={symFx.a}
					/>
				</Container>
			{/if}
		</Container>

		<!-- FREE SPINS count (remaining) — only during a bonus -->
		{#if isBonus}
			<Container x={rightX} y={CY}>
				<Sprite key="smallPadMobile" anchor={0.5} width={boxW} height={boxH} />
				<Text anchor={0.5} y={-boxH * 0.17} text={i18nDerived.translate('FREE SPINS')} style={labelStyle(boxH * 0.15)} />
				<Text anchor={0.5} y={boxH * 0.15} text={`${fsRemaining}`} style={valueStyle(boxH * 0.28)} />
			</Container>
		{/if}
	</MainContainer>
{/if}
