<script lang="ts" module>
	import { ap } from '../lib/preloadArt';

	const iconMinus = ap('/assets/theme-park/v2/hud/icon_minus.svg');
	const iconPlus = ap('/assets/theme-park/v2/hud/icon_plus.svg');
</script>

<script lang="ts">
	import { stateBet } from 'state-shared';
	import { getContext } from '../game/context';
	import { i18nDerived } from '../i18n/i18nDerived';
	import PopupFrame from './PopupFrame.svelte';

	type Props = { onclose: () => void };
	const props: Props = $props();
	const context = getContext();
	const t = (key: string) => i18nDerived.translate(key);

	// The design replaces the old 7-button grid with a -/+ stepper (nodes 6045:4633-4634). The steps
	// are the same values the grid offered, with the unlimited option kept as the final step so the
	// layout change does not quietly drop a feature — the design has no second "unlimited" button.
	const STEPS: (number | typeof Infinity)[] = [5, 10, 25, 50, 100, 200, 500, Infinity];
	let stepIndex = $state(2);
	const selected = $derived(STEPS[stepIndex]);
	const selectedLabel = $derived(selected === Infinity ? '∞' : `${selected}`);

	let stopOnBonus = $state(context.stateGame.stopAutoOnBonus);
	const isTurbo = $derived(stateBet.isTurbo && !stateBet.isSuperTurbo);
	const isSuperTurbo = $derived(stateBet.isSuperTurbo);

	const toggleTurbo = () => {
		if (isTurbo) stateBet.isTurbo = false;
		else {
			stateBet.isTurbo = true;
			stateBet.isSuperTurbo = false;
		}
	};
	const toggleSuperTurbo = () => {
		if (isSuperTurbo) stateBet.isSuperTurbo = false;
		else {
			stateBet.isSuperTurbo = true;
			stateBet.isTurbo = false;
		}
	};

	const start = () => {
		context.stateGame.stopAutoOnBonus = stopOnBonus;
		if (
			stateBet.activeBetModeKey === 'DUCK' ||
			stateBet.activeBetModeKey === 'ROLLER' ||
			stateBet.activeBetModeKey === 'COASTER'
		) {
			stateBet.activeBetModeKey = 'BASE';
		}
		stateBet.autoSpinsCounter = selected;
		props.onclose();
		context.eventEmitter.broadcast({ type: 'autoBet' });
	};

	const ROWS = $derived([
		{ label: t('TURBO SPIN'), on: isTurbo, toggle: toggleTurbo },
		{ label: t('SUPER TURBO SPIN'), on: isSuperTurbo, toggle: toggleSuperTurbo },
		{ label: t('STOP ON BONUS'), on: stopOnBonus, toggle: () => (stopOnBonus = !stopOnBonus) },
	]);
</script>

