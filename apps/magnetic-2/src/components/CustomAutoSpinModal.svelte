<script lang="ts" module>
	// The panel is DRAWN, not art (Figma 4036:2458, plate node 9019:15303): a flat #3A3981 rounded
	// rectangle, 550x423 design px. Every measurement in the style block below is a fraction of that
	// WIDTH, expressed in cqw against the plate's own container.
	//
	// The old `autospin_panel.webp` was the Version2 blue-steel frame, and once the confirm dialogs
	// and the HUD moved to the MOTHERSHIP palette it was the last thing in the game still wearing the
	// previous theme. It is deleted, along with the preload entry it needed.

	// Nothing to preload any more. LoadingController still imports this, so it stays as an empty
	// list rather than becoming a dangling import.
	export const AUTOSPIN_MODAL_IMAGES: string[] = [];
</script>

<script lang="ts">
	import {
		stateBet,
		stateUi,
		LOSS_LIMIT_TEXT_OPTIONS,
		SINGLE_WIN_LIMIT_TEXT_OPTIONS,
		AUTO_SPINS_LOSS_LIMIT_MULTIPLIER_MAP,
		AUTO_SPINS_SINGLE_WIN_LIMIT_MULTIPLIER_MAP,
	} from 'state-shared';
	import { getContext } from '../game/context';
	import { i18nDerived } from '../i18n/i18nDerived';

	const t = (k: string) => i18nDerived.translate(k);

	type Props = { onclose: () => void };
	const props: Props = $props();
	const context = getContext();

	// Spin-count stops (last = unlimited), stepped with − / + per the Figma design.
	const STOPS: Array<number> = [5, 10, 25, 50, 100, 250, 500, Infinity];
	let stopIndex = $state(4); // default 100
	const count = $derived(STOPS[stopIndex]);
	const countLabel = $derived(count === Infinity ? '∞' : `${count}`);
	const disableDec = $derived(stopIndex <= 0);
	const disableInc = $derived(stopIndex >= STOPS.length - 1);
	const step = (dir: -1 | 1) => {
		context.eventEmitter.broadcast({ type: 'soundPressGeneral' });
		stopIndex = Math.min(STOPS.length - 1, Math.max(0, stopIndex + dir));
	};

	// Autoplay stop limits. Stake requires an autoplay run to be stoppable on loss and on a single
	// win, and the shared auto-bet machine already enforces both — but it reads
	// stateBet.autoSpinsLossLimitAmount / autoSpinsSingleWinLimitAmount, which only the SHARED
	// start button ever set. This custom panel replaced that button and set neither, so both stayed
	// at their Infinity default and neither limit could ever fire. Same two option lists and the
	// same bet-amount multiplication as AutoSpinsStartButton, stepped like the spin counter above.
	const LOSS_STOPS = LOSS_LIMIT_TEXT_OPTIONS;
	const WIN_STOPS = SINGLE_WIN_LIMIT_TEXT_OPTIONS;
	let lossIndex = $state(LOSS_STOPS.length - 1); // default ∞
	let winIndex = $state(WIN_STOPS.length - 1); // default ∞
	const lossLabel = $derived(LOSS_STOPS[lossIndex]);
	const winLabel = $derived(WIN_STOPS[winIndex]);
	const stepLoss = (dir: -1 | 1) => {
		context.eventEmitter.broadcast({ type: 'soundPressGeneral' });
		lossIndex = Math.min(LOSS_STOPS.length - 1, Math.max(0, lossIndex + dir));
	};
	const stepWin = (dir: -1 | 1) => {
		context.eventEmitter.broadcast({ type: 'soundPressGeneral' });
		winIndex = Math.min(WIN_STOPS.length - 1, Math.max(0, winIndex + dir));
	};

	// Live game-state toggles (mirror the HUD)
	const isTurbo = $derived(stateBet.isTurbo && !stateBet.isSuperTurbo);
	const isSuperTurbo = $derived(stateBet.isSuperTurbo);
	const isFeature = $derived(stateBet.activeBetModeKey === 'FEATURE');

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
		stateBet.activeBetModeKey = isFeature ? 'BASE' : 'FEATURE';
	};

	const start = () => {
		context.eventEmitter.broadcast({ type: 'soundPressBet' });
		stateBet.autoSpinsCounter = count;
		// Multiplied by the bet the run starts on, exactly as the shared start button does — the
		// option lists are bet multiples ("25×"), not currency amounts.
		stateUi.autoSpinsLossLimitText = lossLabel;
		stateUi.autoSpinsSingleWinLimitText = winLabel;
		stateBet.autoSpinsLossLimitAmount =
			stateBet.betAmount * AUTO_SPINS_LOSS_LIMIT_MULTIPLIER_MAP[lossLabel];
		stateBet.autoSpinsSingleWinLimitAmount =
			stateBet.betAmount * AUTO_SPINS_SINGLE_WIN_LIMIT_MULTIPLIER_MAP[winLabel];
		props.onclose();
		context.eventEmitter.broadcast({ type: 'autoBet' });
	};
