/**
 * English text overrides for social casino mode.
 * Replaces gambling-specific terminology per jurisdiction requirements.
 * Applied when stateConfig.jurisdiction.socialCasino === true (or ?social=true URL param).
 */
export const socialOverridesEn: Record<string, string> = {
	// ── Core HUD labels ──────────────────────────────────────────────────────────
	BET: 'PLAY',
	'BET SIZE': 'PLAY AMOUNT',
	'TOTAL COST': 'TOTAL PLAY',
	'BUY BONUS': 'GET BONUS',
	BUY: 'PLAY',
	PAYOUT: 'WIN',

	// ── Bet-mode UI ──────────────────────────────────────────────────────────────
	'BET MODE BONUS TICKER IDLE': 'COME AND PLAY',
	'BET MODE SUPER TICKER IDLE': 'COME AND PLAY',

	'BET MODE BONUS DESCRIPTION': 'Play the Deal It free spins feature for 100x your selected play amount.',
	'BET MODE BONUS BUTTON': 'PLAY',

	'BET MODE SUPER DESCRIPTION': 'Play the All In feature for 400x your selected play amount.',
	'BET MODE SUPER BUTTON': 'PLAY',

	'BET MODE CHANCE DIALOG':
		'Chance Spin stays active until disabled. Each round costs 2x play and triples the Deal It and All In trigger chance.',
	'BET MODE CHANCE DESCRIPTION': 'Activate Chance Spin for 2x your selected play amount per round.',

	'BET MODE FEATURE DIALOG':
		'Feature Spin stays active until disabled. Each round costs 20x play amount and plays a 1-spin Deal It feature.',
	'BET MODE FEATURE DESCRIPTION': 'Activate Feature Spin for 20x your selected play amount per round.',

	// ── Confirm dialog ───────────────────────────────────────────────────────────
	'CONFIRM TEXT': 'Play %mode% for %cost%?',

	// ── Card descriptions in buy-bonus modal ─────────────────────────────────────
	'CARD ALLIN DESC':
		'10 Free Spins with random expanding symbol and multiplier start at 2x and doubles on every connection.',
	'CARD DEALIT DESC': '10 Free Spins with random expanding symbol and a random multiplier up to 1024x',

	// ── Rules / how-to-play pages ────────────────────────────────────────────────
	'RULE WILD TEXT': 'Wild substitutes for all regular winning symbols and does not substitute for Scatter.',
	'RULE BUY TITLE': 'PLAY / ACTIVATE MODES',
	'RULE BUY TEXT':
		'Deal It play cost is 100x play amount. All In play cost is 400x play amount. Chance Spin costs 2x play amount per round. Feature Spin costs 20x play amount per round. Max win is 25,000x. Target RTP is 96.1%.',

	'FEATURE SELECTED SYMBOL TEXT':
		'Any regular winning symbol can be the expanding symbol. When it lands, all affected reels expand to fill that symbol, and 3 or more reels win even without adjacent connections.',

	'HOWTO BET TITLE': 'PLAY AMOUNT SELECTOR',
	'HOWTO BET TEXT':
		'Use the + and - buttons or open the play menu to change the displayed play amount before a round starts.',

	'HOWTO REPLAY TEXT':
		'Replay loads a previously completed Stake event and displays the original play amount, total play, and win information.',

	// ── Paytable pages ───────────────────────────────────────────────────────────
	'PAYTABLE SPECIAL_TEXT':
		'Wild substitutes for all regular winning symbols. Scatter does not win by itself and only triggers the bonus features.',

	'PAYTABLE BUY TITLE': 'PLAY MODES',
	'PAYTABLE BUY_TEXT':
		'Deal It: 100x play amount.\nAll In: 400x play amount.\nChance Spin: 2x play amount per round.\nFeature Spin: 20x play amount per round.\nDeal It and All In require confirmation before the round starts.',

	'PAYTABLE MAX_TEXT': 'Advertised max win is 25,000x the selected play amount.',

	// ── Info / game-rules pages ──────────────────────────────────────────────────
	'INFO GAME BODY':
		'Forest Gang is a 5x4 video slot played on 20 paylines.\nWins are awarded from left to right on consecutive reels, starting from reel 1, when matching symbols land on an active payline.\nThe game includes 5 premium symbols, 5 low symbols, a Wild symbol, and a Scatter symbol.\n\nMaximum win potential is 25,000x the total play.\n\nTheoretical RTP: 96.1%',

	'INFO WILD TEXT':
		'The Wild substitutes for all regular winning symbols. The Wild does not substitute for the Scatter. Wild win: 5 in a line only 250x.',

	'INFO BUY TITLE': 'FEATURE PLAY',

	'INFO WAYS NOTE':
		'Forest Gang is played on 20 fixed paylines. A winning combination is formed when matching symbols land on consecutive reels from left to right on any active payline. Only the highest win per symbol per payline is won, unless stated otherwise in the final game rules.',

	'INFO INTERRUPTED TEXT':
		'If a game round is interrupted, it will continue when the game is reloaded, where possible.\n\nAll valid plays and potential winnings remain active until the round is fully completed.',

	'INFO LEGAL TEXT':
		'Malfunction voids all wins and plays. A stable internet connection is required. If the connection is lost, reload the game to complete any unfinished rounds.\n\nThe expected return is calculated over a large number of plays. The game display is for visual and entertainment purposes only and does not represent any physical gaming device.\n\nAll winnings are settled according to the result received from the Remote Game Server, not from animations or events shown inside the web browser.',

	// ── Shared package keys (components-ui-html / components-ui-pixi) ────────────
	'BET MENU': 'PLAY MENU',
	'SELECT YOUR BET': 'SELECT YOUR PLAY AMOUNT',
	'INSUFFICIENT FUNDS TO PLACE THIS BET. PLEASE ADD FUNDS TO YOUR ACCOUNT OR LOWER THE BET LEVEL.':
		'NOT ENOUGH BALANCE. GET MORE COINS OR LOWER YOUR PLAY LEVEL.',
};
