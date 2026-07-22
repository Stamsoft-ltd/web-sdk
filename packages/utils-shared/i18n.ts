import _ from 'lodash';
import type { Messages } from '@lingui/core';

import type { Language } from 'state-shared';

export type MessagesMap = Record<Language, Messages>;

// Accepts partial maps: callers commonly layer package catalogs that only cover some locales
// (e.g. a UI package shipping just en/zh) over a full game catalog.
export const mergeMessagesMaps = (messagesMapList: Partial<MessagesMap>[]) => {
	const merged = messagesMapList
		.filter(Boolean)
		.reduce((acc, current) => _.merge(acc, current), {} as MessagesMap);

	return merged;
};
