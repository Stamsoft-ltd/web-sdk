/** Page order from the supplied Gates design. Copy stays tied to the game contract. */
export const RULES_PAGES = [
	'OVERVIEW',
	'PAYOUT TABLE',
	'FEATURES PAGE',
	'WAYS TO WIN',
	'FEATURE BUY',
	'GENERAL INFO',
	'UI GUIDE',
] as const;
export const rulesPageIndex = (current: number, direction: number) =>
	Math.max(0, Math.min(RULES_PAGES.length - 1, current + direction));
const info = (name: string) => ({ title: `INFO ${name}`, copy: `INFO ${name} COPY` });
export const RULE_OVERVIEW = ['HOW TO PLAY', 'THE GATES', 'BONUS FEATURES', 'FEATURE OPTIONS'].map(
	info,
);
export const RULE_FEATURES = [
	'ANYWHERE WINS',
	'CASCADE FEATURE',
	'GATE FEATURE',
	'NORMAL BONUS',
	'SUPER BONUS',
	'HIDDEN BONUS',
].map(info);
export const RULE_WIN_METHODS = [
	'ANYWHERE PAYOUTS',
	'CASCADES',
	'BONUS TRIGGERS',
	'GATE MULTIPLIERS',
	'MAX WIN',
].map((name) => ({
	...info(name),
	title: `INFO ${name === 'ANYWHERE PAYOUTS' ? 'ANYWHERE WINS' : name}`,
}));
export const RULE_BUYS = ['CHANCE', 'FEATURE', 'BONUS', 'SUPER', 'MYSTERY'] as const;
export const RULE_BUY_INFO = Object.fromEntries(
	RULE_BUYS.map((mode, i) => [
		mode,
		info(
			[
				'EXTRA BONUS CHANCE',
				'FEATURE SPIN',
				'NORMAL BONUS BUY',
				'SUPER BONUS BUY',
				'MYSTERY BONUS BUY',
			][i],
		),
	]),
);
export const RULE_CONTROLS = [
	{ title: 'SPIN', copy: 'SPIN CONTROL', art: 'spin' },
	{ title: 'AUTO', copy: 'AUTO CONTROL', art: 'auto' },
	{ title: 'SPEED', copy: 'SPEED CONTROL', art: 'speed' },
	{ title: 'BET PLUS', copy: 'BET PLUS CONTROL', art: 'bet-plus' },
	{ title: 'BET MINUS', copy: 'BET MINUS CONTROL', art: 'bet-minus' },
	{ title: 'PAYTABLE', copy: 'RULES CONTROL', art: 'info' },
	{ title: 'PREVIOUS PAGE', copy: 'PREVIOUS CONTROL', art: 'previous' },
	{ title: 'NEXT PAGE', copy: 'NEXT CONTROL', art: 'next' },
	{ title: 'CLOSE', copy: 'CLOSE CONTROL', art: 'close' },
	{ title: 'MENU', copy: 'MENU CONTROL', art: 'menu' },
	{ title: 'BONUS BUTTON', copy: 'BONUS CONTROL', art: 'bonus' },
	{ title: 'SETTINGS', copy: 'SETTINGS CONTROL', art: 'settings' },
	{ title: 'SOUND', copy: 'SOUND CONTROL', art: 'sound' },
	{ title: 'MUSIC', copy: 'MUSIC CONTROL', art: 'music' },
	{ title: 'STOP', copy: 'STOP CONTROL', art: 'stop' },
	{ title: 'REDUCED MOTION', copy: 'REDUCED CONTROL', art: 'settings' },
	{ title: 'FULLSCREEN', copy: 'FULLSCREEN CONTROL', art: 'fullscreen' },
	{ title: 'SPIN', copy: 'SPACE CONTROL', art: 'space' },
	{ title: 'REPLAY', copy: 'REPLAY CONTROL', art: 'replay' },
] as const;
