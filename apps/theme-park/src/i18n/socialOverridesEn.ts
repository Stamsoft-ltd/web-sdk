export const socialOverridesEn: Record<string, string> = {
	BET: 'PLAY',
	'BET SIZE': 'PLAY AMOUNT',
	'BASE BET': 'BASE PLAY',
	'TOTAL COST': 'TOTAL PLAY',
	'TOTAL BET COST': 'TOTAL PLAY',
	'BUY BONUS': 'GET BONUS',
	BUY: 'PLAY',
	PAYOUT: 'WIN',
	// `pay` -> `win` is applied as a SUBSTRING by reviewers, so PAYTABLE/PAYLINE fail even though
	// neither word is on the list literally. This one used to override PAYTABLE with itself.
	PAYTABLE: 'WIN TABLE',
	'COST MULTIPLIER': 'FEATURE MULTIPLIER',
	'PAYOUT MULTIPLIER': 'FINAL MULTIPLIER',
	'BET MODE ANTE DIALOG': '3x play per round. Extra Feature gives 5x bonus chance.',
	'BET MODE FSPIN1 DESCRIPTION': 'Guaranteed Duck Collect spin for 20x play.',
	'BET MODE FSPIN2 DESCRIPTION': 'Guaranteed Roller Wilds spin for 60x play.',
	'BET MODE DUCK DESCRIPTION': 'Play Duck Your Luck for 100x your selected play amount.',
	'BET MODE ROLLER DESCRIPTION': 'Play Roller Wilds for 200x your selected play amount.',
	'BET MODE COASTER DESCRIPTION': 'Play Mega Coaster for 500x your selected play amount.',
	'HOWTO BET TITLE': 'PLAY AMOUNT',
	'HOWTO BET TEXT': 'Use + and - to change your play amount.',
	'HOWTO BUY TITLE': 'GET BONUS',
	'HOWTO BUY TEXT': 'Open Get Bonus to activate or play a feature.',
	'REPLAY DISCLAIMER': 'This is a replay of a previous play round. No plays will be placed.',
	'BET MENU': 'PLAY MENU',
	'SELECT YOUR BET': 'SELECT YOUR PLAY AMOUNT',
	'DECREASE BET': 'DECREASE PLAY AMOUNT',
	'INCREASE BET': 'INCREASE PLAY AMOUNT',
	'INSUFFICIENT FUNDS TO PLACE THIS BET. PLEASE ADD FUNDS TO YOUR ACCOUNT OR LOWER THE BET LEVEL.':
		'NOT ENOUGH BALANCE. GET MORE COINS OR LOWER YOUR PLAY LEVEL.',
	// ── Bet-mode strings that reach the buy-bonus modal and the info modal's feature cards ──
	'BET MODE FSPIN1 DIALOG': 'One single spin with at least 1 collect duck. Up to 25 ducks can land.',
	'BET MODE FSPIN2 DIALOG':
		'One single spin with at least one roller wild reel. Multiplier plaques can land on any row and add across wild reels.',
	'BET MODE DUCK DIALOG':
		'10 duck picks with coin additions and multiply-all ducks. Lump sum win, capped at 25,000x.',
	'BET MODE DUCK BUTTON': 'PLAY',
	'BET MODE ROLLER BUTTON': 'PLAY',
	'BET MODE COASTER BUTTON': 'PLAY',
	'BET MODE FSPIN1 TICKER IDLE': 'COME AND PLAY',
	'BET MODE FSPIN2 TICKER IDLE': 'COME AND PLAY',
	'BET MODE DUCK TICKER IDLE': 'COME AND PLAY',
	'BET MODE ROLLER TICKER IDLE': 'COME AND PLAY',
	'BET MODE COASTER TICKER IDLE': 'COME AND PLAY',
	// ── Info modal ───────────────────────────────────────────────────────────
	'INFO PAGE FEATURE BUY': 'GET FEATURE',
	'INFO OV INTRO': 'Theme Park is a 5×5 high-volatility video slot played on 15 fixed win lines.',
	// Renders as the tail of "Maximum Win: 25,000× …". The bet->play mapping alone gives
	// "25,000× play", which reads as a typo; the full phrase is what the table actually maps to.
	'INFO OV BET': 'play amount',
	'INFO OV DUCK DESC':
		'Special Ducks reveal coin additions or multiply-all values that multiply the collected prize.',
	'INFO WTW LINES': 'Theme Park is played on 15 fixed win lines.',
	'INFO WTW COMBO':
		'A standard winning combination is formed when 3 or more matching symbols land on consecutive reels from left to right, starting from Reel 1, on one of the fixed win lines.',
	'INFO WTW EVAL':
		'Wins are evaluated after the reels stop and are awarded according to the Win Table.',
	'INFO WTW WILD': 'Wild symbols substitute for all regular winning symbols except Scatter symbols.',
	'INFO WTW SCATTER':
		'Scatter symbols do not need to follow a win line and are used to trigger their associated bonus features.',
	'INFO WTW HIGHEST': 'Only the highest winning combination per symbol per win line is awarded.',
	'INFO WTW MULTIPLES': 'All displayed wins are expressed as multiples of the total play.',
	'INFO WTW DIAGRAM ALT': '15 win lines',
	'INFO GI INTERRUPTED HOLD':
		'All valid plays and potential winnings remain active until the round is fully completed.',
	'INFO GI LEGAL MALFUNCTION':
		'Malfunction voids all wins and plays. A stable internet connection is required. If the connection is lost, reload the game to complete any unfinished rounds.',
	'INFO UI BET PLUS': 'PLAY +',
	'INFO UI BET MINUS': 'PLAY -',
	'INFO UI BET PLUS DESC': 'Increases your total play.',
	'INFO UI BET MINUS DESC': 'Decreases your total play.',
};
