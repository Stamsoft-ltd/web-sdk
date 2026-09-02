/**
 * English text overrides for social-casino mode (Stake.US).
 *
 * Jurisdiction requirements prohibit gambling terminology in player-facing text:
 *   Bet -> Play          Win/Payout -> Win (never "Payout")     Cash/Money -> Coins
 *   Buy/Purchase -> Play or "Instantly Triggered"                Gamble/Wager -> Play
 *   Deposit/Withdraw -> Get Coins / Redeem                       Stake -> Play Amount
 *   Credit/Fund -> Balance                                       Currency -> Token
 *   "Cost of" -> "Can be played for"
 *
 * Applied by SocialI18nSync.svelte when stateConfig.jurisdiction.socialCasino is true or the
 * session carries ?social=true. Only keys whose base English contains a restricted term appear
 * here — everything else falls through to messagesMap/en.ts unchanged.
 */
export const socialOverridesEn: Record<string, string> = {
	// ── Core HUD labels ──────────────────────────────────────────────────────────
	BET: 'PLAY',
	'BET SIZE': 'PLAY AMOUNT',
	'BUY BONUS': 'GET BONUS',
	BUY: 'PLAY',
	PAYOUT: 'WIN',
	'BET REPLAY': 'Play Replay',
	'TOTAL BET COST': 'Total Play',
	'REPLAY DISCLAIMER': 'This is a replay of a previous play round. No plays will be placed.',
	'BASE BET': 'BASE PLAY',
	'COST MULTIPLIER': 'FEATURE MULTIPLIER',
	'PAYOUT MULTIPLIER': 'FINAL MULTIPLIER',

	// ── Bet-mode cards / tickers ─────────────────────────────────────────────────
	'BET MODE BONUS DESCRIPTION':
		'Play 10 free spins with boosted magnet odds for 100x your selected play amount.',
	'BET MODE BONUS BUTTON': 'PLAY',
	'BET MODE BONUS TICKER IDLE': 'COME AND PLAY',
	'BET MODE CHANCE DIALOG':
		'Chance Spin stays active until disabled. Each round can be played for 2x your play amount and triples bonus trigger odds.',
	'BET MODE CHANCE DESCRIPTION': 'Activate Chance Spin for 2x your selected play amount per round.',
	'BET MODE SUPER DESCRIPTION':
		'Play the persistent super bonus for 500x your selected play amount.',
	'BET MODE SUPER BUTTON': 'PLAY',
	'BET MODE SUPER TICKER IDLE': 'COME AND PLAY',
	'BET MODE FEATURE DIALOG':
		'Feature Spin stays active until disabled. Each round can be played for 50x your play amount and guarantees one magnet spin.',
	'BET MODE FEATURE DESCRIPTION':
		'Activate Feature Spin for 50x your selected play amount per round.',

	// ── Rules / paytable ─────────────────────────────────────────────────────────
	'RULE BUY TITLE': 'PLAY / ACTIVATE MODES',
	'RULE BUY TEXT':
		'Drop-O-Magnet can be played for 100x your play amount. Mega Chain can be played for 500x. Chance Spin can be played for 2x per round. Feature Spin can be played for 50x per round. Max win is 20,000x. Target RTP is 96.1%.',
	'HOWTO BET TITLE': 'PLAY AMOUNT SELECTOR',
	'HOWTO BET TEXT':
		'Use the + and - buttons or open the menu to change the displayed play amount before a round starts.',
	'HOWTO BUY TITLE': 'GET BONUS',
	'HOWTO BUY TEXT':
		'Open Get Bonus to choose Drop-O-Magnet, Mega Chain, Chance Spin or Feature Spin. Instantly triggered bonuses require confirmation. Activate modes can be toggled on or off.',
	'HOWTO REPLAY TEXT':
		'Replay loads a previously completed event and displays the original play amount, total play amount and win information.',
	'PAYTABLE BUY TITLE': 'PLAY MODES',
	'PAYTABLE BUY_TEXT':
		'Drop-O-Magnet: 100x play amount.\nMega Chain: 500x play amount.\nChance Spin: 2x play amount per round.\nFeature Spin: 50x play amount per round.',
	'PAYTABLE MAX_TEXT': 'Advertised max win is 20,000x the selected play amount.',

	// ── Info modal ───────────────────────────────────────────────────────────────
	'INFO FEATURE BUY': 'INSTANT FEATURES',
	'INFO OV MAXWIN': 'Maximum win: %value% play amount.',
	'INFO FB SUB':
		'Instant feature options are available only where allowed. All instant feature and bonus options are won as a multiple of the selected play amount.',
	'INFO FB FEATURE TITLE': 'Instant Feature',
	'INFO FB BONUS TITLE': 'Instant Bonus',
	// The three card descriptions all open with "Buys …" in the base map — `buy -> play` on the
	// prohibited list, and reviewers match it as a SUBSTRING, so "Buys" fails just like payline did.
	// `bought -> instantly triggered` gives the wording for the two direct-access cards.
	'INFO FB EXTRA TEXT':
		'Plays a special spin with a guaranteed magnetic connection and a chance to land Multiplier Wilds.',
	'INFO FB FEATURE TEXT': 'Instantly triggers the Drop-O-Magnet Free Spins feature.',
	'INFO FB BONUS TEXT': 'Instantly triggers the stronger Magnetic Mega Chain Free Spins feature.',
	'INFO CTRL SPIN DESC': 'Start a game round with your selected play amount.',
	'INFO CTRL PLUS': 'Increase Play Amount',
	'INFO CTRL PLUS DESC': 'Raise your total play amount.',
	'INFO CTRL MINUS': 'Decrease Play Amount',
	'INFO CTRL MINUS DESC': 'Lower your total play amount.',

	// ── Confirmation + bonus cards ───────────────────────────────────────────────
	'BUY CONFIRM': 'PLAY %name% FOR %cost%?',
	'BUY EXTRA CHANCE TITLE': 'Extra Chance',
	'BUY FEATURE SPINS TITLE': 'Feature Spins',
	// Same "Buys …" sentence as INFO FB EXTRA TEXT, reused by the buy-bonus card — scrub both.
	'BUY FEATURE SPINS DESC':
		'Plays a special spin with a guaranteed magnetic connection and a chance to land Multiplier Wilds.',

	// ── "pay" family ─────────────────────────────────────────────────────────────
	// Reviewers apply the prohibited-term list as SUBSTRINGS, not whole words, so `pay -> win`
	// rejects paytable / payline / cluster-pay / "does not pay" even though none of those appear
	// literally in the table. Likewise `cost -> can be played for` catches COST / TOTAL COST.
	// (`%cost%` in BUY CONFIRM is a translateVars placeholder and is substituted before render, so
	// it never reaches the player as the literal word.)
	PAYTABLE: 'WIN TABLE',
	'INFO PAYTABLE': 'WIN TABLE',
	'INFO STAT PAYS': 'WINS',
	'INFO COST': 'PLAY AMOUNT',
	'TOTAL COST': 'TOTAL PLAY',
	'REAL COST': 'REAL PLAY',
	'INFO CTRL INFO DESC': 'View the game rules and win table.',
	'INFO CW 1': 'Magnetic uses cluster wins instead of win lines.',
	'INFO FEAT WILD TEXT':
		'Substitutes for regular symbols except Scatter. When activated, the Magnetic Wild randomly selects one regular symbol currently on the grid and attracts all matching symbols together. Wilds and Scatters cannot be selected. A Magnetic Wild activates only when it lands and does not reactivate during the resulting respin.',
	'BET MODE BASE DIALOG': '7x7 cluster-win base game with natural clusters and random magnets.',
	'RULE GAME TEXT':
		'Magnetic is a 7x7 cluster-win slot. Wins form when 5 or more matching symbols touch horizontally or vertically. Diagonal connections do not count.',
	'RULE SCATTER TEXT':
		'3 scatters trigger Drop-O-Magnet. 4 scatters trigger Mega Chain. Scatter does not win by itself.',
	'INFO OV TEXT 1':
		'Magnetic is a 7x7 cluster-win slot where wins are created by groups of matching symbols. Land 5 or more matching symbols connected horizontally or vertically to win.',
	'INFO GI INTERRUPTED 2':
		'All valid plays and potential winnings remain active until the round is fully completed.',
	'INFO GI LEGAL 1':
		'Malfunction voids all wins and plays. A stable internet connection is required. If the connection is lost, reload the game to complete any unfinished rounds.',

	// Insufficient-balance dialog. The base copy carries two restricted terms — "bet" (-> play) and
	// "funds" (fund -> balance / deposit -> get coins) — so social mode gets its own sentence. The
	// TITLE needs no override: "NOT ENOUGH BALANCE" contains no restricted substring.
	'NO BALANCE BODY': 'Your balance is too low for this play amount. Lower it to keep playing.',

	// ── Shared package keys (components-ui-html / components-ui-pixi / utils-xstate) ──────────────
	// These strings do NOT live in this game's messagesMap — they are hardcoded English inside the
	// shared packages, where the full sentence IS the lingui key. Lingui returns the key verbatim
	// when the catalog has no entry, so a missing override here renders raw gambling copy with no
	// error and no missing-translation marker. Scrubbing messagesMap/en.ts alone cannot catch them.
	//
	// Regenerate the list of keys the shared packages can render with:
	//   grep -rhno "translate('[^']*')" --include="*.ts" --include="*.svelte" \
	//     packages/components-ui-html/src packages/components-ui-pixi/src \
	//     packages/components-shared/src packages/utils-xstate/src | sed "s/.*translate('//;s/')$//" | sort -u
	// Every returned key must be free of restricted substrings or overridden here.
	'BET MENU': 'PLAY MENU',
	'SELECT YOUR BET': 'SELECT YOUR PLAY AMOUNT',
	// Rejected 2026-08-20. Reached ONLY by autoplay running out of balance, which renders the shared
	// <ModalAutoSpinMessage> — NOT this game's own scrubbed InsufficientFundsModal ('NO BALANCE BODY'
	// above), which handles the `modal.name === 'error'` path. Two dialogs, one logical message.
	'INSUFFICIENT FUNDS TO PLACE THIS BET. PLEASE ADD FUNDS TO YOUR ACCOUNT OR LOWER THE BET LEVEL.':
		'NOT ENOUGH BALANCE. GET MORE COINS OR LOWER YOUR PLAY LEVEL.',

	// Note: the General Game Disclaimer (DISCLAIMER TEXT) is intentionally NOT overridden here — the
	// base copy is jurisdiction-neutral legal boilerplate, so social mode shows the same verbatim text
	// (it contains no prohibited terms, so the "pay/win" review passes without a substitution).
};
