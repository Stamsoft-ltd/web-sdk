import { mergeMessagesMaps } from 'utils-shared/i18n';
import { messagesMap as messagesMapUiPixi } from 'components-ui-pixi';
import { messagesMap as messagesMapUiHtml } from 'components-ui-html';
import { locales } from 'config-lingui';

import en from './en';
import ar from './ar';
import de from './de';
import es from './es';
import fr from './fr';
import id from './id';
import ja from './ja';
import ko from './ko';
import pl from './pl';
import pt from './pt';
import ru from './ru';
import tr from './tr';
import vi from './vi';
import zh from './zh';
import fi from './fi';
import hi from './hi';
import da from './da';

// English is the source/fallback: every locale is spread over `en`, so any key a
// translation is missing still resolves to English instead of showing the raw key.
const localeMaps: Record<string, Record<string, string>> = {
	ar, de, en, es, fr, id, ja, ko, pl, pt, ru, tr, vi, zh, fi, hi, da,
};

// Danish (`da`) is not one of the shared `config-lingui` locales, but the launcher can still
// request it, so support it app-locally in addition to the configured set.
const appLocales = [...locales, 'da'];

const messagesMapGame = Object.fromEntries(
	appLocales.map((locale) => [locale, { ...en, ...(localeMaps[locale] ?? {}) }]),
);

const merged = mergeMessagesMaps([messagesMapGame, messagesMapUiPixi, messagesMapUiHtml]) as Record<
	string,
	(typeof en)
>;

// The shared UI packages (pixi/html) have no `da` catalog, so give Danish the English UI/base
// strings with the Danish game strings layered on top (game text = Danish, chrome = English).
merged.da = { ...merged.en, ...merged.da };

// Any locale we don't ship (e.g. the launcher passes `sv`, `no`, …) must fall back to full
// English text — otherwise Lingui returns the raw message KEY, which leaves modals/tutorials
// showing key identifiers instead of readable copy.
const messagesMap = new Proxy(merged, {
	get: (target, prop) =>
		typeof prop === 'string' && !(prop in target) && /^[a-z]{2}([-_][A-Za-z]+)?$/.test(prop)
			? target.en
			: target[prop as keyof typeof target],
});

export default messagesMap;
