export default {
	reveal: {
		type: 'reveal',
		board: [
			[{ name: 'K' }, { name: 'FOX' }, { name: 'A' }, { name: 'J' }, { name: 'Q' }, { name: 'T' }],
			[{ name: 'A' }, { name: 'FOX' }, { name: 'K' }, { name: 'WOLF' }, { name: 'J' }, { name: 'Q' }],
			[{ name: 'Q' }, { name: 'FOX' }, { name: 'A' }, { name: 'BEAR' }, { name: 'K' }, { name: 'J' }],
			[{ name: 'J' }, { name: 'RABBIT' }, { name: 'Q' }, { name: 'A' }, { name: 'WOLF' }, { name: 'K' }],
			[{ name: 'T' }, { name: 'SQUIRREL' }, { name: 'J' }, { name: 'Q' }, { name: 'A' }, { name: 'K' }],
		],
		paddingPositions: [1, 3, 5, 7, 9],
		gameType: 'basegame',
		anticipation: [0, 0, 0, 0, 0],
	},
	setTotalWin: { type: 'setTotalWin', amount: 300 },
	finalWin: { type: 'finalWin', amount: 300 },
	freeSpinTrigger: {
		type: 'freeSpinTrigger',
		totalFs: 10,
		positions: [
			{ reel: 0, row: 1 },
			{ reel: 2, row: 2 },
			{ reel: 4, row: 4 },
		],
	},
	updateFreeSpin: { type: 'updateFreeSpin', amount: 0, total: 10 },
	winInfo: {
		type: 'winInfo',
		totalWin: 300,
		wins: [
			{
				symbol: 'FOX',
				kind: 3,
				win: 300,
				positions: [
					{ reel: 0, row: 1 },
					{ reel: 1, row: 1 },
					{ reel: 2, row: 1 },
				],
				meta: { lineIndex: 1, multiplier: 1, winWithoutMult: 300, globalMult: 1, lineMultiplier: 1 },
			},
		],
	},
	// --- Storybook sim: all 5 animals on the board, every cell driven into the win animation ---
	revealAnimals: {
		type: 'reveal',
		board: [
			[{ name: 'WOLF' }, { name: 'WOLF' }, { name: 'WOLF' }, { name: 'WOLF' }, { name: 'WOLF' }, { name: 'WOLF' }],
			[{ name: 'FOX' }, { name: 'FOX' }, { name: 'FOX' }, { name: 'FOX' }, { name: 'FOX' }, { name: 'FOX' }],
			[{ name: 'BEAR' }, { name: 'BEAR' }, { name: 'BEAR' }, { name: 'BEAR' }, { name: 'BEAR' }, { name: 'BEAR' }],
			[{ name: 'RABBIT' }, { name: 'RABBIT' }, { name: 'RABBIT' }, { name: 'RABBIT' }, { name: 'RABBIT' }, { name: 'RABBIT' }],
			[{ name: 'SQUIRREL' }, { name: 'SQUIRREL' }, { name: 'SQUIRREL' }, { name: 'SQUIRREL' }, { name: 'SQUIRREL' }, { name: 'SQUIRREL' }],
		],
		paddingPositions: [1, 3, 5, 7, 9],
		gameType: 'basegame',
		anticipation: [0, 0, 0, 0, 0],
	},
	winInfoAnimals: {
		type: 'winInfo',
		totalWin: 1000,
		wins: [
			{
				symbol: 'WOLF',
				kind: 5,
				win: 1000,
				positions: [
					{ reel: 0, row: 0 }, { reel: 0, row: 1 }, { reel: 0, row: 2 }, { reel: 0, row: 3 },
					{ reel: 1, row: 0 }, { reel: 1, row: 1 }, { reel: 1, row: 2 }, { reel: 1, row: 3 },
					{ reel: 2, row: 0 }, { reel: 2, row: 1 }, { reel: 2, row: 2 }, { reel: 2, row: 3 },
					{ reel: 3, row: 0 }, { reel: 3, row: 1 }, { reel: 3, row: 2 }, { reel: 3, row: 3 },
					{ reel: 4, row: 0 }, { reel: 4, row: 1 }, { reel: 4, row: 2 }, { reel: 4, row: 3 },
				],
				meta: { lineIndex: 1, multiplier: 1, winWithoutMult: 1000, globalMult: 1, lineMultiplier: 1 },
			},
		],
	},
	// Storybook sim: expanded WOLF symbol filling every reel (to preview the new win video + vine frame).
	expandedWolf: {
		type: 'expandedSymbolReveal',
		symbol: 'WOLF',
		reels: [0, 1, 2, 3, 4],
		positions: [
			{ reel: 0, row: 1 }, { reel: 1, row: 1 }, { reel: 2, row: 1 }, { reel: 3, row: 1 }, { reel: 4, row: 1 },
		],
	},
	expandedSquirrel: {
		type: 'expandedSymbolReveal',
		symbol: 'SQUIRREL',
		reels: [0, 1, 2, 3, 4],
		positions: [
			{ reel: 0, row: 1 }, { reel: 1, row: 1 }, { reel: 2, row: 1 }, { reel: 3, row: 1 }, { reel: 4, row: 1 },
		],
	},
	// TEMP-DEBUG: rabbit expand animation for user testing (was setWin: { type: 'setWin', amount: 300, winLevel: 3 })
	setWin: { type: 'setWin', amount: 2500, winLevel: 6 }, // TEMP-DEBUG: no-P board check
	freeSpinEnd: { type: 'freeSpinEnd', amount: 2300, winLevel: 6 },
};
