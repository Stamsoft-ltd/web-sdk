import { stateI18nDerived } from 'state-shared';

export const i18nDerived = {
	bet: () => stateI18nDerived.translate('BET'),
	max: () => stateI18nDerived.translate('MAX'),
	betMenu: () => stateI18nDerived.translate('BET MENU'),
	selectYourBet: () => stateI18nDerived.translate('SELECT YOUR BET'),
	confirm: () => stateI18nDerived.translate('CONFIRM'),
	masterVolume: () => stateI18nDerived.translate('MASTER VOLUME'),
	musicVolume: () => stateI18nDerived.translate('MUSIC VOLUME'),
	soundEffectVolume: () => stateI18nDerived.translate('SOUND EFFECT VOLUME'),
	autoSpins: () => stateI18nDerived.translate('AUTO SPINS'),
	numberOfRounds: () => stateI18nDerived.translate('NUMBER OF ROUNDS'),
	advanced: () => stateI18nDerived.translate('ADVANCED'),
	singleWinLimit: () => stateI18nDerived.translate('SINGLE WIN LIMIT'),
	lossLimit: () => stateI18nDerived.translate('LOSS LIMIT'),
	startAutoplay: () => stateI18nDerived.translate('START AUTOPLAY'),
	notification: () => stateI18nDerived.translate('NOTIFICATION'),
	autoSpinsStopInfo: () => stateI18nDerived.translate('AUTO PLAY HAS STOPPED DUE TO'),
	insufficientFunds: () => stateI18nDerived.translate('INSUFFICIENT FUNDS TO PLACE THIS BET. PLEASE ADD FUNDS TO YOUR ACCOUNT OR LOWER THE BET LEVEL.'),
	lossLimitReached: () => stateI18nDerived.translate('LOSS LIMIT REACHED'),
	singleWinLimitReached: () => stateI18nDerived.translate('SINGLE WIN LIMIT REACHED'),
	settings: () => stateI18nDerived.translate('SETTINGS'),
	// Error modal copy (ModalError). The key IS the English sentence so a game whose catalog lacks
	// the entry still renders readable English rather than a bare key.
	errorNetwork: () =>
		stateI18nDerived.translate('CONNECTION PROBLEM. PLEASE CHECK YOUR CONNECTION AND TRY AGAIN.'),
	errorSession: () =>
		stateI18nDerived.translate('YOUR SESSION HAS EXPIRED. PLEASE RELOAD THE GAME.'),
	errorLimits: () =>
		stateI18nDerived.translate('YOUR ACCOUNT LIMIT HAS BEEN REACHED.'),
	errorReplay: () =>
		stateI18nDerived.translate('THIS REPLAY COULD NOT BE LOADED. PLEASE TRY AGAIN.'),
	errorGeneral: () =>
		stateI18nDerived.translate('SOMETHING WENT WRONG. PLEASE TRY AGAIN.'),
};
