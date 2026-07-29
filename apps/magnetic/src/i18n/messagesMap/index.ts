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

// English is the source/fallback: each locale is spread over `en`, so any key a translation is
// missing (e.g. the non-modal game strings, which are localized app-side later) still resolves to
// English instead of showing a raw key.
const localeMaps: Record<string, Record<string, string>> = {
	ar, de, en, es, fi, fr, hi, id, ja, ko, pl, pt, ru, tr, vi, zh, da,
};

// Danish (`da`) is not one of the shared `config-lingui` locales, but the launcher can still request
// it, so support it app-locally in addition to the configured set.
const appLocales = [...locales, 'da'];

const messagesMapGame = Object.fromEntries(
	appLocales.map((locale) => [locale, { ...en, ...(localeMaps[locale] ?? {}) }]),
);

const merged = mergeMessagesMaps([
	messagesMapGame,
	messagesMapUiPixi,
	messagesMapUiHtml,
]) as unknown as Record<string, typeof en>;

// The shared UI packages (pixi/html) have no `da` catalog, so give Danish the English UI/base strings
// with the Danish game strings layered on top (game text = Danish, shared chrome = English).
merged.da = { ...merged.en, ...merged.da };

// Any locale the launcher requests that we don't ship (e.g. `sv`, `no`) must fall back to full
// English — otherwise Lingui returns the raw message KEY, leaving the modal showing identifiers.
const messagesMap = new Proxy(merged, {
	get: (target, prop) =>
		typeof prop === 'string' && !(prop in target) && /^[a-z]{2}([-_][A-Za-z]+)?$/.test(prop)
			? target.en
			: target[prop as keyof typeof target],
}) as unknown as MessagesMap & Record<string, typeof en>;

export default messagesMap;
