<script lang="ts" module>
	// Module scope so the art preloads during the loading screen.
	import { ap } from '../lib/preloadArt';

	const accordionArt = ap('/assets/mcschmutzo/accordion.webp');
</script>

<script lang="ts">
	import { stateUi } from 'state-shared';

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

	// DEV preview: press 8 to force a free-games state (special bg + counter + multiplier).
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
		};
		window.addEventListener('keydown', onDev);
		return () => window.removeEventListener('keydown', onDev);
	});
</script>

{#if show}
	<div class="fp" data-layout={layoutType}>
		<!-- FREE SPINS counter (dark translucent spins card). -->
		<div class="fp-fs">
			<span class="fp-fs__label">{i18nDerived.translate('FREE SPINS')}</span>
			<span class="fp-fs__count">{current}/{total}</span>
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

	.fp-fs,
	.fp-acc {
		position: absolute;
	}

	/* FREE SPINS card — the provided dark translucent spins-card (sizes to its content). */
	.fp-fs {
		box-sizing: border-box;
		padding: clamp(8px, 1vw, 16px) clamp(12px, 1.5vw, 22px);
		border-radius: 10px;
		background: rgba(0, 6, 22, 0.78);
		border: 1.5px solid rgba(255, 255, 255, 0.09);
		box-shadow: 0 5px 12px rgba(0, 0, 0, 0.55);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: clamp(3px, 0.4vw, 7px);
	}
	.fp-fs__label,
	.fp-fs__count {
		color: #ffffff;
		font-family: 'Nunito', sans-serif;
		font-weight: 500;
		letter-spacing: 0.03em;
		text-align: center;
		line-height: 1;
	}
	.fp-fs__label {
		font-size: clamp(9px, 1vw, 14px);
		text-transform: uppercase;
	}
	.fp-fs__count {
		font-size: clamp(19px, 2vw, 29px);
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
	.fp[data-layout='portrait'] .fp-acc {
		right: 6%;
		bottom: 25.5%;
		width: min(118px, 30%);
	}

	/* ── Desktop / landscape: stacked to the LEFT of the board (the chef + pot own the right):
	   accordion on top, the spins card underneath. ── */
	.fp:not([data-layout='portrait']) .fp-acc {
		left: 4%;
		top: 30%;
		width: clamp(130px, 12vw, 200px);
	}
	.fp:not([data-layout='portrait']) .fp-fs {
		left: 3%;
		top: 50%;
		width: clamp(150px, 13vw, 230px);
	}
</style>
