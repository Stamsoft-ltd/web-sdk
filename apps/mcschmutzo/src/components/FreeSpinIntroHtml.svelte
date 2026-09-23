<script lang="ts" module>
	// Module scope so the art preloads during the loading screen (mounts on demand).
	import { ap } from '../lib/preloadArt';

	// Large plaque (bigger-cover) for the bonus intro; the burger sits on its top edge.
	const plaqueArt = ap('/assets/mcschmutzo/congrats-cover-lg.webp');
	const sauceYellowBig = ap('/assets/mcschmutzo/congrats-sauce-yellow-big.webp');
	const sauceRedBig = ap('/assets/mcschmutzo/congrats-sauce-red-big.webp');
	const starArt = ap('/assets/mcschmutzo/win/parts/win-star.webp');
	const closeArt = ap('/assets/mcschmutzo/win/x-button.webp');
</script>

<script lang="ts">
	import { stateBet } from 'state-shared';
	import { waitForResolve } from 'utils-shared/wait';

	import { getContext } from '../game/context';
	import { i18nDerived } from '../i18n/i18nDerived';
	import BurgerStack from './BurgerStack.svelte';

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
			await waitForResolve((resolve) => (oncomplete = resolve));
		},
	});

	// Bonus name + blurb keyed off the mode that produced the free spins.
	const bonusName = $derived(
		stateBet.activeBetModeKey === 'bonus1'
			? i18nDerived.translate('NORMAL BONUS TITLE')
			: i18nDerived.translate('ALL IN BONUS TITLE'),
	);
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
			aria-label="Close"
		></button>

		<div class="fs-stage" role="dialog" aria-modal="true">
			<!-- Each side is a two-tone pair: the "under" splash (red beneath the yellow, yellow beneath
			     the red) renders first so the top splash sits over it. -->
			<img class="fs-sauce fs-sauce--ul" src={sauceRedBig} alt="" draggable="false" />
			<img class="fs-sauce fs-sauce--ur" src={sauceYellowBig} alt="" draggable="false" />
			<img class="fs-sauce fs-sauce--tl" src={sauceYellowBig} alt="" draggable="false" />
			<img class="fs-sauce fs-sauce--tr" src={sauceRedBig} alt="" draggable="false" />

			<!-- Burger perched on the top edge of the plaque — the real slice burger so it assembles. -->
			<div class="fs-burger"><BurgerStack /></div>

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

		<p class="fs-continue">{i18nDerived.translate('PRESS TO CONTINUE')}&nbsp;→</p>
	</div>
{/if}

