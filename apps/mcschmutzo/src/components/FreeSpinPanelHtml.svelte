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

		<!-- Multiplier accordion: the value shows once a multiplier is active. -->
		<div class="fp-acc" style={`background-image:url('${accordionArt}')`}>
			<span class="fp-acc__mult" class:fp-acc__mult--on={hasMult}>{mult}x</span>
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
		transition: opacity 0.15s ease;
	}
	.fp-acc__mult--on {
		opacity: 1;
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
		bottom: 20%;
		width: min(118px, 30%);
	}

	/* ── Desktop / landscape: FREE SPINS + TOTAL WIN stacked on the LEFT of the board, accordion above. ── */
	.fp:not([data-layout='portrait']) .fp-acc {
		left: 4%;
		top: 20%;
		width: clamp(110px, 11vw, 180px);
	}
	.fp:not([data-layout='portrait']) .fp-fs {
		left: 3.5%;
		top: 45%;
		min-width: clamp(130px, 12vw, 210px);
	}
	.fp:not([data-layout='portrait']) .fp-total {
		left: 3.5%;
		top: 62%;
		min-width: clamp(130px, 12vw, 210px);
	}
</style>