<PopupFrame variant="wide" ondismiss={props.onclose} dismissLabel={t('CLOSE AUTOPLAY')}>
	<div class="auto__rows">
		{#each ROWS as row (row.label)}
			<div class="auto__row">
				<span class="auto__row-label tp-popup__label">{row.label}</span>
				<button
					class="tp-popup__toggle"
					type="button"
					aria-pressed={row.on}
					aria-label={row.label}
					onclick={row.toggle}
				></button>
			</div>
		{/each}
	</div>

	<p class="auto__spins-label tp-popup__label">{t('NUMBER OF SPINS')}</p>

	<div class="auto__stepper">
		<button
			class="auto__step auto__step--minus"
			type="button"
			disabled={stepIndex === 0}
			aria-label={i18nDerived.translate('DECREASE BET')}
			onclick={() => (stepIndex = Math.max(0, stepIndex - 1))}
		>
			<img class="auto__step-glyph auto__step-glyph--minus" src={iconMinus} alt="" />
		</button>

		<span class="auto__count">{selectedLabel}</span>

		<button
			class="auto__step auto__step--plus"
			type="button"
			disabled={stepIndex === STEPS.length - 1}
			aria-label={i18nDerived.translate('INCREASE BET')}
			onclick={() => (stepIndex = Math.min(STEPS.length - 1, stepIndex + 1))}
		>
			<img class="auto__step-glyph auto__step-glyph--plus" src={iconPlus} alt="" />
		</button>
	</div>

	<button class="auto__start tp-popup__btn tp-popup__btn--primary" type="button" onclick={start}>
		{t('START')} {t('AUTOPLAY')} ({selectedLabel})
	</button>
</PopupFrame>

<style>
	/* Spacing is the Figma frame's own (7063:18400), converted from absolute positions to flow so a
	   wrapped row label or a long "START AUTOPLAY" caption pushes the layout instead of overlapping
	   it. PopupFrame supplies the 42 / 69.5 / 36 padding that puts the first row where the design
	   has it; the panel has no heading. */

	/* Toggle rows: 494 wide (of 633), 16 apart (node 7063:18402). */
	.auto__rows {
		width: 100%;
		display: flex;
		flex-direction: column;
		gap: calc(16 / var(--pop-w) * 100cqw);
	}

	.auto__row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: calc(16 / var(--pop-w) * 100cqw);
		width: 100%;
	}

	/* 245 of the 494 row — a fixed column so the toggles line up whatever the translation. */
	.auto__row-label {
		flex: 0 1 49.595%;
	}

	/* NUMBER OF SPINS: its caps sit at 231 and the rows end at 173.64. Nunito Sans at 20/normal
	   carries 6.1 of leading above its caps, so the line box starts at 224.9 — 51.26 down. */
	.auto__spins-label {
		margin-top: calc(51.26 / var(--pop-w) * 100cqw);
		text-align: center;
	}

	/* Stepper: two 48.696 circles 89.3 apart, centred, with the count between them (node
	   7063:18416). Its top is 275, i.e. 22.8 below the label's 27.28-tall line box. */
	.auto__stepper {
		margin-top: calc(22.8 / var(--pop-w) * 100cqw);
		display: flex;
		align-items: center;
		justify-content: center;
		gap: calc(16.65 / var(--pop-w) * 100cqw);
	}

	/* Same chrome as the HUD's icon buttons, rim included: the "Icon buttons" component strokes
	   itself with the brand sweep rather than a flat hairline — see <PopupCloseButton>. */
	.auto__step {
		flex: 0 0 auto;
		width: calc(48.696 / var(--pop-w) * 100cqw);
		height: calc(48.696 / var(--pop-w) * 100cqw);
		padding: 0;
		box-sizing: border-box;
		border: 1px solid transparent;
		border-radius: 9999px;
		background:
			linear-gradient(0deg, #1a0535 0%, #000 100%) padding-box,
			linear-gradient(135deg, #d836fc 0%, #272fdd 100%) border-box;
		/* Resting rim glow, the same one .nav-btn carries in the HUD (design ask, 2026-08-26), in
		   the panel's own design unit so the halo scales with the button. */
		box-shadow:
			0 0 calc(5 / var(--pop-w) * 100cqw) calc(0.5 / var(--pop-w) * 100cqw)
				rgba(197, 106, 255, 0.5),
			0 0 calc(14 / var(--pop-w) * 100cqw) calc(2 / var(--pop-w) * 100cqw)
				rgba(124, 48, 221, 0.32);
		display: grid;
		place-items: center;
		cursor: pointer;
		transition:
			filter 0.12s ease,
			box-shadow 0.12s ease;
	}

	/* Behind `hover: hover`: a touch tap latches :hover on whatever it hit, and a latched bloom
	   reads as a stuck selection. Same reasoning as .nav-btn's hover rule. */
	@media (hover: hover) {
		.auto__step:not(:disabled):hover {
			filter: brightness(1.2);
			box-shadow:
				0 0 calc(9 / var(--pop-w) * 100cqw) calc(1.5 / var(--pop-w) * 100cqw)
					rgba(160, 96, 246, 0.85);
		}
	}

	.auto__step:disabled {
		opacity: 0.4;
		cursor: default;
	}

	.auto__step-glyph--minus {
		width: calc(13.854 / var(--pop-w) * 100cqw);
		height: calc(2.13 / var(--pop-w) * 100cqw);
	}

	.auto__step-glyph--plus {
		width: calc(13.854 / var(--pop-w) * 100cqw);
		height: calc(13.854 / var(--pop-w) * 100cqw);
	}

	/* Inter Bold 32 (node 7063:18419). Fixed width so stepping 5 -> 500 does not shuffle the buttons. */
	.auto__count {
		flex: 0 0 auto;
		min-width: calc(56 / var(--pop-w) * 100cqw);
		text-align: center;
		font-family: 'Inter', sans-serif;
		font-weight: 700;
		font-size: calc(32 / var(--pop-w) * 100cqw);
		letter-spacing: 0.03em;
		line-height: 1;
		color: #fff;
		white-space: nowrap;
	}

	/* Full-width action, 494 of 633 (node 7063:18415). */
	.auto__start {
		margin-top: auto;
		width: 100%;
		flex: 0 0 auto;
		white-space: nowrap;
	}
</style>
