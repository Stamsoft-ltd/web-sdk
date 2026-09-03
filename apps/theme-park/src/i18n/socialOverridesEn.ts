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
	'BET MODE FSPIN1 DIALOG':
		'One single spin with at least 1 collect duck. Up to 25 ducks can land.',
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
		'Collectible Ducks reveal 2x–500x base-play additions. Multiply All Ducks reveal 2x–100x multipliers and multiply the running total collected before them; later Ducks add normally.',
	'INFO WTW LINES': 'Theme Park is played on 15 fixed win lines.',
	'INFO WTW COMBO':
		'A standard winning combination is formed when 3 or more matching symbols land on consecutive reels from left to right, starting from Reel 1, on one of the fixed win lines.',
	'INFO WTW EVAL':
		'Wins are evaluated after the reels stop and are awarded according to the Win Table.',
	'INFO WTW WILD':
		'Wild symbols do not award wins by themselves. They substitute for regular symbols, and their multipliers apply to the completed winning symbol.',
	'INFO WTW SCATTER':
		'Scatter symbols do not need to land on a win line and can appear anywhere on the reels.',
	'INFO WTW DUCK':
		'Collectible Ducks award their revealed value as a base-play multiple. Multiply All Ducks multiply the running Duck total collected before them; Ducks revealed afterward are added normally.',
	'INFO WTW HIGHEST': 'Only one winning combination per fixed win line is awarded.',
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

	// The RULES pages and the WIN TABLE, which are the two screens a jurisdiction reviewer reads end
	// to end. `pay` -> `win` is matched as a SUBSTRING, so `payline`, `paytable`, `pays` and `paying`
	// all fail on it even though none of them is on the list literally — that is precisely what the
	// 2026-07-28 rejection was for. `cash` -> `coins` and `buy`/`buy bonus` -> `play`/`get bonus`
	// come from the same table.
	'RULE GAME TEXT':
		'5x5 slot with 15 fixed win lines. Wins are awarded left to right, 3+ consecutive symbols from reel 1. Max win 25,000x play amount.',
	'RULE WILD TEXT':
		'Wild substitutes for all winning symbols (not scatters or ducks). Line multipliers on wilds SUM along a winning line.',
	'RULE BUY TITLE': 'GET BONUS',
	'RULE BUY TEXT': 'Features can be played for 20x to 500x play amount in the Get Bonus menu.',
	'FEATURE DUCK COLLECT TEXT':
		'At least 1 collect duck is guaranteed; up to all 25 positions can be ducks. Each reveals a coin addition or a multiply-all duck; the collected total is awarded as a lump sum.',
	'FEATURE DUCK LUCK TEXT':
		'10 duck picks at the pond. Coin ducks add to the total; multiply-all ducks multiply the running total. Capped at 25,000x.',
	'PAYTABLE PREMIUM TITLE': 'HIGH WIN',
	'PAYTABLE LOW TITLE': 'LOW WIN',
	'PAYTABLE H1_H2':
		'COASTER CAR wins 2 / 10 / 20x. RUBBER DUCK and BALLOON win 1 / 5 / 10x for 3 / 4 / 5 of a kind.',
	'PAYTABLE H3_H5': 'POPCORN and FERRIS WHEEL win 0.5 / 2.5 / 5x for 3 / 4 / 5 of a kind.',
	'PAYTABLE LOWS': 'A, K, Q, J and 10 win 0.1 / 0.5 / 1x for 3 / 4 / 5 of a kind.',
	'PAYTABLE SPECIAL_TEXT':
		'WILD does not win by itself. It substitutes winning symbols, and its multiplier applies to the completed winning symbol. Ducks and scatters award features.',
	'PAYTABLE TITLE PAYLINES': 'WIN LINES',
	'PAYTABLE TEXT PAYLINES': '15 fixed win lines, left to right.',
	'PAYTABLE BUY TITLE': 'PLAY',
};
