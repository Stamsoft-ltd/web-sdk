<script lang="ts" module>
	// Module scope so the art preloads during the loading screen.
	import { ap } from '../lib/preloadArt';

	const accordionArt = ap('/assets/mcschmutzo/accordion.webp');
</script>

<script lang="ts">
	import { stateBet, stateUi } from 'state-shared';
	import { bookEventAmountToCurrencyString } from 'utils-shared/amount';

	import { getContext } from '../game/context';
	import { i18nDerived } from '../i18n/i18nDerived';

	const context = getContext();

	const layoutType = $derived(context.stateLayoutDerived.layoutType());
	const isFreegame = $derived(context.stateGame.gameType === 'freegame');
	const show = $derived(isFreegame || stateUi.freeSpinCounterShow);

	const current = $derived(stateUi.freeSpinCounterCurrent ?? 0);
	const total = $derived(stateUi.freeSpinCounterTotal ?? 0);
	// The accordion reveals the running win multiplier once it climbs above 1x.
	const mult = $derived(context.stateGame.globalMultiplier);
	const hasMult = $derived(mult > 1);
	// Running bonus total — the sum of every free-spin win (the bottom-right WIN shows only the
	// latest spin's win, this sums them). Set via the setTotalWin book event.
	const totalWin = $derived(bookEventAmountToCurrencyString(stateBet.winBookEventAmount));

	// DEV preview: press 8 to force a free-games state (special bg + counter + multiplier + total).
	import { onMount } from 'svelte';
	onMount(() => {
		if (!import.meta.env.DEV) return;
		const onDev = (e: KeyboardEvent) => {
			if (e.code !== 'Digit8') return;
			context.stateGame.gameType = 'freegame';
			context.stateGame.globalMultiplier = context.stateGame.globalMultiplier > 1 ? 1 : 3;
			stateUi.freeSpinCounterShow = true;
			stateUi.freeSpinCounterCurrent = 2;
			stateUi.freeSpinCounterTotal = 15;
			stateBet.winBookEventAmount = 20000; // preview a running total
		};
		window.addEventListener('keydown', onDev);
		return () => window.removeEventListener('keydown', onDev);
	});
</script>

