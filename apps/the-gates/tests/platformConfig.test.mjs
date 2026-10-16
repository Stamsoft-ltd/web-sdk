import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
	normalizeGatesJurisdiction,
	stepRgsBetLevel,
	socialEnglish,
	JURISDICTION_DEFAULTS,
} from '../src/game/platformConfig.ts';
const src = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
test('missing RGS jurisdiction fields receive defaults without losing any server restriction', () => {
	assert.deepEqual(normalizeGatesJurisdiction(undefined), JURISDICTION_DEFAULTS);
	for (const key of Object.keys(JURISDICTION_DEFAULTS).filter((k) => k !== 'minimumRoundDuration'))
		assert.equal(normalizeGatesJurisdiction({ [key]: true })[key], true);
	assert.equal(normalizeGatesJurisdiction({ socialCasino: true }, false).socialCasino, true);
	assert.equal(normalizeGatesJurisdiction({}, true).socialCasino, true);
	assert.equal(normalizeGatesJurisdiction({ minimumRoundDuration: 2.5 }).minimumRoundDuration, 2.5);
	for (const value of [-1, Infinity, 'not a number'])
		assert.equal(
			normalizeGatesJurisdiction({ minimumRoundDuration: value }).minimumRoundDuration,
			0,
		);
});
test('bet stepper follows RGS levels, including sub-cent and resumed off-list amounts', () => {
	const levels = [0.000001, 0.01, 0.025, 0.1, 1];
	assert.equal(stepRgsBetLevel(levels, 0.01, 1), 0.025);
	assert.equal(stepRgsBetLevel(levels, 0.025, -1), 0.01);
	assert.equal(stepRgsBetLevel(levels, 0.03, 1), 0.1);
	assert.equal(stepRgsBetLevel(levels, 0.03, -1), 0.025);
	assert.equal(stepRgsBetLevel(levels, 1, 1), 1);
	assert.equal(stepRgsBetLevel(levels, 0.000001, -1), 0.000001);
	assert.equal(stepRgsBetLevel([], 5, 1), 5);
});
test('social fallback replaces real-money copy, not wallet units or localized catalogs', () => {
	const copy = socialEnglish(
		'Buy bonus. Base bet. Paid spins. Purchase and wager money. Pays anywhere.',
	);
	assert.doesNotMatch(copy, /\b(buy|bet|paid|purchase|wager|money|pays)\b/i);
	const i18n = src('../src/i18n/index.ts');
	assert.match(i18n, /const localized = stateI18nDerived.translate\(key\)/);
	assert.match(i18n, /if \(!social\) return localized/);
	assert.match(i18n, /bgSocial\[key\]/);
});
test('live boot, wager and settlement retain shared RGS configuration and distinct unit scales', () => {
	const layout = src('../src/routes/+layout.svelte'),
		game = src('../src/components/Game.svelte');
	assert.match(layout, /dev && page.url.searchParams.get\('preview'\) === 'true'/);
	assert.match(layout, /<Authenticate><LoadI18n/);
	const auth = src('../../../packages/components-shared/src/components/Authenticate.svelte');
	assert.match(auth, /requestAuthenticate/);
	assert.match(auth, /normalizeRgsBetConfig/);
	assert.match(auth, /authenticateData.balance.amount \/ API_AMOUNT_MULTIPLIER/);
	const requests = src('../../../packages/rgs-requests/src/rgs-requests.ts');
	assert.match(requests, /amount: options.amount \* API_AMOUNT_MULTIPLIER/);
	const actor = src('../../../packages/utils-xstate/src/createPrimaryMachines.ts');
	assert.match(actor, /requestEndRound/);
	assert.match(actor, /stateBet.wageredBetAmount = stateBet.betAmount/);
	assert.match(game, /stepRgsBetLevel\(stateConfig.betAmountOptions/);
	assert.match(game, /formatWalletAmount\(stateBet.currency/);
	assert.match(game, /formatWinAmount\(stateBet.currency/);
});