</script>

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div class="ap-backdrop" onclick={props.onclose}></div>

<button class="ap-close" type="button" onclick={props.onclose} aria-label="Close">
	<span class="glyph glyph--close"></span>
</button>

<div class="ap-root" role="dialog" aria-modal="true">
	<div class="ap-panel">
		<div class="ap-toggles">
			<div class="ap-row">
				<span class="ap-row__label">{t('AUTO TURBO')}</span>
				<button class="ap-switch" class:on={isTurbo} type="button" onclick={toggleTurbo} aria-pressed={isTurbo}>
					<span class="ap-switch__thumb"></span>
				</button>
			</div>
			<div class="ap-row">
				<span class="ap-row__label">{t('AUTO SUPER TURBO')}</span>
				<button class="ap-switch" class:on={isSuperTurbo} type="button" onclick={toggleSuperTurbo} aria-pressed={isSuperTurbo}>
					<span class="ap-switch__thumb"></span>
				</button>
			</div>
			<div class="ap-row">
				<span class="ap-row__label">{t('AUTO FEATURE')}</span>
				<button class="ap-switch" class:on={isFeature} type="button" onclick={toggleFeature} aria-pressed={isFeature}>
					<span class="ap-switch__thumb"></span>
				</button>
			</div>
		</div>

		<div class="ap-limits">
			<p class="ap-spins-label">{t('AUTO NUM SPINS')}</p>

			<div class="ap-stepper">
				<button class="ap-icon-btn" type="button" disabled={disableDec} onclick={() => step(-1)} aria-label="Fewer spins">
					<span class="glyph glyph--minus"></span>
				</button>
				<span class="ap-count">{countLabel}</span>
				<button class="ap-icon-btn" type="button" disabled={disableInc} onclick={() => step(1)} aria-label="More spins">
					<span class="glyph glyph--plus"></span>
				</button>
			</div>

			<p class="ap-spins-label">{t('AUTO LOSS LIMIT')}</p>

			<div class="ap-stepper">
				<button class="ap-icon-btn" type="button" disabled={lossIndex <= 0} onclick={() => stepLoss(-1)} aria-label="Lower loss limit">
					<span class="glyph glyph--minus"></span>
				</button>
				<span class="ap-count">{lossLabel}</span>
				<button class="ap-icon-btn" type="button" disabled={lossIndex >= LOSS_STOPS.length - 1} onclick={() => stepLoss(1)} aria-label="Raise loss limit">
					<span class="glyph glyph--plus"></span>
				</button>
			</div>

			<p class="ap-spins-label">{t('AUTO WIN LIMIT')}</p>

			<div class="ap-stepper">
				<button class="ap-icon-btn" type="button" disabled={winIndex <= 0} onclick={() => stepWin(-1)} aria-label="Lower single win limit">
					<span class="glyph glyph--minus"></span>
				</button>
				<span class="ap-count">{winLabel}</span>
				<button class="ap-icon-btn" type="button" disabled={winIndex >= WIN_STOPS.length - 1} onclick={() => stepWin(1)} aria-label="Raise single win limit">
					<span class="glyph glyph--plus"></span>
				</button>
			</div>
		</div>

		<button class="ap-start" type="button" onclick={start}>
			{t('AUTO START')} ({countLabel})
		</button>
	</div>
</div>

