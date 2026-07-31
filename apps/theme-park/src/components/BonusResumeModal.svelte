<script lang="ts">
	import { stateBet } from 'state-shared';
	import { i18nDerived } from '../i18n/i18nDerived';
	import PopupFrame from './PopupFrame.svelte';

	type Props = { onPlay: () => void; onEnd: () => void };
	const props: Props = $props();

	const mode = $derived(stateBet.betToResume?.mode ?? '');
	const modeLabel = $derived(
		({
			ANTE: i18nDerived.translate('BET MODE ANTE TITLE'),
			FSPIN1: i18nDerived.translate('BET MODE FSPIN1 TITLE'),
			FSPIN2: i18nDerived.translate('BET MODE FSPIN2 TITLE'),
			DUCK: i18nDerived.translate('BET MODE DUCK TITLE'),
			ROLLER: i18nDerived.translate('BET MODE ROLLER TITLE'),
			COASTER: i18nDerived.translate('BET MODE COASTER TITLE'),
		} as Record<string, string>)[mode] ?? i18nDerived.gameTitle(),
	);
</script>

<!-- No `ondismiss`: an unfinished round has to be answered, so the scrim stays inert. -->
<PopupFrame variant="confirm">
	<h2 class="resume__title tp-popup__title">{i18nDerived.translate('RECOVERY TITLE')}</h2>
	<p class="resume__body tp-popup__body">
		{i18nDerived.translateVars('RESUME BODY', { mode: modeLabel })}
	</p>
	<div class="resume__actions">
		<button class="tp-popup__btn" type="button" onclick={props.onEnd}>
			{i18nDerived.translate('END ROUND')}
		</button>
		<button class="tp-popup__btn tp-popup__btn--primary" type="button" onclick={props.onPlay}>
			{i18nDerived.translate('PLAY ROUND')}
		</button>
	</div>
</PopupFrame>

<style>
	/* Spacing is the Figma nodes' own, converted to flow: the title box ends at 75 and the body
	   starts at 91 (a 16 gap); the button row sits at 165.12, which `margin-top: auto` reproduces
	   against the panel's min-height while letting a wrapped title push it down instead of
	   overlapping (nodes 6401:2082-2084). Both text blocks are 303.899 of the 459 panel. */
	.resume__title,
	.resume__body {
		width: 74.303%; /* 303.899 of the 409 content box */
	}

	.resume__body {
		margin-top: calc(16 / var(--pop-w) * 100cqw);
	}

	.resume__actions {
		margin-top: auto;
		padding-top: calc(24 / var(--pop-w) * 100cqw);
		width: 100%; /* the content box is already the 409 row */
		display: flex;
		align-items: center;
		gap: calc(16 / var(--pop-w) * 100cqw);
	}
</style>
