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
	'BET REPLAY': 'Play Replay',
	// BASE BET / COST MULTIPLIER / PAYOUT MULTIPLIER live in the Stake.us block below —
	// duplicating them here silently shadowed those values.
	'TOTAL BET COST': 'Total Play',
	'TOTAL WIN': 'Total Win',
	'REPLAY DISCLAIMER': 'This is a replay of a previous play round. No plays will be placed.',

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
		'Deal It play cost is 100x play amount. All In play cost is 400x play amount. Chance Spin costs 2x play amount per round. Feature Spin costs 20x play amount per round. Max win is 25,000x. Target RTP is 96.11%.',

	'FEATURE SELECTED SYMBOL TEXT':
		'Any regular winning symbol can be the expanding symbol. When it lands, all affected reels expand to fill that symbol, and 3 or more reels win even without adjacent connections.',

	'HOWTO BET TITLE': 'PLAY AMOUNT SELECTOR',
	'HOWTO BET TEXT':
		'Use the + and - buttons or open the play menu to change the displayed play amount before a round starts.',

	'HOWTO BUY TITLE': 'GET BONUS',
	'HOWTO BUY TEXT':
		'Open Get Bonus to choose Deal It, All In, Chance Spin or Feature Spin. Deal It and All In require confirmation. Chance Spin and Feature Spin activate immediately and can be turned off with the DISABLE button.',

	'HOWTO REPLAY TEXT':
		'Replay loads a previously completed Stake event and displays the original play amount, total play, and win information.',
	'HOWTO USER INTERACTION TEXT':
		'Use the main Spin button to start a round. Use + and - to change play amount, open Get Bonus to select feature modes, use Turbo to speed up supported animations, use Autoplay to repeat rounds automatically, and use the sound/settings buttons to adjust the game experience. In replay mode, use Start Replay to begin the recorded sequence and Replay Event at the end to watch it again.',

	// ── Paytable pages ───────────────────────────────────────────────────────────
	'PAYTABLE SPECIAL_TEXT':
		'Wild substitutes for all regular winning symbols. Scatter does not win by itself and only triggers the bonus features.',

	'PAYTABLE BUY TITLE': 'PLAY MODES',
	'PAYTABLE BUY_TEXT':
		'Deal It: 100x play amount.\nAll In: 400x play amount.\nChance Spin: 2x play amount per round.\nFeature Spin: 20x play amount per round.\nDeal It and All In require confirmation before the round starts.',

	'PAYTABLE MAX_TEXT': 'Advertised max win is 25,000x the selected play amount.',

	// ── Info / game-rules pages ──────────────────────────────────────────────────
	'INFO OVERVIEW BODY':
		'Forest Gang is a 5x4 video slot played on 20 paylines.\nWins are awarded from left to right on consecutive reels, starting from reel 1, when matching symbols land on an active payline.\nThe game includes 5 premium symbols, 5 low symbols, a Wild symbol, and a Scatter symbol.\n\nMaximum win potential is 25,000x the total play.\n\nTheoretical RTP: 96.11%',

	'INFO WILD TEXT':
		'The Wild substitutes for all regular winning symbols. The Wild does not substitute for the Scatter. Wild win: 5 in a line only 250x.',

	'INFO BUY TITLE': 'FEATURE PLAY',
	// Feature-buy card cost label — scrub "COST" to match the other COST->PLAY overrides;
	// the paired value ("2x PLAY" etc.) is built in Game.svelte from the overridden BET key.
	'INFO BUY COST': 'PLAY FOR',
	'INFO USER BET TITLE': 'PLAY AMOUNT AND MODES',
	'INFO USER BET TEXT':
		'Use + and - or the play menu to choose an available play level. Get Bonus opens Deal It, All In, Chance Spin and Feature Spin options.',
	'INFO USER REPLAY TEXT':
		'Replay mode shows the recorded round details before playback. Press Start Replay to watch it, then Replay Event to watch the same event again.',

	'INFO WAYS NOTE':
		'Forest Gang is played on 20 fixed paylines. A winning combination is formed when matching symbols land on consecutive reels from left to right on any active payline. Only the highest win per symbol per payline is won, unless stated otherwise in the final game rules.',

	'INFO INTERRUPTED TEXT':
		'If a game round is interrupted, it will continue when the game is reloaded, where possible.\n\nAll valid plays and potential winnings remain active until the round is fully completed.',

	'INFO LEGAL TEXT':
		'Malfunction voids all wins and plays. A consistent internet connection is required. In the event of a disconnection, reload the game to finish any uncompleted plays.\n\nThe expected return is calculated over many spins. Animations are not representative of any physical device, and are for illustrative purposes only.\n\nAll winnings are settled according to the result received from the Remote Game Server, not from animations or events shown inside the web browser.\n\nTM and © 2025 Stake Engine.',

	// ── UI guide page (bet -> play wording) ─────────────────────────────────────
	'INFO UI BETPLUS TITLE': 'PLAY +',
	'INFO UI BETPLUS TEXT': 'Increases your total play amount.',
	'INFO UI BETMINUS TITLE': 'PLAY -',
	'INFO UI BETMINUS TEXT': 'Decreases your total play amount.',

	// ── Stake.us required terminology (bet-details / fairness panel wording) ─────
	'BASE BET': 'BASE PLAY',
	'Base Bet': 'Base Play',
	'COST MULTIPLIER': 'FEATURE MULTIPLIER',
	'Cost Multiplier': 'Feature Multiplier',
	'PAYOUT MULTIPLIER': 'FINAL MULTIPLIER',
	'Payout Multiplier': 'Final Multiplier',

	// ── Shared package keys (components-ui-html / components-ui-pixi) ────────────
	'BET MENU': 'PLAY MENU',
	'SELECT YOUR BET': 'SELECT YOUR PLAY AMOUNT',
	'INSUFFICIENT FUNDS TO PLACE THIS BET. PLEASE ADD FUNDS TO YOUR ACCOUNT OR LOWER THE BET LEVEL.':
		'NOT ENOUGH BALANCE. GET MORE COINS OR LOWER YOUR PLAY LEVEL.',
};