<style>
	.fs-backdrop {
		position: fixed;
		inset: 0;
		z-index: 55;
		display: grid;
		place-items: center;
		background: rgba(0, 0, 0, 0.5);
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
		width: min(600px, 90vw);
		max-height: 88dvh;
		aspect-ratio: 1366 / 989;
		font-family: 'Poppins', sans-serif;
	}

	/* Sauces peeking out from behind the plaque: bigger at the top corners, smaller at the sides.
	   They SWOOSH in a beat after the plaque (win first, then the splashes burst in behind it). */
	.fs-sauce {
		position: absolute;
		height: auto;
		z-index: 0;
		pointer-events: none;
		filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.35));
		/* Thrown in behind the plaque, then a slow throb so the sauce reads as wet. */
		animation:
			fs-splash 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) 0.22s both,
			fs-throb 2.6s ease-in-out 0.85s infinite;
	}
	/* Top splashes (over): bigger sprays that push out past the plaque corners. */
	.fs-sauce--tl {
		width: 37%;
		top: -12%;
		left: -6%;
	}
	.fs-sauce--tr {
		width: 37%;
		top: -14%;
		right: -6%;
	}
	/* Under splashes: red beneath the left yellow, yellow beneath the right red. */
	.fs-sauce--ul {
		width: 30%;
		top: 30%;
		left: -8%;
	}
	.fs-sauce--ur {
		width: 30%;
		top: 28%;
		right: -8%;
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
		animation: fs-pop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both;
	}

	/* Burger peeks over the top edge of the plaque from BEHIND it. It's the real slice-built burger
	   (BurgerStack) so it assembles / disassembles like the reels; a contained --sep keeps the burst
	   from spreading too far above the plaque. Pops in once, then the slices loop. */
	.fs-burger {
		position: absolute;
		left: 50%;
		top: -24%;
		transform: translateX(-50%);
		width: 27%;
		aspect-ratio: 1.077;
		z-index: 0;
		pointer-events: none;
		--sep: 0.5;
		animation: fs-burger-pop 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) both;
	}

	/* Twinkling stars flanking the plaque (top-right + bottom-left), like the win pad. */
	.fs-star {
		position: absolute;
		width: 12%;
		height: auto;
		z-index: 2;
		pointer-events: none;
		filter: drop-shadow(0 2px 5px rgba(0, 0, 0, 0.35));
		animation:
			fs-star-in 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.35s both,
			fs-star-twinkle 1.5s ease-in-out 0.9s infinite;
	}
	.fs-star--tr {
		top: -4%;
		right: 4%;
	}
	.fs-star--bl {
		bottom: -2%;
		left: 4%;
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
		gap: clamp(3px, 0.9vmin, 8px);
	}

	.fs-congrats {
		margin: 0;
		font-family: 'Bowlby One SC', 'Bowlby One', sans-serif;
		font-weight: 400;
		font-size: clamp(1.4rem, 5.6vmin, 2.5rem);
		line-height: 1;
		letter-spacing: 0.02em;
		text-transform: uppercase;
		text-shadow: 0 2px 5px rgba(90, 10, 5, 0.6);
		/* Title breathes (expand / retract), starting after the pop-in. */
		animation: fs-breathe 2.3s ease-in-out 0.5s infinite;
	}
	.fs-youwon {
		margin: 0;
		font-family: 'Inter', sans-serif;
		font-weight: 700;
		font-size: clamp(0.62rem, 1.9vmin, 0.9rem);
		letter-spacing: 0.16em;
	}
	.fs-bonus {
		margin: 0;
		font-family: 'Inter', sans-serif;
		font-weight: 700;
		font-size: clamp(0.95rem, 3vmin, 1.35rem);
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}
	.fs-blurb {
		margin: clamp(2px, 0.8vmin, 8px) 0 0;
		font-family: 'Poppins', sans-serif;
		font-weight: 500;
		font-size: clamp(0.62rem, 1.9vmin, 0.88rem);
		line-height: 1.35;
		color: #ffe9d9;
		max-width: 32ch;
	}

	/* Amount box per spec. */
	.fs-count {
		margin: clamp(6px, 1.6vmin, 14px) 0 clamp(2px, 0.8vmin, 6px);
		display: grid;
		place-items: center;
		min-width: clamp(74px, 14vmin, 108px);
		padding: clamp(6px, 1.4vmin, 12px) clamp(16px, 3vmin, 26px);
		border-radius: 12px;
		background: #292624;
		border: 1px solid #ffffff;
		box-shadow: 0px 0px 17px 0px #e8b574;
	}
	.fs-count span {
		font-family: 'Inter', sans-serif;
		font-weight: 700;
		font-size: clamp(1.5rem, 4.6vmin, 2.2rem);
		line-height: 1;
		color: #ffffff;
	}
	.fs-label {
		margin: 0;
		font-family: 'Inter', sans-serif;
		font-weight: 700;
		font-size: clamp(0.9rem, 2.8vmin, 1.25rem);
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
		font-family: 'Poppins', sans-serif;
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
	/* Sauces get THROWN in behind the plaque (spin + overshoot), a beat later — a bigger burst now. */
	@keyframes fs-splash {
		0% { opacity: 0; transform: scale(0.15) rotate(-28deg); }
		70% { opacity: 1; transform: scale(1.12) rotate(6deg); }
		100% { opacity: 1; transform: scale(1) rotate(0deg); }
	}
	@keyframes fs-throb {
		0%, 100% { transform: scale(1) rotate(0deg); }
		50% { transform: scale(1.07) rotate(3.5deg); }
	}
	@keyframes fs-breathe {
		0%, 100% { transform: scale(1); }
		50% { transform: scale(1.04); }
	}
	@media (prefers-reduced-motion: reduce) {
		.fs-plaque, .fs-burger, .fs-sauce, .fs-congrats, .fs-star { animation: none; }
	}

	/* Tiny popouts (~400x225): shrink the close (X) so it doesn't dominate the small screen. */
	@media (max-height: 300px) {
		.fs-close { width: clamp(20px, 9dvh, 30px); top: 6px; right: 6px; }
	}
</style>
