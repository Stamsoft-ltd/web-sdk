<script lang="ts">
	import { stateConfig, stateI18nDerived, stateUrlDerived } from 'state-shared';

	import messagesMap from '../i18n/messagesMap';
	import { socialOverridesEn } from '../i18n/socialOverridesEn';

	$effect(() => {
		const social = Boolean(stateConfig.jurisdiction?.socialCasino || stateUrlDerived.social());
		if (social) stateI18nDerived.init('en', { ...messagesMap.en, ...socialOverridesEn });
		else {
			const lang = stateUrlDerived.lang();
			stateI18nDerived.init(lang, messagesMap[lang] ?? messagesMap.en);
		}
	});
</script>
