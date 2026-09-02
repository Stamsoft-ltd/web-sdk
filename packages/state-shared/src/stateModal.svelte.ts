type ModalEmpty = null;

type ModalError = {
	name: 'error';
	error: any;
	/**
	 * Recoverable errors leave the game in a playable state (the bet machine falls back to idle),
	 * so the modal is dismissible and the player can adjust the bet and carry on. Fatal errors
	 * (failed authentication) stay persistent — there is nothing to go back to.
	 */
	recoverable?: boolean;
	/** Known error kinds render a translated, player-facing message instead of the raw payload. */
	code?: 'insufficientFunds';
};

type ModalBetMenu = {
	name: 'betAmountMenu';
};

type ModalBuyBonus = {
	name: 'buyBonus';
};

type ModalBuyBonusConfirm = {
	name: 'buyBonusConfirm';
};

type ModalAutoSpin = {
	name: 'autoSpin';
};

type ModalAutoSpinMessage = {
	name: 'autoSpinMessage';
	message: 'insufficientFunds' | 'lossLimitReached' | 'singleWinLimitReached';
};

type ModalPayTable = {
	name: 'payTable';
};

type ModalGameRules = {
	name: 'gameRules';
};

type ModalSettings = {
	name: 'settings';
};

type Modal =
	| ModalEmpty
	| ModalError
	| ModalBetMenu
	| ModalBuyBonus
	| ModalBuyBonusConfirm
	| ModalAutoSpin
	| ModalAutoSpinMessage
	| ModalPayTable
	| ModalGameRules
	| ModalSettings;

export const stateModal = $state({
	modal: null as Modal,
});
