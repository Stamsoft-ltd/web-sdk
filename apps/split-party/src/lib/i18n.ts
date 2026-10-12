// Locale fallback and social English override pattern from Veggie Salad 3d719a197.
// Only shared UI terms imported; no Veggie rules, prices or RTP copied.
import { setupI18n } from '@lingui/core';
import chrome from './reference/chrome-locales.json';
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
	BUY: 'Buy',
	CONFIRM: 'Confirm',
	CANCEL: 'Cancel',
	'FREE SPINS': 'Free spins',
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
	'REPLAY DISCLAIMER': 'Replay of a previous round. No bets will be placed.',
	READY: 'Ready to split?',
	SPLIT: 'Split party!',
	CONTINUE: 'Continue',
	PREVIEW: 'Visual preview · not live play',
	LIVE: 'Connected to RGS',
	CONNECTING: 'Connecting…',
	NORMAL: 'Normal bonus',
	SUPER: 'Super bonus',
	MYSTERY: 'Mystery bonus',
	FEATURE: 'Feature spin',
	BASE: 'Classic',
	HIDDEN: 'Hidden bonus',
	CHOOSE: 'Pick your party',
	LANGUAGE: 'Language',
	STOP: 'Stop',
	SETTINGS: 'Settings',
	RULE: 'Match adjacent same-color blobs: at least 2 tiles and 5 blob units. Winning positions gain one split level, up to 6 units per tile. Splits stay in place as new blobs tumble in.',
	BONUSRULE:
		'3 / 4 / 5+ baskets award Normal / Super / Hidden: 10 free spins, starting at 1 / 2 / 3 units per tile. Split levels persist through the bonus.',
	FEATURE_RULE:
		'Feature: one spin starting with 2–6 units per tile. Mystery: 65% Normal, 30% Super, 5% Hidden.',
	LEGAL:
		'Malfunction voids all pays and plays. Interrupted rounds must be completed. Displayed wins come from the server. RTP describes a long-run average, not a session guarantee.',
	PREVIEW_NOTE:
		'Recorded math-book fixtures cycle in order. Preview balances are simulated; outcome frequencies do not represent RTP.',
	ERROR: 'Connection interrupted',
	INSUFFICIENT: 'Insufficient balance',
	RELOAD: 'Reconnect',
	AUTO_NOTE: 'Base mode only. Stops on bonus, error, insufficient balance, or Stop.',
	RULES_NOTE: 'V1 uses the DOCX two-tile/five-unit cluster rule. Product sign-off pending.',
	NO_SESSION: 'Launch through RGS, or open visual preview.',
	OPEN_PREVIEW: 'Open visual preview',
};
const game: Record<string, Record<string, string>> = {
	es: {
		READY: '¿Listo para dividir?',
		BONUS: 'Bono',
		NORMAL: 'Bono normal',
		SUPER: 'Súper bono',
		MYSTERY: 'Bono misterioso',
		FEATURE: 'Giro especial',
		BASE: 'Clásico',
		HIDDEN: 'Bono oculto',
		CHOOSE: 'Elige tu fiesta',
		LANGUAGE: 'Idioma',
		SETTINGS: 'Ajustes',
		CONTINUE: 'Continuar',
		STOP: 'Parar',
	},
	de: {
		READY: 'Bereit zum Teilen?',
		BONUS: 'Bonus',
		NORMAL: 'Normaler Bonus',
		SUPER: 'Superbonus',
		MYSTERY: 'Überraschungsbonus',
		FEATURE: 'Feature-Drehung',
		BASE: 'Klassisch',
		CHOOSE: 'Wähle deine Party',
		LANGUAGE: 'Sprache',
		SETTINGS: 'Einstellungen',
		CONTINUE: 'Weiter',
		STOP: 'Stopp',
	},
	fr: {
		READY: 'Prêt à se diviser ?',
		BONUS: 'Bonus',
		NORMAL: 'Bonus normal',
		SUPER: 'Super bonus',
		MYSTERY: 'Bonus mystère',
		FEATURE: 'Tour spécial',
		BASE: 'Classique',
		CHOOSE: 'Choisissez votre fête',
		LANGUAGE: 'Langue',
		SETTINGS: 'Réglages',
		CONTINUE: 'Continuer',
		STOP: 'Arrêter',
	},
};
const social: Record<string, string> = {
	LEGAL:
		'Malfunction voids all wins and plays. Interrupted rounds must be completed. Displayed wins come from the server. RTP describes a long-run average, not a session guarantee.',
	BET: 'Play',
	BUY: 'Play',
	'BASE BET': 'Base play',
	'TOTAL BET COST': 'Total play',
	'INFO CTRL PLUS': 'Increase play amount',
	'INFO CTRL MINUS': 'Decrease play amount',
	PAYTABLE: 'Win table',
	'REPLAY DISCLAIMER': 'Replay of a previous play. No new plays will be placed.',
	'RECOVERY BODY': 'Reconnect to restore your round. No new play will be placed.',
};
export const languages = ['en', ...Object.keys(chrome).sort()];
export const i18n = setupI18n();
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
