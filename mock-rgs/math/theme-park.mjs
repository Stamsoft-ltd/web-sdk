const REELS = 5;
const ROWS_WITH_PADDING = 7;

const makeBoard = () =>
	Array.from({ length: REELS }, (_, reel) =>
		Array.from({ length: ROWS_WITH_PADDING }, (_, row) => ({
			name: ['L1', 'L2', 'L3', 'L4', 'L5'][(reel + row) % 5],
		})),
	);

export function generateRoundForMode({ mode = 'BASE', seed = Date.now() } = {}) {
	const events = [
		{
			index: 0,
			type: 'reveal',
			board: makeBoard(),
			paddingPositions: [0, 6],
			anticipation: [0, 0, 0, 0, 0],
			gameType: mode === 'BASE' || mode === 'ANTE' ? 'basegame' : 'freegame',
		},
		{ index: 1, type: 'setTotalWin', amount: 0 },
		{ index: 2, type: 'finalWin', amount: 0 },
	];
	return { seed, payoutMultiplier: 0, events };
}

export const getRoundForMode = (mode = 'BASE', seed = Date.now()) =>
	generateRoundForMode({ mode, seed });

export const getReplayRound = ({ mode = 'BASE', seed = Date.now() } = {}) =>
	generateRoundForMode({ mode, seed });
