import type { RawSymbol, SymbolName, GameType, BetMode } from './types';

const makeReel = (names: SymbolName[]): RawSymbol[] => names.map((name) => ({ name }));

// Cosmetic strips shown while the reels are idle-spinning (not the math strips).
const basePaddingReels: RawSymbol[][] = [
	makeReel([
		'L5',
		'L4',
		'L3',
		'L2',
		'L1',
		'H5',
		'L4',
		'H4',
		'L3',
		'H3',
		'DC',
		'H2',
		'W',
		'H1',
		'S_DUCK',
	]),
	makeReel([
		'L4',
		'L3',
		'L2',
		'L1',
		'H5',
		'L5',
		'H4',
		'L2',
		'H3',
		'L1',
		'H2',
		'W',
		'H1',
		'S_ROLLER',
		'L5',
	]),
	makeReel([
		'L3',
		'L2',
		'L1',
		'H5',
		'L5',
		'H4',
		'L4',
		'H3',
		'L2',
		'H2',
		'DC',
		'W',
		'H1',
		'S_COASTER',
		'L4',
	]),
	makeReel([
		'L2',
		'L1',
		'H5',
		'L5',
		'H4',
		'L4',
		'H3',
		'L3',
		'H2',
		'L1',
		'W',
		'H1',
		'S_DUCK',
		'L5',
		'L3',
	]),
	makeReel([
		'L1',
		'H5',
		'L5',
		'H4',
		'L4',
		'H3',
		'L3',
		'H2',
		'L2',
		'DC',
		'W',
		'H1',
		'S_ROLLER',
		'L4',
		'L2',
	]),
];

const freegamePaddingReels: RawSymbol[][] = [
	makeReel([
		'L5',
		'L4',
		'L3',
		'L2',
		'L1',
		'H5',
		'H4',
		'H3',
		'H2',
		'H1',
		'W',
		'L5',
		'H5',
		'L4',
		'H4',
	]),
	makeReel([
		'L4',
		'L3',
		'L2',
		'L1',
		'H5',
		'H4',
		'H3',
		'H2',
		'H1',
		'W',
		'L5',
		'H5',
		'L4',
		'H4',
		'L3',
	]),
	makeReel([
		'L3',
		'L2',
		'L1',
		'H5',
		'H4',
		'H3',
		'H2',
		'H1',
		'W',
		'L5',
		'H5',
		'L4',
		'H4',
		'L3',
		'H3',
	]),
	makeReel([
		'L2',
		'L1',
		'H5',
		'H4',
		'H3',
		'H2',
		'H1',
		'W',
		'L5',
		'H5',
		'L4',
		'H4',
		'L3',
		'H3',
		'L2',
	]),
	makeReel([
		'L1',
		'H5',
		'H4',
		'H3',
		'H2',
		'H1',
		'W',
		'L5',
		'H5',
		'L4',
		'H4',
		'L3',
		'H3',
		'L2',
		'H2',
	]),
];

export type BetModeConfig = {
	cost: number;
	feature: boolean;
	buyBonus: boolean;
	rtp: number;
	max_win: number;
};

export type SymbolConfig = {
	// per-line bet multipliers, template/math format: [{'5':x},{'4':x},{'3':x}]
	paytable?: [{ '5': number }, { '4': number }, { '3': number }];
	special_properties?: string[];
};

const config: {
	providerName: string;
	gameName: string;
	gameID: string;
	rtp: number;
	numReels: number;
	numRows: number[];
	wincap: number;
	totalFreeSpins: number;
	minScattersForBonus: number;
	betModes: Record<BetMode, BetModeConfig>;
	paylines: Record<string, number[]>;
	symbols: Record<SymbolName, SymbolConfig>;
	paddingReels: Record<GameType, RawSymbol[][]>;
} = {
	providerName: 'sample_provider',
	gameName: 'Theme Park',
	gameID: '0_0_theme_park',
	rtp: 0.961,
	numReels: 5,
	numRows: [5, 5, 5, 5, 5],
	wincap: 25000,
	totalFreeSpins: 10,
	minScattersForBonus: 3,
	// 7 bet modes — costs per theme_park_event_contract.md
	betModes: {
		BASE: { cost: 1.0, feature: true, buyBonus: false, rtp: 0.961, max_win: 25000 },
		ANTE: { cost: 3.0, feature: true, buyBonus: false, rtp: 0.961, max_win: 25000 },
		FSPIN1: { cost: 20.0, feature: true, buyBonus: false, rtp: 0.961, max_win: 25000 },
		FSPIN2: { cost: 60.0, feature: true, buyBonus: false, rtp: 0.961, max_win: 25000 },
		DUCK: { cost: 100.0, feature: false, buyBonus: true, rtp: 0.961, max_win: 25000 },
		ROLLER: { cost: 200.0, feature: false, buyBonus: true, rtp: 0.961, max_win: 25000 },
		COASTER: { cost: 500.0, feature: false, buyBonus: true, rtp: 0.961, max_win: 25000 },
	},
	// 15 fixed paylines — row index per reel, visible coords (contract order, key = 1-based line id)
	paylines: {
		'1': [0, 0, 0, 0, 0],
		'2': [1, 1, 1, 1, 1],
		'3': [2, 2, 2, 2, 2],
		'4': [3, 3, 3, 3, 3],
		'5': [4, 4, 4, 4, 4],
		'6': [0, 1, 2, 3, 4],
		'7': [4, 3, 2, 1, 0],
		'8': [0, 1, 0, 1, 0],
		'9': [1, 0, 1, 0, 1],
		'10': [1, 2, 1, 2, 1],
		'11': [2, 1, 2, 1, 2],
		'12': [2, 3, 2, 3, 2],
		'13': [3, 2, 3, 2, 3],
		'14': [3, 4, 3, 4, 3],
		'15': [4, 3, 4, 3, 4],
	},
	// Paytable (x bet, per line) — contract: H1 20/10/2, H2/H3 10/5/1, H4/H5 5/2.5/0.5, L1-L5 1/0.5/0.1
	symbols: {
		H1: { paytable: [{ '5': 20 }, { '4': 10 }, { '3': 2 }] },
		H2: { paytable: [{ '5': 10 }, { '4': 5 }, { '3': 1 }] },
		H3: { paytable: [{ '5': 10 }, { '4': 5 }, { '3': 1 }] },
		H4: { paytable: [{ '5': 5 }, { '4': 2.5 }, { '3': 0.5 }] },
		H5: { paytable: [{ '5': 5 }, { '4': 2.5 }, { '3': 0.5 }] },
		L1: { paytable: [{ '5': 1 }, { '4': 0.5 }, { '3': 0.1 }] },
		L2: { paytable: [{ '5': 1 }, { '4': 0.5 }, { '3': 0.1 }] },
		L3: { paytable: [{ '5': 1 }, { '4': 0.5 }, { '3': 0.1 }] },
		L4: { paytable: [{ '5': 1 }, { '4': 0.5 }, { '3': 0.1 }] },
		L5: { paytable: [{ '5': 1 }, { '4': 0.5 }, { '3': 0.1 }] },
		W: { special_properties: ['wild'] },
		DC: { special_properties: ['duck'] },
		S_DUCK: { special_properties: ['scatter'] },
		S_ROLLER: { special_properties: ['scatter'] },
		S_COASTER: { special_properties: ['scatter'] },
	},
	paddingReels: {
		basegame: basePaddingReels,
		freegame: freegamePaddingReels,
	},
};

export default config;
