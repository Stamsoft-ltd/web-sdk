import { stateI18nDerived, stateConfig, stateUrlDerived } from 'state-shared';
import sharedMessages from 'components-ui-html/src/i18n/messagesMap';
import { locales } from 'config-lingui';
import type { MessagesMap } from 'utils-shared/i18n';
import { socialEnglish } from '../game/platformConfig';
import { draftCatalogs } from './draftCatalogs';
import { rulesCopy } from './rulesCopy';
import { nativeSocialLabel, needsSocialFallback } from './socialCatalogs';
const en: Record<string, string> = {
	'BOARD DESCRIPTION': '6 columns, 5 rows. Pay anywhere.',
	'LOW BALANCE': 'Low balance',
	RTP: 'RTP',
	'RULES RTP': 'RTP: 96.1% in all modes. Maximum win: 25,000× base bet.',
	'ERROR BALANCE': 'Balance too low for this play. Lower the play amount.',
	'AUTO LOSS LIMIT': 'Autoplay stopped: loss limit reached.',
	'AUTO WIN LIMIT': 'Autoplay stopped: single-win limit reached.',
	'TAP ANYWHERE TO CONTINUE': 'Tap anywhere to continue',
	'ERROR LIMIT': 'Your session limit has been reached. Continue to reconnect.',
	'ERROR BUSY': 'Service temporarily busy. Continue to reconnect.',
	'ERROR SESSION': 'Session unavailable. Continue to reconnect.',
	'ERROR REPLAY AMOUNT': 'This replay link has an invalid or missing play amount.',
	'ERROR CONNECTION':
		'Unable to complete the request. Continue to reconnect and restore any unfinished round.',
	'SOUND CONTROL': 'Turn all sound effects on or off.',
	'MUSIC CONTROL': 'Turn background music on or off.',
	'STOP CONTROL':
		'During a spin, speed up its animation. During autoplay, stop future spins. The current round always finishes.',
	'REDUCED CONTROL': 'Reduce motion effects when available.',
	'FULLSCREEN CONTROL': 'Enter or leave fullscreen when supported.',
	'SPACE CONTROL':
		'Press Space to spin or continue. Hold Space for repeated Turbo spins when allowed.',
	'REPLAY CONTROL': 'Play the recorded round again. No new play is placed.',

	...rulesCopy,
	'THE GATES': 'The Gates',
	MUSIC: 'Music',
	INFO: 'Info',
	OPTIONS: 'Options',
	'CASCADING WINS': 'CASCADING WINS',
	'MAX WIN 25,000×': 'MAX WIN 25,000×',
	'THREE BONUS MODES': 'THREE BONUS MODES',
	'INTRO CASCADING COPY':
		'Winning symbols disappear, making room for new symbols and even more wins!',
	'INTRO MAX WIN COPY': 'Unlock the potential to win up to 25,000× your bet!',
	'INTRO BONUS MODES COPY':
		'Unlock Normal, Super, and Hidden Bonuses, each with exciting features and massive win potential!',
	OVERVIEW: 'Overview',
	'PAYOUT TABLE': 'Paytable',
	'FEATURES PAGE': 'Features',
	'WAYS TO WIN': 'Ways to win',
	'FEATURE BUY': 'Feature buy',
	'GENERAL INFO': 'General info',
	'UI GUIDE': 'User interface guide',
	SYMBOL: 'Symbol',
	PAGE: 'Page',
	'PREVIOUS PAGE': 'Previous page',
	'NEXT PAGE': 'Next page',
	'RULES NAVIGATION': 'Rules pages',
	'MULTIPLIER RULE':
		'Every third winning tumble opens a gate. The final spin multiplier applies to the entire tumble win. Base multipliers reset each spin; bonus multipliers persist.',
	'STICKY RULE':
		'In Super and Hidden, gates may award sticky Wilds. They substitute for paying symbols and persist through tumbles and later free spins, with up to 3 at once.',
	'SPINS RULE':
		'Bonuses begin with 15 free spins. Super and Hidden gates may award 1, 2, 3 or 5 extra spins or a 15-spin retrigger. Normal has no extra-spin rewards.',
	'PAY ANYWHERE': 'Pay anywhere',
	'ANYWHERE RULE':
		'Match 8 or more of the same paying symbol anywhere on the 6 × 5 board. Only the highest matching payout tier for each symbol pays.',
	'TUMBLE RULE':
		'Winning symbols are removed and remaining symbols drop. New symbols fill the empty positions. Tumbles continue while the board wins; progress resets for each spin.',
	'BONUS TRIGGERS': 'Bonus triggers',
	'BONUS RULES':
		'Triggered by 3 Keys, selected by Mystery, or bought directly. Starts with 15 free spins. Gates award additive multipliers. Normal only; no upgrades to Super or Hidden.',
	'INTERRUPTED ROUNDS': 'Interrupted rounds',
	'DISCONNECTION RULE':
		'If disconnected, reload the game and continue the unfinished round. The server retains the authoritative result; continuing does not place another bet.',
	'LEGAL NOTICE': 'Legal notice',
	'INTERRUPTED CONTINUE':
		'If a game round is interrupted, it will continue when the game is reloaded, where possible.',
	'INTERRUPTED WAGERS':
		'All valid wagers and potential winnings remain active until the round is fully completed.',
	'LEGAL CONNECTION':
		'Malfunction voids all pays and plays. A stable internet connection is required. If the connection is lost, reload the game to complete any unfinished rounds.',
	'LEGAL DISPLAY':
		'The expected return is calculated over a large number of plays. The game display is for visual and entertainment purposes only and does not represent any physical gaming device.',
	'LEGAL SETTLEMENT':
		'All winnings are settled according to the result received from the Remote Game Server, not from animations or events shown inside the web browser. TM and © 2026 Engine.',
	'GENERAL DISCLAIMER':
		'Malfunction voids all wins and plays. A consistent internet connection is required. In the event of a disconnection, reload the game to finish any uncompleted rounds. The expected return is calculated over many plays. The game display is not representative of any physical device and is for illustrative purposes only. Winnings are settled according to the amount received from the Remote Game Server and not from events within the web browser. TM and © 2026 Engine.',
	'SPIN CONTROL': 'Start a round at the selected bet and mode.',
	'MENU CONTROL': 'Open paytable & rules or settings.',
	'BONUS CONTROL': 'Choose a feature, or Disable an active feature.',
	'BET CONTROL':
		'Use − / + to change the base bet between rounds. Feature spin displays the full 20× spin cost; payouts still use the base bet.',
	'SPEED CONTROL': 'Cycle Normal, Fast and Turbo. Presentation speed never changes results.',
	'SETTINGS CONTROL': 'Choose reduced motion or fullscreen where available.',
	'RULES CONTROL': 'Browse payouts, features and the seven rules pages.',
	'GATE FEATURE': 'Gate feature',
	'GATE MULTIPLIERS': 'Gate multipliers',
	'NORMAL FEATURE':
		'3 Keys, Mystery or a direct Normal purchase award 15 free spins. Each gate gives an additive multiplier. Upgrades persist through the bonus; no sticky Wilds or extra spins.',
	'SUPER FEATURE':
		'4 Keys, Mystery or a direct Super purchase award 15 free spins. Gates give additive multipliers, ×2/×3/×5 upgrades, up to 3 sticky Wilds, 1, 2, 3 or 5 extra spins or a 15-spin retrigger. Multipliers and sticky Wilds persist.',
	'HIDDEN FEATURE':
		'5+ Keys or Mystery award Hidden; it is not sold directly. Every gate applies two rewards in order, using the Super reward types. Both resolve before the spin win. Multipliers and sticky Wilds persist.',
	'BET PLUS': 'Bet +',
	'BET MINUS': 'Bet −',
	'BET PLUS CONTROL':
		'Increase the base bet between rounds. Hold to move quickly through the available levels.',
	'BET MINUS CONTROL':
		'Decrease the base bet between rounds. Hold to move quickly through the available levels.',
	'PREVIOUS CONTROL': 'Go to the previous rules page.',
	'NEXT CONTROL': 'Go to the next rules page.',
	'CLOSE CONTROL': 'Close the current window.',
	'AUTO CONTROL':
		'Choose a spin count and speed, then confirm to start. Stop ends future spins only.',
	'BUY TERMS':
		'Full entry spin before free spins. Normal and Super are tier-locked; Mystery selects one tier. Payouts use the base bet, not the purchase cost. The 25,000× cap covers the whole round.',
	'SYMBOL GUARDIAN_MASK': 'Guardian Mask',
	'SYMBOL SUN_MEDALLION': 'Sun Medallion',
	'SYMBOL SACRED_EYE': 'Sacred Eye Relic',
	'SYMBOL RUNE_CHALICE': 'Rune Chalice',
	'SYMBOL CRYSTAL_ORB': 'Crystal Orb',
	'SYMBOL RED_GEM': 'Red Gem',
	'SYMBOL BLUE_GEM': 'Blue Gem',
	'SYMBOL GREEN_GEM': 'Green Gem',
	'SYMBOL PURPLE_GEM': 'Purple Gem',
	'SYMBOL AMBER_GEM': 'Amber Gem',
	TUMBLES: 'Tumbles',
	MENU: 'Menu',
	'BONUS BUTTON': 'Bonus',
	'BET LABEL': 'Bet',
	BUY: 'Buy',
	'BONUS MODES': 'Bonus modes & features',
	'BONUS SHARED RULES':
		'Each bonus starts with 15 free spins and a fresh 1× multiplier. The entry-spin multiplier does not carry over. During the bonus, multiplier upgrades persist between spins. Every third winning tumble within a spin opens another gate; tumble progress resets for the next spin. Keys never appear during free spins, so extra spins and retriggers can only come from gate rewards.',
	'NORMAL RULES':
		'Triggered by 3 Keys, selected by Mystery, or bought directly. Each gate gives one additive multiplier reward. The first reward sets the multiplier; later additive rewards increase it. Normal has no sticky Wilds or extra-spin rewards. A direct Normal purchase always awards Normal, with no chance of upgrading to Super or Hidden.',
	'SUPER RULES':
		'Triggered by 4 Keys, selected by Mystery, or bought directly. Each gate gives one reward: an additive multiplier, multiplication of the current multiplier by 2, 3 or 5, a sticky Wild, 1, 2, 3 or 5 extra spins, or a 15-spin retrigger. Sticky Wilds substitute for paying symbols and remain in place through tumbles and subsequent free spins, with up to 3 at once. A direct Super purchase always awards Super, with no chance of upgrading to Hidden.',
	'HIDDEN RULES':
		'Triggered by 5 or more Keys or selected by Mystery; not sold directly. Uses the same reward types as Super, but every gate awards two rewards, applied in order. Multiplier upgrades and sticky Wilds persist through the bonus. Both rewards are resolved before the current spin win is calculated.',
	'MYSTERY RULES':
		'Selects one tier: 65% Normal, 30% Super, or 5% Hidden. The selected tier starts with 15 free spins and keeps its own rules throughout the bonus; there is no later tier upgrade. Mystery is not a guaranteed Hidden bonus.',
	'CHANCE RULES':
		'An optional paid-spin mode that triples the natural bonus-trigger chance compared with the base game. It does not guarantee a bonus. Remains active for each paid spin until deactivated.',
	'FEATURE RULES':
		'An optional paid-spin mode guaranteeing at least one gate on the full entry spin. Gate rewards on that spin are additive multipliers. Keys can also trigger a bonus. Remains active for each paid spin until deactivated; a bonus is not guaranteed.',
	'BONUS PURCHASE RULES':
		'All costs above are multiples of the base bet. Bonus purchases play the full entry spin before the free spins begin. Normal and Super purchases are tier-locked; only Mystery randomly selects a tier. Wins are calculated from the base bet, not the purchase cost. The 25,000× round cap includes the entry spin and the entire bonus.',

	'REDUCED MOTION': 'Reduced motion',
	SPIN: 'Spin',
	STOP: 'Stop',
	PLAY: 'Play',
	CONTINUE: 'Continue',
	'PLAY ROUND': 'Play round',
	'SKIP ROUND': 'Skip round',
	'UNFINISHED ROUND CHOICE': 'Play the unfinished round, or skip its animations and settle it.',
	'PRESS TO CONTINUE': 'Press to continue',
	'UNFINISHED ROUND NOTE': 'You have an unfinished round. Continue to complete it.',
	CLOSE: 'Close',
	CANCEL: 'Cancel',
	CONFIRM: 'Confirm',
	BACK: 'Back',
	OK: 'OK',
	'BALANCE DEBIT NOTE': 'This amount will be deducted from your balance.',
	'FEATURE COST NOTE': 'Cost per spin until disabled.',
	'FAST SPIN': 'Fast spin',
	'INSTANT SPIN': 'Instant spin',
	'AUTOPLAY BONUS': 'Autoplay bonus',
	'AUTO BONUS CONTINUE': 'Continue through earned bonuses. No feature purchases.',
	'AUTO BONUS STOP': 'Stop autoplay when a bonus is awarded.',
	'STOP LIMITS': 'Stop limits',
	'START AUTOPLAY': 'Start autoplay',

	BALANCE: 'Balance',
	BET: 'Base bet',
	WIN: 'Win',
	'SWEET WIN': 'Sweet Win',
	'WILD WIN': 'Wild Win',
	'EPIC WIN': 'Epic Win',
	'MYTHIC WIN': 'Mythic Win',
	'LEGENDARY WIN': 'Legendary Win',
	'TOTAL WIN': 'Total win',
	'SPIN WIN': 'Spin win',
	'RAW WIN': 'Tumble win',
	MULTIPLIER: 'Multiplier',
	GATE: 'The gate',
	GATES: 'Gates',
	CASCADE: 'Winning tumbles',
	'FREE SPINS': 'Free spins',
	REMAINING: 'Remaining',
	FEATURES: 'Enter the gates',
	PAYTABLE: 'Paytable & rules',
	SETTINGS: 'Settings',
	AUTO: 'Autoplay',
	SPEED: 'Speed',
	'SPEED NORMAL': 'Normal',
	'SPEED FAST': 'Fast',
	'SPEED TURBO': 'Turbo',
	SOUND: 'Sound',
	FULLSCREEN: 'Fullscreen',
	NORMAL: 'Normal bonus',
	SUPER: 'Super bonus',
	HIDDEN: 'Hidden bonus',
	MYSTERY: 'Mystery bonus',
	CHANCE: 'Extra chance',
	FEATURE: 'Feature spin',
	BASE: 'Base game',
	'INTRO FEATURES': 'Game features',
	CAROUSEL: 'Carousel',
	'FEATURE CARD': 'Feature card',
	'PLAY CARDS': 'Resume card rotation',
	'PAUSE CARDS': 'Pause card rotation',
	HINT: 'Match 8+ symbols anywhere to win',
	'GATE HINT': '3 winning tumbles open a gate',
	'MAX WIN': 'Maximum win',
	'BONUS COMPLETE': 'Bonus complete',
	'TOTAL COST': 'Total cost',
	COST: 'Cost',
	'BUY NOTE': 'One purchase. Full entry spin, then 15 free spins.',
	'CHANCE DESC': 'Triple the natural bonus chance. Applies to every paid spin until disabled.',
	'FEATURE DESC': 'At least one gate on the entry spin. Applies to every paid spin until disabled.',
	'BONUS DESC': '15 free spins. Additive multipliers persist. Normal tier only.',
	'SUPER DESC':
		'15 free spins. Multipliers, sticky Wilds and gate-awarded extra spins. Super tier only.',
	'MYSTERY DESC':
		'15 free spins. 65% Normal · 30% Super · 5% Hidden. Hidden opens two rewards per gate.',
	ACTIVATE: 'Activate',
	DEACTIVATE: 'Disable',
	REPLAY: 'Replay',
	MODE: 'Mode',
	EVENT: 'Event',
	GAME: 'Game',
	VERSION: 'Version',
	'BASE BET': 'Base bet',
	'COST MULTIPLIER': 'Cost multiplier',
	'PAYOUT MULTIPLIER': 'Payout multiplier',
	'START REPLAY': 'Play replay',
	'PLAY AGAIN': 'Play again',
	'REPLAY BASE UNIT': 'Based on base bet',
	'REPLAY RESULT': 'Recorded result',
	'REPLAY DISCLAIMER': 'Recorded round only. No new wager or balance change.',
	'REPLAY EVENT': 'Play replay',
	RESUME: 'Resume unfinished round',
	RETRY: 'Reload & reconnect',
	ERROR: 'Connection / playback error',
	'GRAPHICS ERROR': 'Graphics unavailable. Reload to reconnect and finish any active round.',
	DEMO: 'UI preview · scripted outcomes · no money',
	READY: 'The temple awaits',
	OPENING: 'Opening the gate',
	'STICKY WILD': 'Sticky Wild',
	'EXTRA SPINS': 'Extra spins',
	RETRIGGER: 'Retrigger',
	REWARD: 'Reward',
	'ROUND COUNT': 'Number of spins',
	'LOSS LIMIT': 'Loss limit',
	'SINGLE WIN LIMIT': 'Single-win stop',
	'AUTO NOTE':
		'Stops on bonus entry, insufficient funds or your limits. Stop never cancels the current round.',
	'TARGET RTP': 'Target RTP',
	SESSION: 'Session',
	NET: 'Net position',
	RULES:
		'6 × 5 grid. Symbols pay anywhere at 8–9, 10–11 or 12+ matches. Winning symbols tumble; every third winning grid opens a gate. The final spin multiplier applies to the entire tumble win. Base multipliers reset each spin; bonus multipliers persist.',
	'KEY RULE':
		'3 / 4 / 5+ Keys pay 2× / 10× / 50× base bet and award Normal / Super / Hidden with 15 free spins. Key awards pay once on the entry spin, outside Gate multiplication and inside the round cap. No Keys appear during bonuses. Retriggers and extra spins come only from gates. Sticky Wilds substitute for paying symbols and stay anchored.',
	'CAP RULE':
		'Maximum round payout is 25,000× base bet, including the entry spin. Remaining spins end at the cap. Malfunctions void affected plays and pays.',
	'PAYS NOTE':
		'Payouts are multiples of the base bet, not the purchase cost. Only the highest matching tier per symbol pays.',
	UNVALIDATED: '96.1% target; generated math and live RGS acceptance pending.',
	BONUS: 'Normal bonus',
	'BET MODE BASE TITLE': 'Base game',
	'MODE CHANCE TITLE': 'Extra chance',
	'MODE FEATURE TITLE': 'Feature spin',
	'MODE BONUS TITLE': 'Normal bonus',
	'MODE SUPER TITLE': 'Super bonus',
	'MODE MYSTERY TITLE': 'Mystery bonus',
	'REPLAY ERROR GENERIC': 'Unable to load this replay. Please reconnect.',
};
const bg: Record<string, string> = {
	TUMBLES: 'Каскади',
	MENU: 'Меню',
	'BONUS BUTTON': 'Бонус',
	'BET LABEL': 'Залог',
	BUY: 'Купи',
	'BONUS MODES': 'Бонус режими и функции',
	'BONUS SHARED RULES':
		'Всеки бонус започва с 15 безплатни врътки и нов множител 1×. Множителят от входната врътка не се пренася. Увеличенията на множителя се запазват между бонус врътките. Всяка трета печеливша каскада в една врътка отваря портал; броячът на каскадите се нулира при следващата врътка. В бонусите няма ключове — допълнителни врътки и ретригъри се получават само от порталите.',
	'NORMAL RULES':
		'Активира се с 3 ключа, чрез Мистери или с директна покупка. Всеки портал дава една награда за добавяне към множителя. Първата награда задава множителя, а следващите го увеличават. Няма залепващи Wild символи или награди с допълнителни врътки. Директната покупка винаги дава Нормален бонус, без шанс за Супер или Скрит.',
	'SUPER RULES':
		'Активира се с 4 ключа, чрез Мистери или с директна покупка. Всеки портал дава една награда: добавяне към множителя, умножаване на текущия множител по 2, 3 или 5, залепващ Wild, 1–2 допълнителни врътки или ретригър с 3 или 5 врътки. Wild символите заместват плащащите символи и остават на място при каскадите и следващите бонус врътки — до 3 едновременно. Директната покупка винаги дава Супер бонус, без шанс за Скрит.',
	'HIDDEN RULES':
		'Активира се с 5 или повече ключа или чрез Мистери; няма директна покупка. Наградите са като в Супер, но всеки портал дава две награди, прилагани последователно. Множителят и залепващите Wild символи се запазват през бонуса. И двете награди се прилагат преди изчисляване на печалбата от текущата врътка.',
	'MYSTERY RULES':
		'Избира един бонус: 65% Нормален, 30% Супер или 5% Скрит. Избраният бонус започва с 15 безплатни врътки и запазва правилата си до края — няма последващо надграждане. Мистери не гарантира Скрит бонус.',
	'CHANCE RULES':
		'Режим за платени врътки с троен естествен шанс за бонус спрямо основната игра. Не гарантира бонус. Остава активен за всяка платена врътка до изключването му.',
	'FEATURE RULES':
		'Режим за платени врътки, гарантиращ поне един портал по време на пълната входна врътка. Наградите от порталите в нея добавят към множителя. Ключовете могат да активират бонус, но той не е гарантиран. Режимът остава активен до изключването му.',
	'BONUS PURCHASE RULES':
		'Всички цени са кратни на основния залог. При покупка се изиграва цялата входна врътка преди безплатните врътки. Нормален и Супер дават само съответния бонус; само Мистери избира случаен вид. Печалбите се изчисляват спрямо основния залог, не цената на покупката. Лимитът от 25 000× включва входната врътка и целия бонус.',

	SPIN: 'Завърти',
	STOP: 'Стоп',
	PLAY: 'Играй',
	CONTINUE: 'Продължи',
	'PLAY ROUND': 'Изиграй рунда',
	'SKIP ROUND': 'Пропусни рунда',
	'UNFINISHED ROUND CHOICE':
		'Изиграйте незавършения рунд или пропуснете анимациите и го приключете.',
	'PRESS TO CONTINUE': 'Натиснете, за да продължите',
	'UNFINISHED ROUND NOTE': 'Имате незавършен рунд. Продължете, за да го завършите.',
	CLOSE: 'Затвори',
	CANCEL: 'Отказ',
	CONFIRM: 'Потвърди',
	BALANCE: 'Баланс',
	BET: 'Основен залог',
	WIN: 'Печалба',
	'TOTAL WIN': 'Обща печалба',
	'FREE SPINS': 'Безплатни врътки',
	MULTIPLIER: 'Множител',
	FEATURES: 'Влез през портите',
	PAYTABLE: 'Плащания и правила',
	SETTINGS: 'Настройки',
	NORMAL: 'Нормален бонус',
	BONUS: 'Нормален бонус',
	SUPER: 'Супер бонус',
	HIDDEN: 'Скрит бонус',
	MYSTERY: 'Мистери бонус',
	CHANCE: 'Допълнителен шанс',
	FEATURE: 'Специална врътка',
	BASE: 'Основна игра',
	'GATE HINT': '3 печеливши каскади отварят портал',
	'TOTAL COST': 'Обща цена',
	'REPLAY EVENT': 'Пусни повторението',
	RESUME: 'Продължи незавършения рунд',
};
const maps = Object.fromEntries(
	[...locales, 'bg'].map((lang) => [
		lang,
		{
			...sharedMessages.en,
			...sharedMessages[lang as keyof typeof sharedMessages],
			...en,
			...draftCatalogs[lang],
			...(lang === 'bg' ? bg : {}),
		},
	]),
);
export default new Proxy(maps, {
	get: (target, key) => target[String(key)] ?? target.en,
}) as unknown as MessagesMap;
const socialText: Record<string, string> = {
	'BOARD DESCRIPTION': '6 columns, 5 rows. Win anywhere.',
	'PAYOUT MULTIPLIER': 'Win multiplier',
	'BASE BET': 'Base play',
	'REPLAY DISCLAIMER': 'Recorded round only. No new play or balance change.',
	'REPLAY BASE UNIT': 'Based on base play',
	BET: 'Base play',
	'BET LABEL': 'Play',
	BUY: 'Play',
	'FEATURE BUY': 'Features',
	'PAYOUT TABLE': 'Win table',
	'PAY ANYWHERE': 'Win anywhere',
	PAYTABLE: 'Win table & rules',
	'TOTAL COST': 'Total play',
	COST: 'Play',
	'BUY NOTE': 'Full entry play, then 15 free spins.',
	RULES: en.RULES,
	'KEY RULE': en['KEY RULE'],
	'CAP RULE':
		'Maximum round win is 25,000× base play amount, including the entry play. Remaining spins end at the cap. Malfunctions void affected plays and wins.',
	'PAYS NOTE':
		'Wins are multiples of the base play amount, not the feature play amount. Only the highest matching tier per symbol wins.',
};
const bgSocial: Record<string, string> = {
	BET: 'Основна игра',
	'BET LABEL': 'Игра',
	BUY: 'Играй',
	PAYTABLE: 'Печалби и правила',
	'TOTAL COST': 'Общо за игра',
	COST: 'Игра',
};
export function t(key: string) {
	const social = stateConfig.jurisdiction?.socialCasino || stateUrlDerived.social();
	const localized = stateI18nDerived.translate(key);
	if (!social) return localized;
	const lang = String(stateUrlDerived.lang());
	const native = nativeSocialLabel(key, draftCatalogs[lang], lang);
	if (native) return native;
	const bgCopy = lang === 'bg' ? bgSocial[key] : undefined;
	// Never leave wagering terminology inside partially translated social rules.
	// Neutral native copy stays native; unreviewed long copy uses English social wording.
	return socialEnglish(
		bgCopy ??
			(needsSocialFallback(en[key] ?? '') || localized === en[key] || lang === 'en'
				? (socialText[key] ?? en[key] ?? localized)
				: localized),
	);
}
