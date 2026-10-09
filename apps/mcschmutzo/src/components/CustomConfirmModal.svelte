<script lang="ts" module>
	// Module scope so the art preloads during the loading screen (the modal mounts on demand).
	import { ap } from '../lib/preloadArt';
	import { i18nDerived } from '../i18n/i18nDerived';

	const closeArt = ap('/assets/mcschmutzo/win/x-button.webp');
	const frameArt = ap('/assets/mcschmutzo/popup/frame.svg');
	const splatArt = ap('/assets/mcschmutzo/popup/splat.webp');
</script>

<script lang="ts">
	import { fade } from 'svelte/transition';
	import { popIn, popOut } from '../lib/popOut';
	import PopupScrews from './PopupScrews.svelte';
	// Reusable two-action confirm dialog (Figma 8888:27021 / 8888:23219): the screwed-down diner
	// frame, a red header with the title, a cream body with a sauce splat either side, and a dark
	// (cancel) + red (confirm) button. Used for the buy-bonus confirm and the unfinished-round prompt.
	type Props = {
		title: string;
		message: string;
		/** Big red amount under the message (the buy confirm: "Buy Normal Bonus for" / "$100.00"). */
		amount?: string;
		/** Small line under the amount, for languages whose sentence goes on after the amount. */
		after?: string;
		/** Left / secondary (dark) button. */
		cancelLabel: string;
		/** Right / primary (red) button. */
		confirmLabel: string;
		oncancel: () => void;
		onconfirm: () => void;
		/** ✕ / backdrop dismiss. Defaults to oncancel when omitted. */
		onclose?: () => void;
	};
	const props: Props = $props();
	const dismiss = () => (props.onclose ?? props.oncancel)();
</script>

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div class="cf-backdrop" in:fade|global={{ duration: 220 }} out:fade|global={{ duration: 200 }} onclick={dismiss}></div>

<button
	in:fade|global={{ duration: 220, delay: 200 }}
	out:fade|global={{ duration: 120 }}
	class="cf-close"
	type="button"
	style={`background-image:url('${closeArt}')`}
	onclick={dismiss}
	aria-label={i18nDerived.translate('CLOSE')}
></button>

