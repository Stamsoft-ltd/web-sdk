<script lang="ts" module>
	// Module scope so the art preloads during the loading screen (mounts on demand).
	import { ap } from '../lib/preloadArt';

	// Large plaque (bigger-cover) for the bonus intro; the burger sits on its top edge.
	const plaqueArt = ap('/assets/mcschmutzo/congrats-cover-lg.webp');
	const starArt = ap('/assets/mcschmutzo/win/parts/win-star.webp');
	const closeArt = ap('/assets/mcschmutzo/win/x-button.webp');
</script>

<script lang="ts">
	import { stateBet, stateBetDerived } from 'state-shared';
	import { isReplayMode } from '../state/roundFlow.svelte';
	import { waitForResolve } from 'utils-shared/wait';

	import { getContext } from '../game/context';
	import { i18nDerived } from '../i18n/i18nDerived';
	import BurgerStack from './BurgerStack.svelte';
	import CongratsSplashes from './CongratsSplashes.svelte';
	import { continueBottom } from '../lib/continuePos';
	// Prompt position (above the portrait HUD; default elsewhere) — re-measured on resize.
	let contBottom = $state('clamp(14px, 3.5vh, 34px)');
	$effect(() => {
		const upd = () => (contBottom = continueBottom('clamp(14px, 3.5vh, 34px)'));
		const raf = requestAnimationFrame(upd);
		window.addEventListener('resize', upd);
		return () => (cancelAnimationFrame(raf), window.removeEventListener('resize', upd));
	});

	const context = getContext();

	let show = $state(false);
	let totalFreeSpins = $state(0);
	let oncomplete = $state(() => {});

	context.eventEmitter.subscribeOnMount({
		freeSpinIntroShow: () => {
			show = true;
			context.stateGame.freeSpinPopupShowing = true;
		},
		freeSpinIntroHide: () => {
			show = false;
			context.stateGame.freeSpinPopupShowing = false;
		},
		freeSpinIntroUpdate: async (emitterEvent) => {
			totalFreeSpins = emitterEvent.totalFreeSpins;
			awaitingPress = true;
			await waitForResolve((resolve) => (oncomplete = resolve));
			awaitingPress = false;
		},
	});

	// Bonus name keyed off what produced the free spins: a bought Normal / Super bonus, or the natural
	// trigger (3 scatters = Normal Bonus, 4 = Super Bonus — see stateGame.bonusTier).
	const isSuper = $derived(
		stateBet.activeBetModeKey === 'bonus2' ||
			(stateBet.activeBetModeKey !== 'bonus1' && context.stateGame.bonusTier === 'super'),
	);
	const bonusName = $derived(i18nDerived.translate(isSuper ? 'SUPER BONUS TITLE' : 'NORMAL BONUS TITLE'));
	const bonusBlurb = $derived(i18nDerived.translateVars('BONUS BLURB', { count: totalFreeSpins }));

	// DEV preview: press 6 to show the free-spin bonus congrats with mock data.
	import { onMount } from 'svelte';
	onMount(() => {
		if (!import.meta.env.DEV) return;
		const onDev = (e: KeyboardEvent) => {
			if (e.code !== 'Digit6') return;
			stateBet.activeBetModeKey = 'bonus2';
			totalFreeSpins = 10;
			show = true;
			context.stateGame.freeSpinPopupShowing = true;
		};
		window.addEventListener('keydown', onDev);
		return () => window.removeEventListener('keydown', onDev);
	});

	const proceed = () => {
		context.eventEmitter.broadcast({ type: 'soundPressGeneral' });
		oncomplete();
	};

	// Nobody is at the controls during autoplay / held Space, and a replay must play through on its
	// own — waiting for a press there stalls the round (same rule as the bonus wheel).
	const AUTO_ADVANCE_MS = 2500;
	const autoAdvances = $derived(
		isReplayMode() ||
			stateBetDerived.hasAutoBetCounter() ||
			context.stateXstateDerived.isAutoBetting() ||
			stateBet.isSpaceHold,
	);
	let awaitingPress = $state(false);
	$effect(() => {
		if (!show || !awaitingPress || !autoAdvances) return;
		const timer = setTimeout(proceed, AUTO_ADVANCE_MS);
		return () => clearTimeout(timer);
	});
	const onKey = (e: KeyboardEvent) => {
		if (show && (e.code === 'Space' || e.code === 'Enter')) proceed();
	};
