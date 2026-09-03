import en from './en';

export type LocaleTerms = {
	bonus: string;
	bonuses: string;
	earned: string;
	garden: string;
	welcome: string;
	gameBoard: string;
	clusterPayouts: string;
	vegetables: [string, string, string, string, string, string, string];
	normalBonus: string;
	superBonus: string;
	hiddenBonus: string;
	mysteryBonus: string;
	featureSpin: string;
	guaranteedCluster: string;
	bonusChance: string;
	active: string;
	harvest: string;
	skip: string;
	toggle: string;
	tumbleTitle: string;
	tumbleText: string;
	multiplierTitle: string;
	multiplierText: string;
	bonusRule: string;
	controls: string;
	splashGarden: string;
};

// Magnetic's approved catalogs provide all shared Stake/RGS language. This adapter deliberately
// maps only semantically identical strings; Veggie-specific names/rules come from LocaleTerms.
export const createLocale = (source: Record<string, string>, terms: LocaleTerms) => {
	const s = (key: string, fallback: string) => source[key] || fallback;
	const freeSpins = s('FREE SPINS', en['FREE SPINS']);
	const win = s('WIN', en.WIN);
	const maxWin = s('INFO STAT MAXWIN', en['MAX WIN']);
	const feature = s('INFO FEATURES', en.FEATURES);
	const scatter = s('RULE SCATTER TITLE', en.SCATTER);
	const play = s('BET MODE BASE BUTTON', en.PLAY);
	const goodLuck = s('BET MODE BASE TICKER SPIN', en['GOOD LUCK']);
	const clusterRule = [s('INFO CW 2', en['RULE CLUSTER TEXT']), source['INFO CW 3']]
		.filter(Boolean)
		.join(' ');
	const spinBetText = [source['HOWTO SPIN TEXT'], source['HOWTO BET TEXT']]
		.filter(Boolean)
		.join(' ');
	const legal = [source['INFO GI LEGAL 1'], source['INFO GI LEGAL 2'], source['INFO GI LEGAL 3']]
		.filter(Boolean)
		.join(' ');
	const exactKeys = [
		'HOME',
		'BALANCE',
		'BET',
		'WIN',
		'SOUND',
		'MUSIC',
		'INFO',
		'TOTAL WIN',
		'PAYTABLE',
		'GAME RULES',
		'AUTOPLAY',
		'TURBO',
		'REPLAY',
		'BET REPLAY',
		'START REPLAY',
		'REPLAY EVENT',
		'BASE BET',
		'COST MULTIPLIER',
		'TOTAL BET COST',
		'PAYOUT MULTIPLIER',
		'REPLAY DISCLAIMER',
		'REPLAY ERROR GENERIC',
		'EVENT',
		'MODE',
		'BUY',
		'CONFIRM',
		'CANCEL',
		'ACTIVATE',
		'YOU WON',
		'FREE SPINS',
		'UNFINISHED ROUND',
		'PLAY ROUND',
		'END ROUND',
		'RETRY RESUME',
		'RECOVERY TITLE',
		'RECOVERY BODY',
	] as const;
	const exact = Object.fromEntries(exactKeys.map((key) => [key, s(key, en[key])])) as Partial<
		typeof en
	>;

	return {
		...en,
		...exact,
		'BONUS TOTAL': `${terms.bonus} · ${s('TOTAL WIN', en['TOTAL WIN'])}`,
		EARNED: terms.earned,
		'CONGRATULATIONS!': s('CONGRATULATIONS', en['CONGRATULATIONS!']),
		'CLICK ANYWHERE TO CONTINUE': s('PRESS ANYWHERE', en['CLICK ANYWHERE TO CONTINUE']),
		BONUS: terms.bonus,
		BONUSES: terms.bonuses,
		'VEGGIE SALAD GAME BOARD': terms.gameBoard,
		'CLUSTER PAYOUTS': terms.clusterPayouts,
		BROCCOLI: terms.vegetables[0],
		CORN: terms.vegetables[1],
		TOMATO: terms.vegetables[2],
		EGGPLANT: terms.vegetables[3],
		CARROT: terms.vegetables[4],
		CAULIFLOWER: terms.vegetables[5],
		RADISH: terms.vegetables[6],
		'BONUS TIER NORMAL': terms.normalBonus,
		'BONUS TIER SUPER': terms.superBonus,
		'BONUS TIER HIDDEN': terms.hiddenBonus,
		'BONUS INTRO NORMAL TEXT': `10 ${freeSpins} · 8×8`,
		'BONUS INTRO SUPER TEXT': `10 ${freeSpins} · 9×9`,
		'BONUS INTRO HIDDEN TEXT': `10 ${freeSpins} · 10×10`,
		'GUARANTEED CLUSTER': terms.guaranteedCluster,
		FEATURES: feature,
		SPIN: s('INFO CTRL SPIN', en.SPIN),
		SKIP: terms.skip,
		'SKIP ANIMATION': `${terms.skip} · ${s('INFO FEATURES', en.FEATURES)}`,
		MENU: s('INFO CTRL MENU', en.MENU),
		EXTRA: s('INFO FB EXTRA TITLE', en.EXTRA),
		CHANCE: s('BET MODE CHANCE TITLE', en.CHANCE),
		AUTO: s('INFO CTRL AUTO', en.AUTO),
		'AUTO SPIN': s('INFO CTRL AUTO', en['AUTO SPIN']),
		'NUMBER OF SPINS': s('AUTO NUM SPINS', en['NUMBER OF SPINS']),
		'START AUTOPLAY': s('AUTO START', en['START AUTOPLAY']),
		'AUTOPLAY STOP NOTE': s('HOWTO AUTOPLAY TEXT', en['AUTOPLAY STOP NOTE']),
		'DECREASE BET': s('INFO CTRL MINUS', en['DECREASE BET']),
		'INCREASE BET': s('INFO CTRL PLUS', en['INCREASE BET']),
		CLOSE: s('INFO CTRL CLOSE', en.CLOSE),
		SCATTER: scatter,
		SCATTERS: scatter,
		'VEGGIE SALAD REPLAY': `VEGGIE SALAD · ${s('REPLAY', en.REPLAY)}`,
		'CHOOSE YOUR HARVEST': terms.harvest,
		'BONUS FEATURES': `${terms.bonus} · ${feature}`,
		'ARMED TAP TO STOP': `${terms.active} · ${terms.skip}`,
		TOGGLE: terms.toggle,
		'CONFIRM ACTIVATION': s('CONFIRM TITLE', en['CONFIRM ACTIVATION']),
		'CONFIRM PURCHASE': s('BUY CONFIRM', en['CONFIRM PURCHASE']),
		'TOGGLE COST NOTE': `${s('PER SPIN', en['TOGGLE COST NOTE'])} · 2×`,
		'MODE CHANCE TITLE': s('BET MODE CHANCE TITLE', en['MODE CHANCE TITLE']),
		'MODE CHANCE TAG': `3× ${terms.bonusChance}`,
		'MODE FEATURE TITLE': terms.featureSpin,
		'MODE FEATURE TAG': terms.guaranteedCluster,
		'MODE BONUS TITLE': terms.normalBonus,
		'MODE BONUS TAG': `8×8 · 10 ${freeSpins}`,
		'MODE MYSTERY TITLE': terms.mysteryBonus,
		'MODE MYSTERY TAG': `${terms.normalBonus} · ${terms.superBonus} · ${terms.hiddenBonus}`,
		'MODE SUPER TITLE': terms.superBonus,
		'MODE SUPER TAG': `9×9 · 10 ${freeSpins}`,
		'BET MODE BASE TITLE': 'VEGGIE SALAD',
		'BET MODE BASE DIALOG': clusterRule,
		PLAY: play,
		'PLACE YOUR BET': s('HOWTO BET TITLE', en['PLACE YOUR BET']),
		'GOOD LUCK': goodLuck,
		'BET MODE CHANCE DIALOG': `2× · 3× ${terms.bonusChance}`,
		'EXTRA CHANCE ACTIVE': `${s('BET MODE CHANCE TITLE', en.CHANCE)} · ${terms.active}`,
		'BET MODE FEATURE DIALOG': `20× · ${terms.guaranteedCluster}`,
		'FEATURE SPIN': terms.featureSpin,
		'FEATURE ACTIVE': `${terms.featureSpin} · ${terms.active}`,
		'BET MODE BONUS DIALOG': `100× · 10 ${freeSpins} · 8×8`,
		'BONUS ACTIVE': `${terms.normalBonus} · ${terms.active}`,
		'BET MODE MYSTERY DIALOG': `300× · ${terms.normalBonus} / ${terms.superBonus} / ${terms.hiddenBonus}`,
		'MYSTERY ACTIVE': `${terms.mysteryBonus} · ${terms.active}`,
		'BET MODE SUPER DIALOG': `400× · 10 ${freeSpins} · 9×9`,
		'SUPER ACTIVE': `${terms.superBonus} · ${terms.active}`,
		'RULE CLUSTER TITLE': terms.clusterPayouts,
		'RULE CLUSTER TEXT': clusterRule,
		'RULE TUMBLE TITLE': terms.tumbleTitle,
		'RULE TUMBLE TEXT': terms.tumbleText,
		'RULE MULTIPLIER TITLE': terms.multiplierTitle,
		'RULE MULTIPLIER TEXT': terms.multiplierText,
		'RULE BONUS TEXT': terms.bonusRule,
		'RTP AND MAX WIN': `RTP · ${maxWin}`,
		'RTP AND MAX WIN TEXT': `RTP 96.10% · ${maxWin} 25,000×`,
		CONTROLS: terms.controls,
		'SPIN AND BET': `${s('INFO CTRL SPIN', en.SPIN)} · ${s('BET', en.BET)}`,
		'SPIN AND BET TEXT': spinBetText || en['SPIN AND BET TEXT'],
		'FEATURES AND AUTOPLAY': `${feature} · ${s('AUTOPLAY', en.AUTOPLAY)}`,
		'FEATURES AND AUTOPLAY TEXT': s('HOWTO AUTOPLAY TEXT', en['FEATURES AND AUTOPLAY TEXT']),
		DISCLAIMER: s('RULE SECTION DISCLAIMER', en.DISCLAIMER),
		'DISCLAIMER TEXT': legal || en['DISCLAIMER TEXT'],
		'PAYTABLE CHANCE TEXT': `2× · 3× ${terms.bonusChance}`,
		'PAYTABLE FEATURE TEXT': `20× · ${terms.guaranteedCluster}`,
		'PAYTABLE BONUS TEXT': `100× · 10 ${freeSpins} · 8×8`,
		'PAYTABLE SUPER TEXT': `400× · 10 ${freeSpins} · 9×9`,
		'PAYTABLE MYSTERY TEXT': `300× · 60% ${terms.normalBonus} · 30% ${terms.superBonus} · 10% ${terms.hiddenBonus}`,
		'PAYTABLE MAX TEXT': `${maxWin} 25,000×`,
		'PRESS PLAY': s('SPLASH PRESS', en['PRESS PLAY']),
		'VEGGIE SALAD INTRO': `VEGGIE SALAD · ${s('INFO OVERVIEW', en['VEGGIE SALAD INTRO'])}`,
		'WELCOME TO': terms.welcome,
		'THE GARDEN': terms.garden,
		'SPLASH GARDEN COPY': terms.splashGarden,
		'3 UNIQUE': `3 ${feature}`,
		'SPLASH BONUS COPY': `${terms.normalBonus} · ${terms.superBonus} · ${terms.hiddenBonus}`,
		'MAX WIN': maxWin,
		'SPLASH MAX COPY': `${maxWin} 25,000×`,
		FAST: s('AUTO TURBO', en.FAST),
		MAX: s('AUTO SUPER TURBO', en.MAX),
	};
};
