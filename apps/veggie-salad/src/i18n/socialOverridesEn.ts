// Stake.us/social-casino terminology. Applied at runtime without changing real-money locales.
export const socialOverridesEn: Record<string, string> = {
	BET: 'PLAY',
	'BET SIZE': 'PLAY AMOUNT',
	'BET MENU': 'PLAY MENU',
	'SELECT YOUR BET': 'SELECT YOUR PLAY AMOUNT',
	'TOTAL COST': 'TOTAL PLAY',
	'REAL COST': 'REAL PLAY',
	'BUY BONUS': 'GET BONUS',
	BUY: 'PLAY',
	PAYOUT: 'WIN',
	PAYTABLE: 'WIN TABLE',
	// The info screen's own page title is a separate key from the shared one.
	'INFO PAYTABLE': 'WIN TABLE',
	'CLUSTER PAYOUTS': 'CLUSTER WINS',
	'RULE CLUSTER TITLE': 'CLUSTER WINS',
	'SPIN AND BET': 'SPIN AND PLAY',
	'SPIN AND BET TEXT':
		'Press Spin or Space to play. Use − and + to select any play level returned by the RGS. Turbo changes presentation speed; pressing Spin during a round skips supported animations.',
	'FEATURES AND AUTOPLAY TEXT':
		'Bonus opens all feature modes. Feature modes require confirmation. Extra Chance toggles directly. Autoplay requires selecting a spin count and confirming Start Autoplay.',
	// No DISCLAIMER TEXT override: it is Engine's own approved boilerplate, so the
	// prohibited-terms pass does not apply to it and it must not be reworded.
	'GAME RULES': 'GAME RULES',
	'BET REPLAY': 'PLAY REPLAY',
	'BASE BET': 'BASE PLAY',
	'COST MULTIPLIER': 'FEATURE MULTIPLIER',
	'PAYOUT MULTIPLIER': 'FINAL MULTIPLIER',
	'TOTAL BET COST': 'TOTAL PLAY',
	'PLACE YOUR BET': 'SELECT YOUR PLAY AMOUNT',
	'DECREASE BET': 'DECREASE PLAY AMOUNT',
	'INCREASE BET': 'INCREASE PLAY AMOUNT',
	'REPLAY DISCLAIMER': 'This is a replay of a previous play round. No plays will be placed.',
	'CONFIRM PURCHASE': 'CONFIRM PLAY',
	'CONFIRM ACTIVATION': 'CONFIRM PLAY',
	CONFIRM: 'PLAY',
	'CHOOSE YOUR HARVEST': 'CHOOSE YOUR FEATURE',
	'PAYTABLE MAX TEXT': 'Maximum win is 25,000× the selected play amount.',
	'PAYTABLE CHANCE TEXT': '2× play amount · 3× higher bonus chance.',
	'PAYTABLE FEATURE TEXT': '20× play amount · guaranteed winning cluster.',
	'BET MODE FEATURE DIALOG':
		'Can be played for 20× play amount. Plays one Feature Spin with at least one guaranteed winning cluster and increased multiplier chance.',
	'BET MODE BONUS DIALOG':
		'Can be played for 100× play amount. Awards 10 free spins on an 8×8 grid.',
	'BET MODE MYSTERY DIALOG':
		'Can be played for 300× play amount. Awards Normal, Super, or Hidden Bonus.',
	'BET MODE SUPER DIALOG':
		'Can be played for 400× play amount. Awards 10 free spins on a 9×9 grid.',
	'PAYTABLE BONUS TEXT': '100× play amount · 10 free spins on an 8×8 grid.',
	'PAYTABLE SUPER TEXT': '400× play amount · 10 free spins on a 9×9 grid.',
	'PAYTABLE MYSTERY TEXT': '300× play amount · 60% Normal, 30% Super, 10% Hidden.',
	'BET MODE CHANCE DIALOG': '2× play amount. Bonus activation is three times more likely.',
	'BET MODE BASE DIALOG':
		'7×7 cluster-win game. Five or more matching vegetables connected horizontally or vertically win.',
	'RTP AND MAX WIN TEXT':
		'Theoretical RTP is 96.10% in every mode. Maximum win is 25,000× the base play amount in every mode.',
	'TOGGLE COST NOTE': 'This mode stays active and uses the shown play amount on every spin.',
	'UNFINISHED ROUND': 'UNFINISHED ROUND',
	'RESUME BODY': 'An unfinished %mode% round was found. Play it now or end it safely.',
	'RECOVERY BODY': 'The unfinished round could not be restored. Retry without starting a new play.',
	'INFO CTRL SPIN DESC': 'Start a game round with your selected play amount.',
	'INFO CTRL PLUS': 'Increase Play Amount',
	'INFO CTRL PLUS DESC': 'Raise your total play amount.',
	'INFO CTRL MINUS': 'Decrease Play Amount',
	'INFO CTRL MINUS DESC': 'Lower your total play amount.',
	'INFO CTRL INFO DESC': 'View the game rules and win table.',
	'HOWTO BET TITLE': 'PLAY AMOUNT SELECTOR',
	'HOWTO BET TEXT':
		'Use the + and − buttons or open the menu to change the displayed play amount before a round starts.',
	'HOWTO BUY TITLE': 'GET BONUS',
	'HOWTO BUY TEXT':
		'Open Bonus to choose a feature. Instantly triggered features require confirmation. Extra Chance toggles directly.',
	'HOWTO REPLAY TEXT':
		'Replay loads a completed event and shows the original play amount, total play amount, and win.',
	'INSUFFICIENT FUNDS TO PLACE THIS BET. PLEASE ADD FUNDS TO YOUR ACCOUNT OR LOWER THE BET LEVEL.':
		'NOT ENOUGH BALANCE. GET MORE COINS OR LOWER YOUR PLAY LEVEL.',
	// Info pages 3-6 (design copy carries bet / pay / buy / purchase / wager).
	'INFO FEATURE BUY': 'INSTANT BONUS',
	'INFO FEAT CLUSTER TEXT':
		'Wins are formed by landing 5 or more matching symbols connected horizontally or vertically. Only symbols directly connected to the same cluster are counted together. Larger clusters award higher wins according to the Win Table. More than one winning cluster can be formed during the same spin.',
	'INFO FEAT HIDDEN TEXT':
		'The Hidden Bonus is played on a 10x10 grid. This is the rarest and most powerful Bonus Feature. The expanded grid creates the highest possible number of symbol positions and the greatest potential for large clusters, repeated Tumbles and powerful Multiplier combinations.\n\nThe Random Multiplier Feature remains active during the bonus. Winning symbols have an increased chance of carrying Multipliers. The Hidden Bonus cannot be triggered instantly.',
	'INFO WTW CLUSTER TEXT':
		'Wins are formed by connecting 5 or more identical vegetable symbols horizontally or vertically.\nDiagonal symbols do not connect.\nEach connected winning cluster wins according to the Win Table.',
	'INFO WTW MAXWIN TEXT':
		'The maximum win is 25,000x the selected base play amount.\nWhen the maximum win is reached, the current game round or Free Spins feature ends immediately and the maximum amount is awarded.',
	'INFO FB NORMAL TITLE': 'Instant Normal Bonus',
	'INFO FB NORMAL TEXT':
		'Can be played for 100x the selected play amount and awards direct entry to the Normal Bonus on the 8x8 grid.',
	'INFO FB SUPER TITLE': 'Instant Super Bonus',
	'INFO FB SUPER TEXT':
		'Can be played for 400x the selected play amount and awards direct entry to the Super Bonus on the 9x9 grid.',
	'INFO FB MYSTERY TITLE': 'Instant Mystery Bonus',
	'INFO FB MYSTERY TEXT':
		'Can be played for 300x the selected play amount and randomly awards one of the following Bonus Features:\n60% chance of Normal Bonus, 30% chance of Super Bonus, 10% chance of Hidden Bonus\nThe Hidden Bonus cannot be triggered instantly and can only be obtained through a natural trigger or through the Instant Mystery Bonus.',
	'INFO GI INTERRUPTED TEXT':
		'If a game round is interrupted, it will continue when the game is reloaded, where possible. All valid plays and potential winnings remain active until the round is fully completed.',
	// Overview stat value (design copy reads "25,000× bet").
	'INFO OV MAXWIN VALUE': '25,000× play amount',
};
