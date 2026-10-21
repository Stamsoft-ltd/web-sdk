// Locale fallback and social English override pattern from Veggie Salad 3d719a197.
// Only shared UI terms imported; no Veggie rules, prices or RTP copied.
import { setupI18n } from '@lingui/core';
import chrome from './reference/chrome-locales.json';
import gameLocales from './game-locales.json';
const en: Record<string, string> = {
	BALANCE: 'Balance',
	BET: 'Bet',
	WIN: 'Win',
	BONUS: 'Bonus',
	SOUND: 'Sound',
	INFO: 'Info',
	MUSIC: 'Music',
	'TOTAL WIN': 'Total win',
	PAYTABLE: 'Paytable',
	'GAME RULES': 'Game rules',
	AUTOPLAY: 'Autoplay',
	TURBO: 'Turbo',
	REPLAY: 'Replay',
	'START REPLAY': 'Start replay',
	'BET REPLAY': 'Bet replay',
	'COST MULTIPLIER': 'Cost multiplier',
	'PAYOUT MULTIPLIER': 'Payout multiplier',
	BUY: 'Buy',
	CONFIRM: 'Confirm',
	CANCEL: 'Cancel',
	'FREE SPINS': 'Free spins',
	CONGRATULATIONS: 'Congratulations!',
	'MYSTERY NORMAL TEXT': 'Tiles start with 1 Blob. All tile upgrades persist throughout the bonus.',
	'MYSTERY SUPER TEXT': 'Tiles start with 2 Blobs. All tile upgrades persist throughout the bonus.',
	'MYSTERY HIDDEN TEXT': 'Tiles start with 3 Blobs. All tile upgrades persist throughout the bonus.',
	'YOU WON': 'You won',
	TUMBLES: 'Tumbles',
	'UNFINISHED ROUND': 'Unfinished round',
	'RETRY RESUME': 'Retry recovery',
	'RECOVERY TITLE': 'Round paused',
	'RECOVERY BODY': 'Reconnect to restore your round. No new bet will be placed.',
	'INFO CTRL SPIN': 'Spin',
	'INFO CTRL MENU': 'Menu',
	'INFO CTRL CLOSE': 'Close',
	'INFO CTRL PLUS': 'Increase bet',
	'INFO CTRL MINUS': 'Decrease bet',
	'AUTO START': 'Start autoplay',
	'AUTO NUM SPINS': 'Number of spins',
	'TOTAL BET COST': 'Total cost',
	'BASE BET': 'Base bet',
	MODE: 'Mode',
	'REPLAY DISCLAIMER': 'This is a replay of a previous bet round. No bets will be placed.',
	READY: 'Ready to split?',
	SPLIT: 'Split party!',
	CONTINUE: 'Continue',
	'PRESS TO CONTINUE': 'Press to continue',
	'PRESS ANYWHERE TO CONTINUE': 'Press anywhere to continue',
	// Splash cards; titles break where "\n" is.
	'SPLASH SPLIT TITLE': 'Split for\nbigger wins',
	'SPLASH SPLIT TEXT': 'Winning connections split the tiles, creating up to 6 Blobs per tile for bigger winning potential!',
	'SPLASH MAX TITLE': 'Max\nwin',
	'SPLASH MAX TEXT': 'Unleash the power of the Blobs and win up to 20,000× your bet!',
	'SPLASH BONUS TITLE': 'Three\nbonus modes',
	'SPLASH BONUS TEXT': 'Discover Normal, Super, and Hidden Bonuses, each bringing more Blobs and massive win potential!',
	PREVIEW: 'Visual preview · not live play',
	LIVE: 'Connected to RGS',
	CONNECTING: 'Connecting…',
	NORMAL: 'Normal Bonus',
	SUPER: 'Super Bonus',
	MYSTERY: 'Mystery Bonus',
	FEATURE: 'Feature Spin',
	BASE: 'Classic',
	HIDDEN: 'Hidden Bonus',
	// The replay card names the mode the way the game does, never the math key.
	'REPLAY MODE BASE': 'Base',
	'REPLAY MODE EXTRA_CHANCE': 'Extra Feature',
	'REPLAY MODE FEATURE': 'Feature Spin',
	'REPLAY MODE NORMAL': 'Normal Bonus',
	'REPLAY MODE SUPER': 'Super Bonus',
	'REPLAY MODE MYSTERY': 'Mystery Bonus',
	CHOOSE: 'Pick your party',
	'BUY BONUS': 'Buy bonus',
	'BUY FOR': 'Buy %name% for %price%?',
	'FEATURE DESC': 'Play one spin with random Split levels across the grid. Tiles can hold up to 6 Blobs.',
	'NORMAL DESC':
		'Awards 10 Free Spins. Each winning connection upgrades the tiles involved, allowing them to split into up to 6 Blobs. Upgrades remain active throughout the bonus.',
	'SUPER DESC':
		'Awards 10 Free Spins. Every tile starts with 2 Blobs. Winning connections upgrade the tiles further, up to 6 Blobs per tile. Upgrades persist throughout the bonus.',
	// One line per odds row (the cards and the info page render it with pre-line).
	'MYSTERY DESC':
		'Randomly awards one of three bonuses, each with 10 Free Spins:\n65% Normal Bonus — Tiles start with 1 Blob.\n30% Super Bonus — Tiles start with 2 Blobs.\n5% Hidden Bonus — Tiles start with 3 Blobs.\nAll tile upgrades persist throughout the bonus.',
	// Design's Extra Chance card (Figma 9164:11722): toggles the extra_chance bet mode.
	EXTRA: 'Extra Feature',
	EXTRA_CHANCE: 'Extra Feature',
	DEACTIVATE: 'Deactivate',
	'EXTRA DESC': 'Double your bet for twice the chance of triggering a Bonus Feature.',
	ACTIVATE: 'Activate',
	'COMING SOON': 'Coming soon',
	'TURBO SPIN': 'Turbo spin',
	'SUPER TURBO SPIN': 'Super turbo spin',
	LANGUAGE: 'Language',
	STOP: 'Stop',
	SETTINGS: 'Settings',
	RULE: 'Match adjacent same-color blobs: at least 2 tiles and 5 blob units. Winning positions gain one split level, up to 6 units per tile. Splits stay in place as new blobs tumble in.',
	BONUSRULE:
		'3 / 4 / 5+ eggs award Normal / Super / Hidden: 10 free spins, starting at 1 / 2 / 3 units per tile. Split levels persist through the bonus.',
	FEATURE_RULE:
		'Feature: one spin starting with 2–6 units per tile. Mystery: 65% Normal, 30% Super, 5% Hidden.',
	PREVIEW_NOTE:
		'Recorded math-book fixtures cycle in order. Preview balances are simulated; outcome frequencies do not represent RTP.',
	ERROR: 'Connection interrupted',
	INSUFFICIENT: 'Insufficient balance',
	'INSUFFICIENT BODY': 'Your balance is too low for this bet. Lower the bet to keep playing.',
	'PLAY FAILED': 'The round could not be started. Nothing was placed, please try again.',
	NOTICE: 'Notice',
	LOADING: 'Loading',
	OK: 'OK',
	RELOAD: 'Reconnect',
	AUTO_NOTE: 'Base mode only. Stops on bonus, error, insufficient balance, or Stop.',
	RULES_NOTE: 'V1 uses the DOCX two-tile/five-unit cluster rule. Product sign-off pending.',
	NO_SESSION: 'Launch through RGS, or open visual preview.',
	OPEN_PREVIEW: 'Open visual preview',
	// Game info pages (components/GameInfo.svelte). Content follows the math, not the
	// design's placeholder copy.
	'INFO PAGE': 'Page',
	'INFO OVERVIEW': 'Overview',
	'INFO OVERVIEW TEXT':
		'Blob Split is a 7x7 cluster slot. Match neighbouring blobs of the same colour, at least 2 tiles holding 5 or more blob units, to win.',
	'INFO OVERVIEW TEXT 2':
		'Every win splits the blobs that made it, up to 6 units per tile, and splits stay in place as new blobs tumble in.',
	'INFO MAX WIN': 'Maximum win:',
	'INFO RTP': 'Theoretical RTP:',
	RTP: 'RTP',
	'SESSION TIME': 'Session',
	'SPIN WINS': 'Spin wins',
	'SPIN WIN': 'Spin win',
	'NET POSITION': 'Net',
	'ERROR BODY': 'Check your internet connection, then reconnect to keep playing.',
	AUTO: 'AUTO',
	'INFO TILE REELS': 'reels',
	'INFO TILE CLUSTER': 'Cluster',
	'INFO TILE WINS': 'wins',
	'INFO TILE MAX': 'max win',
	'INFO UNITS': 'Blob units',
	'INFO SYMBOL': 'Symbol',
	'INFO BASKETS': 'Eggs',
	'INFO SPLITS': 'Blob split',
	'INFO SPLITS TEXT':
		'Columns count every blob unit in the cluster, so split tiles push a win into higher columns.',
	'INFO FEATURES': 'Features',
	'INFO SPLIT TEXT': 'Each winning tile gains one split level, up to 6 units. Scatter eggs do not split.',
	'INFO TUMBLE': 'Tumble',
	'INFO TUMBLE TEXT': 'Winners pop, the rest fall and new blobs drop in. Splits stay.',
	'INFO NORMAL TEXT':
		'Triggered by 3 eggs. Awards 10 free spins with every tile starting at 1 blob unit. Split levels stay for the whole bonus.',
	'INFO SUPER TEXT':
		'Triggered by 4 eggs. Awards 10 free spins with every tile starting at 2 blob units. Split levels stay for the whole bonus.',
	'INFO HIDDEN TEXT':
		'Triggered by 5 or more eggs. Awards 10 free spins with every tile starting at 3 blob units. Split levels stay for the whole bonus.',
	'INFO WAYS': 'Ways to win',
	'INFO WAYS 1': 'Blob Split uses cluster wins instead of lines.',
	'INFO WAYS 2': 'A win needs neighbouring blobs of the same colour: at least 2 tiles holding 5 or more blob units in total.',
	'INFO WAYS 3': 'A split tile counts every blob unit on it, so a few split tiles can form a win on their own.',
	'INFO WAYS 4': 'The win depends on the colour and on the total blob units in the cluster. More units award bigger wins.',
	'INFO WAYS 5': 'Winning tiles split and stay split as new blobs tumble in.',
	'INFO WAYS 6':
		'Free spins: 3, 4 or 5+ eggs award 10 free spins in the Normal, Super or Hidden bonus. More than 5 eggs award no extra spins, and free spins cannot be retriggered. The bonus ends early if the 20,000x max win is reached.',
	'INFO BUY INTRO':
		'Bonus buys are available only where allowed. Each one is priced as a multiple of the selected bet.',
	'INFO PRICE': 'Cost',
	'INFO GENERAL': 'General info',
	'INFO INTERRUPTED': 'Interrupted rounds',
	'INFO INTERRUPTED TEXT':
		'If a round is interrupted, it continues when the game is reloaded. No new bet is placed to finish it.',
	'INFO LEGAL': 'Legal notice',
	// General Game Disclaimer = Engine's own template, verbatim (BODY 1-3 + COPYRIGHT). It ends
	// "TM and © 2026 Engine." — never "Stake Engine". No social override: it is Engine's approved text.
	'INFO LEGAL BODY 1':
		'Malfunction voids all wins and plays. A consistent internet connection is required. In the event of a disconnection, reload the game to finish any uncompleted rounds.',
	'INFO LEGAL BODY 2':
		'The expected return is calculated over many plays. The game display is not representative of any physical device and is for illustrative purposes only.',
	'INFO LEGAL BODY 3':
		'Winnings are settled according to the amount received from the Remote Game Server and not from events within the web browser.',
	'INFO LEGAL COPYRIGHT': 'TM and © 2026 Engine.',
	'INFO UI': 'User interface guide',
	'INFO UI SPIN': 'Starts a new game round.',
	'INFO UI AUTO': 'Opens the autoplay menu.',
	'INFO UI TURBO': 'Cycles the speed: normal, turbo, super turbo.',
	'INFO UI BET PLUS': 'Bet +',
	'INFO UI BET MINUS': 'Bet -',
	'INFO UI MENU': 'Opens settings and game info.',
	'INFO UI SOUND': 'In settings: turns sound on or off.',
	'INFO UI MUSIC': 'In settings: turns music on or off.',
	'INFO UI BONUS': 'Opens the bonus menu. While Extra Feature is on, it reads Deactivate and turns it off.',
	'INFO UI INFO': 'In settings: opens the game info.',
	'INFO UI PREV': 'Previous',
	'INFO UI PREV DESC': 'Goes to the previous page.',
	'INFO UI NEXT': 'Next',
	'INFO UI NEXT DESC': 'Goes to the next page.',
	'INFO UI CLOSE': 'Closes the current window.',
};
// The game's own copy in every language the chrome catalog offers (the chrome keys stay in
// chrome-locales.json). Social mode is always English, so these carry no social variants.
const game: Record<string, Record<string, string>> = gameLocales;
const social: Record<string, string> = {
	BET: 'Play',
	BUY: 'Play',
	'BUY BONUS': 'Get bonus',
	'BUY FOR': 'Play %name% for %price%?',
	'BASE BET': 'Base play',
	'BET REPLAY': 'Play replay',
	'PAYOUT MULTIPLIER': 'Win multiplier',
	'TOTAL BET COST': 'Total play',
	'INFO CTRL PLUS': 'Increase play amount',
	'INFO CTRL MINUS': 'Decrease play amount',
	PAYTABLE: 'Win table',
	'REPLAY DISCLAIMER': 'Replay of a previous play. No new plays will be placed.',
	'RECOVERY BODY': 'Reconnect to restore your round. No new play will be placed.',
	'INSUFFICIENT BODY': 'Your balance is too low for this play. Lower the play amount to keep going.',
	'INFO BUY INTRO':
		'Instant bonuses are available only where allowed. Each one can be played for a multiple of the selected play amount.',
	'INFO PRICE': 'Play for',
	'INFO INTERRUPTED TEXT':
		'If a round is interrupted, it continues when the game is reloaded. No new play is placed to finish it.',
	'INFO UI BET PLUS': 'Play +',
	'INFO UI BET MINUS': 'Play -',
	'EXTRA DESC': 'Double your play amount for twice the chance of triggering a Bonus Feature.',
	'SPLASH MAX TEXT': 'Unleash the power of the Blobs and win up to 20,000× your play amount!',
};
export const languages = ['en', ...Object.keys(chrome).sort()];
export const i18n = setupI18n();
// The catalogs are plain strings (no ICU placeholders: %name% is replaced by translateVars), so
// each passes through as one literal token. Lingui sets its ICU compiler only in dev; without
// one, a production build logs "Uncompiled message detected!" for every string it translates.
i18n.setMessagesCompiler((message) => [message]);
export function activate(lang: string, isSocial = false) {
	const locale = isSocial ? 'en' : lang.split(/[-_]/)[0];
	const messages = {
		...en,
		...(chrome as Record<string, Record<string, string>>)[locale],
		...game[locale],
		...(isSocial ? social : {}),
	};
	i18n.load(locale, messages);
	i18n.activate(locale);
	document.documentElement.lang = locale;
	document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
}
export const t = (key: string) => i18n._(key);
