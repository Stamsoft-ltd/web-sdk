const makeTierPaytable = (bands: Array<[number, number, number]>) => {
	const out: Record<string, number> = {};
	for (const [from, to, value] of bands) {
		for (let count = from; count <= to; count += 1) out[String(count)] = value;
	}
	return out;
};

export default {
	providerName: 'sample_provider',
	gameName: 'magnetic',
	gameID: '0_0_magnetic',
	rtp: 0.961,
	numReels: 7,
	numRows: [7, 7, 7, 7, 7, 7, 7],
	betModes: {
		BASE: { cost: 1.0, feature: true, buyBonus: false, rtp: 0.961, max_win: 20000 },
		CHANCE: { cost: 2.0, feature: true, buyBonus: false, rtp: 0.961, max_win: 20000 },
		FEATURE: { cost: 50.0, feature: true, buyBonus: false, rtp: 0.961, max_win: 20000 },
		BONUS: { cost: 100.0, feature: false, buyBonus: true, rtp: 0.961, max_win: 20000 },
		SUPER: { cost: 500.0, feature: false, buyBonus: true, rtp: 0.961, max_win: 20000 },
	},
	symbols: {
		H1: { paytable: makeTierPaytable([[5, 5, 0.5], [6, 6, 1], [7, 7, 2], [8, 8, 4], [9, 9, 8], [10, 11, 15], [12, 14, 30], [15, 19, 75], [20, 24, 200], [25, 29, 500], [30, 32, 1000], [33, 49, 2000]]) },
		H2: { paytable: makeTierPaytable([[5, 5, 0.4], [6, 6, 0.8], [7, 7, 1.5], [8, 8, 3], [9, 9, 6], [10, 11, 12], [12, 14, 25], [15, 19, 60], [20, 24, 150], [25, 29, 350], [30, 32, 750], [33, 49, 1500]]) },
		H3: { paytable: makeTierPaytable([[5, 5, 0.3], [6, 6, 0.6], [7, 7, 1.2], [8, 8, 2.5], [9, 9, 5], [10, 11, 10], [12, 14, 20], [15, 19, 45], [20, 24, 120], [25, 29, 275], [30, 32, 600], [33, 49, 1200]]) },
		H4: { paytable: makeTierPaytable([[5, 5, 0.2], [6, 6, 0.5], [7, 7, 1], [8, 8, 2], [9, 9, 4], [10, 11, 8], [12, 14, 15], [15, 19, 35], [20, 24, 90], [25, 29, 200], [30, 32, 450], [33, 49, 900]]) },
		L1: { paytable: makeTierPaytable([[5, 5, 0.15], [6, 6, 0.3], [7, 7, 0.6], [8, 8, 1.2], [9, 9, 2.5], [10, 11, 5], [12, 14, 10], [15, 19, 25], [20, 24, 60], [25, 29, 125], [30, 32, 250], [33, 49, 500]]) },
		L2: { paytable: makeTierPaytable([[5, 5, 0.12], [6, 6, 0.25], [7, 7, 0.5], [8, 8, 1], [9, 9, 2], [10, 11, 4], [12, 14, 8], [15, 19, 20], [20, 24, 50], [25, 29, 100], [30, 32, 200], [33, 49, 400]]) },
		L3: { paytable: makeTierPaytable([[5, 5, 0.1], [6, 6, 0.2], [7, 7, 0.4], [8, 8, 0.8], [9, 9, 1.6], [10, 11, 3], [12, 14, 6], [15, 19, 15], [20, 24, 40], [25, 29, 80], [30, 32, 150], [33, 49, 300]]) },
		L4: { paytable: makeTierPaytable([[5, 5, 0.08], [6, 6, 0.15], [7, 7, 0.3], [8, 8, 0.6], [9, 9, 1.2], [10, 11, 2.5], [12, 14, 5], [15, 19, 12], [20, 24, 30], [25, 29, 60], [30, 32, 120], [33, 49, 250]]) },
		WILD: { special_properties: ['wild', 'multiplier'] },
		MAGNET: { special_properties: ['magnet'] },
		SCATTER: { special_properties: ['scatter'] },
	},
} as const;
