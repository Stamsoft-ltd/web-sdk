<script lang="ts">
	import { stateBet } from 'state-shared';
	import { getContext } from '../game/context';
	import { i18nDerived } from '../i18n/i18nDerived';

	const t = (k: string) => i18nDerived.translate(k);

	type Props = { onclose: () => void };
	const props: Props = $props();
	const context = getContext();

	const ap = (p: string) => `./${p.startsWith('/') ? p.slice(1) : p}`;
	// Version2 steel-framed panel (Figma 4036-2458, art node 7002:11401). The export is the PLACED
	// node with its white backdrop keyed out and trimmed, so the art box is exactly 632x524 design
	// px — every position below is a fraction of that box, taken from the design's own child nodes.
	const panelBg = ap('/assets/components/ui/autospin_panel.webp?v=20260807');

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

<button class="ap-close ap-icon-btn" type="button" onclick={props.onclose} aria-label="Close">
	<span class="glyph glyph--close"></span>
</button>

<div class="ap-root" role="dialog" aria-modal="true">
	<div class="ap-panel" style={`background-image:url('${panelBg}')`}>
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

	/* Type is sized in em off this width-derived font-size so the whole dialog scales with the
	   panel art (design art box = 632px wide → 1em = 16px). Positions are % of the panel box.
	   52.7vw is the panel's share of the design frame (632 of 1200), so on screens wider than the
	   design the dialog keeps its intended presence instead of shrinking away; 632px is the floor
	   and 94vw / 104vh keep it inside small or portrait viewports. */
	.ap-root {
		--ap-w: min(94vw, 104vh, max(632px, 52.7vw));
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		z-index: 59;
		width: var(--ap-w);
		font-size: calc(var(--ap-w) / 39.5);
		font-family: 'Inter', sans-serif;
	}

	/* Steel frame with the navy interior baked in — trimmed to the art, so % positions are exact. */
	.ap-panel {
		position: relative;
		aspect-ratio: 632 / 524;
		background-size: 100% 100%;
		background-repeat: no-repeat;
	}

	/* Figma "Icon buttons": 48.696 circle, #22365B fill, 1px #2391C1 border, white glyph. */
	.ap-icon-btn {
		/* buttons do NOT inherit font-size — without this the em box collapses to Chrome's 13.3px */
		font-size: inherit;
		width: 3.0435em;
		height: 3.0435em;
		flex-shrink: 0;
		padding: 0;
		border-radius: 50%;
		border: 1px solid #2391c1;
		background: #22365b;
		display: grid;
		place-items: center;
		cursor: pointer;
		transition: filter 0.12s ease;
	}
	.ap-icon-btn:hover:not(:disabled) { filter: brightness(1.35); }
	.ap-icon-btn:disabled { opacity: 0.4; cursor: default; }

	/* Glyphs are drawn rather than imported: the design's are plain 2.13px white strokes. */
	.glyph {
		position: relative;
		display: block;
		width: 0.866em;
		height: 0.133em;
		border-radius: 0.133em;
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
	.glyph--plus::after { transform: rotate(90deg); }
	.glyph--close { width: 1.155em; background: none; }
	.glyph--close::before { background: #fff; transform: rotate(45deg); }
	.glyph--close::after { background: #fff; transform: rotate(-45deg); }

	/* Design places the close button at the top-right of the whole screen, not on the panel. */
	.ap-close {
		position: fixed;
		top: 22px;
		right: 22px;
		z-index: 60;
		width: 48px;
		height: 48px;
		font-size: 16px;
	}

	/* Figma 4036:2490 — three rows, 16px apart, inset 10.76% and starting 14.98% down. */
	.ap-toggles {
		position: absolute;
		left: 10.76%;
		right: 11.08%;
		top: 14.98%;
		display: flex;
		flex-direction: column;
		gap: 1em;
	}

	.ap-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.6em;
		height: 2.076em;
	}

	/* Figma: IBM Plex Sans Condensed Bold 20px, white, 0.6px tracking */
	.ap-row__label {
		font-family: 'IBM Plex Sans Condensed', 'Inter', sans-serif;
		font-weight: 700;
		font-size: 1.25em;
		letter-spacing: 0.03em;
		color: #fff;
	}

	/* Cyan toggle switch (62 x 33.214 design size) */
	.ap-switch {
		font-size: inherit;
		flex: 0 0 auto;
		position: relative;
		width: 3.875em;
		height: 2.076em;
		border-radius: 999px;
		border: 1px solid #556479;
		/* OFF: near-black at the top fading to blue at the bottom (sampled from the design render) */
		background: linear-gradient(180deg, #141b1c 0%, #2c5aa4 100%);
		cursor: pointer;
		padding: 0;
		transition: background 0.2s ease, border-color 0.2s ease;
	}
	.ap-switch.on {
		border-color: transparent;
		background: linear-gradient(180deg, #00fcff 0%, #0046a9 100%);
	}
	.ap-switch__thumb {
		position: absolute;
		top: 0.277em;
		left: 7.14%;
		width: 1.522em;
		height: 1.522em;
		border-radius: 50%;
		background: #fff;
		transition: left 0.2s ease;
	}
	.ap-switch.on .ap-switch__thumb { left: 53.57%; }

	/* Figma 4036:2489 — IBM Plex Sans Condensed Bold 20px, flat #2391C1, centred at 51.8%. */
	.ap-spins-label {
		position: absolute;
		left: 0;
		right: 0;
		top: 51.81%;
		margin: 0;
		transform: translateY(-50%);
		text-align: center;
		font-family: 'IBM Plex Sans Condensed', 'Inter', sans-serif;
		font-weight: 700;
		font-size: 1.25em;
		letter-spacing: 0.03em;
		color: #2391c1;
	}

	/* − [count] + row, centred at 63.04% with the buttons 69px either side of centre. */
	.ap-stepper {
		position: absolute;
		left: 0;
		right: 0;
		top: 63.04%;
		transform: translateY(-50%);
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0;
	}

	/* Figma 4036:2488 — Inter Bold 32px white. The count is a FIXED 89.3px slot (the design's gap
	   between the two button edges) so 3-digit values and ∞ never shift the − / + off their marks. */
	.ap-count {
		/* own font-size is 2em, so the 89.3px slot is 89.3 / 32 em here */
		width: 2.79em;
		text-align: center;
		color: #fff;
		font-weight: 700;
		font-size: 2em;
		line-height: 1;
	}

	/* Figma 4036:2503 — flat #28A6DE, 1px #60A5FA border, radius 12, Inter Bold 14 / 1.4px tracking */
	.ap-start {
		position: absolute;
		left: 10.76%;
		right: 11.08%;
		top: 79.49%;
		/* own font-size is 0.875em → design px ÷ 14 for this element's own metrics */
		font-size: 0.875em;
		height: 3.143em;
		transform: translateY(-50%);
		border: 1px solid #60a5fa;
		border-radius: 0.857em;
		background: #28a6de;
		color: #fff;
		font-family: 'Inter', sans-serif;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		cursor: pointer;
		filter: drop-shadow(0 4px 2px rgba(0, 0, 0, 0.25));
		transition: filter 0.12s ease;
	}
	.ap-start:hover { filter: brightness(1.12) drop-shadow(0 4px 2px rgba(0, 0, 0, 0.25)); }
	.ap-start:active { filter: brightness(0.95); }
</style>