<div class="cf-root" in:popIn|global out:popOut|global role="dialog" aria-modal="true">
	<div class="cf-popup" class:cf-popup--amount={props.amount}>
		<div class="cf-body"></div>
		<div class="cf-head"></div>
		<img class="cf-frame" src={frameArt} alt="" draggable="false" />
		<PopupScrews frame="confirm" />
		<span class="cf-dash" aria-hidden="true"></span>

		<p class="cf-title">{props.title}</p>

		<div class="cf-copy">
			{#if props.amount}<p class="cf-message">{props.message}</p>{/if}
			<div class="cf-row">
				<img class="cf-splat" src={splatArt} alt="" draggable="false" />
				{#if props.amount}
					<p class="cf-amount">{props.amount}</p>
				{:else}
					<p class="cf-message">{props.message}</p>
				{/if}
				<img class="cf-splat cf-splat--right" src={splatArt} alt="" draggable="false" />
			</div>
			{#if props.amount && props.after}<p class="cf-after">{props.after}</p>{/if}
		</div>

		<div class="cf-actions">
			<button class="cf-btn cf-btn--secondary" type="button" onclick={props.oncancel}>
				{props.cancelLabel}
			</button>
			<button class="cf-btn cf-btn--primary" type="button" onclick={props.onconfirm}>
				{props.confirmLabel}
			</button>
		</div>
	</div>
</div>

<style>
	.cf-backdrop {
		position: fixed;
		inset: 0;
		z-index: 68;
		background: rgba(0, 0, 0, 0.74);
		backdrop-filter: blur(4px);
	}

	/* Laid out at the design's 594×437 and scaled by width: --u is one design px. */
	.cf-root {
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		z-index: 69;
		width: min(594px, 92vw, calc(92dvh * 594 / 437));
		container-type: inline-size;
		font-family: 'Nunito', sans-serif;
	}
	.cf-popup {
		--u: calc(100cqw / 594);
		position: relative;
		aspect-ratio: 594 / 437;
		filter: drop-shadow(0 calc(14 * var(--u)) calc(24 * var(--u)) rgba(0, 0, 0, 0.55));
	}
	/* Cream body + red header under the frame (the frame's inner edge hides their corners). */
	.cf-body,
	.cf-head {
		position: absolute;
		left: calc(12.5 * var(--u));
		right: calc(13.5 * var(--u));
	}
	.cf-body {
		top: calc(98.5 * var(--u));
		bottom: calc(12.6 * var(--u));
		background: #f9dca6;
	}
	.cf-head {
		top: calc(11.5 * var(--u));
		height: calc(119 * var(--u));
		background: #b1190a;
	}
	.cf-frame {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
		user-select: none;
	}
	.cf-dash {
		position: absolute;
		top: calc(143.2 * var(--u));
		left: calc(16 * var(--u));
		width: calc(562 * var(--u));
		height: calc(1.64 * var(--u));
		background: repeating-linear-gradient(
			90deg,
			#b11909 0 calc(22.91 * var(--u)),
			transparent calc(22.91 * var(--u)) calc(45.82 * var(--u))
		);
	}

	.cf-close {
		position: fixed;
		top: 20px;
		right: 20px;
		z-index: 70;
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
	.cf-close:hover {
		filter: brightness(1.2);
	}
	.cf-close:active {
		transform: scale(0.94);
	}

	/* Title: Comica Brush 48 in the design (Bowlby One SC until that font ships), cream with a dark
	   outline, centred in the red header. */
	.cf-title {
		position: absolute;
		left: calc(30 * var(--u));
		right: calc(30 * var(--u));
		top: calc(11.5 * var(--u));
		height: calc(119 * var(--u));
		margin: 0;
		display: grid;
		place-items: center;
		text-align: center;
		color: #e7d5b7;
		font-family: var(--font-brush);
		-webkit-text-stroke: var(--brush-stroke) currentColor;
		font-weight: 400;
		font-size: calc(40 * var(--u));
		line-height: 1;
		letter-spacing: calc(1.4 * var(--u));
		text-transform: uppercase;
		text-wrap: balance;
	}

	/* Message between the dashed rule and the buttons, a sauce splat on either side (of the amount,
	   when there is one: the message then sits above it). */
	.cf-copy {
		position: absolute;
		left: calc(30 * var(--u));
		right: calc(30 * var(--u));
		top: calc(146 * var(--u));
		height: calc(170 * var(--u));
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: calc(6 * var(--u));
		text-align: center;
	}
	.cf-row {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: calc(14 * var(--u));
		max-width: 100%;
	}
	.cf-splat {
		flex: none;
		width: calc(80 * var(--u));
		rotate: 25.64deg;
		pointer-events: none;
		user-select: none;
	}
	.cf-splat--right {
		scale: -1 1;
		rotate: -25.64deg;
	}
	.cf-message {
		margin: 0;
		min-width: 0;
		max-width: calc(362 * var(--u));
		color: #000;
		font-weight: 900;
		font-size: calc(26 * var(--u));
		line-height: 1.33;
		letter-spacing: calc(0.78 * var(--u));
		text-wrap: balance;
	}
	.cf-popup--amount .cf-message {
		max-width: none;
	}
	.cf-amount {
		margin: 0;
		color: #c41e0a;
		font-family: 'Luckiest Guy', 'Bowlby One SC', sans-serif;
		font-size: calc(66 * var(--u));
		line-height: 1;
		letter-spacing: calc(2.4 * var(--u));
		white-space: nowrap;
		-webkit-text-stroke: calc(5 * var(--u)) #2b120c;
		paint-order: stroke fill;
		/* Luckiest Guy sits high in its line box */
		padding-top: calc(8 * var(--u));
	}
	.cf-after {
		margin: 0;
		color: #000;
		font-weight: 800;
		font-size: calc(18 * var(--u));
	}

	.cf-actions {
		position: absolute;
		left: 50%;
		translate: -50% 0;
		top: calc(325 * var(--u));
		display: flex;
		gap: calc(17.7 * var(--u));
	}
	.cf-btn {
		position: relative;
		height: calc(59 * var(--u));
		padding: 0 calc(16 * var(--u));
		border-radius: calc(14.16 * var(--u));
		color: #fef4d5;
		font-family: var(--font-brush);
		-webkit-text-stroke: var(--brush-stroke) currentColor;
		font-weight: 400;
		font-size: calc(18 * var(--u));
		line-height: 1;
		letter-spacing: calc(1.65 * var(--u));
		text-transform: uppercase;
		white-space: nowrap;
		cursor: pointer;
		transition:
			filter 0.12s ease,
			transform 0.08s ease;
	}
	.cf-btn:hover {
		filter: brightness(1.1);
	}
	.cf-btn:active {
		transform: scale(0.97);
	}
	/* Secondary (dark) — CANCEL / END ROUND. */
	.cf-btn--secondary {
		width: calc(251 * var(--u));
		background: #2b2c2a;
		border: calc(2.36 * var(--u)) solid #605553;
	}
	/* Primary (red) — CONFIRM / PLAY ROUND: an inner dark-red rim and a white glint along the top. */
	.cf-btn--primary {
		width: calc(258 * var(--u));
		background: #c41e0a;
		border: none;
	}
	.cf-btn--primary::before {
		content: '';
		position: absolute;
		inset: calc(5 * var(--u));
		border: calc(2.36 * var(--u)) solid #851406;
		border-radius: calc(11.8 * var(--u));
	}
	.cf-btn--primary::after {
		content: '';
		position: absolute;
		top: calc(4.1 * var(--u));
		left: calc(14.16 * var(--u));
		width: calc(219.4 * var(--u));
		height: calc(1.18 * var(--u));
		background: linear-gradient(90deg, rgba(255, 255, 255, 0), #fff 50%, rgba(255, 255, 255, 0));
	}

	/* Phones (narrow portrait / short landscape): a smaller card — at 92% of the height it filled the
	   whole landscape screen. */
	@media (max-width: 500px), (max-height: 500px) {
		.cf-root {
			width: min(594px, 82vw, calc(66dvh * 594 / 437));
		}
	}

	/* Tiny popouts (~400x225): lay the dialog out at a fixed design width and scale the whole thing to
	   fit, so it stays compact on the short screen. Shrink the close (X) too. */
	@media (max-height: 300px) {
		.cf-root {
			width: 594px;
			transform: translate(-50%, -50%) scale(min(calc(88vw / 594px), calc(86vh / 437px)));
		}
		.cf-close { width: clamp(20px, 9dvh, 30px); top: 6px; right: 6px; }
	}
</style>
