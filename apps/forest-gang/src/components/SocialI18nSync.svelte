<script lang="ts">
	import { stateConfig, stateI18nDerived, stateUrlDerived } from 'state-shared';

	import messagesMap from '../i18n/messagesMap';
	import { socialOverridesEn } from '../i18n/socialOverridesEn';

	const reinit = () => {
		const lang = stateUrlDerived.lang();
		const social = stateConfig.jurisdiction.socialCasino || stateUrlDerived.social();
		const base = messagesMap[lang] ?? messagesMap.en;
		const messages = social && lang === 'en' ? { ...base, ...socialOverridesEn } : base;
		stateI18nDerived.init(lang, messages);
	};

	$effect(() => {
		void stateConfig.jurisdiction.socialCasino;
		reinit();
	});
</script>
