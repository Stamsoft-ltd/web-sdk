<script lang="ts" module>
	import type { WinLevelData } from '../game/winLevelMap';

	export type EmitterEventWin =
		| { type: 'winShow' }
		| { type: 'winHide' }
		| { type: 'winUpdate'; amount: number; winLevelData: WinLevelData };
</script>

<script lang="ts">
	import { Container } from 'pixi-svelte';
	import { FadeContainer, WinCountUpProvider } from 'components-pixi';
	import { waitForResolve } from 'utils-shared/wait';
	import { CanvasSizeRectangle, MainContainer } from 'components-layout';
	import { OnMount } from 'components-shared';

	import WinCoins from './WinCoins.svelte';
	import WinBoard from './WinBoard.svelte';
	import WinAmountPlaque from './WinAmountPlaque.svelte';
	import PressToContinue from './PressToContinue.svelte';
	import { getContext } from '../game/context';
	import { stateBet } from 'state-shared';

	const context = getContext();

	// How long a tiered win board lingers after its amount has finished counting up before it
	// closes itself. The board used to wait for a press indefinitely, which stalled an unattended
	// autoplay run on every big win. Armed only once the counting has SETTLED, so the final number
	// is always fully readable first; a press still dismisses immediately.
	//
	// 5000 -> 8500 (user round 2026-08-11, "make the win animations 3-4 seconds longer"). The extra
	// time deliberately goes HERE and not into presentDuration: the roll-up is the part the player
	// is waiting on to read the amount, while this dwell is the part they are watching the sign,
	// its neon tubes and the coins. Lengthening the roll-up instead would make the number take
	// longer to arrive without adding a single frame of celebration.
	const AUTO_DISMISS_MS = 8500;

	// Turbo COMPRESSES the big-win presentation rather than skipping it — the board is the payoff
	// moment, so it still plays, just at the pace turbo implies. Both halves scale by the same
	// factor so the rhythm holds: the roll-up (presentDuration) and the dwell before auto-dismiss.
	// A legendary win goes 5.5s + 8.5s = 14s -> 7s on turbo -> 4.2s on super turbo.
	const turboSpeed = $derived(stateBet.isSuperTurbo ? 0.3 : stateBet.isTurbo ? 0.5 : 1);

	// Ordinary-win plaque width as a fraction of the visible board width. Wide enough to carry a
	// seven-figure amount at full size, narrow enough that the winning cluster stays readable
	// around it — the old bare number spanned the whole board.
	const PLAQUE_BOARD_FILL = 0.52;

	let show = $state(false);
	let amount = $state(0);
	let winLevelData = $state<WinLevelData>();
	let oncomplete = $state(() => {});
	let boardClickHandled = false;
	let dismissTimer = 0;
	let isCountingUp = $state(false);
	let shakeX = $state(0);
	let shakeY = $state(0);

	const boardLayout = $derived(context.stateGameDerived.boardLayout());
	const mainLayout = $derived(context.stateLayoutDerived.mainLayout());

	const clearDismissTimer = () => {
		if (!dismissTimer) return;
		clearTimeout(dismissTimer);
		dismissTimer = 0;
	};

	// Single dismissal path for both the auto-dismiss timer and press-to-continue, so whichever
	// fires first wins and the other is a no-op (`boardClickHandled` is reset per win).
	const dismiss = () => {
		clearDismissTimer();
		if (boardClickHandled) return;
		boardClickHandled = true;
		oncomplete();
	};

	const scheduleAutoDismiss = () => {
		clearDismissTimer();
		dismissTimer = setTimeout(dismiss, AUTO_DISMISS_MS * turboSpeed) as unknown as number;
	};

	context.eventEmitter.subscribeOnMount({
		winShow: () => (show = true),
		winHide: () => {
			show = false;
			clearDismissTimer();
		},
		winUpdate: async (emitterEvent) => {
			clearDismissTimer();
			boardClickHandled = false;
			amount = emitterEvent.amount;
			winLevelData = emitterEvent.winLevelData;
			isCountingUp = true;
			await waitForResolve((resolve) => (oncomplete = resolve));
			isCountingUp = false;
		},
	});

	// A pending timer would otherwise resolve a stale `oncomplete` after teardown.
	$effect(() => clearDismissTimer);

	// Continuous board shake — the popup never sits still: a low rumble the whole time it's up
	// plus a sharp "electric jolt" every ~1.35s in a pseudo-random direction. Stronger while the
	// amount is counting up, calmer (but still alive) once the count settles.
	$effect(() => {
		if (!show || !winLevelData?.animation) {
			shakeX = 0;
			shakeY = 0;
			return;
		}

		const alias = winLevelData.alias;
		const amp =
			alias === 'max'
				? 14
				: alias === 'epic'
					? 10
					: alias === 'mega'
						? 7
						: alias === 'superwin'
							? 5
							: 3;

		let raf = 0;
		const tick = (now: number) => {
			raf = requestAnimationFrame(tick);
			const t = now / 1000;
			const boost = isCountingUp ? 1 : 0.55;
			// low continuous rumble (two incommensurate sines per axis)
			const rumbleX = (Math.sin(t * 12.9) * 0.5 + Math.sin(t * 7.1) * 0.35) * amp * 0.35;
			const rumbleY = (Math.cos(t * 11.3) * 0.5 + Math.sin(t * 5.7) * 0.35) * amp * 0.2;
			// periodic jolt: fast-decay impulse with a hashed direction per burst
			const period = 1.35;
			const jt = t % period;
			const seed = Math.floor(t / period);
			const h1 = Math.sin(seed * 127.1) * 43758.5453;
			const h2 = Math.sin(seed * 311.7) * 26951.3151;
			const dirX = (h1 - Math.floor(h1)) * 2 - 1;
			const dirY = (h2 - Math.floor(h2)) * 2 - 1;
			const jolt = Math.exp(-jt * 5.5) * Math.sin(jt * 55) * amp;
			shakeX = (rumbleX + jolt * dirX) * boost;
			shakeY = (rumbleY + jolt * dirY * 0.6) * boost;
		};
		raf = requestAnimationFrame(tick);
		return () => {
			cancelAnimationFrame(raf);
			shakeX = 0;
			shakeY = 0;
		};
	});
