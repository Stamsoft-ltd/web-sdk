<script lang="ts">
	import { onMount, type Snippet } from 'svelte';

	import { requestAuthenticate, requestReplay } from 'rgs-requests';
	import { stateUrlDerived, stateBet, stateConfig, stateModal, stateUi } from 'state-shared';
	import { API_AMOUNT_MULTIPLIER } from 'constants-shared/bet';
	import { normalizeRgsBetConfig } from '../betConfig';

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
				stateConfig.jurisdiction = authenticateData?.config?.jurisdiction;
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

				if (authenticateData.round?.state) {
					// @ts-ignore
					stateBet.betToResume = authenticateData.round;
				}

				if (authenticateData.round?.amount) {
					const betAmountValue =
						authenticateData.round.amount > 0
							? authenticateData.round.amount / API_AMOUNT_MULTIPLIER
							: 0;
					stateBet.betAmount = betAmountValue;
					stateBet.wageredBetAmount = betAmountValue;
				}

				if (authenticateData.round?.mode) {
					stateBet.activeBetModeKey = authenticateData.round.mode;
				}
			}
		} catch (error) {
			console.error(error);
			stateModal.modal = { name: 'error', error };
		}
	};

	const handleReplay = async () => {
		try {
			if (stateUrlDerived.currency()) stateBet.currency = stateUrlDerived.currency();
			stateBet.betAmount = stateUrlDerived.amount() / API_AMOUNT_MULTIPLIER || 0;
			stateBet.wageredBetAmount = stateUrlDerived.amount() / API_AMOUNT_MULTIPLIER || 0;
			stateBet.activeBetModeKey = stateUrlDerived.mode();

			const data = await requestReplay({
				rgsUrl: stateUrlDerived.rgsUrl(),
				game: stateUrlDerived.game(),
				mode: stateUrlDerived.mode(),
				version: stateUrlDerived.version(),
				event: stateUrlDerived.event(),
				language: stateUrlDerived.lang(),
			});

			if (!data || data.error) throw data || new Error('Replay unavailable. Please retry.');

			const replayCurrency = data.balance?.currency || data.currency;
			if (replayCurrency) stateBet.currency = replayCurrency;
			// @ts-ignore replay endpoint is not part of the generated RGS schema yet.
			stateBet.betToResume = {
				...data,
				event: '0',
				active: true,
				mode: stateUrlDerived.mode(),
			};
		} catch (error) {
			console.error(error);
			stateModal.modal = { name: 'error', error };
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
			// Failed replay requests must still mount the app so its replay error/retry UI can render.
			authenticated = true;
		}
	});
</script>

{#if authenticated}
	{@render props.children()}
{/if}
