<script lang="ts">
	import { stateConfig, stateI18n, stateUrlDerived } from 'state-shared';
	import { untrack } from 'svelte';

	import messagesMap from '../i18n/messagesMap';
	import { socialOverridesEn } from '../i18n/socialOverridesEn';

	const reinit = (social: boolean, lang: keyof typeof messagesMap) => {
		if (social) {
			stateI18n.i18n.loadAndActivate({
				locale: 'en',
				messages: { ...messagesMap.en, ...socialOverridesEn },
			});
			return;
		}
		stateI18n.i18n.loadAndActivate({
			locale: lang,
			messages: { ...(messagesMap[lang] ?? messagesMap.en) },
		});
	};

	$effect(() => {
		const social = stateConfig.jurisdiction.socialCasino || stateUrlDerived.social();
		const lang = stateUrlDerived.lang();
		// Lingui's activate/load methods read and mutate their own reactive internals.
		// Tracking those reads makes this effect subscribe to the state it writes and
		// causes Svelte's effect_update_depth_exceeded loop during dev startup.
		untrack(() => reinit(social, lang));
	});
</script>
