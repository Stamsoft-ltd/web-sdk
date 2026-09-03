<script lang="ts">
	import { stateModal } from 'state-shared';

	import { i18nDerived } from '../i18n/i18nDerived';
	import { fitTextScale } from '../utils/fitText';
	import { CONFIRM_TITLE_FONT_F, CONFIRM_TITLE_FIT_W, CONFIRM_TITLE_FAMILY } from './confirmDialog';

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
			<div class="nb-panel">
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

	/* Width is shared with the other two dialogs — see the plate note below. */
	.nb {
		width: clamp(300px, 54vw, 720px);
		container-type: inline-size;
		font-family: 'Chakra Petch', 'Inter', sans-serif;
	}

	/* MOTHERSHIP confirm popup — plate node 9076:28671 inside the design's "confirm popup" frame
	   (Figma 4036:3584, SECTION 9078:18631 POPUPS). Three dialogs wear this plate — the buy
	   confirmation, the unfinished-round dialog and the insufficient-funds notice — and they must
	   stay identical; the metrics the text fitter needs live in confirmDialog.ts.
	   
	   Re-measured 2026-09-03 off 9076:28671, which REPLACED the 4036-era plate the old numbers came
	   from. What changed: the faces (Audiowide title / Poppins body, not Chakra Petch throughout),
	   a 4px #2D2C69 edge with a #5E4374 hairline inside it, and 196.5x50 buttons on radius 12.
	   The outer plate is 467 design px wide, so with container-type:inline-size 1cqw == 1% of it
	   and every number below is the design's own measurement divided by 467. */
	.nb-panel {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 5.7cqw;
		padding: 4.71cqw 5.35cqw 4.26cqw;
		background: #3a3981;
		border: 0.86cqw solid #2d2c69;
		border-radius: 3cqw;
		/* The design's inner plate carries its own 1px #5E4374 hairline inside the #2D2C69 edge. */
		box-shadow:
			inset 0 0 0 0.21cqw #5e4374,
			0 1.6cqw 3.6cqw rgba(0, 0, 0, 0.5);
	}

	.nb-title {
		text-align: center;
		/* 32/467, AUDIOWIDE — Regular is the family's only weight, so 700 here would be synthesised. */
		font-family: 'Audiowide', 'Chakra Petch', 'Inter', sans-serif;
		font-weight: 400;
		font-size: calc(6.85cqw * var(--nb-title-fit, 1));
		letter-spacing: 0.03em;
		text-transform: uppercase;
		line-height: 1;
		white-space: nowrap;
		color: #ffffff;
	}

	.nb-text {
		text-align: center;
		/* 20/467, POPPINS Regular. */
		font-family: 'Poppins', 'Chakra Petch', 'Inter', sans-serif;
		font-size: 4.28cqw;
		font-weight: 400;
		letter-spacing: 0.03em;
		color: #fff;
		line-height: 1.3;
	}

	/* One button, so it sits alone on the design's button row rather than in a pair. */
	.nb-row {
		display: flex;
		justify-content: center;
	}
	.nb-btn {
		height: 10.71cqw;
		min-width: 42.08cqw;
		padding: 0 3cqw;
		/* The design's primary is a flat #A88EFF with NO stroke — which is what this ring already is
		   once the fill matches it, so both variants keep the same box. */
		border: 0.21cqw solid #a88eff;
		border-radius: 2.57cqw;
		background: #a88eff;
		font-family: 'Audiowide', 'Chakra Petch', 'Inter', sans-serif;
		font-size: 3.43cqw;
		font-weight: 400;
		letter-spacing: 0.0875em;
		text-transform: uppercase;
		white-space: nowrap;
		color: #fff;
		cursor: pointer;
		transition: filter 0.12s ease;
	}
	.nb-btn:hover {
		filter: brightness(1.18);
	}

	/* Buttons do NOT inherit font-family — the UA stylesheet hard-sets `font: 400 13.333px Arial`
	   on form controls. Same note as BonusResumeModal. */
	button {
		font-family: 'Chakra Petch', 'Inter', sans-serif;
	}
</style>