{#if show}
	<div class="fp" data-layout={layoutType}>
		<!-- FREE SPINS counter -->
		<div class="fp-card fp-fs">
			<span class="fp-card__label">{i18nDerived.translate('FREE SPINS')}</span>
			<span class="fp-card__value">{current}/{total}</span>
		</div>

		<!-- TOTAL WIN — the running sum of the free-spin wins. -->
		<div class="fp-card fp-total">
			<span class="fp-card__label">{i18nDerived.translate('TOTAL WIN')}</span>
			<span class="fp-card__value">{totalWin}</span>
		</div>

		<!-- Multiplier accordion/printer: indicator lights blink (machine alive) and the value stamps
		     onto the ticket each time it prints/changes. -->
		<div class="fp-acc" style={`background-image:url('${accordionArt}')`}>
			<span class="fp-acc__led fp-acc__led--green"></span>
			<span class="fp-acc__led fp-acc__led--red"></span>
			{#key mult}
				<span class="fp-acc__mult" class:fp-acc__mult--on={hasMult}>{mult}x</span>
			{/key}
		</div>
	</div>
{/if}

<style>
	.fp {
		position: absolute;
		inset: 0;
		z-index: 6;
		pointer-events: none;
		font-family: 'Poppins', sans-serif;
	}

	.fp-card,
	.fp-acc {
		position: absolute;
	}

	/* FREE SPINS / TOTAL WIN — small dark #1F1F1F card with a lighter top bevel, matching the HUD
	   readouts (BALANCE / WIN). Sizes to its content. */
	.fp-card {
		box-sizing: border-box;
		padding: clamp(6px, 0.9vw, 14px) clamp(10px, 1.4vw, 20px);
		border-radius: 4.21px;
		background: #1f1f1f;
		border-top: 1.28px solid #605553;
		box-shadow: 0 5px 12px rgba(0, 0, 0, 0.5);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: clamp(2px, 0.4vw, 6px);
	}
	.fp-card__label,
	.fp-card__value {
		color: #ffffff;
		font-family: 'Nunito', sans-serif;
		font-weight: 600;
		letter-spacing: 0.03em;
		text-align: center;
		line-height: 1;
		white-space: nowrap;
	}
	.fp-card__label {
		font-size: clamp(9px, 1vw, 14px);
		text-transform: uppercase;
		opacity: 0.85;
	}
	.fp-card__value {
		font-size: clamp(17px, 1.9vw, 27px);
	}

	/* Multiplier accordion machine. */
	.fp-acc {
		container-type: inline-size;
		aspect-ratio: 1127 / 794;
		background-size: 100% 100%;
		background-repeat: no-repeat;
		filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.4));
	}
	.fp-acc__mult {
		position: absolute;
		left: 50%;
		top: 62%;
		transform: translate(-50%, -50%);
		color: #b3261a;
		font-family: 'Bowlby One SC', 'Bowlby One', sans-serif;
		font-weight: 400;
		font-size: 17cqw;
		line-height: 1;
		opacity: 0;
	}
	/* The value "prints/stamps" onto the ticket: drops in big + tilted with an overshoot, then
	   settles — replayed whenever the multiplier value changes (the {#key} remounts it). */
	.fp-acc__mult--on {
		opacity: 1;
		animation: fp-mult-stamp 0.5s cubic-bezier(0.2, 1.5, 0.4, 1) both;
	}
	@keyframes fp-mult-stamp {
		0% {
			opacity: 0;
			transform: translate(-50%, -95%) scale(1.9) rotate(-9deg);
			filter: blur(1.2px);
		}
		55% {
			opacity: 1;
			transform: translate(-50%, -43%) scale(0.9) rotate(3deg);
			filter: blur(0);
		}
		100% {
			opacity: 1;
			transform: translate(-50%, -50%) scale(1) rotate(0);
		}
	}

	/* Indicator lights — soft glows layered over the painted lamps so they pulse/blink (machine alive).
	   `screen` blend brightens the underlying dot rather than covering it. */
	.fp-acc__led {
		position: absolute;
		width: 9cqw;
		height: 9cqw;
		transform: translate(-50%, -50%);
		border-radius: 50%;
		pointer-events: none;
		mix-blend-mode: screen;
	}
	.fp-acc__led--green {
		left: 16.8%;
		top: 10.6%;
		background: radial-gradient(circle at 42% 36%, #eaffe4 0%, #74e85e 42%, rgba(70, 190, 45, 0) 70%);
		animation: fp-led-breathe 1.7s ease-in-out infinite;
	}
	.fp-acc__led--red {
		left: 82.4%;
		top: 10.6%;
		background: radial-gradient(circle at 42% 36%, #ffe0d8 0%, #ff5333 42%, rgba(210, 45, 20, 0) 70%);
		animation: fp-led-blink 1.5s steps(1, end) infinite;
	}
	@keyframes fp-led-breathe {
		0%,
		100% {
			opacity: 0.3;
			transform: translate(-50%, -50%) scale(0.85);
		}
		50% {
			opacity: 0.95;
			transform: translate(-50%, -50%) scale(1.12);
		}
	}
	@keyframes fp-led-blink {
		0%,
		62% {
			opacity: 0;
		}
		66%,
		84% {
			opacity: 1;
		}
		88%,
		100% {
			opacity: 0;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.fp-acc__mult--on {
			animation: none;
		}
		.fp-acc__led {
			animation: none;
			opacity: 0.6;
		}
	}

	/* ── Portrait: a row under the board (accordion lifted so it clears the nav bar). ── */
	.fp[data-layout='portrait'] .fp-fs {
		left: 6%;
		bottom: 24%;
		width: min(150px, 39%);
	}
	.fp[data-layout='portrait'] .fp-total {
		left: 6%;
		bottom: 13%;
		width: min(150px, 39%);
	}
	.fp[data-layout='portrait'] .fp-acc {
		right: 6%;
		/* px floor lifts the printer clear of the bottom nav on short phones (the % alone put it too
		   low, resting on the control row); a touch narrower so it fits the board-to-nav gap. */
		bottom: max(21%, 150px);
		width: min(104px, 27%);
	}

	/* ── Desktop / landscape: FREE SPINS + TOTAL WIN stacked on the LEFT of the board, accordion above.
	   Sized in vmin (short side) so the pills shrink on tiny popouts (400x225) and clear the board's
	   left column, while staying full-size on normal mobile-landscape. ── */
	.fp:not([data-layout='portrait']) .fp-acc {
		left: 4%;
		top: 18%;
		width: clamp(70px, 22vmin, 180px);
	}
	.fp:not([data-layout='portrait']) .fp-fs {
		left: 3.5%;
		top: 44%;
		min-width: clamp(84px, 28vmin, 210px);
	}
	.fp:not([data-layout='portrait']) .fp-total {
		left: 3.5%;
		top: 62%;
		min-width: clamp(84px, 28vmin, 210px);
	}

	/* Smallest landscape popouts (~400x225, ≤300px tall): shrink the FREE SPINS / TOTAL WIN pills and
	   the multiplier accordion so they don't dominate the tiny screen. Placed LAST so it wins over the
	   base rules (equal specificity → later wins). 812x375 (height 375) is unaffected. */
	@media (max-height: 300px) {
		.fp:not([data-layout='portrait']) .fp-acc {
			top: 15%;
			width: clamp(46px, 19vmin, 120px);
		}
		.fp:not([data-layout='portrait']) .fp-fs {
			top: 42%;
			min-width: clamp(56px, 22vmin, 150px);
		}
		.fp:not([data-layout='portrait']) .fp-total {
			top: 60%;
			min-width: clamp(56px, 22vmin, 150px);
		}
		.fp-card {
			padding: 3px 7px;
			gap: 1px;
			border-radius: 3px;
		}
		.fp-card__label {
			font-size: clamp(6px, 3vmin, 9px);
		}
		.fp-card__value {
			font-size: clamp(11px, 5vmin, 16px);
		}
	}
</style>
