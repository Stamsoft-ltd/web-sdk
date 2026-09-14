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
	'BUY BONUS': 'GET BONUS',
	BUY: 'PLAY',
	PAYOUT: 'WIN',
	'BET REPLAY': 'Play Replay',
	'TOTAL BET COST': 'Total Play',
	'REPLAY DISCLAIMER': 'This is a replay of a previous play round. No plays will be placed.',
	'BASE BET': 'BASE PLAY',
	'COST MULTIPLIER': 'FEATURE MULTIPLIER',
	'PAYOUT MULTIPLIER': 'FINAL MULTIPLIER',

	// ── Info modal ───────────────────────────────────────────────────────────────
	'INFO FEATURE BUY': 'INSTANT FEATURES',
	'INFO OV MAXWIN': 'Maximum win: %value% play amount.',
	'INFO FB SUB':
		'Instant feature options are available only where allowed. All instant feature and bonus options are won as a multiple of the selected play amount.',
	'INFO CTRL SPIN DESC': 'Start a game round with your selected play amount.',
	'INFO CTRL PLUS': 'Increase Play Amount',
	'INFO CTRL PLUS DESC': 'Raise your total play amount.',
	'INFO CTRL MINUS': 'Decrease Play Amount',
	'INFO CTRL MINUS DESC': 'Lower your total play amount.',

	// ── Confirmation + bonus cards ───────────────────────────────────────────────
	'BUY CONFIRM': 'PLAY %name% FOR %cost%?',
	'BUY EXTRA CHANCE TITLE': 'Extra Chance',
	'BUY FEATURE SPINS TITLE': 'Feature Spins',
	// Opens "Buys …" in the base map — `buy -> play` is on the prohibited list and reviewers match
	// it as a SUBSTRING, so "Buys" fails just like payline did. Shown on the buy-bonus card AND on
	// the rules page, which reuses the same key.
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
	'INFO OV TEXT 1':
		'Magnetic is a 7x7 cluster-win slot where wins are created by groups of matching symbols. Land 5 or more matching symbols connected horizontally or vertically to win.',
	'INFO GI INTERRUPTED 2':
		'All valid plays and potential winnings remain active until the round is fully completed.',
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
