// Minimal mock rounds for local dev of McSchmutzo (cluster/tumble game). Enough for the client to
// authenticate + render the splash/loading/board; base spins return a trivial no-win reveal, and
// the bought bonuses (bonus1/bonus2) return a bonus-wheel award so the wheel screen can be tested.
const REELS = 5;
const ROWS = 5;

const makeBoard = () =>
	Array.from({ length: REELS }, (_, reel) =>
		Array.from({ length: ROWS }, (_, row) => ({
			name: ['L1', 'L2', 'L3', 'L4', 'L5'][(reel + row) % 5],
		})),
	);
const noAnticipation = Array.from({ length: REELS }, () => 0);

export function generateRoundForMode({ mode = 'base', seed = 0 } = {}) {
	const m = String(mode).toLowerCase(); // server upper-cases the mode (e.g. BONUS2)
	// Bought bonuses spin the wheel, then award the free games it lands on.
	if (m === 'bonus1' || m === 'bonus2') {
		const scatterEntry = m === 'bonus2' ? 4 : 3;
		const freeSpins = m === 'bonus2' ? 15 : 6;
		const addedSteps = m === 'bonus2' ? 8 : 3;
		const globalMult = m === 'bonus2' ? 2 : 1;
		return {
			seed,
			payoutMultiplier: 0,
			events: [
				{ index: 0, type: 'reveal', board: makeBoard(), gameType: 'basegame', anticipation: noAnticipation },
				{ index: 1, type: 'bonusWheel', scatterEntry, freeSpins, addedSteps, globalMult },
				{ index: 2, type: 'setTotalWin', amount: 0 },
				{ index: 3, type: 'finalWin', amount: 0 },
			],
		};
	}

	const gameType = m === 'base' || m === 'enhancer1' ? 'basegame' : 'freegame';
	const events = [
		{ index: 0, type: 'reveal', board: makeBoard(), gameType, anticipation: noAnticipation },
		{ index: 1, type: 'setTotalWin', amount: 0 },
		{ index: 2, type: 'finalWin', amount: 0 },
	];
	return { seed, payoutMultiplier: 0, events };
}

export const getRoundForMode = (mode = 'base', seed = 0) => generateRoundForMode({ mode, seed });
export const getReplayRound = ({ mode = 'base', seed = 0 } = {}) => generateRoundForMode({ mode, seed });
