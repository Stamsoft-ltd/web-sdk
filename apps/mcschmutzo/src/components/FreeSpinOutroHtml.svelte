<script lang="ts" module>
	import type { WinLevelData } from '../game/winLevelMap';

	export type EmitterEventFreeSpinOutro =
		| { type: 'freeSpinOutroShow' }
		| { type: 'freeSpinOutroHide' }
		| { type: 'freeSpinOutroCountUp'; amount: number; winLevelData: WinLevelData };

	// Module scope so the art preloads during the loading screen (mounts on demand).
	import { ap } from '../lib/preloadArt';

	// Small plaque (congrats-cover) for the total-win outro; burger sits on its top edge.
	const plaqueArt = ap('/assets/mcschmutzo/congrats-cover-sm.webp');
	const closeArt = ap('/assets/mcschmutzo/win/x-button.webp');
</script>

<script lang="ts">
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicIn, cubicOut } from 'svelte/easing';
	import { waitForResolve } from 'utils-shared/wait';
	import { stateBet, stateBetDerived } from 'state-shared';
	import { isReplayMode } from '../state/roundFlow.svelte';
	import { bookEventAmountToCurrencyString } from 'utils-shared/amount';

	import { getContext } from '../game/context';
	import { i18nDerived } from '../i18n/i18nDerived';
	import BurgerStack from './BurgerStack.svelte';
	import CongratsSplashes from './CongratsSplashes.svelte';
	import { continueBottom } from '../lib/continuePos';
	import { popOut } from '../lib/popOut';
	import { fade } from 'svelte/transition';
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
	let oncomplete = $state(() => {});
	// Count the total win up from 0 (mirrors the previous animated outro).
	const amountTween = new Tween(0, { duration: 900, easing: cubicOut });
	const amountText = $derived(bookEventAmountToCurrencyString(Math.round(amountTween.current)));
	// The HUD WIN readout follows this count-up while freeSpinEnd owns it (stateGame.winCountUp).
	$effect(() => {
		const amount = amountTween.current;
		untrack(() => {
			if (show && context.stateGame.winCountUp !== null) context.stateGame.winCountUp = amount;
		});
	});

	context.eventEmitter.subscribeOnMount({
		freeSpinOutroShow: () => {
			show = true;
			context.stateGame.freeSpinPopupShowing = true;
		},
		freeSpinOutroHide: () => {
			show = false;
			context.stateGame.freeSpinPopupShowing = false;
			amountTween.set(0, { duration: 0 });
		},
		freeSpinOutroCountUp: async (emitterEvent) => {
			amountTween.set(emitterEvent.amount);
			awaitingPress = true;
			await waitForResolve((resolve) => (oncomplete = resolve));
			awaitingPress = false;
		},
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

	// DEV preview: press 7 to show the total-win congrats with a mock amount.
	import { onMount } from 'svelte';
	onMount(() => {
		if (!import.meta.env.DEV) return;
		const onDev = (e: KeyboardEvent) => {
			if (e.code !== 'Digit7') return;
			show = true;
			context.stateGame.freeSpinPopupShowing = true;
			amountTween.set(0, { duration: 0 });
			amountTween.set(154300);
		};
		window.addEventListener('keydown', onDev);
		return () => window.removeEventListener('keydown', onDev);
	});
</script>

<svelte:window onkeydown={onKey} />

{#if show}
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
	<div class="fo-backdrop" onclick={proceed} out:fade={{ duration: 260, easing: cubicIn }}>
		<button
			class="fo-close"
			type="button"
			style={`background-image:url('${closeArt}')`}
			onclick={(e) => {
				e.stopPropagation();
				proceed();
			}}
			aria-label={i18nDerived.translate('CLOSE')}
		></button>

		<div class="fo-stage" role="dialog" aria-modal="true" out:popOut>
			<!-- Mustard + ketchup, drawn in code and squeezed out from behind the plaque when the
			     CONGRATS title slams onto it (HIT, 0.64s in — see the title's stamp animation). -->
			<CongratsSplashes hitMs={640} />

			<!-- Burger straddling the plaque's top edge, in front of the rim — the real slice burger so it assembles. -->
			<div class="fo-burger"><BurgerStack assemble /></div>


			<div class="fo-plaque" style={`background-image:url('${plaqueArt}')`}>
				<div class="fo-content">
					<p class="fo-congrats">{i18nDerived.translate('CONGRATS')}</p>
					<p class="fo-youwon">{i18nDerived.translate('YOU WON')}</p>
					<div class="fo-amount"><span>{amountText}</span></div>
				</div>
			</div>
		</div>

		<p class="fo-continue" style={`bottom:${contBottom}`}>{i18nDerived.translate('PRESS TO CONTINUE')}&nbsp;→</p>
	</div>
{/if}

<style>
	.fo-backdrop {
		position: fixed;
		inset: 0;
		z-index: 55;
		display: grid;
		place-items: center;
		background: rgba(0, 0, 0, 0.6);
		cursor: pointer;
		user-select: none;
	}

	.fo-close {
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
	.fo-close:hover {
		filter: brightness(1.2);
	}
	.fo-close:active {
		transform: scale(0.94);
	}

	/* Small plaque is wide + short (1241 x 623). */
	.fo-stage {
		position: relative;
		/* Height-capped (plaque ≈ 1/2 of its width tall, burger + splashes overhang above) so the whole
		   composition stays on short landscape screens. */
		/* (85% of the design's size, like the intro's) */
		width: min(476px, 78vw, 94dvh);
		aspect-ratio: 1241 / 623;
		container-type: inline-size; /* text below scales with the plaque (cqw) */
		font-family: 'Nunito', sans-serif;
	}


	/* Burger peeks over the top edge of the plaque — the real slice-built burger (BurgerStack) so it
	   assembles / disassembles; a contained --sep keeps the burst from spreading too far up. */
	.fo-burger {
		position: absolute;
		left: 50%;
		/* Straddles the plaque's top edge, IN FRONT of the rim: the bottom bun sits on the red field just
		   under the rim, the top bun stands up over it (clear of the CONGRATS title below). */
		top: -15%;
		transform: translateX(-50%);
		width: 20%;
		aspect-ratio: 1.077;
		z-index: 2;
		pointer-events: none;
		--sep: 0.5;
		animation: fo-burger-pop 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) both;
	}

	.fo-plaque {
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
			fo-pop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both,
			fo-hit 0.52s ease-in-out 0.64s;
	}

	.fo-content {
		position: relative;
		z-index: 3;
		width: 74%;
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		color: #ffffff;
		gap: clamp(2px, 0.8vmin, 7px);
	}

	.fo-congrats {
		margin: 0;
		font-family: var(--font-brush);
		-webkit-text-stroke: var(--brush-stroke) currentColor;
		font-weight: 400;
		font-size: min(clamp(1.5rem, 6.4vmin, 2.7rem), 7cqw);
		line-height: 1;
		letter-spacing: 0.02em;
		text-transform: uppercase;
		text-shadow: 0 2px 5px rgba(90, 10, 5, 0.6);
		/* STAMPED onto the plaque: drops from 1.7× and slams down at 0.64s (the HIT that squashes the
		   plaque and squeezes the sauce out — CongratsSplashes), squashes flat, springs back, then
		   breathes. */
		animation:
			fo-stamp 0.85s ease-in-out 0.33s both,
			fo-breathe 2.3s ease-in-out 1.3s infinite;
	}
	.fo-youwon {
		margin: clamp(1px, 0.5vmin, 4px) 0 0;
		font-family: var(--font-brush);
		-webkit-text-stroke: var(--brush-stroke) currentColor;
		font-weight: 400;
		/* the design's 25 : 62 to CONGRATS (8259:4651 / 4650) */
		font-size: min(clamp(0.72rem, 2.6vmin, 1.1rem), 3cqw);
		letter-spacing: 0.16em;
	}

	/* Amount box, matching the free-spin count box. */
	.fo-amount {
		margin: clamp(8px, 2vmin, 18px) 0 0;
		display: grid;
		place-items: center;
		min-width: min(clamp(120px, 26vmin, 220px), 39cqw);
		padding: min(clamp(7px, 1.6vmin, 14px), 2.5cqw) min(clamp(18px, 3.4vmin, 32px), 5.7cqw);
		border-radius: 12px;
		background: #292624;
		border: 1px solid #ffffff;
		box-shadow: 0px 0px 17px 0px #e8b574;
	}
	.fo-amount span {
		font-family: 'Bowlby One SC', sans-serif;
		font-weight: 400;
		font-size: min(clamp(1.5rem, 5vmin, 2.4rem), 6cqw);
		line-height: 1;
		color: #ffffff;
		white-space: nowrap;
	}

	.fo-continue {
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
		animation: fo-blink 1.6s ease-in-out infinite;
	}
	@keyframes fo-blink {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.5;
		}
	}

	/* Win (plaque + copy) pops in first; burger keeps its centring while it pops; sauces burst in. */
	@keyframes fo-pop {
		0% { opacity: 0; transform: scale(0.72); }
		60% { opacity: 1; transform: scale(1.03); }
		100% { opacity: 1; transform: scale(1); }
	}
	@keyframes fo-burger-pop {
		0% { opacity: 0; transform: translateX(-50%) scale(0.55); }
		60% { opacity: 1; transform: translateX(-50%) scale(1.06); }
		100% { opacity: 1; transform: translateX(-50%) scale(1); }
	}
	/* Stamp: hit at 36% (0.64s after the screen opens), squash wide + flat, spring back. */
	@keyframes fo-stamp {
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
	@keyframes fo-hit {
		0% { transform: scale(1); }
		18% { transform: scale(1.035, 0.95); }
		42% { transform: scale(0.988, 1.018); }
		68% { transform: scale(1.006, 0.996); }
		100% { transform: scale(1); }
	}
	@keyframes fo-breathe {
		0%, 100% { transform: scale(1); }
		50% { transform: scale(1.04); }
	}
	@media (prefers-reduced-motion: reduce) {
		.fo-plaque, .fo-burger, .fo-congrats { animation: none; }
	}

	/* Smallest landscape popouts (~400x225, <=300px tall): the plaque is sized by width, so on a very
	   short screen the burger + sauce that overhang the top edge clip off the top and PRESS TO CONTINUE
	   collides with it. Cap the stage by viewport HEIGHT (dvh) so the whole composition — burger, plaque
	   and splashes — fits, and tuck the close + continue in tighter. Placed LAST so it wins over the base
	   rules. 812x375 (height 375) is unaffected. */
	@media (max-height: 300px) {
		.fo-stage {
			width: min(476px, 78vw, 92dvh);
			max-height: none;
		}
		.fo-close {
			width: clamp(20px, 9dvh, 30px);
			top: 6px;
			right: 6px;
		}
		.fo-continue {
			bottom: 5px;
			font-size: clamp(9px, 4vmin, 13px);
		}
	}
</style>
