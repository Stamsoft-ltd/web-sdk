<script lang="ts" module>
	// Module scope so the art preloads during the loading screen (mounts on demand).
	import { ap } from '../lib/preloadArt';

	const plaqueArt = ap('/assets/mcschmutzo/congrats.webp');
	const splashYellow = ap('/assets/mcschmutzo/congrats-splash-yellow.webp');
	const splashRed = ap('/assets/mcschmutzo/congrats-splash-red.webp');
	const closeArt = ap('/assets/mcschmutzo/win/x-button.webp');

	const STAR_SVG = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 1.5l3.09 6.26 6.91 1-5 4.87 1.18 6.87L12 17.27 5.82 20.5 7 13.63l-5-4.87 6.91-1z" fill="#FFCB33" stroke="#E39B1A" stroke-width="1.1" stroke-linejoin="round"/></svg>`;
</script>

<script lang="ts">
	import { stateBet } from 'state-shared';
	import { waitForResolve } from 'utils-shared/wait';

	import { getContext } from '../game/context';
	import { i18nDerived } from '../i18n/i18nDerived';

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
			<img class="fs-splash fs-splash--yellow" src={splashYellow} alt="" draggable="false" />
			<img class="fs-splash fs-splash--red" src={splashRed} alt="" draggable="false" />

			<div class="fs-plaque" style={`background-image:url('${plaqueArt}')`}>
				<span class="fs-star fs-star--left">{@html STAR_SVG}</span>
				<span class="fs-star fs-star--right">{@html STAR_SVG}</span>

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
		width: min(680px, 92vw);
		max-height: 90dvh;
		aspect-ratio: 900 / 651;
		font-family: 'Poppins', sans-serif;
	}

	/* Sauce splashes bleeding out from behind the top corners of the plaque. */
	.fs-splash {
		position: absolute;
		width: 34%;
		height: auto;
		z-index: 0;
		pointer-events: none;
		filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.35));
	}
	.fs-splash--yellow {
		top: -6%;
		left: 2%;
		transform: scaleX(-1);
	}
	.fs-splash--red {
		top: -8%;
		right: 1%;
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
	}

	.fs-star {
		position: absolute;
		z-index: 2;
		width: 15%;
		filter: drop-shadow(0 3px 4px rgba(0, 0, 0, 0.4));
		pointer-events: none;
	}
	.fs-star :global(svg) {
		width: 100%;
		height: auto;
		display: block;
	}
	.fs-star--left {
		left: 8%;
		bottom: 20%;
		transform: rotate(-12deg);
	}
	.fs-star--right {
		right: 10%;
		top: 22%;
		transform: rotate(12deg);
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
</style>
