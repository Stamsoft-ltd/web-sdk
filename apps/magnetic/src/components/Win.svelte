<script lang="ts" module>
	import type { WinLevelData } from '../game/winLevelMap';

	export type EmitterEventWin =
		| { type: 'winShow' }
		| { type: 'winHide' }
		| { type: 'winUpdate'; amount: number; winLevelData: WinLevelData };
</script>

<script lang="ts">
	import { Container, Graphics, Text, type Sizes } from 'pixi-svelte';
	import { FadeContainer, WinCountUpProvider } from 'components-pixi';
	import { waitForResolve } from 'utils-shared/wait';
	import { bookEventAmountToCurrencyString } from 'utils-shared/amount';
	import { CanvasSizeRectangle, MainContainer } from 'components-layout';
	import { OnMount } from 'components-shared';

	import WinCoins from './WinCoins.svelte';
	import PressToContinue from './PressToContinue.svelte';
	import { Sprite } from 'pixi-svelte';
	import { SYMBOL_SIZE } from '../game/constants';
	import { getContext } from '../game/context';
	import { winBoardByAlias } from '../game/utils';
	import { WIN_GRADIENT } from '../game/goldGradient';
	import { stateBet } from 'state-shared';

	const context = getContext();

	let show = $state(false);
	let amount = $state(0);
	let winLevelData = $state<WinLevelData>();
	let oncomplete = $state(() => {});
	let boardClickHandled = false;
	let isCountingUp = $state(false);
	let shakeX = $state(0);
	let shakeY = $state(0);
	// Board "breathing" (expand / retract) + electric flicker for the win-tier screen. Driven by one
	// rAF loop while the board is shown, mirroring the desktop CapsulePanel's animated lightning.
	let pulse = $state(1);
	let boltA = $state(0.7);
	let boltB = $state(0.4);
	let webRot = $state(0);
	// Measured text sizes for scale-to-fit (board plaque / full-screen win).
	let boardSizes = $state<Sizes>({ width: 0, height: 0 });
	let winSizes = $state<Sizes>({ width: 0, height: 0 });

	const boardLayout = $derived(context.stateGameDerived.boardLayout());
	const mainLayout = $derived(context.stateLayoutDerived.mainLayout());

	context.eventEmitter.subscribeOnMount({
		winShow: () => (show = true),
		winHide: () => (show = false),
		winUpdate: async (emitterEvent) => {
			boardClickHandled = false;
			amount = emitterEvent.amount;
			winLevelData = emitterEvent.winLevelData;
			isCountingUp = true;
			await waitForResolve((resolve) => (oncomplete = resolve));
			isCountingUp = false;
		},
	});

	$effect(() => {
		if (!isCountingUp || !winLevelData?.animation) {
			shakeX = 0;
			shakeY = 0;
			return;
		}

		const alias = winLevelData.alias;
		const amp = alias === 'max' ? 14 : alias === 'epic' ? 10 : alias === 'mega' ? 7 : alias === 'superwin' ? 5 : 3;
		const duration = winLevelData.presentDuration;

		let raf = 0;
		let startTime = 0;

		const tick = (t: number) => {
			if (!startTime) startTime = t;
			const elapsed = t - startTime;
			const progress = Math.min(elapsed / duration, 1);
			const decay = 1 - progress * progress;
			const angle = elapsed * 0.016; // ~15Hz shake
			shakeX = Math.round(Math.sin(angle) * amp * decay);
			shakeY = Math.round(Math.cos(angle * 0.73) * amp * 0.45 * decay);
			if (progress < 1) raf = requestAnimationFrame(tick);
		};
		raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
	});

	// Breathing pulse + lightning flicker, active for the whole time a board win is on screen.
	$effect(() => {
		if (!show || !winLevelData?.animation) {
			pulse = 1;
			boltA = 0.7;
			boltB = 0.4;
			return;
		}
		let raf = 0;
		const t0 = performance.now();
		// Random SURGES: every so often the electricity slams to full brightness and the board swells.
		let nextSurge = t0 + 700 + Math.random() * 1200;
		let surgeStart = -1;
		const tick = (now: number) => {
			const t = (now - t0) / 1000;
			if (surgeStart < 0 && now >= nextSurge) surgeStart = now;
			let surge = 0;
			if (surgeStart >= 0) {
				const st = (now - surgeStart) / 1000;
				surge = Math.max(0, (0.6 + 0.4 * Math.sin(st * 70)) * Math.exp(-st / 0.12));
				if (st > 0.4) {
					surgeStart = -1;
					nextSurge = now + 800 + Math.random() * 1800;
				}
			}
			// Slow breathing expand/retract, with an extra swell on each surge.
			pulse = 1 + 0.055 * Math.sin(t * 3.4) + surge * 0.06;
			// Layered sines = cheap organic flicker; deeper swing + surge on top (mirrors CapsulePanel).
			boltA = Math.min(1, 0.6 + 0.34 * Math.sin(t * 18) * Math.sin(t * 5.7) + 0.18 * Math.sin(t * 44) + surge * 0.6);
			boltB = Math.min(1, 0.45 + 0.5 * (0.5 + 0.5 * Math.sin(t * 12.6 + 1.7)) + surge * 0.7);
			webRot = t * 0.35;
			raf = requestAnimationFrame(tick);
		};
		raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
	});
