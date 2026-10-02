<script lang="ts">
	// Social-casino mode: re-activate the English catalog with the prohibited-term overrides on top
	// (same pattern as forest-gang / theme-park). Mounted inside <LoadI18n> so it runs after the
	// regular catalog load and wins.
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
		// Lingui's activate/load methods read and mutate their own reactive internals. Tracking those
		// reads would make this effect subscribe to the state it writes (effect_update_depth_exceeded).
		untrack(() => reinit(social, lang));
	});
</script>
