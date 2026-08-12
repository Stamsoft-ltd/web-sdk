<script lang="ts">
	import { stateModal } from 'state-shared';

	import { i18nDerived } from '../i18n/i18nDerived';
	import { fitTextScale } from '../utils/fitText';
	import {
		CONFIRM_PANEL_BG,
		CONFIRM_TITLE_FONT_F,
		CONFIRM_TITLE_FIT_W,
		CONFIRM_TITLE_FAMILY,
	} from './confirmDialog';

	const t = (k: string) => i18nDerived.translate(k);

	// Running out of balance is the one "error" a player will actually hit, and it is not a fault —
	// it is a normal state of the game. It used to surface through the shared <ModalError>, which
	// opens with "Sorry, something went wrong." and prints the raw error payload in a red box. This
	// replaces that one case with the game's own Version2 confirm plate; every other error still
	// goes to the shared modal, where a raw payload is genuinely the useful thing to show.

	// The message reaches us in more than one shape: the client-side pre-check in utils-xstate
	// throws `new Error('INSUFFICIENT FUNDS TO PLACE THIS BET...')`, while the RGS rejects a bet it
	// cannot cover with statusCode `ERR_IPB` (Insufficient Player Balance) nested somewhere inside
	// the response body. Match on the whole serialized payload rather than guessing a path.
	const describe = (error: unknown): string => {
		if (!error) return '';
		if (typeof error === 'string') return error;
		const parts: string[] = [];
		if (error instanceof Error) parts.push(error.message);
		try {
			parts.push(JSON.stringify(error));
		} catch {
			parts.push(String(error));
		}
		return parts.join(' ');
	};
	const isInsufficient = (error: unknown) => {
		const text = describe(error);
		return /insufficient/i.test(text) || /ERR_IPB/.test(text);
	};

	let show = $state(false);

	$effect(() => {
		const modal = stateModal.modal;
		if (modal?.name !== 'error' || !isInsufficient(modal.error)) return;
		// Clearing the shared modal IS the suppression: <Modals> renders <ModalError> unconditionally
		// on `name === 'error'`, and it lives in a shared package this game should not fork. Both
		// this effect and ModalError's `{#if}` resolve inside the same Svelte flush, so the generic
		// dialog never reaches a painted frame.
		stateModal.modal = null;
		show = true;
	});

	const title = $derived(t('NO BALANCE TITLE'));

	// Same nowrap-title shrink-to-fit the other two confirm dialogs use — see confirmDialog.ts.
	let boxW = $state(0);
	let boxEl = $state<HTMLDivElement>();
	$effect(() => {
		const el = boxEl;
		if (!el) return;
		const measure = () => (boxW = el.clientWidth);
		measure();
		const ro = new ResizeObserver(measure);
		ro.observe(el);
		return () => ro.disconnect();
	});
	const titleFit = $derived(
		fitTextScale(title, {
			fontSizePx: boxW * CONFIRM_TITLE_FONT_F,
			availablePx: boxW * CONFIRM_TITLE_FIT_W,
			fontFamily: CONFIRM_TITLE_FAMILY,
			letterSpacingEm: 0.03,
		}),
	);
</script>

{#if show}
	<div class="modal-overlay">
		<div
			class="nb"
			role="dialog"
			aria-modal="true"
			bind:this={boxEl}
			style={`--nb-title-fit:${titleFit}`}
		>
			<div class="nb-panel" style={`background-image:url('${CONFIRM_PANEL_BG}')`}>
				<div class="nb-title">{title}</div>
				<div class="nb-text">{t('NO BALANCE BODY')}</div>
				<div class="nb-row">
					<button class="nb-btn" type="button" onclick={() => (show = false)}>{t('OK')}</button>
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	.modal-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.72);
		backdrop-filter: blur(5px);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 9999;
	}

	/* Version2 confirm popup (Figma 4036-3584, art node 7002:11406) — the same plate and the same
	   design percentages as BonusResumeModal and CustomBuyBonusModal's .confirm. Keep the three in
	   sync; the shared metrics live in confirmDialog.ts. With container-type:inline-size on .nb,
	   1cqw == 1% of the 507.33px design width. */
	.nb {
		width: clamp(300px, 54vw, 720px);
		container-type: inline-size;
		font-family: 'Chakra Petch', 'Inter', sans-serif;
	}

	.nb-panel {
		position: relative;
		aspect-ratio: 507.33 / 283;
		background-size: 100% 100%;
		background-repeat: no-repeat;
	}

	.nb-title {
		position: absolute;
		left: 7%;
		right: 7%;
		top: 29.33%;
		transform: translateY(-50%);
		text-align: center;
		font-family: 'Chakra Petch', 'Inter', sans-serif;
		font-weight: 700;
		font-size: calc(6.31cqw * var(--nb-title-fit, 1));
		letter-spacing: 0.03em;
		text-transform: uppercase;
		line-height: 1;
		white-space: nowrap;
		color: #2391c1;
	}

	.nb-text {
		position: absolute;
		left: 8%;
		right: 8%;
		top: 50.18%;
		transform: translateY(-50%);
		text-align: center;
		font-family: 'Chakra Petch', 'Inter', sans-serif;
		font-size: 3.94cqw;
		font-weight: 600;
		letter-spacing: 0.03em;
		color: #fff;
		line-height: 1.3;
	}

	/* One button, so it centres on the design's button baseline rather than sitting in a pair. */
	.nb-row {
		position: absolute;
		left: 0;
		right: 0;
		top: 71.38%;
		transform: translateY(-50%);
		display: flex;
		justify-content: center;
	}
	.nb-btn {
		height: 8.67cqw;
		min-width: 28.37cqw;
		padding: 0 4.73cqw;
		border: 1px solid #60a5fa;
		border-radius: 2.37cqw;
		background: #28a6de;
		font-family: 'Chakra Petch', 'Inter', sans-serif;
		font-size: 2.76cqw;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		white-space: nowrap;
		color: #fff;
		cursor: pointer;
		filter: drop-shadow(0 4px 2px rgba(0, 0, 0, 0.25));
		transition: filter 0.12s ease;
	}
	.nb-btn:hover {
		filter: brightness(1.12) drop-shadow(0 4px 2px rgba(0, 0, 0, 0.25));
	}

	/* Buttons do NOT inherit font-family — the UA stylesheet hard-sets `font: 400 13.333px Arial`
	   on form controls. Same note as BonusResumeModal. */
	button {
		font-family: 'Chakra Petch', 'Inter', sans-serif;
	}
</style>