</script>

<svelte:window onkeydown={onKey} />

{#if show}
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
	<div class="fs-backdrop" onclick={proceed}>
		<button
			class="fs-close"
			type="button"
			style={`background-image:url('${closeArt}')`}
			onclick={(e) => {
				e.stopPropagation();
				proceed();
			}}
			aria-label={i18nDerived.translate('CLOSE')}
		></button>

		<div class="fs-stage" role="dialog" aria-modal="true">
			<!-- Mustard + ketchup, drawn in code and squeezed out from behind the plaque when the
			     CONGRATS title slams onto it (HIT, 0.64s in — see the title's stamp animation). -->
			<CongratsSplashes hitMs={640} />

			<!-- Burger straddling the plaque's top edge, in front of the rim — the real slice burger so it assembles. -->
			<div class="fs-burger"><BurgerStack assemble /></div>

			<!-- Flanking stars (top-right + bottom-left) that twinkle, like the win pad. -->
			<img class="fs-star fs-star--tr" src={starArt} alt="" draggable="false" />
			<img class="fs-star fs-star--bl" src={starArt} alt="" draggable="false" />


			<div class="fs-plaque" style={`background-image:url('${plaqueArt}')`}>
				<div class="fs-content">
					<p class="fs-congrats">{i18nDerived.translate('CONGRATS')}</p>
					<p class="fs-youwon">{i18nDerived.translate('YOU WON')}</p>
					<p class="fs-bonus">{bonusName}</p>
					<p class="fs-blurb">{bonusBlurb}</p>
					<div class="fs-count"><span>{totalFreeSpins}</span></div>
					<p class="fs-label">{i18nDerived.translate('FREE SPINS')}</p>
				</div>
			</div>
		</div>

		<p class="fs-continue" style={`bottom:${contBottom}`}>{i18nDerived.translate('PRESS TO CONTINUE')}&nbsp;→</p>
	</div>
{/if}

<style>
	.fs-backdrop {
		position: fixed;
		inset: 0;
		z-index: 55;
		display: grid;
		place-items: center;
		background: rgba(0, 0, 0, 0.6);
		cursor: pointer;
		user-select: none;
	}

	.fs-close {
		position: fixed;
		top: 20px;
		right: 20px;
		z-index: 57;
		width: clamp(42px, 6.5vmin, 52px);
		aspect-ratio: 1;
		padding: 0;
		border: none;
		background: transparent center / contain no-repeat;
		cursor: pointer;
		transition:
			filter 0.12s ease,
			transform 0.08s ease;
	}
	.fs-close:hover {
		filter: brightness(1.2);
	}
	.fs-close:active {
		transform: scale(0.94);
	}

	.fs-stage {
		position: relative;
		/* Height-capped too (86dvh of WIDTH ≈ 62% of the screen height for the plaque): the burger sits
		   25% of the plaque above it and the splashes overhang, so on short landscape screens a
		   width-only cap pushed the burger + top sauces off the top. */
		width: min(600px, 90vw, 86dvh);
		container-type: inline-size;
		aspect-ratio: 1366 / 989;
		font-family: 'Nunito', sans-serif;
	}


	.fs-plaque {
		position: absolute;
		inset: 0;
		z-index: 1;
		background-size: 100% 100%;
		background-repeat: no-repeat;
		background-position: center;
		display: grid;
		place-items: center;
		/* The win (plaque + copy) pops in first. */
		animation:
			fs-pop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both,
			fs-hit 0.52s linear 0.64s;
	}

	/* Burger peeks over the top edge of the plaque from BEHIND it. It's the real slice-built burger
	   (BurgerStack) so it assembles / disassembles like the reels; a contained --sep keeps the burst
	   from spreading too far above the plaque. Pops in once, then the slices loop. */
	.fs-burger {
		position: absolute;
		left: 50%;
		/* Straddles the plaque's top edge, IN FRONT of the rim: the bottom bun sits on the red field just
		   under the rim, the top bun stands up over it (clear of the CONGRATS title below). */
		top: -9%;
		transform: translateX(-50%);
		width: 20%;
		aspect-ratio: 1.077;
		z-index: 2;
		pointer-events: none;
		--sep: 0.5;
		animation: fs-burger-pop 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) both;
	}

	/* Twinkling stars, tucked INSIDE the red field corners (top-right + bottom-left), like the win pad. */
	.fs-star {
		position: absolute;
		width: 10%;
		height: auto;
		z-index: 2;
		pointer-events: none;
		filter: drop-shadow(0 2px 5px rgba(0, 0, 0, 0.35));
		animation:
			fs-star-in 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.35s both,
			fs-star-twinkle 1.5s ease-in-out 0.9s infinite;
	}
	.fs-star--tr {
		top: 13%;
		right: 11%;
	}
	.fs-star--bl {
		bottom: 13%;
		left: 11%;
		/* Offset so the two don't twinkle in lock-step. */
		animation-delay: 0.45s, 1.65s;
	}
	@keyframes fs-star-in {
		0% { opacity: 0; transform: scale(0) rotate(-45deg); }
		70% { opacity: 1; transform: scale(1.18) rotate(9deg); }
		100% { opacity: 1; transform: scale(1) rotate(0deg); }
	}
	@keyframes fs-star-twinkle {
		0%, 100% {
			transform: scale(1) rotate(-5deg);
			filter: drop-shadow(0 2px 5px rgba(0, 0, 0, 0.35)) brightness(1);
		}
		50% {
			transform: scale(1.14) rotate(5deg);
			filter: drop-shadow(0 0 9px rgba(255, 226, 120, 0.95)) brightness(1.28);
		}
	}

	/* Copy sits within the red field of the plaque. */
	.fs-content {
		position: relative;
		z-index: 3;
		width: 62%;
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		color: #ffffff;
		gap: min(clamp(3px, 0.9vmin, 8px), 1.3cqw);
	}

	.fs-congrats {
		margin: 0;
		font-family: 'Bowlby One SC', sans-serif;
		font-weight: 400;
		font-size: min(clamp(1.4rem, 5.6vmin, 2.5rem), 6.67cqw);
		line-height: 1;
		letter-spacing: 0.02em;
		text-transform: uppercase;
		text-shadow: 0 2px 5px rgba(90, 10, 5, 0.6);
		/* STAMPED onto the plaque: drops from 1.7× and slams down at 0.64s (the HIT that squashes the
		   plaque and squeezes the sauce out — CongratsSplashes), squashes flat, springs back, then
		   breathes. */
		animation:
			fs-stamp 0.85s linear 0.33s both,
			fs-breathe 2.3s ease-in-out 1.3s infinite;
	}
	.fs-youwon {
		margin: 0;
		font-family: 'Nunito', sans-serif;
		font-weight: 700;
		font-size: min(clamp(0.62rem, 1.9vmin, 0.9rem), 2.4cqw);
		letter-spacing: 0.16em;
	}
	.fs-bonus {
		margin: 0;
		font-family: 'Nunito', sans-serif;
		font-weight: 700;
		font-size: min(clamp(0.95rem, 3vmin, 1.35rem), 3.6cqw);
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}
	.fs-blurb {
		margin: min(clamp(2px, 0.8vmin, 8px), 1.3cqw) 0 0;
		font-family: 'Nunito', sans-serif;
		font-weight: 500;
		font-size: min(clamp(0.62rem, 1.9vmin, 0.88rem), 2.35cqw);
		line-height: 1.35;
		color: #ffe9d9;
		max-width: 32ch;
	}

	/* Amount box per spec. */
	.fs-count {
		margin: min(clamp(6px, 1.6vmin, 14px), 2.3cqw) 0 min(clamp(2px, 0.8vmin, 6px), 1cqw);
		display: grid;
		place-items: center;
		min-width: min(clamp(74px, 14vmin, 108px), 18cqw);
		padding: min(clamp(6px, 1.4vmin, 12px), 2cqw) min(clamp(16px, 3vmin, 26px), 4.3cqw);
		border-radius: 12px;
		background: #292624;
		border: 1px solid #ffffff;
		box-shadow: 0px 0px 17px 0px #e8b574;
	}
	.fs-count span {
		font-family: 'Bowlby One SC', sans-serif;
		font-weight: 400;
		font-size: min(clamp(1.5rem, 4.6vmin, 2.2rem), 5.9cqw);
		line-height: 1;
		color: #ffffff;
	}
	.fs-label {
		margin: 0;
		font-family: 'Nunito', sans-serif;
		font-weight: 700;
		font-size: min(clamp(0.9rem, 2.8vmin, 1.25rem), 3.33cqw);
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.fs-continue {
		position: fixed;
		left: 50%;
		bottom: clamp(14px, 3.5vh, 34px);
		transform: translateX(-50%);
		z-index: 56;
		margin: 0;
		white-space: nowrap;
		font-family: 'Nunito', sans-serif;
		font-weight: 600;
		font-size: clamp(12px, 2.2vmin, 17px);
		letter-spacing: 0.1em;
		color: #fff;
		text-transform: uppercase;
		text-shadow: 0 2px 5px rgba(0, 0, 0, 0.6);
		animation: fs-blink 1.6s ease-in-out infinite;
	}
	@keyframes fs-blink {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.5;
		}
	}

	/* Win (plaque + copy) pops in first. */
	@keyframes fs-pop {
		0% { opacity: 0; transform: scale(0.72); }
		60% { opacity: 1; transform: scale(1.03); }
		100% { opacity: 1; transform: scale(1); }
	}
	/* Burger keeps its translateX(-50%) centring while it pops. */
	@keyframes fs-burger-pop {
		0% { opacity: 0; transform: translateX(-50%) scale(0.55); }
		60% { opacity: 1; transform: translateX(-50%) scale(1.06); }
		100% { opacity: 1; transform: translateX(-50%) scale(1); }
	}
	/* Stamp: hit at 36% (0.64s after the screen opens), squash wide + flat, spring back. */
	@keyframes fs-stamp {
		0% { opacity: 0; transform: scale(1.7); animation-timing-function: cubic-bezier(0.55, 0, 1, 0.45); }
		12% { opacity: 1; }
		36% { transform: scale(1); }
		46% { transform: scale(1.16, 0.8); }
		60% { transform: scale(0.94, 1.07); }
		74% { transform: scale(1.03, 0.98); }
		88% { transform: scale(0.995, 1.005); }
		100% { opacity: 1; transform: scale(1); }
	}
	/* The plaque takes the title's impact: a quick squash and a damped wobble. */
	@keyframes fs-hit {
		0% { transform: scale(1); }
		18% { transform: scale(1.035, 0.95); }
		42% { transform: scale(0.988, 1.018); }
		68% { transform: scale(1.006, 0.996); }
		100% { transform: scale(1); }
	}
	@keyframes fs-breathe {
		0%, 100% { transform: scale(1); }
		50% { transform: scale(1.04); }
	}
	@media (prefers-reduced-motion: reduce) {
		.fs-plaque, .fs-burger, .fs-congrats, .fs-star { animation: none; }
	}

	/* Tiny popouts (~400x225): shrink the close (X) so it doesn't dominate the small screen. */
	@media (max-height: 300px) {
		.fs-close { width: clamp(20px, 9dvh, 30px); top: 6px; right: 6px; }
	}
</style>
