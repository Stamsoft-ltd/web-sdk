<script lang="ts" module>
	export type EmitterEventPortraitTopBar = { type: 'portraitTopBarNoop' };
</script>

<script lang="ts">
	import { Tween } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';
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

	// Live electricity inside the (transparent, black-inside) tube — mirrors the desktop CapsulePanel:
	// a flickering central bolt + a crackle web drawn twice (one mirrored) with out-of-phase shimmer,
	// plus periodic SURGES that slam everything to full brightness and decay fast.
	let arcFlicker = $state(0.8);
	let crackleA = $state(0.6);
	let crackleB = $state(0.3);
	$effect(() => {
		if (!isPortrait) return;
		let raf = 0;
		const t0 = performance.now();
		let nextSurge = t0 + 800 + Math.random() * 1500;
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
			raf = requestAnimationFrame(tick);
		};
		raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
	});

	// Horizontal bar centred at the top of the portrait area, above the board.
	const CY = $derived(main.height * 0.186);
	// magnetic_tube.png is 2004×1336 (fully transparent, see-through interior).
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
			<Sprite key="capsuleTubeGlass" anchor={0.5} width={capsuleW} height={capsuleH} />
			{#if symbolKey}
				<Sprite key={symbolKey} anchor={0.5} width={symSize} height={symSize * (152 / 184)} />
			{/if}
			<Container>
				<Graphics
					isMask
					draw={(g) => {
						g.clear();
						g.beginFill(0xffffff);
						g.rect(-capsuleW * 0.23, -capsuleH * 0.18, capsuleW * 0.46, capsuleH * 0.36);
						g.endFill();
					}}
				/>
				<!-- Pulsing core glow (wide ellipse) so the charge reads even between bolt flickers. -->
				<Graphics
					blendMode="add"
					draw={(g) => {
						g.clear();
						const steps = 8;
						for (let s = steps; s >= 1; s--) {
							const t = s / steps;
							g.beginFill(0x59b7ff, 0.06 * (1 - t) + 0.015);
							g.drawEllipse(0, 0, capsuleW * 0.26 * t, capsuleH * 0.14 * t);
							g.endFill();
						}
					}}
				/>
				<!-- Lightning runs HORIZONTALLY along the tube: the (vertical) bolt art is rotated 90°, so
				     its length maps to the sprite HEIGHT (tube width) and its thickness to the WIDTH. -->
				<Sprite key="capsuleCrackle" anchor={0.5} rotation={Math.PI / 2} width={capsuleH * 0.4} height={capsuleW * 0.5} alpha={crackleA} blendMode="add" />
				<Sprite key="capsuleCrackle" anchor={0.5} rotation={Math.PI / 2} width={-capsuleH * 0.4} height={capsuleW * 0.5} alpha={crackleB} blendMode="add" />
				<Sprite key="capsuleLightning" anchor={0.5} rotation={Math.PI / 2} width={capsuleH * 0.42} height={capsuleW * 0.56} alpha={arcFlicker} blendMode="add" />
				<Sprite key="capsuleLightning" anchor={0.5} rotation={Math.PI / 2} width={capsuleH * 0.32} height={capsuleW * 0.46} alpha={arcFlicker} />
			</Container>
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
