import { requestReplay } from 'rgs-requests';
import { stateBet, stateUrlDerived } from 'state-shared';
import { API_AMOUNT_MULTIPLIER } from 'constants-shared/bet';

/**
 * Fetch the replay round named by the URL (`?replay=true&game=&version=&mode=&event=&amount=`) and
 * stage it as `stateBet.betToResume`, so the game plays it through the normal resume path.
 *
 * Throws when the round cannot be loaded. Exported (rather than living only inside Authenticate) so
 * a game's replay HUD can offer a retry without reloading the page.
 */
export const loadReplayBet = async () => {
	if (stateUrlDerived.currency()) stateBet.currency = stateUrlDerived.currency();
	const amount = stateUrlDerived.amount() / API_AMOUNT_MULTIPLIER || 0;
	stateBet.betAmount = amount;
	stateBet.wageredBetAmount = amount;
	stateBet.activeBetModeKey = stateUrlDerived.mode();

	const data = await requestReplay({
		rgsUrl: stateUrlDerived.rgsUrl(),
		game: stateUrlDerived.game(),
		mode: stateUrlDerived.mode(),
		version: stateUrlDerived.version(),
		event: stateUrlDerived.event(),
		language: stateUrlDerived.lang(),
	});

	if (!data || data.error || !Array.isArray(data.state) || data.state.length === 0) {
		throw data || new Error('Replay round unavailable');
	}

	const replayCurrency = data.balance?.currency || data.currency;
	if (replayCurrency) stateBet.currency = replayCurrency;
	// @ts-ignore replay endpoint is not part of the generated RGS schema yet.
	stateBet.betToResume = {
		...data,
		event: '0',
		active: true,
		mode: stateUrlDerived.mode(),
	};

	return data;
};
