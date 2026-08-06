import { i18n, type Messages } from '@lingui/core';
import { compileMessage } from '@lingui/message-utils/compileMessage';
import { type Language } from './stateUrl.svelte';

export const stateI18n = $state({
	i18n
});

export const stateI18nDerived = {
	init: (lang: Language, messages: Messages) => {
		// The catalogs are hand-written raw ICU strings (messagesMap/*.ts), never `lingui compile`d.
		// Without a runtime compiler lingui falls back to using them verbatim and warns "Uncompiled
		// message detected!" once per string — 156 console warnings per session. Registered here
		// rather than at module top level so tree-shaking of the `export *` barrel can't drop it.
		stateI18n.i18n.setMessagesCompiler(compileMessage);
		stateI18n.i18n.load(lang, messages as Messages);
		stateI18n.i18n.activate(lang);
	},
	translate: (value: string) => stateI18n.i18n._(stateI18n.i18n.t(value)),
};