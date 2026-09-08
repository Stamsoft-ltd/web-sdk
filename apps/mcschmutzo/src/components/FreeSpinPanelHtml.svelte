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

	/* Both panels are their own query container so their text scales with their size on any layout. */
	.fp-fs,
	.fp-acc {
		position: absolute;
		container-type: size;
	}

	/* FREE SPINS card — the provided dark translucent spins-card. */
	.fp-fs {
		aspect-ratio: 2 / 1;
		box-sizing: border-box;
		border-radius: 10px;
		background: rgba(0, 6, 22, 0.78);
		border: 1.5px solid rgba(255, 255, 255, 0.09);
		box-shadow: 0 5px 12px rgba(0, 0, 0, 0.55);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 4cqh;
	}
	.fp-fs__label {
		color: #ffffff;
		font-weight: 700;
		font-size: 20cqh;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		line-height: 1;
	}
	.fp-fs__count {
		color: #ffffff;
		font-family: 'Bowlby One SC', 'Bowlby One', sans-serif;
		font-weight: 400;
		font-size: 42cqh;
		line-height: 1;
	}

	/* Multiplier accordion machine. */
	.fp-acc {
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
		font-size: 34cqh;
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

	/* ── Desktop / landscape: stacked to the LEFT of the board (the chef + pot own the right). ── */
	.fp:not([data-layout='portrait']) .fp-fs {
		left: 3%;
		top: 33%;
		width: clamp(150px, 13vw, 230px);
	}
	.fp:not([data-layout='portrait']) .fp-acc {
		left: 4%;
		top: 52%;
		width: clamp(130px, 12vw, 200px);
	}
</style>
