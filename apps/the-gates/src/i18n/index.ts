import { stateI18nDerived, stateConfig, stateUrlDerived } from 'state-shared';
import { messagesMap as sharedMessages } from 'components-ui-html';
import { locales } from 'config-lingui';
import type { MessagesMap } from 'utils-shared/i18n';
const en: Record<string, string> = {
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
