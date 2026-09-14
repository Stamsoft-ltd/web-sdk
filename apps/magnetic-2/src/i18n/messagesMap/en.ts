export default {
	HOME: 'HOME',
	'NOT TRANSLATED': 'NOT TRANSLATED',
	'GAME TITLE': 'MAGNETIC',

	// Splash intro feature boards (see SplashIntro.svelte). The big multiplier values are
	// set as constants in the component; only the surrounding copy is translated here.
	'SPLASH MULTIPLIER': 'multiplier',
	'SPLASH PRESS': 'PRESS TO CONTINUE',
	'SPLASH BONUS TITLE': 'BONUS\nGAMES',
	'SPLASH SCATTERS FOR': '%count% scatters for',
	// The three scatter tiers and the POLARITY SHIFTER card (design 9078:18632, 2026-09-02). These
	// replaced the old MEGA CHAIN copy on the splash; the game uses the design's names throughout --
	// Gravity Breach and Core Overload (2026-09-04 rename, see art-src/REBUILD-QUEUE.md).
	'SPLASH GRAVITY BREACH': 'GRAVITY BREACH',
	'SPLASH CORE OVERLOAD': 'CORE OVERLOAD',
	'SPLASH ZERO POINT': 'ZERO POINT PROTOCOL',
	'SPLASH POLARITY TITLE': 'POLARITY\nSHIFTER',
	'SPLASH POLARITY BODY': 'Slams all symbols toward one wall — Left, Right, Up, or Down!',
	'SPLASH MAX TITLE': 'MAX\nWIN',
	'SPLASH UP TO': 'up to',
	BALANCE: 'BALANCE',
	BET: 'BET',
	'TOTAL COST': 'TOTAL COST',
	'REAL COST': 'REAL COST',
	MODE: 'MODE',
	'BUY BONUS': 'BUY BONUS',
	BONUS: 'BONUS',
	PAYTABLE: 'PAYTABLE',
	'GAME RULES': 'GAME RULES',
	AUTOPLAY: 'AUTOPLAY',
	AUTO: 'AUTO',
	TURBO: 'TURBO',
	REPLAY: 'REPLAY',
	'BET REPLAY': 'Bet Replay',
	'START REPLAY': 'START REPLAY',
	'REPLAY EVENT': 'Replay Event',
	'BASE BET': 'Base Bet',
	'COST MULTIPLIER': 'Cost Multiplier',
	'TOTAL BET COST': 'Total Bet Cost',
	'PAYOUT MULTIPLIER': 'Payout Multiplier',
	'REPLAY DISCLAIMER': 'This is a replay of a previous bet round. No bets will be placed.',
	'PLAY AGAIN': 'PLAY AGAIN',
	'RETRY RESUME': 'RETRY ROUND',
	'RECOVERY TITLE': 'UNFINISHED ROUND DETECTED',
	'RECOVERY BODY':
		'The previous round could not be restored automatically. Retry to finish the original round before starting a new one.',
	EVENT: 'EVENT',
	PAYOUT: 'PAYOUT',
	WIN: 'WIN',
	'DEAL IT': 'GRAVITY BREACH',
	'ALL IN': 'CORE OVERLOAD',
	'REPLAY ERROR GENERIC': 'Replay unavailable. Please retry.',
	'BET MODE BASE TITLE': 'BASE',
	'BET MODE BONUS TITLE': 'GRAVITY BREACH',
	'BET MODE CHANCE TITLE': 'CHANCE SPIN',
	'BET MODE SUPER TITLE': 'CORE OVERLOAD',
	'BET MODE FEATURE TITLE': 'FEATURE SPIN',
	// General Game Disclaimer. This is Stake Engine's OWN template, verbatim:
	//   https://stake-engine.com/docs/approval-guidelines/general-disclaimer
	// A submission may use the template or its own wording "so long as the same message is
	// clearly conveyed" — use the template, because a reviewer can diff it. Note the closing
	// sentence is "TM and © 2026 Engine.", NOT "Stake Engine"; the other locales carry their
	// own wording of that one sentence. See STAKE_REVIEW_LESSONS.md.
	'DISCLAIMER TEXT':
		'Malfunction voids all wins and plays. A consistent internet connection is required. In the event of a disconnection, reload the game to finish any uncompleted rounds. The expected return is calculated over many plays. The game display is not representative of any physical device and is for illustrative purposes only. Winnings are settled according to the amount received from the Remote Game Server and not from events within the web browser. TM and © 2026 Engine.',

	// ── Info / rules popup (CustomInfoModal.svelte). Numeric values (7X7, 20,000, 96.10%, 2x…) stay as
	//    constants in the component; only the copy below is translated. %value% placeholders are left
	//    intact by translators and substituted at render time. ──
	// Page titles
	'INFO OVERVIEW': 'OVERVIEW',
	'INFO PAYTABLE': 'PAYTABLE',
	'INFO FEATURES': 'FEATURES',
	'INFO CLUSTER WIN': 'CLUSTER WIN',
	'INFO FEATURE BUY': 'FEATURE BUY',
	'INFO GENERAL INFO': 'GENERAL INFO',
	'INFO UI GUIDE': 'USER INTERFACE GUIDE',
	// Overview
	'INFO OV TEXT 1':
		'Magnetic is a 7x7 cluster-pay slot where wins are created by groups of matching symbols. Land 5 or more matching symbols connected horizontally or vertically to win.',
	'INFO OV TEXT 2':
		'Magnetic features can pull matching symbols together, helping create bigger clusters and stronger wins.',
	'INFO OV MAXWIN': 'Maximum win: %value% bet.',
	'INFO STAT REELS': 'REELS',
	'INFO STAT CLUSTER': 'CLUSTER',
	'INFO STAT PAYS': 'PAYS',
	'INFO STAT MAXWIN': 'MAX WIN',
	'INFO STAT RTP': 'RTP',
	// Paytable
	'INFO SYMBOL RANK': 'SYMBOL RANK',
	'INFO POLARITY TITLE': 'POLARITY SHIFTER',
	'INFO POLARITY TEXT':
		'When activated, the Polarity Shifter slams the whole cluster toward the wall shown by the arrow. New symbols of the same type are then added along that wall, creating a larger cluster.',
	'INFO WILD VALUES': 'Multiplier Wild Values',
	'INFO WILD STANDARD': 'Standard multiplier wild values:',
	'INFO WILD RARE': 'Rare multiplier wild values (mainly in Core Overload):',
	// Features
	'INFO FEAT WILD TITLE': 'Wild Symbol',
	'INFO FEAT WILD TEXT':
		'Substitutes for all pay symbols except Scatter. When activated, the Magnetic Wild randomly selects one regular pay symbol currently on the grid and attracts all matching symbols together. Wilds and Scatters cannot be selected. A Magnetic Wild activates only when it lands and does not reactivate during the resulting respin.',
	'INFO FEAT MWILD TITLE': 'Multiplier Wild',
	'INFO FEAT MWILD TEXT':
		'Substitutes like a Wild and increases the active bonus multiplier for the rest of the feature.',
	'INFO FEAT DROP TITLE': 'Gravity Breach Free Spins',
	'INFO FEAT DROP TEXT':
		'Triggered by 3 Scatters. Awards 10 Free Spins. When a Magnetic Wild lands, it selects a target using the same visible-position rule and pulls matching symbols together.',
	'INFO FEAT MEGA TITLE': 'Core Overload Free Spins',
	'INFO FEAT MEGA TEXT':
		'Triggered by 4 Scatters. Awards 10 Free Spins. Magnetic clusters can remain locked and grow across the feature.',
	'INFO FEAT RETRIGGER':
		'Free Spins cannot be re-triggered. Scatters landing during a bonus round do not award extra spins.',
	// Cluster win
	'INFO CW 1': 'Magnetic uses cluster wins instead of paylines.',
	'INFO CW 2':
		'A win is created when 5 or more matching symbols touch each other horizontally or vertically.',
	'INFO CW 3': 'Diagonal connections do not count.',
	'INFO CW 4':
		'Winning symbols do not need to form a straight line. They only need to be connected as one group.',
	'INFO CW 5': 'Bigger clusters award bigger wins.',
	// Feature buy
	'INFO FB SUB':
		'Feature Buy options are available only where allowed. All Feature Buy and Bonus Buy options are paid as a multiple of the selected bet.',
	'INFO COST': 'COST',
	'INFO RTP': 'RTP',
	// General info
	'INFO GI INTERRUPTED TITLE': 'Interrupted Rounds',
	'INFO GI INTERRUPTED 1':
		'If a game round is interrupted, it will continue when the game is reloaded, where possible.',
	'INFO GI INTERRUPTED 2':
		'All valid wagers and potential winnings remain active until the round is fully completed.',
	'INFO GI LEGAL TITLE': 'Legal Notice',
	// Controls / UI guide
	'INFO CTRL SPIN': 'Spin',
	'INFO CTRL SPIN DESC': 'Start a game round with your selected bet.',
	'INFO CTRL AUTO': 'Autoplay',
	'INFO CTRL AUTO DESC': 'Play a set number of rounds automatically.',
	'INFO CTRL TURBO': 'Turbo',
	'INFO CTRL TURBO DESC': 'Speed up every game round.',
	'INFO CTRL PLUS': 'Increase Bet',
	'INFO CTRL PLUS DESC': 'Raise your total bet.',
	'INFO CTRL MINUS': 'Decrease Bet',
	'INFO CTRL MINUS DESC': 'Lower your total bet.',
	'INFO CTRL INFO': 'Info',
	'INFO CTRL INFO DESC': 'View the game rules and paytable.',
	'INFO CTRL SOUND': 'Sound',
	'INFO CTRL SOUND DESC': 'Turn the sound effects on or off.',
	'INFO CTRL PREV': 'Previous',
	'INFO CTRL PREV DESC': 'Go to the previous page.',
	'INFO CTRL NEXT': 'Next',
	'INFO CTRL NEXT DESC': 'Go to the next page.',
	'INFO CTRL CLOSE': 'Close',
	'INFO CTRL CLOSE DESC': 'Close this window.',
	'INFO CTRL MENU': 'Menu',
	'INFO CTRL MENU DESC': 'Open settings and game options.',
	'INFO CTRL MUSIC': 'Music',
	'INFO CTRL MUSIC DESC': 'Turn the background music on or off.',
	// Pager
	'INFO PAGE': 'Page',

	// ── HUD, menus, modals, win screens (rest of the app). %name%/%mode%/%cost% are left intact by
	//    translators and substituted at render time. Feature/brand names (Gravity Breach, Core
	//    Overload) stay verbatim. ──
	SOUND: 'SOUND',
	MUSIC: 'MUSIC',
	INFO: 'INFO',
	DEACTIVATE: 'DEACTIVATE',
	ACTIVATE: 'ACTIVATE',
	BUY: 'BUY',
	CONFIRM: 'CONFIRM',
	CANCEL: 'CANCEL',
	'PER SPIN': '/ spin',
	'CONFIRM TITLE': 'CONFIRM %name%',
	'BUY CONFIRM': 'BUY %name% FOR %cost%?',
	// Buy bonus modal cards
	'BUY EXTRA CHANCE TITLE': 'Extra Chance',
	'BUY EXTRA CHANCE DESC': 'Activate to triple the chance of triggering a bonus round.',
	'BUY FEATURE SPINS TITLE': 'Feature Spins',
	'BUY FEATURE SPINS DESC':
		'Buys a special spin with a guaranteed magnetic connection and a chance to land Multiplier Wilds.',
	'BUY DROP TITLE': 'Gravity Breach',
	'BUY DROP DESC':
		'10 free spins awarded. One random symbol becomes magnetic every spin. Matching symbols connect together automatically. Multiplier Wilds increase the bonus multiplier permanently.',
	'BUY MEGA TITLE': 'Core Overload',
	'BUY MEGA DESC':
		'10 free spins awarded. One random symbol becomes magnetic and remains connected between spins. The magnetic cluster persists and grows throughout the feature while multipliers continue stacking.',
	'MYSTERY WON GRAVITY': '%count% free spins with Magnetic connections and Multiplier Magnets.',
	'MYSTERY WON CORE':
		'%count% free spins with persistent Magnetic clusters that can grow throughout the bonus.',
	'MYSTERY WON ZERO': '%count% free spins with a guaranteed Multiplier Magnet on the first spin.',
	'BUY ZERO TITLE': 'Zero Point Protocol',
	'BUY ZERO DESC':
		'10 free spins awarded with a guaranteed Multiplier Magnet on the very first spin.',
	'BUY MYSTERY TITLE': 'Mystery Bonus',
	'BUY MYSTERY DESC': 'One of the three bonus rounds is awarded at random: %a%, %b% or %c%.',
	// Autoplay modal
	'AUTO TURBO': 'TURBO SPIN',
	'AUTO SUPER TURBO': 'SUPER TURBO SPIN',
	'AUTO FEATURE': '50X BONUS FEATURE',
	'AUTO NUM SPINS': 'NUMBER OF SPINS',
	'AUTO LOSS LIMIT': 'LOSS LIMIT',
	'AUTO WIN LIMIT': 'SINGLE WIN LIMIT',
	'AUTO START': 'START AUTOPLAY',
	// Win / free-spin screens
	'YOU WON': 'YOU WON',
	'FREE SPINS': 'FREE SPINS',
	CONGRATULATIONS: 'CONGRATULATIONS!',
	'PRESS ANYWHERE': 'PRESS ANYWHERE TO CONTINUE',
	'TOTAL WIN': 'TOTAL WIN',
	// Bonus resume modal
	'UNFINISHED ROUND': 'UNFINISHED ROUND',
	// Shown instead of the shared generic error modal when a bet cannot be covered — see
	// InsufficientFundsModal.svelte. Social-mode wording is overridden in socialOverridesEn.ts.
	'NO BALANCE TITLE': 'NOT ENOUGH BALANCE',
	'NO BALANCE BODY': 'Your balance is too low for this bet. Lower your bet level to keep playing.',
	OK: 'OK',
	'RESUME BODY': 'You have an active %mode% bonus in progress.',
	'PLAY ROUND': 'PLAY ROUND',
	'END ROUND': 'END ROUND',
};