<style>
	.ap-backdrop {
		position: fixed;
		inset: 0;
		z-index: 58;
		background: rgba(0, 0, 0, 0.7);
		backdrop-filter: blur(4px);
	}

	/* 550px is the design plate's own width and 45.8vw is its share of the design frame (550 of
	   1200), so on screens wider than the design the dialog keeps its intended presence instead of
	   shrinking away; 94vw / 104vh keep it inside small or portrait viewports. */
	.ap-root {
		/* The height cap was 104vh against the old 550x423 plate. The panel now carries two more
		   stepper blocks (the loss and single-win stop limits), so it is taller than it is wide and
		   the cap has to come down with it or a short viewport clips the START button. */
		--ap-w: min(94vw, 62vh, max(550px, 45.8vw));
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		z-index: 59;
		width: var(--ap-w);
		font-family: 'Chakra Petch', 'Inter', sans-serif;
	}

	/* The plate. Flow layout at the design's own vertical rhythm rather than absolute percentages of
	   a fixed-aspect bitmap: the rows, the label, the stepper and the button are a stack, and a
	   measured stack survives a longer translation without overlapping itself.
	   Design 4036:2458 / plate 9019:15303 — 550x423, radius 14, fill #3A3981 over a #2D2C69 edge,
	   which is the same plate the three confirm dialogs wear. */
	.ap-panel {
		container-type: inline-size;
		position: relative;
		display: flex;
		flex-direction: column;
		padding: 5.09cqw 5.09cqw 6.36cqw;
		/* Last-resort guard: a very short window (or a long translation) must scroll the panel, not
		   push START off the bottom where it cannot be pressed. */
		max-height: 94vh;
		overflow-y: auto;
		background: #3a3981;
		border: 0.44cqw solid #2d2c69;
		border-radius: 2.55cqw;
		box-shadow: 0 1.6cqw 3.6cqw rgba(0, 0, 0, 0.5);
	}

	/* Figma 4036:2490 — three rows 33.214 tall, 16 apart. */
	.ap-toggles {
		display: flex;
		flex-direction: column;
		gap: 2.91cqw;
	}

	.ap-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 2cqw;
		height: 6.04cqw;
	}

	/* Chakra Petch Bold 20px white (20 / 550). */
	.ap-row__label {
		font-weight: 700;
		/* max() is a FLOOR: the plate's sizes are shares of its width, and a narrow plate (a phone in
		   portrait, a popout) took them below the point where they can be read. */
		font-size: max(12px, 3.64cqw);
		letter-spacing: 0.02em;
		color: #fff;
		text-transform: uppercase;
	}

	/* Toggle: 62 x 33.214, radius 999. OFF is near-black, ON is the design's lavender #A88EFF — the
	   same accent the START button and the confirm dialogs' primary button carry. */
	.ap-switch {
		font-size: inherit;
		flex: 0 0 auto;
		position: relative;
		width: 11.27cqw;
		height: 6.04cqw;
		border-radius: 999px;
		border: none;
		background: #0e1306;
		cursor: pointer;
		padding: 0;
		transition: background 0.2s ease;
	}
	.ap-switch.on {
		background: #a88eff;
	}
	.ap-switch__thumb {
		position: absolute;
		top: 0.62cqw;
		left: 0.62cqw;
		width: 4.8cqw;
		height: 4.8cqw;
		border-radius: 50%;
		background: #fff;
		transition: left 0.2s ease;
	}
	.ap-switch.on .ap-switch__thumb {
		left: 5.85cqw;
	}

	/* Figma 4036:2489 — Chakra Petch Bold 20px white, 48.4 design px below the last toggle row. */
	.ap-spins-label {
		/* 8.8cqw was the design's single-block rhythm. With three blocks it triples, so the leading
		   gap is halved and the first block keeps a little more air (rule below). */
		margin: 4.4cqw 0 0;
		text-align: center;
		font-weight: 700;
		font-size: max(12px, 3.64cqw);
		/* The design gives this line a 30px box against a 20px face. Left at the browser's default
		   the stack comes up ~6 design px short and the plate ends up proportionally wider than
		   550x423, which shows as a slack margin under the START button. */
		line-height: 1.5;
		letter-spacing: 0.02em;
		color: #fff;
		text-transform: uppercase;
	}

	.ap-spins-label:first-of-type {
		margin-top: 7.2cqw;
	}

	/* − [count] + — 48.696 circles, 138 design px apart centre to centre. */
	.ap-stepper {
		margin-top: 2.2cqw;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0;
	}

	/* Figma "Icon buttons": 48.696 circle, #49489B fill, lavender border, white glyph. The design's
	   render rings the − button in white rather than lavender because it is drawn at the minimum
	   spin count — that is the disabled state below, not a second style. */
	.ap-icon-btn {
		/* buttons do NOT inherit font-size — without this the em box collapses to Chrome's 13.3px */
		font-size: inherit;
		width: 8.85cqw;
		height: 8.85cqw;
		flex-shrink: 0;
		padding: 0;
		border-radius: 50%;
		border: 0.22cqw solid #a88eff;
		background: #49489b;
		display: grid;
		place-items: center;
		cursor: pointer;
		transition: filter 0.12s ease;
	}
	.ap-icon-btn:hover:not(:disabled) {
		filter: brightness(1.35);
	}
	.ap-icon-btn:disabled {
		border-color: rgba(255, 255, 255, 0.5);
		opacity: 0.55;
		cursor: default;
	}

	/* Glyphs are drawn rather than imported: the design's are plain white strokes. */
	.glyph {
		position: relative;
		display: block;
		width: 3.1cqw;
		height: 0.48cqw;
		border-radius: 0.48cqw;
		background: #fff;
	}
	.glyph--plus::after,
	.glyph--close::before,
	.glyph--close::after {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: inherit;
		background: inherit;
	}
	.glyph--plus::after {
		transform: rotate(90deg);
	}
	/* The close button sits OUTSIDE the plate, so its glyph cannot use cqw — there is no container
	   query context out there. It is sized in em off the button's own font-size instead. */
	.glyph--close {
		width: 1.155em;
		height: 0.133em;
		border-radius: 0.133em;
		background: none;
	}
	.glyph--close::before {
		background: #fff;
		transform: rotate(45deg);
	}
	.glyph--close::after {
		background: #fff;
		transform: rotate(-45deg);
	}

	/* Figma 4036:2488 — Bold 32px white. The count is a FIXED slot as wide as the design's gap
	   between the two button edges, so 3-digit values and ∞ never shift the − / + off their marks. */
	.ap-count {
		width: 16.2cqw;
		text-align: center;
		color: #fff;
		font-weight: 700;
		font-size: max(19px, 5.82cqw);
		line-height: 1;
	}

	/* Figma 4036:2503 — flat #A88EFF, radius 8, the content box's full width, 44 tall, 40.3 below the
	   stepper. Its label is AUDIOWIDE: the design sets it in the same face as the HUD's numerals, and
	   it is the only text in this dialog that is. Regular is the family's only weight, so asking for
	   bold here would get a synthesised smear. */
	.ap-start {
		margin-top: 5.2cqw;
		/* A MINIMUM height, not a fixed one: a label that has to wrap (a long translation, or any
		   language in the half-width Popout-S column) grew out of a fixed 8cqw box and drew its
		   second line across the plate's bottom edge. */
		min-height: 8cqw;
		height: auto;
		padding: 0.55em 0.9em;
		line-height: 1.15;
		text-wrap: balance;
		border: none;
		border-radius: 1.45cqw;
		background: #a88eff;
		color: #fff;
		font-family: 'Audiowide', 'Chakra Petch', 'Inter', sans-serif;
		font-weight: 400;
		font-size: max(13px, 2.9cqw);
		letter-spacing: 0.12em;
		text-transform: uppercase;
		cursor: pointer;
		transition: filter 0.12s ease;
	}
	.ap-start:hover {
		filter: brightness(1.08);
	}
	.ap-start:active {
		filter: brightness(0.94);
	}

	/* The design places the close button at the top-right of the whole screen, not on the panel.
	   Sized against the viewport — a fixed-px button takes a huge bite out of a phone screen (user
	   pass 2026-08-10) — with the design's 48px as the cap. */
	.ap-close {
		/* Width-only sizing gave a short popout the phone's button: 34px on a 225px-tall Popout-S
		   and the full 48px on Popout-L. The 7vh term brings those to 22 / ~36px; tall windows keep
		   the design's 48. */
		--ap-close: clamp(22px, min(8.5vw, 7vh), 48px);
		position: fixed;
		top: clamp(8px, min(3vw, 3vh), 22px);
		right: clamp(8px, min(3vw, 3vh), 22px);
		z-index: 60;
		width: var(--ap-close);
		height: var(--ap-close);
		font-size: calc(var(--ap-close) * 0.33);
		padding: 0;
		border: none;
		border-radius: 50%;
		background: #49489b;
		display: grid;
		place-items: center;
		cursor: pointer;
		transition: filter 0.12s ease;
	}
	.ap-close:hover {
		filter: brightness(1.3);
	}

	/* ── Short, wide windows (Stake's popout sizes, e.g. 610x347) ──
	   The dialog is taller than it is wide, so on a short window the `62vh` term above used to set
	   the whole plate — 215px across at Popout-S — and every size inside is a share of that width:
	   the row labels came out at 5px and the START button at 4px, which is the unreadable dialog in
	   the 2026-09-23 Stake review. Here the plate takes the WIDTH it can have instead, and the
	   content splits into two columns so the short axis still fits: toggles and START on the left,
	   the three limit steppers on the right. */
	@media (max-height: 700px) and (min-aspect-ratio: 5 / 4) {
		.ap-root {
			--ap-w: min(94vw, 700px);
		}
		.ap-panel {
			display: grid;
			grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
			column-gap: 5cqw;
			align-items: start;
			padding: 3.6cqw 4cqw 4cqw;
		}
		.ap-toggles {
			grid-column: 1;
			grid-row: 1;
		}
		.ap-limits {
			grid-column: 2;
			grid-row: 1 / span 2;
		}
		.ap-spins-label:first-of-type {
			margin-top: 0;
		}
		.ap-start {
			grid-column: 1;
			grid-row: 2;
			align-self: end;
			margin-top: 4cqw;
			/* Half the plate is ~250px at Popout-S: at the one-column 0.12em tracking "START
			   AUTOPLAY (100)" needs ~265px and broke onto two lines. Tighter tracking and 2.3cqw type keep
			   English on one line; longer translations wrap inside the button (min-height above). */
			letter-spacing: 0.05em;
			font-size: max(12px, 2.3cqw);
		}
		/* The design's vertical rhythm was set for one column of blocks; three of them stacked in
		   half the plate need a tighter one, or the plate outgrows a 347px-tall window and starts
		   to scroll. */
		.ap-spins-label {
			margin-top: 2.6cqw;
			/* In a half-width column the Russian headings ("КОЛИЧЕСТВО ВРАЩЕНИЙ", "ЛИМИТ ОДНОГО
			   ВЫИГРЫША") wrap, and at the design's 1.5 leading each extra line cost ~31px: the plate
			   grew to 360px in a 347px Popout-S and lost its top and bottom edges. */
			font-size: max(12px, 3.1cqw);
			line-height: 1.2;
			text-wrap: balance;
		}
		.ap-stepper {
			margin-top: 1.2cqw;
		}
		.ap-icon-btn {
			width: 7.8cqw;
			height: 7.8cqw;
		}
		/* Half the plate is a narrow column, so a long row label (any of the translations, and
		   "50X BONUS FEATURE" in English) wraps. The row is a fixed 6.04cqw tall in the one-column
		   design, which a wrapped label overflows straight into the row below it. */
		.ap-row {
			height: auto;
			min-height: 6.04cqw;
		}
		.ap-row__label {
			font-size: max(12px, 3.2cqw);
			line-height: 1.15;
		}
		.ap-toggles {
			gap: 3.4cqw;
		}
	}

	/* ── Very short windows (Popout-S, 400x225) ──
	   The two-column layout above still spent the whole screen here: every size sat on its 12px
	   floor, which at this scale made the plate 376x185 of a 400x225 window, with START wrapped onto
	   two lines (user, 2026-09-23: "we don't need that huge dialog"). A narrower plate and 10px
	   floors keep the copy readable — the 2026-09-23 review's complaint was 5px type, not 10 — and
	   leave the game visible around the dialog. */
	@media (max-height: 300px) and (min-aspect-ratio: 5 / 4) {
		.ap-root {
			--ap-w: min(76vw, 420px);
		}
		.ap-panel {
			padding: 3cqw 3.6cqw 3.4cqw;
		}
		.ap-row__label,
		.ap-spins-label {
			font-size: max(10px, 3.1cqw);
		}
		/* The right column's three stacked steppers set the plate's height, so that is where the
		   rhythm comes in: smaller discs, and the heading sits right on its stepper. */
		.ap-spins-label {
			margin-top: 1.6cqw;
			line-height: 1.1;
		}
		.ap-stepper {
			margin-top: 0.8cqw;
		}
		.ap-icon-btn {
			width: 6.8cqw;
			height: 6.8cqw;
		}
		.ap-count {
			font-size: max(14px, 4.8cqw);
		}
		.ap-toggles {
			gap: 2.4cqw;
		}
		.ap-start {
			font-size: max(10px, 2.9cqw);
			letter-spacing: 0.02em;
			padding: 0.5em 0.5em;
		}
	}

	/* Buttons do NOT inherit font-family: the UA stylesheet hard-sets `font: 400 13.333px Arial` on
	   form controls, so every <button> here (and the glyph spans inside them) rendered in Arial no
	   matter what the container was set to — measured via getComputedStyle, not assumed. Set
	   OUTRIGHT rather than to `inherit`: `inherit` on a top-level sibling like .ap-close resolves
	   against <body>, not the dialog. Svelte scopes this to the component, and .ap-start overrides
	   it with Audiowide. */
	button {
		font-family: 'Chakra Petch', 'Inter', sans-serif;
	}
</style>
