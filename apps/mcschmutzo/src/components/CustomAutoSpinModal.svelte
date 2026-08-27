<script lang="ts" module>
	// Module scope so the art preloads during the loading screen (the modal mounts on demand).
	import { ap } from '../lib/preloadArt';

	const hatArt = ap('/assets/mcschmutzo/autoplay/hat.webp');
	const minusArt = ap('/assets/mcschmutzo/autoplay/minus.svg');
	const plusArt = ap('/assets/mcschmutzo/autoplay/plus-icon.svg');
	const activeArt = ap('/assets/mcschmutzo/autoplay/active.svg');
	const inactiveArt = ap('/assets/mcschmutzo/autoplay/inactive.svg');
	const startArt = ap('/assets/mcschmutzo/autoplay/autoplay.svg');
</script>

<script lang="ts">
	import { stateBet } from 'state-shared';
	import { getContext } from '../game/context';
	import { i18nDerived } from '../i18n/i18nDerived';

	type Props = { onclose: () => void };
	const props: Props = $props();
	const context = getContext();

	// Spin-count stops (last = unlimited); the −/+ buttons step through them.
	const STOPS: Array<number> = [10, 25, 50, 100, 250, 500, Infinity];
	let stopIndex = $state(3); // default 100
	const count = $derived(STOPS[stopIndex]);
	const countLabel = $derived(count === Infinity ? '∞' : `${count}`);

	const step = (dir: number) => {
		const next = stopIndex + dir;
		if (next < 0 || next > STOPS.length - 1) return;
		stopIndex = next;
		context.eventEmitter.broadcast({ type: 'soundPressGeneral' });
	};

	// Live game-state toggles (mirror the HUD)
	const isTurbo = $derived(stateBet.isTurbo && !stateBet.isSuperTurbo);
	const isSuperTurbo = $derived(stateBet.isSuperTurbo);
	const isFeature = $derived(stateBet.activeBetModeKey === 'featureSpin');

	const toggleTurbo = () => {
		context.eventEmitter.broadcast({ type: 'soundPressGeneral' });
		if (isTurbo) {
			stateBet.isTurbo = false;
		} else {
			stateBet.isTurbo = true;
			stateBet.isSuperTurbo = false;
		}
	};
	const toggleSuperTurbo = () => {
		context.eventEmitter.broadcast({ type: 'soundPressGeneral' });
		if (isSuperTurbo) {
			stateBet.isSuperTurbo = false;
		} else {
			stateBet.isSuperTurbo = true;
			stateBet.isTurbo = false;
		}
	};
	const toggleFeature = () => {
		context.eventEmitter.broadcast({ type: 'soundPressGeneral' });
		stateBet.activeBetModeKey = isFeature ? 'base' : 'featureSpin';
	};

	const start = () => {
		context.eventEmitter.broadcast({ type: 'soundPressBet' });
		// Buy modes are one-shot. Autospin must never inherit a previous BONUS/SUPER purchase.
		if (stateBet.activeBetModeKey === 'bonus1' || stateBet.activeBetModeKey === 'bonus2') {
			stateBet.activeBetModeKey = 'base';
		}
		stateBet.autoSpinsCounter = count;
		props.onclose();
		context.eventEmitter.broadcast({ type: 'autoBet' });
	};

	const TOGGLES = $derived([
		{ label: i18nDerived.translate('TURBO SPIN'), on: isTurbo, onclick: toggleTurbo },
		{ label: i18nDerived.translate('SUPER TURBO SPIN'), on: isSuperTurbo, onclick: toggleSuperTurbo },
		{ label: i18nDerived.translate('LOCK FEATURE SPIN'), on: isFeature, onclick: toggleFeature },
	]);
</script>

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div class="ap-backdrop" onclick={props.onclose}></div>

<button class="ap-close" type="button" onclick={props.onclose} aria-label="Close">✕</button>

