<script lang="ts" module>
	// Module scope so the art preloads during the loading screen (the modal mounts on demand).
	import { ap } from '../lib/preloadArt';

	const closeArt = ap('/assets/mcschmutzo/win/x-button.webp');
</script>

<script lang="ts">
	// Reusable two-action confirm dialog, styled to match CustomAutoSpinModal.
	// Used for the buy-bonus confirm ("CONFIRM IT ALL") and the unfinished-round prompt.
	type Props = {
		title: string;
		message: string;
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
<div class="cf-backdrop" onclick={dismiss}></div>

<button
	class="cf-close"
	type="button"
	style={`background-image:url('${closeArt}')`}
	onclick={dismiss}
	aria-label="Close"
></button>

<div class="cf-root" role="dialog" aria-modal="true">
	<div class="cf-popup">
		<p class="cf-title">{props.title}</p>
		<p class="cf-message">{props.message}</p>

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
		background: rgba(0, 0, 0, 0.64);
		backdrop-filter: blur(4px);
	}

	.cf-root {
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		z-index: 69;
		width: min(500px, 92vw);
		max-height: 94dvh;
		font-family: 'Poppins', sans-serif;
	}

	/* Dark pop-up: 3px #444444 border wrapped by a few px of #181818 (the outer-most layer). */
	.cf-popup {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: clamp(12px, 2.6vmin, 22px);
		padding: clamp(24px, 5vmin, 40px) clamp(20px, 4vmin, 34px) clamp(22px, 4vmin, 32px);
		border: 3px solid #444444;
		border-radius: 20px;
		background: linear-gradient(180deg, #241f1c 0%, #171412 100%);
		box-shadow:
			0 0 0 4px #181818,
			0 18px 50px rgba(0, 0, 0, 0.6);
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

	/* Title: Bowlby One SC, white, uppercase (matches the auto-spin modal). */
	.cf-title {
		margin: 0;
		text-align: center;
		color: #ffffff;
		font-family: 'Bowlby One SC', 'Bowlby One', sans-serif;
		font-weight: 400;
		font-size: clamp(1.25rem, 5vmin, 1.9rem);
		line-height: 1.05;
		letter-spacing: 1.4px;
		text-transform: uppercase;
		text-wrap: balance;
		text-shadow: 0 2px 6px rgba(0, 0, 0, 0.6);
	}

	.cf-message {
		margin: 0;
		text-align: center;
		max-width: 30ch;
		color: #d8cfc4;
		font-weight: 500;
		font-size: clamp(0.82rem, 2.4vmin, 1rem);
		line-height: 1.4;
	}

	.cf-actions {
		display: flex;
		justify-content: center;
		gap: clamp(10px, 2.4vmin, 18px);
		width: 100%;
		margin-top: clamp(2px, 1vmin, 8px);
	}

	.cf-btn {
		flex: 1 1 0;
		min-width: 0;
		max-width: 190px;
		padding: clamp(10px, 2.2vmin, 15px) clamp(10px, 2vmin, 18px);
		border-radius: 10px;
		font-family: 'Inter', sans-serif;
		font-weight: 700;
		font-size: clamp(0.78rem, 2.2vmin, 0.95rem);
		letter-spacing: 0.04em;
		text-transform: uppercase;
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
		color: #ffffff;
		background: linear-gradient(180deg, #322c29 0%, #241f1d 100%);
		border: 1px solid #4a4340;
		box-shadow:
			0 1px 0 rgba(255, 255, 255, 0.06) inset,
			0 3px 8px rgba(0, 0, 0, 0.4);
	}

	/* Primary (red) — CONFIRM / PLAY ROUND. */
	.cf-btn--primary {
		color: #ffffff;
		background: linear-gradient(180deg, #d5240f 0%, #a5170a 100%);
		border: 1px solid #6d0f05;
		box-shadow:
			0 1px 0 rgba(255, 255, 255, 0.22) inset,
			0 0 0 1px rgba(255, 120, 100, 0.25) inset,
			0 3px 10px rgba(0, 0, 0, 0.45);
	}
</style>
