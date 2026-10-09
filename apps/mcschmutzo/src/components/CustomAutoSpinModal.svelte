<script lang="ts" module>
	// Module scope so the art preloads during the loading screen (the modal mounts on demand).
	import { ap } from '../lib/preloadArt';

	const frameArt = ap('/assets/mcschmutzo/popup/autospin-frame.svg');
	const minusArt = ap('/assets/mcschmutzo/autoplay/minus.svg');
	const plusArt = ap('/assets/mcschmutzo/autoplay/plus-icon.svg');
	const closeArt = ap('/assets/mcschmutzo/win/x-button.webp');
</script>

<script lang="ts">
	import { fade } from 'svelte/transition';
	import { popIn, popOut } from '../lib/popOut';
	import PopupScrews from './PopupScrews.svelte';
	import { onMount } from 'svelte';
	import { stateBet, stateConfig } from 'state-shared';
	import { getContext } from '../game/context';
	import { i18nDerived } from '../i18n/i18nDerived';

	type Props = { onclose: () => void };
	const props: Props = $props();
	const context = getContext();

	// Close on Escape, matching the buy-bonus / info modals.
	onMount(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') props.onclose();
		};
		window.addEventListener('keydown', onKeyDown);
		return () => window.removeEventListener('keydown', onKeyDown);
	});

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
		if (stateConfig.jurisdiction?.disabledAutoplay) {
			props.onclose();
			return;
		}
		context.eventEmitter.broadcast({ type: 'soundPressBet' });
		// Buy modes are one-shot. Autospin must never inherit a previous BONUS/SUPER purchase.
		if (stateBet.activeBetModeKey === 'bonus1' || stateBet.activeBetModeKey === 'bonus2') {
			stateBet.activeBetModeKey = 'base';
		}
		stateBet.autoSpinsCounter = count;
		props.onclose();
		context.eventEmitter.broadcast({ type: 'autoBet' });
	};

	// Jurisdiction flags: disabledTurbo removes both speed-ups, disabledSuperTurbo only the second.
	const turboAllowed = $derived(!stateConfig.jurisdiction?.disabledTurbo);
	const superTurboAllowed = $derived(turboAllowed && !stateConfig.jurisdiction?.disabledSuperTurbo);
	const TOGGLES = $derived([
		...(turboAllowed
			? [{ label: i18nDerived.translate('TURBO SPIN'), on: isTurbo, onclick: toggleTurbo }]
			: []),
		...(superTurboAllowed
			? [{ label: i18nDerived.translate('SUPER TURBO SPIN'), on: isSuperTurbo, onclick: toggleSuperTurbo }]
			: []),
		{ label: i18nDerived.translate('LOCK FEATURE SPIN'), on: isFeature, onclick: toggleFeature },
	]);

	// The design's lettering is sized for "AUTO SPIN" / "START AUTOPLAY": longer localized words shrink
	// to the frame instead of overflowing it.
	const longestWord = (text: string) => Math.max(1, ...text.split(/\s+/).map((w) => w.length));
	const titleText = $derived(i18nDerived.translate('AUTO SPIN'));
	const startText = $derived(i18nDerived.translate('START AUTOPLAY'));
	const titleFit = $derived(Math.min(1, 9.5 / longestWord(titleText)));
	const startFit = $derived(Math.min(1, 17 / startText.length));
</script>

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div class="ap-backdrop" in:fade|global={{ duration: 220 }} out:fade|global={{ duration: 200 }} onclick={props.onclose}></div>

<button
	in:fade|global={{ duration: 220, delay: 200 }}
	out:fade|global={{ duration: 120 }}
	class="ap-close"
	type="button"
	style={`background-image:url('${closeArt}')`}
	onclick={props.onclose}
	aria-label={i18nDerived.translate('CLOSE')}
></button>

<!-- Figma 8888:19398 (437x594): cream body + red header under the drawn frame, a dashed rule, the
     toggle rows, the spin counter and the red START button, all laid out in design px (--u). -->