<div class="ap-root" role="dialog" aria-modal="true">
	<div class="ap-popup">
		<p class="ap-title">{i18nDerived.translate('AUTO SPIN')}</p>

		<p class="ap-spins-label">{i18nDerived.translate('NUMBER OF SPINS')}</p>

		<div class="ap-counter">
			<button
				class="ap-step"
				type="button"
				style={`background-image:url('${minusArt}')`}
				onclick={() => step(-1)}
				disabled={stopIndex === 0}
				aria-label="Fewer spins"
			></button>

			<div class="ap-counter-box">
				<img class="ap-hat" src={hatArt} alt="" draggable="false" />
				<span class="ap-count">{countLabel}</span>
			</div>

			<button
				class="ap-step"
				type="button"
				style={`background-image:url('${plusArt}')`}
				onclick={() => step(1)}
				disabled={stopIndex === STOPS.length - 1}
				aria-label="More spins"
			></button>
		</div>

		<div class="ap-toggles">
			{#each TOGGLES as t (t.label)}
				<div class="ap-row">
					<span class="ap-row__label">{t.label}</span>
					<button
						class="ap-switch"
						type="button"
						style={`background-image:url('${t.on ? activeArt : inactiveArt}')`}
						onclick={t.onclick}
						aria-pressed={t.on}
						aria-label={t.label}
					></button>
				</div>
			{/each}
		</div>

		<button
			class="ap-start"
			type="button"
			style={`background-image:url('${startArt}')`}
			onclick={start}
			aria-label={i18nDerived.translate('START AUTOPLAY')}
		></button>
	</div>
</div>

<style>
	.ap-backdrop {
		position: fixed;
		inset: 0;
		z-index: 58;
		background: rgba(0, 0, 0, 0.64);
		backdrop-filter: blur(4px);
	}

	.ap-root {
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		z-index: 59;
		width: min(500px, 92vw);
		font-family: 'Poppins', sans-serif;
	}

	/* Dark pop-up per spec: 3px #444444 border. */
	.ap-popup {
		display: flex;
		flex-direction: column;
		gap: clamp(10px, 2vw, 18px);
		padding: clamp(18px, 3.4vw, 30px) clamp(16px, 3vw, 28px) clamp(20px, 3.6vw, 30px);
		border: 3px solid #444444;
		border-radius: 20px;
		background: linear-gradient(180deg, #241f1c 0%, #171412 100%);
		box-shadow: 0 18px 50px rgba(0, 0, 0, 0.6);
	}

	.ap-close {
		position: fixed;
		top: 22px;
		right: 22px;
		z-index: 60;
		width: 48px;
		height: 48px;
		border-radius: 50%;
		border: 3px solid #444444;
		background: #201d1b;
		color: #fff1cf;
		font-size: 1.05rem;
		font-weight: 700;
		cursor: pointer;
		display: grid;
		place-items: center;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
		transition: filter 0.12s ease;
	}
	.ap-close:hover {
		filter: brightness(1.25);
	}

	.ap-title {
		margin: 0;
		text-align: center;
		color: #fff1cf;
		font-weight: 800;
		font-size: clamp(1.15rem, 2.8vw, 1.6rem);
		letter-spacing: 0.06em;
		text-shadow: 0 2px 6px rgba(0, 0, 0, 0.6);
	}

	.ap-spins-label {
		margin: 0;
		text-align: center;
		color: #c9beb0;
		font-weight: 600;
		font-size: clamp(0.72rem, 1.6vw, 0.92rem);
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}

	/* Counter row: −  [ hat + count ]  + */
	.ap-counter {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: clamp(12px, 2.4vw, 22px);
	}

	.ap-step {
		flex: 0 0 auto;
		width: clamp(44px, 8vw, 58px);
		height: clamp(44px, 8vw, 58px);
		padding: 0;
		border: none;
		background: transparent center / contain no-repeat;
		cursor: pointer;
		transition: filter 0.12s ease, transform 0.08s ease;
	}
	.ap-step:hover {
		filter: brightness(1.15);
	}
	.ap-step:active {
		transform: scale(0.92);
	}
	.ap-step:disabled {
		opacity: 0.35;
		cursor: default;
		filter: none;
	}

	/* Middle counter box per spec. */
	.ap-counter-box {
		flex: 1 1 auto;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: clamp(8px, 1.8vw, 16px);
		min-width: 0;
		padding: clamp(8px, 1.5vw, 14px) clamp(14px, 2.6vw, 24px);
		border: 1px solid #ffffff;
		border-radius: 12px;
		background: #292624;
		box-shadow: 0px 0px 6px 0px #000000 inset;
	}
	.ap-hat {
		height: clamp(30px, 5.6vw, 46px);
		width: auto;
		flex: 0 0 auto;
		filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.5));
	}
	.ap-count {
		color: #fff1cf;
		font-weight: 800;
		font-size: clamp(1.5rem, 4vw, 2.2rem);
		line-height: 1;
		letter-spacing: 0.02em;
		text-shadow: 0 2px 4px rgba(0, 0, 0, 0.6);
	}

	.ap-toggles {
		display: flex;
		flex-direction: column;
		gap: clamp(8px, 1.5vw, 14px);
	}
	.ap-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}
	.ap-row__label {
		color: #fff;
		font-weight: 700;
		font-size: clamp(0.74rem, 1.6vw, 0.95rem);
		letter-spacing: 0.02em;
		text-shadow: 0 2px 4px rgba(0, 0, 0, 0.6);
	}
	.ap-switch {
		flex: 0 0 auto;
		width: clamp(50px, 9vw, 64px);
		aspect-ratio: 62 / 34;
		padding: 0;
		border: none;
		background: transparent center / contain no-repeat;
		cursor: pointer;
		transition: filter 0.12s ease;
	}
	.ap-switch:hover {
		filter: brightness(1.1);
	}

	/* START AUTOPLAY button (Figma art). */
	.ap-start {
		width: 100%;
		aspect-ratio: 317 / 50;
		margin-top: clamp(2px, 0.6vw, 6px);
		padding: 0;
		border: none;
		background: transparent center / contain no-repeat;
		cursor: pointer;
		transition: filter 0.12s ease, transform 0.08s ease;
	}
	.ap-start:hover {
		filter: brightness(1.06);
	}
	.ap-start:active {
		transform: scale(0.98);
	}
</style>
