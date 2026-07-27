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
};

const messagesMapGame = Object.fromEntries(
	locales.map((locale) => [locale, { ...en, ...(localeMaps[locale] ?? {}) }]),
);

const merged = mergeMessagesMaps([messagesMapGame, messagesMapUiPixi, messagesMapUiHtml]) as unknown as Record<
	string,
	typeof en
>;

const messagesMap = new Proxy(merged, {
	get: (target, prop) =>
		typeof prop === 'string' && !(prop in target) && /^[a-z]{2}([-_][A-Za-z]+)?$/.test(prop)
			? target.en
			: target[prop as keyof typeof target],
}) as unknown as MessagesMap & Record<string, typeof en>;

export default messagesMap;
