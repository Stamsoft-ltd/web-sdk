import { mergeMessagesMaps, type MessagesMap } from 'utils-shared/i18n';
import { messagesMap as messagesMapUiPixi } from 'components-ui-pixi';
import { messagesMap as messagesMapUiHtml } from 'components-ui-html';
import { locales } from 'config-lingui';

import en from './en';
import ar from './ar';
import de from './de';
import es from './es';
import fi from './fi';
import fr from './fr';
import hi from './hi';
import id from './id';
import ja from './ja';
import ko from './ko';
import pl from './pl';
import pt from './pt';
import ru from './ru';
import tr from './tr';
import vi from './vi';
import zh from './zh';
import da from './da';

const localeMaps: Record<string, Record<string, string>> = {
	ar,
	de,
	en,
	es,
	fi,
	fr,
	hi,
	id,
	ja,
	ko,
	pl,
	pt,
	ru,
	tr,
	vi,
	zh,
	da,
};

// Danish (`da`) isn't in the shared `config-lingui` locale set, but the launcher can still request
// it, so support it app-locally in addition to the configured locales.
const appLocales = [...locales, 'da'];

// Every locale layers over English, so any key a translation is missing falls back to the English
// string instead of showing the raw key.
const messagesMapGame = Object.fromEntries(
	appLocales.map((locale) => [locale, { ...en, ...(localeMaps[locale] ?? {}) }]),
);

const merged = mergeMessagesMaps([
	messagesMapGame,
	messagesMapUiPixi,
	messagesMapUiHtml,
]) as unknown as Record<string, typeof en>;

// The shared UI packages (pixi/html) ship no `da` catalog, so give Danish the English UI/base
// strings with the Danish game strings layered on top (game text = Danish, chrome = English).
merged.da = { ...merged.en, ...merged.da };

// Any 2-letter locale code we don't ship a file for resolves to English.
const messagesMap = new Proxy(merged, {
	get: (target, prop) =>
		typeof prop === 'string' && !(prop in target) && /^[a-z]{2}([-_][A-Za-z]+)?$/.test(prop)
			? target.en
			: target[prop as keyof typeof target],
}) as unknown as MessagesMap & Record<string, typeof en>;

export default messagesMap;

// locales: en ar de es fi fr hi id ja ko pl pt ru tr vi zh + da (app-local)
