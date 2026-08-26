// Minimal mock rounds for local dev of McSchmutzo (cluster/tumble game). Enough for the client to
// authenticate + render the splash/loading/board; spins return a trivial no-win reveal.
const REELS = 5;
const ROWS = 5;

const makeBoard = () =>
	Array.from({ length: REELS }, (_, reel) =>
		Array.from({ length: ROWS }, (_, row) => ({
			name: ['L1', 'L2', 'L3', 'L4', 'L5'][(reel + row) % 5],
		})),
	);

export function generateRoundForMode({ mode = 'base', seed = 0 } = {}) {
	const gameType = mode === 'base' || mode === 'enhancer1' ? 'basegame' : 'freegame';
	const events = [
		{ index: 0, type: 'reveal', board: makeBoard(), gameType },
		{ index: 1, type: 'setTotalWin', amount: 0 },
		{ index: 2, type: 'finalWin', amount: 0 },
	];
	return { seed, payoutMultiplier: 0, events };
}

export const getRoundForMode = (mode = 'base', seed = 0) => generateRoundForMode({ mode, seed });
export const getReplayRound = ({ mode = 'base', seed = 0 } = {}) => generateRoundForMode({ mode, seed });
