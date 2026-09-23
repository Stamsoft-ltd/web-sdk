import { stateI18nDerived, stateConfig, stateUrlDerived } from 'state-shared';
import { messagesMap as sharedMessages } from 'components-ui-html';
import { locales } from 'config-lingui';
import type { MessagesMap } from 'utils-shared/i18n';
const en: Record<string, string> = {
	'BONUS MODES': 'Bonus modes & features',
	'BONUS SHARED RULES':
		'Each bonus starts with 15 free spins and a fresh 1× multiplier. The entry-spin multiplier does not carry over. During the bonus, multiplier upgrades persist between spins. Every third winning tumble within a spin opens another gate; tumble progress resets for the next spin. Keys never appear during free spins, so extra spins and retriggers can only come from gate rewards.',
	'NORMAL RULES':
		'Triggered by 3 Keys, selected by Mystery, or bought directly. Each gate gives one additive multiplier reward. The first reward sets the multiplier; later additive rewards increase it. Normal has no sticky Wilds or extra-spin rewards. A direct Normal purchase always awards Normal, with no chance of upgrading to Super or Hidden.',
	'SUPER RULES':
		'Triggered by 4 Keys, selected by Mystery, or bought directly. Each gate gives one reward: an additive multiplier, multiplication of the current multiplier by 2, 3 or 5, a sticky Wild, 1–2 extra spins, or a 3- or 5-spin retrigger. Sticky Wilds substitute for paying symbols and remain in place through tumbles and subsequent free spins, with up to 3 at once. A direct Super purchase always awards Super, with no chance of upgrading to Hidden.',
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
	CLOSE: 'Close',
	CANCEL: 'Cancel',
	CONFIRM: 'Confirm',
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
	INTRO: 'Beyond every gate, a greater power.',
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
	DEACTIVATE: 'Return to base',
	REPLAY: 'Replay',
	'REPLAY EVENT': 'Play replay',
	RESUME: 'Resume unfinished round',
	RETRY: 'Reload & reconnect',
	ERROR: 'Connection / playback error',
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
		'Keys do not pay. 3 / 4 / 5+ Keys award Normal / Super / Hidden with 15 free spins. No Keys appear during bonuses. Retriggers and extra spins come only from gates. Sticky Wilds substitute for paying symbols and stay anchored.',
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
			...(lang === 'bg' ? bg : {}),
		},
	]),
);
export default new Proxy(maps, {
	get: (target, key) => target[String(key)] ?? target.en,
}) as unknown as MessagesMap;
const socialText: Record<string, string> = {
	BET: 'Base play',
	PAYTABLE: 'Win table & rules',
	'TOTAL COST': 'Total play',
	COST: 'Play amount',
	'BUY NOTE': 'Full entry play, then 15 free spins.',
	RULES: en.RULES,
	'KEY RULE': en['KEY RULE'],
	'CAP RULE':
		'Maximum round win is 25,000× base play amount, including the entry play. Remaining spins end at the cap. Malfunctions void affected plays and wins.',
	'PAYS NOTE':
		'Wins are multiples of the base play amount, not the feature play amount. Only the highest matching tier per symbol wins.',
};
export function t(key: string) {
	const social = stateConfig.jurisdiction?.socialCasino || stateUrlDerived.social();
	if (social)
		return (socialText[key] ?? en[key] ?? key)
			.replace(/\bpaid spin(s?)\b/gi, 'play$1')
			.replace(/\bpay(s?)\b/gi, 'win$1')
			.replace(/\bbet(s?)\b/gi, 'play amount$1');
	return stateI18nDerived.translate(key);
}
