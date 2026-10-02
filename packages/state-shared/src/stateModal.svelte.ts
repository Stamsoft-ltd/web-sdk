type ModalEmpty = null;

/**
 * Known error kinds. The modal renders translated, player-facing copy for each code; the raw error
 * object is for the console only. Code below the UI layer (state machines, fetch wrappers) must set
 * a code instead of putting English text in front of the player (STAKE_REVIEW_LESSONS R-07).
 */
export type ModalErrorCode =
	| 'insufficientFunds' // ERR_IPB, or the client-side cost check
	| 'network' // the request never got an answer (offline, DNS, CORS, timeout)
	| 'session' // ERR_IS / ERR_ATE: the session is gone, nothing works until a relaunch
	| 'limits' // ERR_GLE: a player limit blocks further rounds
	| 'replay' // the replay round could not be loaded
	| 'general'; // anything else

type ModalError = {
	name: 'error';
	error: any;
	/**
	 * Recoverable errors leave the game in a playable state (the bet machine falls back to idle),
	 * so the modal is dismissible and the player can adjust the bet and carry on. Fatal errors
	 * (failed authentication, expired session) stay persistent — there is nothing to go back to.
	 */
	recoverable?: boolean;
	/** Known error kinds render a translated, player-facing message instead of the raw payload. */
	code?: ModalErrorCode;
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

const RGS_ERROR_CODE_MAP: Record<string, ModalErrorCode> = {
	ERR_IPB: 'insufficientFunds',
	ERR_IS: 'session',
	ERR_ATE: 'session',
	ERR_GLE: 'limits',
};

const rgsStatusCode = (error: any): string => {
	const candidates = [error?.error, error?.code, error?.statusCode, error?.payload?.error, error?.status?.statusCode];
	for (const candidate of candidates) {
		if (typeof candidate === 'string' && candidate.trim()) return candidate.trim().toUpperCase();
	}
	return '';
};

/**
 * Map whatever a request threw (an RGS error payload, a fetch TypeError, a JSON SyntaxError…) to a
 * player-facing error code. Unknown shapes are 'general' — never surface the raw payload.
 */
export const modalErrorCodeFrom = (error: unknown, fallback: ModalErrorCode = 'general'): ModalErrorCode => {
	const known = RGS_ERROR_CODE_MAP[rgsStatusCode(error)];
	if (known) return known;
	// fetch() rejects with a TypeError when the request never got an answer (offline, DNS, CORS).
	if (error instanceof TypeError) return 'network';
	if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'network';
	return fallback;
};
