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
	const burgerArt = ap('/assets/mcschmutzo/congrats-burger.webp');
	const sauceYellowBig = ap('/assets/mcschmutzo/congrats-sauce-yellow-big.webp');
	const sauceRedBig = ap('/assets/mcschmutzo/congrats-sauce-red-big.webp');
	const closeArt = ap('/assets/mcschmutzo/win/x-button.webp');
</script>

<script lang="ts">
	import { Tween } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';
	import { waitForResolve } from 'utils-shared/wait';
	import { bookEventAmountToCurrencyString } from 'utils-shared/amount';

	import { getContext } from '../game/context';
	import { i18nDerived } from '../i18n/i18nDerived';

	const context = getContext();

	let show = $state(false);
	let oncomplete = $state(() => {});
	// Count the total win up from 0 (mirrors the previous animated outro).
	const amountTween = new Tween(0, { duration: 900, easing: cubicOut });
	const amountText = $derived(bookEventAmountToCurrencyString(amountTween.current));

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
			await waitForResolve((resolve) => (oncomplete = resolve));
		},
	});

	const proceed = () => {
		context.eventEmitter.broadcast({ type: 'soundPressGeneral' });
		oncomplete();
	};
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
	<div class="fo-backdrop" onclick={proceed}>
		<button
			class="fo-close"
			type="button"
			style={`background-image:url('${closeArt}')`}
			onclick={(e) => {
				e.stopPropagation();
				proceed();
			}}
			aria-label="Close"
		></button>

		<div class="fo-stage" role="dialog" aria-modal="true">
			<!-- Two-tone pairs: the "under" splash (red beneath the yellow, yellow beneath the red)
			     renders first so the top splash sits over it. -->
			<img class="fo-sauce fo-sauce--ul" src={sauceRedBig} alt="" draggable="false" />
			<img class="fo-sauce fo-sauce--ur" src={sauceYellowBig} alt="" draggable="false" />
			<img class="fo-sauce fo-sauce--tl" src={sauceYellowBig} alt="" draggable="false" />
			<img class="fo-sauce fo-sauce--tr" src={sauceRedBig} alt="" draggable="false" />

			<!-- Burger perched on the top edge of the plaque. -->
			<img class="fo-burger" src={burgerArt} alt="" draggable="false" />

			<div class="fo-plaque" style={`background-image:url('${plaqueArt}')`}>
				<div class="fo-content">
					<p class="fo-congrats">{i18nDerived.translate('CONGRATS')}</p>
					<p class="fo-youwon">{i18nDerived.translate('YOU WON')}</p>
					<div class="fo-amount"><span>{amountText}</span></div>
				</div>
			</div>
		</div>

		<p class="fo-continue">{i18nDerived.translate('PRESS TO CONTINUE')}&nbsp;→</p>
	</div>
{/if}

<style>
	.fo-backdrop {
		position: fixed;
		inset: 0;
		z-index: 55;
		display: grid;
		place-items: center;
		background: rgba(0, 0, 0, 0.5);
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
		width: min(560px, 92vw);
		max-height: 82dvh;
		aspect-ratio: 1241 / 623;
		font-family: 'Poppins', sans-serif;
	}

	.fo-sauce {
		position: absolute;
		height: auto;
		z-index: 0;
		pointer-events: none;
		filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.35));
		/* Thrown in behind the plaque, then a slow throb so the sauce reads as wet. */
		animation:
			fo-splash 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) 0.22s both,
			fo-throb 2.6s ease-in-out 0.85s infinite;
	}
	.fo-sauce--tl {
		width: 33%;
		top: -18%;
		left: -2%;
	}
	.fo-sauce--tr {
		width: 33%;
		top: -22%;
		right: -2%;
	}
	/* Under splashes: red beneath the left yellow, yellow beneath the right red. */
	.fo-sauce--ul {
		width: 22%;
		top: 40%;
		left: -6%;
	}
	.fo-sauce--ur {
		width: 22%;
		top: 36%;
		right: -6%;
	}

	/* Burger peeks over the top edge of the plaque from BEHIND it (z-index below the plaque), bigger. */
	.fo-burger {
		position: absolute;
		left: 50%;
		top: -30%;
		transform: translateX(-50%);
		width: 26%;
		height: auto;
		z-index: 0;
		pointer-events: none;
		filter: drop-shadow(0 5px 9px rgba(0, 0, 0, 0.4));
		animation: fo-burger-pop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both;
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
		animation: fo-pop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both;
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
		font-family: 'Bowlby One SC', 'Bowlby One', sans-serif;
		font-weight: 400;
		font-size: clamp(1.5rem, 6.4vmin, 2.7rem);
		line-height: 1;
		letter-spacing: 0.02em;
		text-transform: uppercase;
		text-shadow: 0 2px 5px rgba(90, 10, 5, 0.6);
		/* Title breathes (expand / retract), starting after the pop-in. */
		animation: fo-breathe 2.3s ease-in-out 0.5s infinite;
	}
	.fo-youwon {
		margin: clamp(1px, 0.5vmin, 4px) 0 0;
		font-family: 'Inter', sans-serif;
		font-weight: 700;
		font-size: clamp(0.66rem, 2vmin, 0.95rem);
		letter-spacing: 0.16em;
	}

	/* Amount box, matching the free-spin count box. */
	.fo-amount {
		margin: clamp(8px, 2vmin, 18px) 0 0;
		display: grid;
		place-items: center;
		min-width: clamp(120px, 26vmin, 220px);
		padding: clamp(7px, 1.6vmin, 14px) clamp(18px, 3.4vmin, 32px);
		border-radius: 12px;
		background: #292624;
		border: 1px solid #ffffff;
		box-shadow: 0px 0px 17px 0px #e8b574;
	}
	.fo-amount span {
		font-family: 'Inter', sans-serif;
		font-weight: 700;
		font-size: clamp(1.5rem, 5vmin, 2.4rem);
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
		font-family: 'Poppins', sans-serif;
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
	@keyframes fo-splash {
		0% { opacity: 0; transform: scale(0.25) rotate(-20deg); }
		70% { opacity: 1; transform: scale(1.08) rotate(5deg); }
		100% { opacity: 1; transform: scale(1) rotate(0deg); }
	}
	@keyframes fo-throb {
		0%, 100% { transform: scale(1) rotate(0deg); }
		50% { transform: scale(1.045) rotate(2deg); }
	}
	@keyframes fo-breathe {
		0%, 100% { transform: scale(1); }
		50% { transform: scale(1.04); }
	}
	@media (prefers-reduced-motion: reduce) {
		.fo-plaque, .fo-burger, .fo-sauce, .fo-congrats { animation: none; }
	}

	/* Smallest landscape popouts (~400x225, <=300px tall): the plaque is sized by width, so on a very
	   short screen the burger + sauce that overhang the top edge clip off the top and PRESS TO CONTINUE
	   collides with it. Cap the stage by viewport HEIGHT (dvh) so the whole composition — burger, plaque
	   and splashes — fits, and tuck the close + continue in tighter. Placed LAST so it wins over the base
	   rules. 812x375 (height 375) is unaffected. */
	@media (max-height: 300px) {
		.fo-stage {
			width: min(560px, 92vw, 126dvh);
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
