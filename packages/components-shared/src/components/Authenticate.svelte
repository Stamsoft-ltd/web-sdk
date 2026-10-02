<script lang="ts">
	import { onMount, type Snippet } from 'svelte';

	import { requestAuthenticate } from 'rgs-requests';
	import {
		stateUrlDerived,
		stateBet,
		stateConfig,
		stateModal,
		stateUi,
		modalErrorCodeFrom,
	} from 'state-shared';
	import { API_AMOUNT_MULTIPLIER } from 'constants-shared/bet';
	import { normalizeRgsBetConfig } from '../betConfig';
	import { loadReplayBet } from '../replay';

	type Props = { children: Snippet };

	const props: Props = $props();

	let authenticated = $state(false);

	const authenticate = async () => {
		try {
			const authenticateData = await requestAuthenticate({
				rgsUrl: stateUrlDerived.rgsUrl(),
				sessionID: stateUrlDerived.sessionID(),
				language: stateUrlDerived.lang(),
			});

			// error
			if (authenticateData?.error) throw authenticateData;

			// balance
			if (authenticateData?.balance) {
				// Example of authenticateData.balance
				// {
				// 		"amount": 10000000000000000,
				// 		"currency": "USD"
				// },
				stateBet.currency = authenticateData.balance.currency;
				stateBet.balanceAmount = authenticateData.balance.amount / API_AMOUNT_MULTIPLIER;
			}

			// config
			if (authenticateData?.config) {
				// Example of authenticateData.config
				// {
				// 	"gameID": "37_test-lines",
				// 	"minBet": 100000,
				// 	"maxBet": 1000000000,
				// 	"stepBet": 10000,
				// 	"defaultBetLevel": 1000000,
				// 	"betLevels": [100000, 200000, ..., 1000000000],
				// 	"betModes": {},
				// 	"jurisdiction": {
				// 			"socialCasino": false,
				// 			"disabledFullscreen": false,
				// 			"disabledTurbo": false,
				// 			"disabledSuperTurbo": false,
				// 			"disabledAutoplay": false,
				// 			"disabledSlamstop": false,
				// 			"disabledSpacebar": false,
				// 			"disabledBuyFeature": false,
				// 			"displayNetPosition": false,
				// 			"displayRTP": false,
				// 			"displaySessionTimer": false,
				// 			"minimumRoundDuration": 0
				// 	}
				// }
				// Merge over the defaults: an operator that omits `jurisdiction` (or some of its flags)
				// must not leave `stateConfig.jurisdiction` undefined — every HUD dereferences it.
				stateConfig.jurisdiction = {
					...stateConfig.jurisdiction,
					...(authenticateData?.config?.jurisdiction ?? {}),
				};
				// The bet must always be one of the levels the RGS offered (bounded by min/maxBet),
				// and the default the closest offered level to `defaultBetLevel`.
				const normalizedBetConfig = normalizeRgsBetConfig(
					authenticateData.config,
					stateConfig.betAmountOptions,
				);
				stateConfig.betAmountOptions = normalizedBetConfig.betAmountOptions;
				stateConfig.betMenuOptions = normalizedBetConfig.betMenuOptions;
				stateConfig.minBetAmount = normalizedBetConfig.minBetAmount;
				stateConfig.maxBetAmount = normalizedBetConfig.maxBetAmount;
				stateConfig.stepBetAmount = normalizedBetConfig.stepBetAmount;
				stateConfig.defaultBetAmount = normalizedBetConfig.defaultBetAmount;
				stateBet.betAmount = normalizedBetConfig.defaultBetAmount;
				stateBet.wageredBetAmount = normalizedBetConfig.defaultBetAmount;
			}

			// round
			if (authenticateData?.round) {
				// Example of authenticateData.round 
				// {
				// 	"betID": 62277967,
				// 	"amount": 1000000,
				// 	"payout": 33400000,
				// 	"payoutMultiplier": 33.4,
				// 	"active": true,
				// 	"state": [...],
				// 	"mode": "BONUS",
				// 	"event": null
				// }

				if(authenticateData.round?.state) {
					// @ts-ignore
					stateBet.betToResume =  authenticateData.round;
				}

				if(authenticateData.round?.amount) {
					const betAmountValue =
						authenticateData.round.amount > 0
							? authenticateData.round.amount / API_AMOUNT_MULTIPLIER
							: 0;
					stateBet.betAmount = betAmountValue;
					stateBet.wageredBetAmount = betAmountValue;
				}

				if (authenticateData.round?.mode) {
					stateBet.activeBetModeKey = authenticateData.round.mode;
				};
			}
		} catch (error) {
			console.error(error);
			// No session means nothing to return to: persistent. Translated copy by code (R-07).
			const code = modalErrorCodeFrom(error, 'session');
			stateModal.modal = { name: 'error', error, code: code === 'network' ? 'network' : 'session' };
		}
	};

	const handleReplay = async () => {
		try {
			await loadReplayBet();
		} catch (error) {
			console.error(error);
			// Dismissible: the game still mounts (see onMount) and its replay UI can offer a retry.
			stateModal.modal = { name: 'error', error, code: 'replay', recoverable: true };
		}
	};

	onMount(async () => {
		try {
			if (stateUrlDerived.replay()) {
				stateUi.config.mode = 'replay';
				await handleReplay();
			} else {
				stateUi.config.mode = 'default';
				await authenticate();
			}
		} finally {
			// A failed request must still mount the app, so the error modal (and, in replay, a retry)
			// renders over the game instead of a blank screen.
			authenticated = true;
		}
	});
</script>

{#if authenticated}
	{@render props.children()}
{/if}
