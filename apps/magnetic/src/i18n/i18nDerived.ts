import { stateI18nDerived } from 'state-shared';

import { i18nDerived as i18nDerivedUiPixi } from 'components-ui-pixi';
import { i18nDerived as i18nDerivedUiHtml } from 'components-ui-html';

export const i18nDerived = {
	...i18nDerivedUiPixi,
	...i18nDerivedUiHtml,
	translate: (key: string) => stateI18nDerived.translate(key),
	// Interpolation helper — the shared translate() has no var support, so we use %name%
	// placeholders (which Lingui leaves intact) and substitute here.
	translateVars: (key: string, vars: Record<string, string | number>) =>
		stateI18nDerived
			.translate(key)
			.replace(/%(\w+)%/g, (_m, name: string) => String(vars[name] ?? '')),
	home: () => stateI18nDerived.translate('HOME'),
	notTranslated: () => stateI18nDerived.translate('NOT TRANSLATED'),
	gameTitle: () => stateI18nDerived.translate('GAME TITLE'),
	balance: () => stateI18nDerived.translate('BALANCE'),
	betLabel: () => stateI18nDerived.translate('BET'),
	totalCost: () => stateI18nDerived.translate('TOTAL COST'),
	realCost: () => stateI18nDerived.translate('REAL COST'),
	mode: () => stateI18nDerived.translate('MODE'),
	buyBonus: () => stateI18nDerived.translate('BUY BONUS'),
	paytable: () => stateI18nDerived.translate('PAYTABLE'),
	gameRules: () => stateI18nDerived.translate('GAME RULES'),
	autoplayLabel: () => stateI18nDerived.translate('AUTOPLAY'),
	turboLabel: () => stateI18nDerived.translate('TURBO'),
	replay: () => stateI18nDerived.translate('REPLAY'),
	playAgain: () => stateI18nDerived.translate('PLAY AGAIN'),
	event: () => stateI18nDerived.translate('EVENT'),
	payout: () => stateI18nDerived.translate('PAYOUT'),
	win: () => stateI18nDerived.translate('WIN'),
	startReplay: () => stateI18nDerived.translate('START REPLAY'),
	retryResume: () => stateI18nDerived.translate('RETRY RESUME'),
	recoveryTitle: () => stateI18nDerived.translate('RECOVERY TITLE'),
	recoveryBody: () => stateI18nDerived.translate('RECOVERY BODY'),
	dealIt: () => stateI18nDerived.translate('DEAL IT'),
	allIn: () => stateI18nDerived.translate('ALL IN'),
};
