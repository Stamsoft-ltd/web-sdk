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
		'Replay loads a previously completed event and displays the original play amount, total cost and win information.',
	'PAYTABLE BUY TITLE': 'PLAY MODES',
	'PAYTABLE BUY_TEXT':
		'Drop-O-Magnet: 100x play amount.\nMega Chain: 500x play amount.\nChance Spin: 2x play amount per round.\nFeature Spin: 50x play amount per round.',
	'PAYTABLE MAX_TEXT': 'Advertised max win is 20,000x the selected play amount.',

	// ── Info modal ───────────────────────────────────────────────────────────────
	'INFO FEATURE BUY': 'INSTANT FEATURES',
	'INFO OV MAXWIN': 'Maximum win: %value% play amount.',
	'INFO FB SUB':
		'Instant feature options are available only where allowed. All instant feature and bonus options are paid as a multiple of the selected play amount.',
	'INFO FB FEATURE TITLE': 'Instant Feature',
	'INFO FB BONUS TITLE': 'Instant Bonus',
	'INFO CTRL SPIN DESC': 'Start a game round with your selected play amount.',
	'INFO CTRL PLUS': 'Increase Play Amount',
	'INFO CTRL PLUS DESC': 'Raise your total play amount.',
	'INFO CTRL MINUS': 'Decrease Play Amount',
	'INFO CTRL MINUS DESC': 'Lower your total play amount.',

	// ── Confirmation + bonus cards ───────────────────────────────────────────────
	'BUY CONFIRM': 'PLAY %name% FOR %cost%?',
	'BUY EXTRA CHANCE TITLE': 'Extra Chance',
	'BUY FEATURE SPINS TITLE': 'Feature Spins',

	// ── Disclaimer ───────────────────────────────────────────────────────────────
	'DISCLAIMER TEXT':
		'Malfunction voids all wins and plays. A consistent internet connection is required. In the event of a disconnection, reload the game to finish any uncompleted rounds. The expected return is calculated over many plays. Winnings are settled according to the amount received from the Remote Game Server and not from events within the web browser. TM and © 2026 Stake Engine.',
};
