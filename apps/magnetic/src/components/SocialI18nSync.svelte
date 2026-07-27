<script lang="ts">
	import { stateConfig, stateI18nDerived, stateUrlDerived } from 'state-shared';

	import messagesMap from '../i18n/messagesMap';
	import { socialOverridesEn } from '../i18n/socialOverridesEn';

	// Runs after <LoadI18n> has done its own init, and re-runs whenever the jurisdiction arrives
	// from /wallet/authenticate — which is normally AFTER the first init, so the social swap has to
	// be reactive rather than a one-shot at mount.
	const reinit = () => {
		const social = stateConfig.jurisdiction.socialCasino || stateUrlDerived.social();
		if (social) {
			// Social-casino jurisdictions (e.g. Stake.US) must present English-only, compliant
			// terminology regardless of the requested locale. Lock to `en` + the social overrides so
			// a `?lang=de` (etc.) session can't fall back to base gambling wording.
			stateI18nDerived.init('en', { ...messagesMap.en, ...socialOverridesEn });
			return;
		}
		const lang = stateUrlDerived.lang();
		stateI18nDerived.init(lang, messagesMap[lang] ?? messagesMap.en);
	};

	$effect(() => {
		void stateConfig.jurisdiction.socialCasino;
		reinit();
	});
</script>
