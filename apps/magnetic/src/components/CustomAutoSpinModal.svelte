<script lang="ts">
	import { stateBet } from 'state-shared';
	import { getContext } from '../game/context';
	import { i18nDerived } from '../i18n/i18nDerived';

	const t = (k: string) => i18nDerived.translate(k);

	type Props = { onclose: () => void };
	const props: Props = $props();
	const context = getContext();

	const ap = (p: string) => `./${p.startsWith('/') ? p.slice(1) : p}`;
	// Blue bracketed board panel (Figma 4036-2458 uses board_panel_623x514 = fs_panel art).
	const panelBg = ap('/assets/components/ui/fs_panel.webp?v=20260708');
	// Our control icons for the +, − and × (close) buttons (matches the buy-bonus / info modals).
	const iconClose = ap('/assets/components/ui/ctrl_close.webp');
	const iconMinus = ap('/assets/components/ui/ctrl_minus.webp');
	const iconPlus = ap('/assets/components/ui/ctrl_plus.webp');

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

<button class="ap-close" type="button" onclick={props.onclose} aria-label="Close"><img class="ctrl-glyph" src={iconClose} alt="" /></button>

<div class="ap-root" role="dialog" aria-modal="true">
	<div class="ap-panel" style={`background-image:url('${panelBg}')`}>
		<div class="ap-content">
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
				<button class="ap-step" type="button" disabled={disableDec} onclick={() => step(-1)} aria-label="Fewer spins"><img class="ctrl-glyph" src={iconMinus} alt="" /></button>
				<span class="ap-count">{countLabel}</span>
				<button class="ap-step" type="button" disabled={disableInc} onclick={() => step(1)} aria-label="More spins"><img class="ctrl-glyph" src={iconPlus} alt="" /></button>
			</div>

			<button class="ap-start" type="button" onclick={start}>
				{t('AUTO START')} ({countLabel})
			</button>
		</div>
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

	/* Everything inside the panel is sized in em off this width-derived font-size, so the whole
	   dialog scales proportionally with the panel (Figma design width = 623px → 1em = 16px). */
	.ap-root {
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		z-index: 59;
		width: min(623px, 94vw, 104vh);
		font-size: calc(min(623px, 94vw, 104vh) / 38.9375);
		font-family: 'Inter', sans-serif;
	}

	/* Blue circular close button, pinned to the top-right of the screen (matches the buy-bonus one) */
	.ap-close {
		position: fixed;
		top: 22px;
		right: 22px;
		z-index: 60;
		width: 48px;
		height: 48px;
		border-radius: 50%;
		border: 1.5px solid #00fcff;
		background: linear-gradient(0deg, #0f2053 0%, #000000 100%);
		color: #cfe6ff;
		font-size: 1rem;
		font-weight: 700;
		cursor: pointer;
		display: grid;
		place-items: center;
		box-shadow: 0 0 12px rgba(0, 140, 255, 0.35), 0 4px 12px rgba(0, 0, 0, 0.5);
		transition: filter 0.12s ease;
	}
	.ap-close:hover { filter: brightness(1.25); }
	/* The ctrl icons are full round buttons — fill the wrapper and strip its own frame. */
	.ap-close:has(.ctrl-glyph),
	.ap-step:has(.ctrl-glyph) {
		border: none;
		background: none;
		box-shadow: none;
		padding: 0;
	}
	.ctrl-glyph { width: 100%; height: 100%; object-fit: contain; display: block; }

	/* Blue bracketed tech panel (fs_panel.webp, 623×514 design size) */
	.ap-panel {
		aspect-ratio: 623 / 514;
		background-size: 100% 100%;
		background-repeat: no-repeat;
		display: flex;
		box-sizing: border-box;
		/* Figma: content column is 494 wide inside 623 (~10.3% side padding), rows start ~15% down. */
		padding: 15% 10.3% 9%;
	}

	.ap-content {
		width: 100%;
		display: flex;
		flex-direction: column;
	}

	.ap-toggles {
		display: flex;
		flex-direction: column;
		gap: 1em;
	}

	.ap-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.6em;
	}

	/* Figma: IBM Plex Sans Condensed Bold 20px, white, 0.6px tracking */
	.ap-row__label {
		font-family: 'IBM Plex Sans Condensed', 'Inter', sans-serif;
		font-weight: 700;
		font-size: 1.25em;
		letter-spacing: 0.03em;
		color: #fff;
		text-shadow: 0 2px 4px rgba(0, 0, 0, 0.6);
	}

	/* Cyan toggle switch (62×33 design size) */
	.ap-switch {
		flex: 0 0 auto;
		position: relative;
		width: 3.875em;
		height: 2.075em;
		border-radius: 999px;
		border: 1px solid rgba(0, 0, 0, 0.4);
		background: linear-gradient(180deg, #3c4654, #232a35);
		cursor: pointer;
		padding: 0;
		transition: background 0.2s ease;
	}
	.ap-switch.on {
		background: linear-gradient(180deg, #00c2ff, #0075d9);
		border-color: rgba(0, 252, 255, 0.6);
		box-shadow: 0 0 10px rgba(0, 194, 255, 0.45);
	}
	.ap-switch__thumb {
		position: absolute;
		top: 50%;
		left: 8%;
		transform: translateY(-50%);
		width: 1.55em;
		height: 1.55em;
		border-radius: 50%;
		background: #fff;
		box-shadow: 0 1px 4px rgba(0, 0, 0, 0.5);
		transition: left 0.2s ease;
	}
	.ap-switch.on .ap-switch__thumb { left: calc(92% - 1.55em); }

	/* Figma: IBM Plex Sans Condensed Bold 20px, cyan→blue gradient, centered */
	.ap-spins-label {
		margin: auto 0 0;
		text-align: center;
		font-family: 'IBM Plex Sans Condensed', 'Inter', sans-serif;
		font-weight: 700;
		font-size: 1.25em;
		letter-spacing: 0.03em;
		background: linear-gradient(180deg, #00fcff 0%, #0046a9 100%);
		-webkit-background-clip: text;
		background-clip: text;
		-webkit-text-fill-color: transparent;
		color: transparent;
	}

	/* − [count] + stepper row */
	.ap-stepper {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 2.7em;
		margin-top: 0.9em;
	}

	.ap-step {
		/* own font-size is 1.4em, so box dims are divided by 1.4 to stay 48.7px at design size */
		width: 2.17em;
		height: 2.17em;
		flex-shrink: 0;
		border-radius: 50%;
		border: 1.5px solid #00fcff;
		background: linear-gradient(0deg, #0f2053 0%, #000000 100%);
		color: #cfe6ff;
		font-size: 1.4em;
		font-weight: 400;
		line-height: 1;
		display: grid;
		place-items: center;
		cursor: pointer;
		box-shadow: 0 0 10px rgba(0, 200, 255, 0.3);
		transition: filter 0.12s ease;
	}
	.ap-step:hover:not(:disabled) { filter: brightness(1.3); }
	.ap-step:disabled { opacity: 0.4; cursor: default; }

	/* Figma: Inter Bold 32px white */
	.ap-count {
		min-width: 2.6em;
		text-align: center;
		color: #fff;
		font-weight: 700;
		font-size: 2em;
		letter-spacing: 0.03em;
		text-shadow: 0 2px 5px rgba(0, 0, 0, 0.7);
	}

	/* Figma: full-width cyan button, 44px tall, radius 12, Inter Bold 14 / 1.4px tracking */
	.ap-start {
		/* own font-size is 0.875em → design px ÷ 0.875 (44px height, 12px radius, 24px top gap) */
		width: 100%;
		height: 3.14em;
		margin-top: 1.7em;
		border: 1px solid #60a5fa;
		border-radius: 0.857em;
		background: linear-gradient(180deg, #00fcff 0%, #0046a9 100%);
		color: #fff;
		font-family: 'Inter', sans-serif;
		font-weight: 700;
		font-size: 0.875em;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		cursor: pointer;
		filter: drop-shadow(0 4px 2px rgba(0, 0, 0, 0.25));
		transition: filter 0.12s ease;
	}
	.ap-start:hover { filter: brightness(1.12) drop-shadow(0 4px 2px rgba(0, 0, 0, 0.25)); }
	.ap-start:active { filter: brightness(0.95); }
</style>
