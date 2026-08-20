export default {
	'GAME TITLE': 'THEME PARK',
	BALANCE: 'BALANCE',
	BET: 'BET',
	'TOTAL COST': 'TOTAL COST',
	MODE: 'MODE',
	'BUY BONUS': 'BUY BONUS',
	PAYTABLE: 'PAYTABLE',
	'GAME RULES': 'GAME RULES',
	AUTOPLAY: 'AUTOPLAY',
	// Short caption printed inside the autoplay button on the HUD bar (Figma 6281-1791). Kept
	// separate from AUTOPLAY: the button is 48px wide, so the full word does not fit.
	AUTO: 'AUTO',
	TURBO: 'TURBO',
	REPLAY: 'REPLAY',
	'START REPLAY': 'START REPLAY',
	'PLAY AGAIN': 'PLAY AGAIN',
	'RETRY RESUME': 'RETRY ROUND',
	EVENT: 'EVENT',
	PAYOUT: 'PAYOUT',
	WIN: 'WIN',
	'BET SIZE': 'BET SIZE',
	'BASE BET': 'BASE BET',
	'TOTAL BET COST': 'TOTAL BET COST',
	'COST MULTIPLIER': 'COST MULTIPLIER',
	'PAYOUT MULTIPLIER': 'PAYOUT MULTIPLIER',
	'REPLAY EVENT': 'REPLAY EVENT',
	ACTIVATE: 'ACTIVATE',
	DEACTIVATE: 'DEACTIVATE',
	BUY: 'BUY',
	CANCEL: 'CANCEL',
	CONFIRM: 'CONFIRM',
	'CONFIRM TEXT': 'Confirm %mode% for %cost%?',
	'PER SPIN': '/ SPIN',
	CLOSE: 'CLOSE',
	'NUMBER OF SPINS': 'NUMBER OF SPINS',
	'TURBO SPIN': 'TURBO SPIN',
	'SUPER TURBO SPIN': 'SUPER TURBO SPIN',
	'STOP ON BONUS': 'STOP ON BONUS',
	START: 'START',
	SPINS: 'SPINS',
	'FREE SPINS': 'FREE SPINS',
	'DUCK PICKS': 'DUCK PICKS',
	OF: 'OF',
	'BONUS COMPLETE': 'BONUS COMPLETE',
	// Headings on the bonus-complete screen (Figma 6094:4022).
	'CONGRATULATIONS!': 'CONGRATULATIONS!',
	// The 2026-08-20 congratulations marquees (Figma 7033:24761, 7032:19821) shorten the headline to
	// fit the frame. Only English has a short form; every other locale reuses its CONGRATULATIONS!
	// translation and <CongratsPanel> scales the longer word into the frame.
	'CONGRATS!': 'CONGRATS!',
	'YOU WON': 'YOU WON',
	SELECTED: 'SELECTED',
	'REVEALING ALL DUCKS': 'REVEALING ALL DUCKS',
	'PICK MORE': 'PICK %count% MORE',
	REVEALING: 'REVEALING',
	ALL: 'ALL',
	UNLIMITED: 'UNLIMITED',
	'PRESS TO CONTINUE': 'PRESS TO CONTINUE',
	// Wording and placement from Figma 6094:4022; the arrow is appended by <PressToContinue>.
	'PRESS ANYWHERE TO CONTINUE': 'PRESS ANYWHERE TO CONTINUE',
	// ── Splash feature cards (Figma 6102-1129) ───────────────────────────────
	// The three headline names stay English in every locale, like GAME TITLE — they are feature
	// brand names, and the design sets them in a stylised gradient face.
	'SPLASH FEATURE 1': 'WELCOME TO\nTHE PARK',
	'SPLASH FEATURE 1 BODY': 'Bright lights, wild rides\nand big surprises\naround every corner.',
	'SPLASH FEATURE 2': '3 UNIQUE\nBONUSES',
	'SPLASH FEATURE 2 BODY': 'Pick the Ducks\nRide the Wilds\nSurvive the Coaster',
	'SPLASH FEATURE 3': 'MAX WIN OF',
	'SPLASH FEATURE 3 BODY': 'THE ULTIMATE\nPARK PRIZE',
	'SPLASH WITH UP TO': 'with up to',
	'SPLASH MULTIPLIER': 'multiplier',
	SOUND: 'SOUND',
	MUSIC: 'MUSIC',
	INFO: 'INFO',
	MENU: 'MENU',
	'DECREASE BET': 'DECREASE BET',
	'INCREASE BET': 'INCREASE BET',
	SPIN: 'SPIN',
	'REMAINING AUTO SPINS': 'REMAINING AUTO SPINS: %count%',
	'CLOSE AUTOPLAY': 'CLOSE AUTOPLAY',
	'RESUME BODY': 'You have an active %mode% round in progress.',
	'PLAY ROUND': 'PLAY ROUND',
	'END ROUND': 'END ROUND',
	'REPLAY ERROR GENERIC': 'Replay unavailable. Please retry.',
	// ── Bet modes ────────────────────────────────────────────────────────────
	'BET MODE BASE TITLE': 'BASE',
	'BET MODE BASE DIALOG': 'Standard Theme Park base game.',
	'BET MODE BASE BUTTON': 'PLAY',
	'BET MODE BASE TICKER IDLE': 'THEME PARK',
	'BET MODE BASE TICKER SPIN': 'GOOD LUCK',
	'BET MODE ANTE TITLE': 'EXTRA FEATURE',
	'BET MODE ANTE DIALOG': '3x cost per spin. Extra Feature — 5x bonus chance.',
	'BET MODE ANTE DESCRIPTION': 'Extra Feature — 5x bonus chance.',
	'BET MODE ANTE BUTTON': 'ACTIVATE',
	'BET MODE ANTE TICKER IDLE': 'EXTRA FEATURE ACTIVE',
	'BET MODE ANTE TICKER SPIN': 'GOOD LUCK',
	'BET MODE FSPIN1 TITLE': 'DUCK COLLECT SPIN',
	'BET MODE FSPIN1 DIALOG': 'One paid spin with at least 1 collect duck. Up to 25 ducks can land.',
	'BET MODE FSPIN1 DESCRIPTION': 'Guaranteed duck collect for 20x bet.',
	'BET MODE FSPIN1 BUTTON': 'ACTIVATE',
	'BET MODE FSPIN1 TICKER IDLE': 'PLACE YOUR BET',
	'BET MODE FSPIN1 TICKER SPIN': 'DUCK COLLECT',
	'BET MODE FSPIN2 TITLE': 'ROLLER WILDS SPIN',
	'BET MODE FSPIN2 DIALOG':
		'One paid spin with at least one roller wild reel. Multiplier plaques can land on any row and add across wild reels.',
	'BET MODE FSPIN2 DESCRIPTION': 'Guaranteed roller wilds spin for 60x bet.',
	'BET MODE FSPIN2 BUTTON': 'ACTIVATE',
	'BET MODE FSPIN2 TICKER IDLE': 'PLACE YOUR BET',
	'BET MODE FSPIN2 TICKER SPIN': 'ROLLER WILDS',
	'BET MODE DUCK TITLE': 'DUCK YOUR LUCK',
	'BET MODE DUCK DIALOG':
		'10 duck picks with cash additions and multiply-all ducks. Lump sum payout, capped at 25,000x.',
	'BET MODE DUCK DESCRIPTION': 'Buy the Duck Your Luck bonus for 100x bet.',
	'BET MODE DUCK BUTTON': 'BUY',
	'BET MODE DUCK TICKER IDLE': 'PLACE YOUR BET',
	'BET MODE DUCK TICKER SPIN': 'DUCK YOUR LUCK',
	'BET MODE ROLLER TITLE': 'ROLLER WILDS',
	'BET MODE ROLLER DIALOG':
		'10 free spins. A landing wild can transform its reel after the spin. Row multiplier plaques add across each wild reel and across multiple wild reels.',
	'BET MODE ROLLER DESCRIPTION': 'Buy the Roller Wilds bonus (10 free spins) for 200x bet.',
	'BET MODE ROLLER BUTTON': 'BUY',
	'BET MODE ROLLER TICKER IDLE': 'PLACE YOUR BET',
	'BET MODE ROLLER TICKER SPIN': 'ROLLER WILDS ACTIVE',
	'BET MODE COASTER TITLE': 'MEGA COASTER',
	'BET MODE COASTER DIALOG':
		'Coaster setup places persistent multiplier wilds, then 10 free spins. Repeat hits double the tile up to x1024.',
	'BET MODE COASTER DESCRIPTION':
		'Buy the Mega Coaster bonus (setup + 10 free spins) for 500x bet.',
	'BET MODE COASTER BUTTON': 'BUY',
	'BET MODE COASTER TICKER IDLE': 'PLACE YOUR BET',
	'BET MODE COASTER TICKER SPIN': 'MEGA COASTER ACTIVE',
	// ── Recovery / rules ─────────────────────────────────────────────────────
	'RECOVERY TITLE': 'UNFINISHED ROUND',
	'RECOVERY BODY': 'The previous round could not be restored. Retry to finish.',
	'RULE SECTION GAME INFO': 'GAME INFO',
	'RULE SECTION FEATURES': 'FEATURES',
	'RULE SECTION HOW TO PLAY': 'HOW TO PLAY',
	'RULE SECTION DISCLAIMER': 'DISCLAIMER',
	'RULE GAME TITLE': 'THEME PARK',
	'RULE GAME TEXT':
		'5x5 slot with 15 fixed paylines. Wins pay left to right, 3+ consecutive symbols from reel 1. Max win 25,000x bet.',
	'RULE WILD TITLE': 'WILD',
	'RULE WILD TEXT':
		'Wild substitutes for all paying symbols (not scatters or ducks). Line multipliers on wilds SUM along a winning line.',
	'RULE SCATTER TITLE': 'SCATTERS',
	'RULE SCATTER TEXT':
		'3+ matching scatters trigger their feature: duck scatters award Duck Your Luck, roller scatters award Roller Wilds, coaster scatters award Mega Coaster.',
	'RULE BUY TITLE': 'BUY BONUS',
	'RULE BUY TEXT': 'Buy features from 20x to 500x bet in the Buy Bonus menu.',
	// ── Features ─────────────────────────────────────────────────────────────
	'FEATURE DUCK COLLECT TITLE': 'DUCK COLLECT',
	'FEATURE DUCK COLLECT TEXT':
		'At least 1 collect duck is guaranteed; up to all 25 positions can be ducks. Each reveals a cash addition or a multiply-all duck; the collected total pays as a lump sum.',
	'FEATURE DUCK LUCK TITLE': 'DUCK YOUR LUCK',
	'FEATURE DUCK LUCK TEXT':
		'10 duck picks at the pond. Cash ducks add to the total; multiply-all ducks multiply the running total. Capped at 25,000x.',
	'FEATURE ROLLER TITLE': 'ROLLER WILDS',
	'FEATURE ROLLER TEXT':
		'10 free spins. A wild lands first, then its reel transforms into a full wild stack. Multiplier plaques can appear on any rows; their values add across the reel and across multiple wild reels.',
	'FEATURE COASTER TITLE': 'MEGA COASTER',
	'FEATURE COASTER TEXT':
		'The coaster car places persistent multiplier wilds before 10 free spins. Repeat hits double a tile: x2, x4, ... up to x1024. Max 10 wild tiles.',
	// ── How to play ──────────────────────────────────────────────────────────
	'HOWTO SPIN TITLE': 'SPIN',
	'HOWTO SPIN TEXT': 'Press Spin to start a round.',
	'HOWTO BET TITLE': 'BET',
	'HOWTO BET TEXT': 'Use +/- to change your bet.',
	'HOWTO BUY TITLE': 'BUY BONUS',
	'HOWTO BUY TEXT': 'Buy features from the buy menu, or activate Extra Feature for 3x cost.',
	'HOWTO TURBO TITLE': 'TURBO',
	'HOWTO TURBO TEXT': 'Turbo shortens round timings.',
	'HOWTO AUTOPLAY TITLE': 'AUTOPLAY',
	'HOWTO AUTOPLAY TEXT': 'Repeats rounds automatically.',
	'HOWTO REPLAY TITLE': 'REPLAY',
	'HOWTO REPLAY TEXT': 'Replays a previous round.',
	// ── Paytable ─────────────────────────────────────────────────────────────
	'PAYTABLE PREMIUM TITLE': 'HIGH PAY',
	'PAYTABLE LOW TITLE': 'LOW PAY',
	'PAYTABLE SPECIAL TITLE': 'SPECIAL',
	'PAYTABLE H1_H2':
		'COASTER CAR pays 2 / 10 / 20x. RUBBER DUCK and BALLOON pay 1 / 5 / 10x for 3 / 4 / 5 of a kind.',
	'PAYTABLE H3_H5': 'POPCORN and FERRIS WHEEL pay 0.5 / 2.5 / 5x for 3 / 4 / 5 of a kind.',
	'PAYTABLE LOWS': 'A, K, Q, J and 10 pay 0.1 / 0.5 / 1x for 3 / 4 / 5 of a kind.',
	'PAYTABLE SPECIAL_TEXT':
		'WILD substitutes all paying symbols; a pure wild line pays as Coaster Car. Ducks and scatters award features.',
	'PAYTABLE TITLE PAYLINES': 'PAYLINES',
	'PAYTABLE TEXT PAYLINES': '15 fixed paylines, left to right.',
	'PAYTABLE BUY TITLE': 'BUY',
	'PAYTABLE MAX TITLE': 'MAX WIN',
	// ── Feature presentation strings ─────────────────────────────────────────
	'DUCK COLLECT': 'DUCK COLLECT',
	'PICK N DUCKS': 'PICK %count% DUCKS',
	'DUCKS COLLECTED': 'DUCKS COLLECTED!',
	'DUCK YOUR LUCK': 'DUCK YOUR LUCK',
	'RUNNING TOTAL': 'RUNNING TOTAL',
	'TOTAL WIN': 'TOTAL WIN',
	'MULTIPLY ALL': 'MULTIPLY ALL',
	'ROLLER WILDS': 'ROLLER WILDS',
	'WILD REEL': 'WILD REEL',
	'MEGA COASTER': 'MEGA COASTER',
	'COASTER SETUP': 'COASTER CARS DROP PERSISTENT WILDS',
	'MAX WIN': 'MAX WIN',
	'DISCLAIMER TEXT': 'This game is for entertainment purposes. 18+.',
	// ── Info modal (CustomInfoModal, 7 pages) ────────────────────────────────
	// Every string on those pages used to be an English literal in the markup, which meant the
	// 15 non-English catalogues never reached it AND the social-jurisdiction overrides could not
	// scrub it. The PAYTABLE page title reuses the existing PAYTABLE key; the six feature cards
	// reuse the BET MODE * TITLE/DIALOG keys the buy-bonus modal already uses, so the two screens
	// cannot drift apart and neither needs its own translation.
	'INFO PAGE OVERVIEW': 'OVERVIEW',
	'INFO PAGE FEATURES': 'FEATURES',
	'INFO PAGE WAYS TO WIN': 'WAYS TO WIN',
	'INFO PAGE FEATURE BUY': 'FEATURE BUY',
	'INFO PAGE GENERAL INFO': 'GENERAL INFO',
	'INFO PAGE UI GUIDE': 'USER INTERFACE GUIDE',
	'INFO PAGE LABEL': 'Page',
	RTP: 'RTP',
	// Overview page.
	'INFO OV INTRO': 'Theme Park is a 5×5 high-volatility video slot played on 15 fixed paylines.',
	'INFO OV WINS':
		'Wins are formed when matching symbols land on consecutive reels from left to right, starting from Reel 1.',
	'INFO OV FEATURES':
		'The game features Duck Collect, Roller Wilds, and the Mega Coaster Bonus, bringing multipliers, full-reel Wilds, and persistent multiplier Wilds into play.',
	'INFO OV MAX WIN': 'Maximum Win:',
	'INFO OV BET': 'bet',
	'INFO OV RTP': 'Theoretical RTP:',
	'INFO OV DUCK DESC':
		'Special Ducks reveal cash additions or multiply-all values that multiply the collected prize.',
	'INFO OV ROLLER DESC':
		'Roller coaster ducks can transform entire reels into Wild reels with multipliers up to ×100.',
	'INFO OV COASTER DESC':
		'Creates persistent Wild positions before 10 Free Spins. Repeated hits can increase Wild multipliers up to ×1024.',
	'INFO OV BONUS TITLE': 'BONUS FEATURES',
	'INFO OV BONUS DESC':
		'Three different feature experiences: Duck Your Luck, Roller Wilds, and Mega Coaster.',
	// Paytable page — column headers and the symbol names beside the art.
	'INFO PAY SYMBOL': 'Symbol',
	'INFO PAY 3': '3 In a Line',
	'INFO PAY 4': '4 In a Line',
	'INFO PAY 5': '5 In a Line',
	'INFO SYM ROYALS': 'J A K 10 Q',
	'INFO SYM FERRIS': 'Ferris Wheel',
	'INFO SYM POPCORN': 'Popcorn',
	'INFO SYM DUCK': 'Duck',
	'INFO SYM BALLOONS': 'Balloons',
	'INFO SYM COASTER': 'Roller Coaster',
	'INFO SYM WILD': 'Wild',
	// Ways to win page.
	'INFO WTW LINES': 'Theme Park is played on 15 fixed paylines.',
	'INFO WTW COMBO':
		'A standard winning combination is formed when 3 or more matching symbols land on consecutive reels from left to right, starting from Reel 1, on one of the fixed paylines.',
	'INFO WTW EVAL':
		'Wins are evaluated after the reels stop and are paid according to the Paytable.',
	'INFO WTW WILD': 'Wild symbols substitute for all regular paying symbols except Scatter symbols.',
	'INFO WTW SCATTER':
		'Scatter symbols do not need to follow a payline and are used to trigger their associated bonus features.',
	'INFO WTW HIGHEST': 'Only the highest winning combination per symbol per payline is paid.',
	'INFO WTW MULTIPLES': 'All displayed payouts are expressed as multiples of the total bet.',
	'INFO WTW DIAGRAM ALT': '15 paylines',
	'INFO WTW MULT TITLE': 'WILD REEL MULTIPLIERS',
	'INFO WTW MULT BODY':
		'When a Roller Wild transforms a reel, the entire reel becomes Wild and receives a multiplier of:',
	'INFO WTW MULT SUM':
		'When multiple multiplier Wild reels contribute to the same winning combination, their multipliers are added together and applied to the win.',
	// General info page. The \n in the first title is the design's forced line break.
	'INFO GI INTERRUPTED TITLE': 'INTERRUPTED\nROUNDS',
	'INFO GI INTERRUPTED BODY':
		'If a game round is interrupted, it will continue when the game is reloaded, where possible.',
	'INFO GI INTERRUPTED HOLD':
		'All valid wagers and potential winnings remain active until the round is fully completed.',
	'INFO GI LEGAL TITLE': 'LEGAL NOTICE',
	'INFO GI LEGAL MALFUNCTION':
		'Malfunction voids all pays and plays. A stable internet connection is required. If the connection is lost, reload the game to complete any unfinished rounds.',
	'INFO GI LEGAL RETURN':
		'The expected return is calculated over a large number of plays. The game display is for visual and entertainment purposes only and does not represent any physical gaming device.',
	'INFO GI LEGAL SETTLE':
		'All winnings are settled according to the result received from the Remote Game Server, not from animations or events shown inside the web browser.',
	// User interface guide page. SPIN/TURBO/INFO/SOUND/CLOSE/MENU/MUSIC reuse the HUD keys above.
	'INFO UI AUTO SPINS': 'AUTO SPINS',
	'INFO UI BET PLUS': 'BET +',
	'INFO UI BET MINUS': 'BET -',
	'INFO UI PREVIOUS': 'PREVIOUS',
	'INFO UI NEXT': 'NEXT',
	'INFO UI SPIN DESC': 'Starts a new game round.',
	'INFO UI AUTO DESC': 'Opens the Auto Spins menu.',
	'INFO UI TURBO DESC': 'Enables faster reel spins.',
	'INFO UI BET PLUS DESC': 'Increases your total bet.',
	'INFO UI BET MINUS DESC': 'Decreases your total bet.',
	'INFO UI INFO DESC': 'Opens the game information.',
	'INFO UI SOUND DESC': 'Turns game sound on or off.',
	'INFO UI PREVIOUS DESC': 'Goes to the previous page.',
	'INFO UI NEXT DESC': 'Goes to the next page.',
	'INFO UI CLOSE DESC': 'Closes the current window.',
	'INFO UI MENU DESC': 'Opens the game menu.',
	'INFO UI MUSIC DESC': 'Turns game music on or off.',
};
