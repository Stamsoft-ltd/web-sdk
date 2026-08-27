<script lang="ts" module>
	// Module scope so the art preloads during the loading screen (the modal mounts on demand).
	import { ap } from '../lib/preloadArt';

	const hatArt = ap('/assets/mcschmutzo/autoplay/hat.webp');
	const minusArt = ap('/assets/mcschmutzo/autoplay/minus.svg');
	const plusArt = ap('/assets/mcschmutzo/autoplay/plus-icon.svg');
	const startArt = ap('/assets/mcschmutzo/autoplay/autoplay.svg');
	const closeArt = ap('/assets/mcschmutzo/win/x-button.webp');
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

<button
	class="ap-close"
	type="button"
	style={`background-image:url('${closeArt}')`}
	onclick={props.onclose}
	aria-label="Close"
></button>

<div class="ap-root" role="dialog" aria-modal="true">
	<div class="ap-popup">
		<p class="ap-title">{i18nDerived.translate('AUTO SPIN')}</p>
		<div class="ap-divider"></div>

		<div class="ap-toggles">
			{#each TOGGLES as t (t.label)}
				<div class="ap-row">
					<span class="ap-row__label">{t.label}</span>
					<button
						class="ap-switch"
						class:on={t.on}
						type="button"
						onclick={t.onclick}
						aria-pressed={t.on}
						aria-label={t.label}
					>
						<span class="ap-switch__knob"></span>
					</button>
				</div>
			{/each}
		</div>

		<div class="ap-counter-group">
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
		</div>

		<button
			class="ap-start"
			type="button"
			style={`background-image:url('${startArt}')`}
			onclick={start}
			aria-label={i18nDerived.translate('START AUTOPLAY')}
		></button>
	</div>

	<!-- Chef hat mascot straddling the top edge of the pop-up (half in, half out). Kept a sibling
	     of the pop-up so the pop-up's own overflow clipping never cuts off its upper half. -->
	<img class="ap-hat" src={hatArt} alt="" draggable="false" />
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
		width: min(460px, 92vw);
		max-height: 94dvh;
		font-family: 'Poppins', sans-serif;
	}

	/* Dark pop-up: 3px #444444 border wrapped by a few px of #181818 (the outer-most layer).
	   Sizing uses vmin so it also shrinks on short (landscape) viewports and never overflows. */
	.ap-popup {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: clamp(12px, 2.6vmin, 22px);
		padding: clamp(44px, 8.5vmin, 60px) clamp(18px, 3.8vmin, 32px) clamp(22px, 4vmin, 34px);
		max-height: 94dvh;
		overflow-y: auto;
		border: 3px solid #444444;
		border-radius: 20px;
		background: linear-gradient(180deg, #241f1c 0%, #171412 100%);
		box-shadow:
			0 0 0 4px #181818,
			0 18px 50px rgba(0, 0, 0, 0.6);
	}

	/* Half above the pop-up, half inside it. */
	.ap-hat {
		position: absolute;
		left: 50%;
		top: 0;
		transform: translate(-50%, -50%);
		height: clamp(56px, 11vmin, 90px);
		width: auto;
		pointer-events: none;
		filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.55));
	}

	.ap-close {
		position: fixed;
		top: 20px;
		right: 20px;
		z-index: 60;
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
	.ap-close:hover {
		filter: brightness(1.2);
	}
	.ap-close:active {
		transform: scale(0.94);
	}

	/* Title per spec: Bowlby One SC, white, 36px, +1.4px tracking, uppercase. */
	.ap-title {
		margin: 0;
		text-align: center;
		color: #ffffff;
		font-family: 'Bowlby One SC', 'Bowlby One', sans-serif;
		font-weight: 400;
		font-size: clamp(1.4rem, 6vmin, 2.25rem);
		line-height: 1;
		letter-spacing: 1.4px;
		text-transform: uppercase;
		text-shadow: 0 2px 6px rgba(0, 0, 0, 0.6);
	}

	/* Fading rule under the title, 90% width. */
	.ap-divider {
		align-self: center;
		width: 90%;
		height: 0;
		border: solid;
		border-width: 2px 0 0 0;
		border-image-source: linear-gradient(
			90deg,
			rgba(96, 85, 83, 0) 0%,
			#605553 50%,
			rgba(96, 85, 83, 0) 100%
		);
		border-image-slice: 1;
		margin-bottom: clamp(2px, 0.8vmin, 6px);
	}

	/* Label + counter kept tight together, with extra breathing room around the whole block. */
	.ap-counter-group {
		display: flex;
		flex-direction: column;
		gap: clamp(9px, 2vmin, 16px);
		margin: clamp(6px, 1.8vmin, 14px) 0;
	}

	.ap-spins-label {
		margin: 0;
		text-align: center;
		color: #c9beb0;
		font-weight: 600;
		font-size: clamp(0.7rem, 2vmin, 0.92rem);
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}

	/* Counter row: −  [ count ]  + */
	.ap-counter {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: clamp(12px, 3vmin, 22px);
	}

	.ap-step {
		flex: 0 0 auto;
		width: clamp(40px, 8vmin, 56px);
		aspect-ratio: 1;
		padding: 0;
		border: none;
		background: transparent center / contain no-repeat;
		cursor: pointer;
		transition:
			filter 0.12s ease,
			transform 0.08s ease;
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

	/* Middle counter box per spec: thin white border + inset shadow on #292624. */
	.ap-counter-box {
		flex: 0 0 auto;
		width: clamp(112px, 33%, 165px);
		display: flex;
		align-items: center;
		justify-content: center;
		min-width: 0;
		padding: clamp(8px, 1.8vmin, 15px) clamp(12px, 2.4vmin, 20px);
		border: 0.44px solid #ffffff;
		border-radius: 12px;
		background: #292624;
		box-shadow: 0px 0px 6px 0px #000000 inset;
	}
	.ap-count {
		color: #fff1cf;
		font-weight: 800;
		font-size: clamp(1.4rem, 5vmin, 2.1rem);
		line-height: 1;
		letter-spacing: 0.02em;
		text-shadow: 0 2px 4px rgba(0, 0, 0, 0.6);
	}

	.ap-toggles {
		display: flex;
		flex-direction: column;
		gap: clamp(10px, 2vmin, 17px);
	}
	.ap-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}
	.ap-row__label {
		color: #fff;
		font-family: 'Inter', sans-serif;
		font-weight: 700;
		font-size: clamp(0.9rem, 3vmin, 1.25rem); /* 20px @ design */
		line-height: 1;
		letter-spacing: 0.03em; /* 3% */
		text-shadow: 0 2px 4px rgba(0, 0, 0, 0.6);
	}

	/* Animated switch — colours from the design SVGs (off #605553, on #C51F0B→#AF190A). */
	.ap-switch {
		flex: 0 0 auto;
		position: relative;
		width: clamp(50px, 9vmin, 62px);
		aspect-ratio: 62 / 34;
		padding: 0;
		border: none;
		border-radius: 999px;
		background: #605553;
		cursor: pointer;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4) inset;
		transition: background 0.22s ease;
	}
	.ap-switch.on {
		background: linear-gradient(180deg, #c51f0b 0%, #af190a 100%);
	}
	.ap-switch__knob {
		position: absolute;
		top: 50%;
		left: 7.1%; /* off: knob near the left edge */
		transform: translateY(-50%);
		height: 71.6%;
		aspect-ratio: 1;
		border-radius: 50%;
		background: #fff;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.45);
		transition: left 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
	}
	.ap-switch.on .ap-switch__knob {
		left: 53.6%; /* on: knob near the right edge */
	}

	/* START AUTOPLAY button (Figma art). */
	.ap-start {
		width: 66%;
		align-self: center;
		aspect-ratio: 317 / 50;
		margin-top: clamp(2px, 0.8vmin, 6px);
		padding: 0;
		border: none;
		background: transparent center / contain no-repeat;
		cursor: pointer;
		transition:
			filter 0.12s ease,
			transform 0.08s ease;
	}
	.ap-start:hover {
		filter: brightness(1.06);
	}
	.ap-start:active {
		transform: scale(0.98);
	}
</style>
