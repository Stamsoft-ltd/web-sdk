<script lang="ts" module>
	// Module scope so the art preloads during the loading screen.
	import { ap } from '../lib/preloadArt';

	const fsFrame = ap('/assets/mcschmutzo/free-spins-frame.webp');
	const accordionArt = ap('/assets/mcschmutzo/accordion.webp');
</script>

<script lang="ts">
	import { stateUi } from 'state-shared';

	import { getContext } from '../game/context';
	import { i18nDerived } from '../i18n/i18nDerived';

	const context = getContext();

	// Portrait-only: desktop/landscape already have the pixi FreeSpinCounter.
	const isPortrait = $derived(context.stateLayoutDerived.layoutType() === 'portrait');
	const isFreegame = $derived(context.stateGame.gameType === 'freegame');
	const show = $derived(isPortrait && (isFreegame || stateUi.freeSpinCounterShow));

	const current = $derived(stateUi.freeSpinCounterCurrent ?? 0);
	const total = $derived(stateUi.freeSpinCounterTotal ?? 0);
	// The accordion shows the running win multiplier once it climbs above 1x.
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
	<div class="fp-row">
		<!-- FREE SPINS counter (left) -->
		<div class="fp-fs" style={`background-image:url('${fsFrame}')`}>
			<span class="fp-fs__label">{i18nDerived.translate('FREE SPINS')}</span>
			<span class="fp-fs__count">{current}/{total}</span>
		</div>

		<!-- Multiplier accordion (right): the value shows once a multiplier is active. -->
		<div class="fp-acc" style={`background-image:url('${accordionArt}')`}>
			<span class="fp-acc__mult" class:fp-acc__mult--on={hasMult}>{mult}x</span>
		</div>
	</div>
{/if}

<style>
	.fp-row {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 20.5%;
		z-index: 6;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 6%;
		box-sizing: border-box;
		pointer-events: none;
		font-family: 'Poppins', sans-serif;
	}

	/* FREE SPINS ticket (red ketchup/mustard frame). */
	.fp-fs {
		position: relative;
		width: min(150px, 38%);
		aspect-ratio: 1354 / 528;
		background-size: 100% 100%;
		background-repeat: no-repeat;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 2%;
		filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.35));
	}
	.fp-fs__label {
		color: #fff5e6;
		font-weight: 800;
		font-size: clamp(7px, 2.4vw, 11px);
		letter-spacing: 0.06em;
		text-transform: uppercase;
		text-shadow: 0 1px 2px rgba(90, 10, 5, 0.7);
		line-height: 1;
	}
	.fp-fs__count {
		color: #ffffff;
		font-family: 'Bowlby One SC', 'Bowlby One', sans-serif;
		font-weight: 400;
		font-size: clamp(13px, 4.6vw, 22px);
		line-height: 1;
		text-shadow: 0 2px 3px rgba(90, 10, 5, 0.7);
	}

	/* Multiplier accordion machine. */
	.fp-acc {
		position: relative;
		width: min(120px, 30%);
		aspect-ratio: 1127 / 794;
		background-size: 100% 100%;
		background-repeat: no-repeat;
		filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.35));
	}
	.fp-acc__mult {
		position: absolute;
		left: 50%;
		top: 60%;
		transform: translate(-50%, -50%);
		color: #b3261a;
		font-family: 'Bowlby One SC', 'Bowlby One', sans-serif;
		font-weight: 400;
		font-size: clamp(15px, 5vw, 26px);
		line-height: 1;
		opacity: 0;
		transition: opacity 0.15s ease;
	}
	.fp-acc__mult--on {
		opacity: 1;
	}
</style>
