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
	import { stateBet } from 'state-shared';
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
		--ap-w: min(94vw, 104vh, max(550px, 45.8vw));
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
		font-size: 3.64cqw;
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
		margin: 8.8cqw 0 0;
		text-align: center;
		font-weight: 700;
		font-size: 3.64cqw;
		/* The design gives this line a 30px box against a 20px face. Left at the browser's default
		   the stack comes up ~6 design px short and the plate ends up proportionally wider than
		   550x423, which shows as a slack margin under the START button. */
		line-height: 1.5;
		letter-spacing: 0.02em;
		color: #fff;
		text-transform: uppercase;
	}

	/* − [count] + — 48.696 circles, 138 design px apart centre to centre. */
	.ap-stepper {
		margin-top: 3.1cqw;
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
		font-size: 5.82cqw;
		line-height: 1;
	}

	/* Figma 4036:2503 — flat #A88EFF, radius 8, the content box's full width, 44 tall, 40.3 below the
	   stepper. Its label is AUDIOWIDE: the design sets it in the same face as the HUD's numerals, and
	   it is the only text in this dialog that is. Regular is the family's only weight, so asking for
	   bold here would get a synthesised smear. */
	.ap-start {
		margin-top: 7.33cqw;
		height: 8cqw;
		border: none;
		border-radius: 1.45cqw;
		background: #a88eff;
		color: #fff;
		font-family: 'Audiowide', 'Chakra Petch', 'Inter', sans-serif;
		font-weight: 400;
		font-size: 2.9cqw;
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
		position: fixed;
		top: clamp(10px, 3vw, 22px);
		right: clamp(10px, 3vw, 22px);
		z-index: 60;
		width: clamp(32px, 8.5vw, 48px);
		height: clamp(32px, 8.5vw, 48px);
		font-size: clamp(10.5px, 2.8vw, 16px);
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
