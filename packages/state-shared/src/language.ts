import { locales } from 'config-lingui';

import type { Language } from './stateUrl.svelte';

// Stake accepts ISO 639-1 language codes. Danish is supported by the launcher and by games that
// provide an app-local catalogue even though it is not part of the shared Lingui build list yet.
const SUPPORTED_LANGUAGE_CODES = new Set<string>([...locales, 'da']);

export const normalizeLanguageParam = (raw: unknown): Language => {
	const code = String(raw ?? '')
		.trim()
		.toLowerCase();
	const normalized = code === 'br' ? 'pt' : code;
	return (SUPPORTED_LANGUAGE_CODES.has(normalized) ? normalized : 'en') as Language;
};
