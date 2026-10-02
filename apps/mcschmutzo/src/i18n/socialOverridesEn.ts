// Social-casino (sweepstakes) English. SocialI18nSync activates `{ ...messagesMap.en, ...this }` when
// the jurisdiction is social or the URL carries `social=true`, so every key here replaces its English
// value in that mode. Stake reviewers match prohibited terms as SUBSTRINGS ("pay" inside "paytable",
// "bet" inside "bet level", "fund" inside "funds"), so every rendered value must be free of them.
// Scan with the social audit script after any copy change (STAKE_REVIEW_LESSONS R-02).
//
// Two groups: the game's own keys, and the shared-package keys (components-ui-html /
// components-ui-pixi / utils-xstate) whose key IS the English sentence — those never appear in the
// game's catalog, so they must be overridden here or they render unscrubbed. The long insufficient-
// funds sentence is matched as a key and must stay character-for-character.
//
// Deliberately NOT overridden: INFO LEGAL BODY 1-3 + INFO LEGAL COPYRIGHT — Engine's own General
// Disclaimer template, shipped verbatim.
export const socialOverridesEn: Record<string, string> = {
	// ── Game keys ────────────────────────────────────────────────────────────────────────────────
	BET: 'PLAY',
	BUY: 'PLAY',
	'BUY BONUS': 'GET BONUS',
	PAYTABLE: 'WIN TABLE',
	PAYOUT: 'WIN',
	'TOTAL COST': 'TOTAL PLAY',
	'REAL COST': 'PLAY AMOUNT',
	'FEATURE BUY': 'GET BONUS',
	'CONFIRM TEXT': 'Play %mode% for %cost%?',
	'CONFIRM ACTIVATE TEXT': 'Activate %mode%? Each spin is played for %cost%.',
	'CONFIRM PURCHASE': 'CONFIRM PLAY',
	'UI BET PLUS': 'PLAY +',
	'UI BET MINUS': 'PLAY -',
	'INFO UI BETPLUS DESC': 'Increases your total play amount.',
	'INFO UI BETMINUS DESC': 'Decreases your total play amount.',
	'INFO MAX WIN VALUE': '%value%× play amount',
	'INFO FB COST': '%cost%× the base play amount',
	'INFO OVERVIEW BODY':
		'McSchmutzo is played on a 5×5 reel setup and awards wins on 50 fixed win-lines. Winning combinations are formed by landing matching symbols on an active win-line, starting from the leftmost reel and continuing on consecutive reels. All wins are calculated according to the symbol values shown in the Win Table. Multiple winning combinations may be awarded on the same game round.',
	'INFO WILD BODY 1':
		'The WILD symbol substitutes for all regular winning symbols. When a Wild contributes to a winning combination, it substitutes for the required winning symbol and is counted as part of that win.',
	'INFO WAYS BODY':
		'McSchmutzo is played on a 5×5 grid with 50 fixed win-lines. Land 3, 4, or 5 matching symbols from left to right, starting from the leftmost reel, on one of the 50 win-lines to create a win. The Wild substitutes for all regular winning symbols and can help complete winning combinations, but it does not substitute for the Scatter or special Multiplier symbols. Winning combinations are awarded according to the Win Table.',
	'INFO FB1 BODY':
		'While active, every spin is played for the amount shown below and has an increased chance of triggering the Free Games. All other game mechanics remain unchanged. It stays active until it is deactivated.',
	'INFO FB2 BODY':
		'While active, every spin is played for the amount shown below and is guaranteed to be a winning spin that starts the Lock & Re-Spin feature. It stays active until it is deactivated.',
	'INFO INTERRUPTED BODY 2':
		'All valid plays and potential wins remain active until the round is fully completed.',

	// ── Shared-package keys (rendered by components-ui-html / components-ui-pixi / utils-xstate) ──
	'BET MENU': 'PLAY MENU',
	'SELECT YOUR BET': 'SELECT YOUR PLAY AMOUNT',
	'INSUFFICIENT FUNDS TO PLACE THIS BET. PLEASE ADD FUNDS TO YOUR ACCOUNT OR LOWER THE BET LEVEL.':
		'Your balance is too low for this play amount. Get more coins or lower your play amount.',
};