</script>

<FadeContainer {show}>
	{#if winLevelData}
		{@const isBigWin = winLevelData.type === 'big'}
		{@const hasBoardAnimation = !!winLevelData?.animation}
		{@const duration = (stateBet.isTurbo || stateBet.isSuperTurbo) && !hasBoardAnimation ? Math.min(winLevelData.presentDuration, 400) : winLevelData.presentDuration}
		{#key oncomplete}
		<WinCountUpProvider {amount} {duration} oncomplete={() => { context.eventEmitter.broadcast({ type: 'soundStop', name: 'sfx_bigwin_coinloop' }); if (!hasBoardAnimation) oncomplete(); }}>
			{#snippet children({ countUpAmount, startCountUp, finishCountUp, countUpCompleted })}
				{#if isBigWin}
					<CanvasSizeRectangle backgroundColor={0x000000} backgroundAlpha={0.5} />
				{/if}

				<OnMount onmount={() => startCountUp()} />

					<!-- Coins spawn BEHIND the win card (rendered before the board container). -->
					<WinCoins emit={true} levelAlias={winLevelData?.alias} boardMode={hasBoardAnimation} />

				<MainContainer>
					<Container
						x={boardLayout.x + shakeX}
						y={boardLayout.y + shakeY}
					>
						{#if hasBoardAnimation}
							{@const bs = boardLayout.boardScale}
							{@const mult = stateBet.betAmount > 0 ? countUpAmount / stateBet.betAmount : 0}
							<!-- MAX WIN board is reserved for the 20000x win cap; LEGENDARY covers 250x up to the cap. -->
							{@const boardKey = mult >= 20000 ? 'maxWinBoard' : mult >= 250 ? winBoardByAlias.epic : mult >= 100 ? winBoardByAlias.mega : mult >= 50 ? winBoardByAlias.superwin : winBoardByAlias.big}
							{@const boardSize = Math.min(boardLayout.width * bs * 0.55, boardLayout.height * bs * 0.85)}
							<!-- The MAX WIN art is wide (1535×1025), not square; its amount plaque sits lower/narrower. -->
							{@const isMaxBoard = boardKey === 'maxWinBoard'}
							{@const boardW = isMaxBoard ? boardSize * 1.35 : boardSize}
							{@const boardH = isMaxBoard ? boardW * (1025 / 1535) : boardSize}
							<!-- Tier tint, used for the ambient glow AND the electric arcs. -->
							{@const glowColor =
								boardKey === 'sweetWinBoard' ? 0x2fb4ff
								: boardKey === 'wildWinBoard' ? 0x46e04b
								: boardKey === 'epicWinBoard' ? 0xff4032
								: boardKey === 'mythicWinBoard' ? 0xa64dff
								: 0xffb428 /* legendary + max win: gold */}
							{@const amtY = isMaxBoard ? boardH * 0.31 : boardSize * 0.37}
							<!-- Win amount — Cinzel 900 gold gradient with a black outline; scales to fit the tube -->
							{@const boardFont = SYMBOL_SIZE * bs * 0.295}
							{@const tubeW = isMaxBoard ? boardW * 0.48 : boardSize * 0.78}
							{@const tubeH = tubeW * (551 / 1536)}
							{@const boardMaxW = tubeW * 0.82}
							{@const boardScale = boardSizes.width > boardMaxW ? boardMaxW / boardSizes.width : 1}
							<!-- Everything breathes: a slow expand / retract driven by the rAF `pulse`. -->
							<Container scale={pulse}>
								<!-- Electric aura BEHIND the board: two counter-rotating crackle webs, tier-tinted
								     and flickering, so lightning crawls around the board's edges. Additive = light. -->
								<Sprite key="capsuleCrackle" anchor={0.5} rotation={webRot} width={boardW * 1.22} height={boardW * 1.22} tint={glowColor} alpha={boltA * 0.6} blendMode="add" />
								<Sprite key="capsuleCrackle" anchor={0.5} rotation={-webRot * 0.8} width={boardW * 1.06} height={boardW * 1.06} tint={glowColor} alpha={boltB * 0.5} blendMode="add" />

								<!-- Soft ambient glow behind the board (additive concentric circles = cheap radial glow). -->
								<Graphics
									blendMode="add"
									draw={(g) => {
										g.clear();
										const R = boardW * 0.78;
										const steps = 14;
										for (let i = steps; i >= 1; i--) {
											const t = i / steps;
											g.beginFill(glowColor, 0.05 * (1 - t) * (1 - t) + 0.004);
											g.drawCircle(0, 0, R * t);
											g.endFill();
										}
									}}
								/>
								{#if boardKey}
									<Sprite
										key={boardKey}
										anchor={0.5}
										width={boardW}
										height={boardH}
									/>
								{/if}

								<!-- Win amount in the capsule tube, wrapped in live electricity.
								     Order: arcs AROUND the tube (unmasked, spill past the border) -> a charged
								     glow -> the tube -> a bright bolt + crackle INSIDE the glass (masked) ->
								     the number on top. -->
								<Container y={amtY}>
									<!-- Electric arcs crawling around the tube's border (spill just beyond its edges). -->
									<Sprite key="capsuleLightning" anchor={0.5} rotation={0.09} width={tubeW * 1.22} height={tubeH * 1.32} tint={glowColor} alpha={boltA * 0.9} blendMode="add" />
									<Sprite key="capsuleLightning" anchor={0.5} rotation={-0.09} width={tubeW * 1.14} height={tubeH * 1.15} tint={0xffffff} alpha={boltB * 0.7} blendMode="add" />
									<Sprite key="capsuleCrackle" anchor={0.5} rotation={webRot} width={tubeW * 1.28} height={tubeH * 1.28} tint={glowColor} alpha={boltB * 0.85} blendMode="add" />
									<!-- Charged glow pulsing behind the tube. -->
									<Graphics
										blendMode="add"
										draw={(g) => {
											g.clear();
											const steps = 10;
											for (let s = steps; s >= 1; s--) {
												const t = s / steps;
												g.beginFill(glowColor, 0.05 * (1 - t) + 0.01);
												g.drawEllipse(0, 0, tubeW * 0.62 * t, tubeH * 0.85 * t);
												g.endFill();
											}
										}}
									/>

									<Sprite key="winTube" anchor={0.5} width={tubeW} height={tubeH} />

									<!-- Bright bolt + crackle arcing INSIDE the glass (masked to the clear interior). -->
									<Container>
										<Graphics
											isMask
											draw={(g) => {
												g.clear();
												g.beginFill(0xffffff);
												g.rect(-tubeW * 0.3, -tubeH * 0.31, tubeW * 0.6, tubeH * 0.62);
												g.endFill();
											}}
										/>
										<Sprite key="capsuleCrackle" anchor={0.5} rotation={-webRot * 0.7} width={tubeW * 0.6} height={tubeH * 0.6} tint={glowColor} alpha={Math.min(1, boltB + 0.3)} blendMode="add" />
										<Sprite key="capsuleLightning" anchor={0.5} width={tubeW * 0.56} height={tubeH * 0.58} tint={0xffffff} alpha={boltA} blendMode="add" />
										<Sprite key="capsuleLightning" anchor={0.5} rotation={0.05} width={tubeW * 0.5} height={tubeH * 0.54} tint={glowColor} alpha={Math.min(1, boltA + 0.25)} blendMode="add" />
									</Container>

									<Container scale={boardScale}>
										<Text
											anchor={0.5}
											onresize={(s) => (boardSizes = s)}
											text={bookEventAmountToCurrencyString(countUpAmount)}
											style={{
												fontFamily: 'Cinzel',
												fontWeight: '900',
												fontSize: boardFont,
												fill: WIN_GRADIENT,
												align: 'center',
												letterSpacing: boardFont * 0.03,
												stroke: { color: 0x000000, width: Math.max(2, Math.round(boardFont * 0.04)) },
											}}
										/>
									</Container>
								</Container>
							</Container>
						{:else}
							{@const winMaxW = context.stateLayoutDerived.canvasSizes().width / context.stateLayoutDerived.mainLayout().scale}
							{@const winScale = winSizes.width > winMaxW ? winMaxW / winSizes.width : 1}
							<!-- Line-win amount (no board animation) — white, per design feedback -->
							<Container scale={winScale}>
								<Text
									anchor={0.5}
									onresize={(s) => (winSizes = s)}
									text={bookEventAmountToCurrencyString(countUpAmount)}
									style={{
										fontFamily: 'Cinzel',
										fontWeight: '900',
										fontSize: SYMBOL_SIZE,
										fill: 0xffffff,
										align: 'center',
										letterSpacing: SYMBOL_SIZE * 0.03,
										stroke: { color: 0x000000, width: Math.max(2, Math.round(SYMBOL_SIZE * 0.04)) },
									}}
								/>
							</Container>
						{/if}
					</Container>
				</MainContainer>


				{#if hasBoardAnimation}
					<PressToContinue onpress={() => {
						if (!countUpCompleted) {
							finishCountUp();
						} else {
							if (boardClickHandled) return;
							boardClickHandled = true;
							oncomplete();
						}
					}} />
				{/if}
			{/snippet}
		</WinCountUpProvider>
		{/key}
	{/if}
</FadeContainer>
