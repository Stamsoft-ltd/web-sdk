import { stateBet, stateBetDerived } from 'state-shared';

/**
 * A buy is a ONE-SHOT purchase, so its mode must not outlive the round it paid for. If it does,
 * betCost() stays at 100x/500x the bet: isBetCostAvailable() goes false as soon as the balance cannot
 * cover ANOTHER buy, and the spin button greys out with no way back to BASE (a soft-lock).
 * 'activate' modes (extra chance, feature spin) are toggles the player can switch off from the HUD,
 * so they are deliberately left alone.
 *
 * Called on every way out of a bet/resume round — including a failed request, where the round never
 * started but the mode had already been selected.
 */
export const resetOneShotBetMode = () => {
	if (stateBetDerived.activeBetMode()?.type === 'buy') {
		stateBet.activeBetModeKey = 'BASE';
	}
};