<div class="ap-root" in:popIn|global out:popOut|global role="dialog" aria-modal="true" aria-label={titleText}>
	<div class="ap-popup">
		<div class="ap-body" aria-hidden="true"></div>
		<div class="ap-head" aria-hidden="true"></div>
		<img class="ap-frame" src={frameArt} alt="" draggable="false" />
		<PopupScrews frame="autospin" />
		<div class="ap-dash" aria-hidden="true"></div>

		<p class="ap-title" style={`--fit:${titleFit}`}>{titleText}</p>

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
			<p class="ap-spins-label">{i18nDerived.translate('NUMBER OF SPINS')}:</p>
			<div class="ap-counter">
				<button
					class="ap-step"
					type="button"
					style={`background-image:url('${minusArt}')`}
					onclick={() => step(-1)}
					disabled={stopIndex === 0}
					aria-label={i18nDerived.translate('FEWER SPINS')}
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
					aria-label={i18nDerived.translate('MORE SPINS')}
				></button>
			</div>
		</div>

		<button class="ap-start" type="button" onclick={start} aria-label={startText}>
			<span class="ap-start__label" style={`--fit:${startFit}`}>{startText}</span>
		</button>
	</div>
</div>

<style>
	.ap-backdrop {
		position: fixed;
		inset: 0;
		z-index: 58;
		background: rgba(0, 0, 0, 0.74);
		backdrop-filter: blur(4px);
	}

	/* Width follows the design's aspect so the whole dialog fits short (landscape) screens too. */
	.ap-root {
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		z-index: 59;
		width: min(437px, 92vw, calc(92dvh * 437 / 594));
		container-type: inline-size;
		font-family: 'Nunito', sans-serif;
	}
	.ap-popup {
		--u: calc(100cqw / 437);
		position: relative;
		width: 100%;
		aspect-ratio: 437 / 594;
		filter: drop-shadow(0 calc(14 * var(--u)) calc(24 * var(--u)) rgba(0, 0, 0, 0.5));
	}
	.ap-body {
		position: absolute;
		inset: calc(98 * var(--u)) calc(13.07 * var(--u)) calc(13.07 * var(--u)) calc(13 * var(--u));
		background: #f9dca6;
	}
	.ap-head {
		position: absolute;
		top: calc(5 * var(--u));
		left: calc(11 * var(--u));
		right: calc(16 * var(--u));
		height: calc(106 * var(--u));
		background: #b1190a;
	}
	.ap-frame {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
	}
	.ap-dash {
		position: absolute;
		top: calc(125 * var(--u));
		left: calc(20 * var(--u));
		width: calc(397 * var(--u));
		height: calc(2 * var(--u));
		background: repeating-linear-gradient(
			90deg,
			#b11909 0 calc(14 * var(--u)),
			transparent calc(14 * var(--u)) calc(28 * var(--u))
		);
	}

	.ap-title {
		position: absolute;
		top: calc(5 * var(--u));
		left: calc(30 * var(--u));
		right: calc(30 * var(--u));
		height: calc(106 * var(--u));
		margin: 0;
		display: grid;
		place-items: center;
		text-align: center;
		color: #e7d5b7;
		font-family: var(--font-brush);
		-webkit-text-stroke: var(--brush-stroke) currentColor;
		font-weight: 400;
		font-size: calc(48 * var(--u) * var(--fit, 1));
		line-height: 1;
		letter-spacing: calc(2.29 * var(--u) * var(--fit, 1));
		text-transform: uppercase;
		overflow-wrap: break-word;
	}

	/* Toggle rows: 321 wide from y 165, 16 apart; Nunito Black 20, black. */
	.ap-toggles {
		position: absolute;
		top: calc(165 * var(--u));
		left: calc(67 * var(--u));
		width: calc(321 * var(--u));
		display: flex;
		flex-direction: column;
		gap: calc(16 * var(--u));
	}
	.ap-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: calc(12 * var(--u));
		min-height: calc(33.2 * var(--u));
	}
	.ap-row__label {
		min-width: 0;
		color: #000;
		font-weight: 900;
		font-size: calc(20 * var(--u));
		line-height: 1.1;
		letter-spacing: calc(0.6 * var(--u));
		text-transform: uppercase;
	}

	/* Switch from the design SVGs: off #605553, on #C51F0B→#AF190A, knob white with a black ring. */
	.ap-switch {
		flex: 0 0 auto;
		position: relative;
		width: calc(62 * var(--u));
		height: calc(33.2 * var(--u));
		padding: 0;
		border: none;
		border-radius: 999px;
		background: #605553;
		cursor: pointer;
		transition: background 0.22s ease;
	}
	.ap-switch.on {
		background: linear-gradient(0deg, #c51f0b 0%, #af190a 100%);
	}
	.ap-switch__knob {
		position: absolute;
		top: 50%;
		left: calc(4.4 * var(--u));
		width: calc(24.4 * var(--u));
		aspect-ratio: 1;
		box-sizing: border-box;
		transform: translateY(-50%);
		border: calc(2 * var(--u)) solid #000;
		border-radius: 50%;
		background: #fff;
		transition: left 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
	}
	.ap-switch.on .ap-switch__knob {
		left: calc(33.2 * var(--u));
	}

	/* Spin counter: red brush label over  −  [ value ]  +  (y 366–466). */
	.ap-counter-group {
		position: absolute;
		top: calc(366 * var(--u));
		left: calc(30 * var(--u));
		right: calc(30 * var(--u));
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: calc(22 * var(--u));
	}
	.ap-spins-label {
		margin: 0;
		text-align: center;
		color: #b11909;
		font-family: var(--font-brush);
		-webkit-text-stroke: var(--brush-stroke) currentColor;
		font-weight: 400;
		font-size: calc(23.9 * var(--u));
		line-height: 1.2;
		text-transform: uppercase;
	}
	.ap-counter {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: calc(11 * var(--u));
	}
	.ap-step {
		flex: 0 0 auto;
		width: calc(48 * var(--u));
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
	.ap-counter-box {
		width: calc(150 * var(--u));
		height: calc(49 * var(--u));
		display: grid;
		place-items: center;
		box-sizing: border-box;
		border: max(0.5px, calc(0.44 * var(--u))) solid #fff;
		border-radius: calc(6.7 * var(--u));
		background: #292624;
		box-shadow: inset 0 0 calc(6.2 * var(--u)) #000;
	}
	/* the design sets the count in the brush face too (8888:19439), without the stroke */
	.ap-count {
		color: #e7d5b7;
		font-family: var(--font-brush);
		font-weight: 400;
		font-size: calc(41.6 * var(--u));
		line-height: 1;
		letter-spacing: calc(2.36 * var(--u));
	}

	/* START AUTOPLAY (317x50 at y 508): red gradient, inner #851406 rim, white glint. */
	.ap-start {
		position: absolute;
		top: calc(508 * var(--u));
		left: calc(60 * var(--u));
		width: calc(317 * var(--u));
		height: calc(50 * var(--u));
		display: grid;
		place-items: center;
		padding: 0 calc(16 * var(--u));
		border: none;
		border-radius: calc(12 * var(--u));
		background: linear-gradient(97deg, #c41e0a 49.3%, #ae1809 99%);
		box-shadow: 0 calc(3 * var(--u)) calc(7 * var(--u)) rgba(0, 0, 0, 0.35);
		cursor: pointer;
		transition:
			filter 0.12s ease,
			transform 0.08s ease;
	}
	.ap-start::before {
		content: '';
		position: absolute;
		left: calc(6.5 * var(--u));
		top: calc(4.5 * var(--u));
		width: calc(304 * var(--u));
		height: calc(41 * var(--u));
		box-sizing: border-box;
		border: calc(2 * var(--u)) solid #851406;
		border-radius: calc(10 * var(--u));
		pointer-events: none;
	}
	.ap-start::after {
		content: '';
		position: absolute;
		top: calc(4 * var(--u));
		left: calc(12 * var(--u));
		width: calc(186 * var(--u));
		height: calc(1.2 * var(--u));
		background: linear-gradient(90deg, rgba(255, 255, 255, 0), #fff 50%, rgba(255, 255, 255, 0));
		pointer-events: none;
	}
	.ap-start__label {
		position: relative;
		color: #feefcf;
		font-family: var(--font-brush);
		-webkit-text-stroke: var(--brush-stroke) currentColor;
		font-weight: 400;
		font-size: calc(20 * var(--u) * var(--fit, 1));
		line-height: 1;
		letter-spacing: 0.03em;
		text-transform: uppercase;
		white-space: nowrap;
	}
	.ap-start:hover {
		filter: brightness(1.06);
	}
	.ap-start:active {
		transform: scale(0.98);
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
	/* Narrow phones and short screens: the smaller X used on the buy-bonus / info popups. */
	@media (max-width: 480px), (max-height: 500px) {
		/* a smaller card on phones (at 92% of the height it filled the landscape screen) */
		.ap-root {
			width: min(437px, 80vw, calc(80dvh * 437 / 594));
		}
		.ap-close {
			width: clamp(28px, 8vmin, 40px);
			top: 8px;
			right: 8px;
		}
	}
</style>