</script>

<FadeContainer {show}>
	{#if winLevelData}
		{@const isBigWin = winLevelData.type === 'big'}
		{@const hasBoardAnimation = !!winLevelData?.animation}
		<!-- Line wins (no board) collapse to a near-instant 400ms on turbo as before; board wins
		     scale by turboSpeed, which is 1 when turbo is off — so the normal pace is unchanged. -->
		{@const duration =
			(stateBet.isTurbo || stateBet.isSuperTurbo) && !hasBoardAnimation
				? Math.min(winLevelData.presentDuration, 400)
				: winLevelData.presentDuration * turboSpeed}
		{#key oncomplete}
			<WinCountUpProvider
				{amount}
				{duration}
				oncomplete={() => {
					context.eventEmitter.broadcast({ type: 'soundStop', name: 'sfx_win_countup_loop' });
					// Fires when the roll-up finishes naturally AND when a press snaps it to the
					// final value — either way the counting is over, so the dwell starts here.
					if (hasBoardAnimation) scheduleAutoDismiss();
					else oncomplete();
				}}
			>
				{#snippet children({ countUpAmount, startCountUp, finishCountUp, countUpCompleted })}
					{#if isBigWin}
						<!-- 0.5 -> 0.82: the Version2 win screens are near-black behind the sign (measured off the
						     design renders); at 0.5 the lit workshop read through the dim and competed with the sign. -->
						<CanvasSizeRectangle backgroundColor={0x000000} backgroundAlpha={0.82} />
					{/if}

					<OnMount onmount={() => startCountUp()} />

					<!-- Coins BEHIND the win popup (template order = z-order) -->
					<WinCoins emit={true} levelAlias={winLevelData?.alias} boardMode={hasBoardAnimation} />

					<MainContainer>
						<Container x={boardLayout.x + shakeX} y={boardLayout.y + shakeY}>
							{#if hasBoardAnimation}
								{@const screenW =
									context.stateLayoutDerived.canvasSizes().width / (mainLayout.scale || 1)}
								{@const screenH =
									context.stateLayoutDerived.canvasSizes().height / (mainLayout.scale || 1)}
								<!-- One board for the whole presentation, chosen from the SETTLED total
								     (`amount`), while the text counts up (`countUpAmount`). -->
								<WinBoard
									amount={countUpAmount}
									tierAmount={amount}
									{screenW}
									{screenH}
									maxOffX={mainLayout.width * 0.5 - boardLayout.x}
									maxOffY={mainLayout.height * 0.5 - boardLayout.y}
								/>
							{:else}
								<!-- Ordinary win (no big-win board): the shared amount plaque, sized off the
								     board so it stays legible from a phone to a desktop without ever
								     covering more than a couple of symbol rows. -->
								<!-- Round only the IN-FLIGHT tween value. countUpAmount is a raw tween over BOOK
								     units, and a fractional book amount formats as a jittering 7-digit
								     string ("$12.4958") on the way up. Once it lands, show the settled
								     amount exactly — rounding a settled book amount truncates the win
								     (book 16.4 must read $0.00164, not $0.0016). -->
								<WinAmountPlaque
									amount={Math.abs(countUpAmount - amount) < 0.5
										? amount
										: Math.round(countUpAmount)}
									width={boardLayout.width * boardLayout.boardScale * PLAQUE_BOARD_FILL}
								/>
							{/if}
						</Container>
					</MainContainer>

					<PressToContinue
						onpress={() => {
							if (!countUpCompleted) finishCountUp();
							else dismiss();
						}}
					/>
				{/snippet}
			</WinCountUpProvider>
		{/key}
	{/if}
</FadeContainer>
