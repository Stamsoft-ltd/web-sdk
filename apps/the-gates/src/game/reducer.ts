import {
	emptyBoard,
	type Board,
	type BookEvent,
	type Position,
	type Reward,
	type Tier,
	type Win,
} from './contract.ts';
export function initialState() {
	return {
		board: emptyBoard(),
		spinId: 0,
		tier: null as Tier | null,
		freeSpin: 0,
		totalFs: 0,
		remaining: 0,
		multiplier: 1,
		multiplierActive: false,
		sticky: [] as Position[],
		progress: 0,
		gate: 0,
		gateOpen: false,
		reward: null as Reward | null,
		rewardOrder: 0,
		rewardCount: 0,
		raw: 0,
		spinWin: 0,
		total: 0,
		bonusWin: 0,
		capped: false,
		wins: [] as Win[],
		movements: [] as Extract<BookEvent, { type: 'reveal' }>['movements'],
		fallOffsets: Array.from({ length: 6 }, () => Array<number>(5).fill(0)),
		revealId: 0,
		lastType: '',
		cursor: 0,
	};
}
export type GameState = ReturnType<typeof initialState>;
const boardCopy = (board: Board) =>
	board.map((col) => col.map((cell) => (cell ? { ...cell } : null)));
/** Presentation only. All awards/counters come from the authoritative book. */
export function reduceEvent(previous: GameState, e: BookEvent): GameState {
	const s = { ...previous, lastType: e.type, cursor: e.index + 1 };
	switch (e.type) {
		case 'featureSpinStart':
			break;
		case 'spinStart':
			Object.assign(s, {
				spinId: e.spinId,
				tier: e.tier,
				freeSpin: e.freeSpin,
				multiplier: e.multiplier,
				multiplierActive: e.multiplierActive,
				sticky: e.stickyPositions,
				progress: 0,
				gate: 0,
				gateOpen: false,
				reward: null,
				raw: 0,
				spinWin: 0,
				wins: [],
			});
			break;
		case 'reveal':
			s.fallOffsets = e.board.map((col, reel) =>
				col.map((cell, row) => {
					if (e.cascadeIndex === 0) return -(col.length + 1) * 100;
					const move = e.movements.find((m) => m.reel === reel && m.toRow === row);
					if (move) return (move.fromRow - move.toRow) * 100;
					const movedAway = e.movements.some((m) => m.reel === reel && m.fromRow === row);
					if (!movedAway && previous.board[reel][row]?.name === cell?.name) return 0;
					return -(row + 1) * 100;
				}),
			);
			s.board = boardCopy(e.board);
			s.movements = e.movements;
			s.revealId++;
			s.wins = [];
			s.gateOpen = false;
			s.reward = null;
			break;
		case 'cascadeWin':
			s.raw = e.rawSpinWin;
			s.wins = e.wins;
			break;
		case 'gateProgress':
			s.progress = e.progress;
			break;
		case 'gateOpen':
			s.gateOpen = true;
			s.gate = e.gate;
			s.rewardCount = e.rewardCount;
			s.rewardOrder = 0;
			break;
		case 'gateReward':
			Object.assign(s, {
				multiplier: e.multiplier,
				multiplierActive: e.multiplierActive,
				sticky: e.stickyPositions,
				totalFs: e.totalFs,
				reward: e.reward,
				rewardOrder: e.order,
			});
			if (e.reward.kind === 'stickyWild') {
				s.board = boardCopy(s.board);
				for (const p of e.reward.positions) s.board[p.reel][p.row] = { name: 'WILD' };
			}
			if (s.tier) s.remaining = Math.max(0, e.totalFs - s.freeSpin);
			break;
		case 'tumbleRemove':
			s.board = boardCopy(s.board);
			for (const p of e.positions) s.board[p.reel][p.row] = null;
			s.wins = [];
			break;
		case 'spinWin':
			s.spinWin = e.amount;
			s.raw = e.rawAmount;
			s.multiplier = e.multiplier;
			s.capped = e.capped;
			break;
		case 'setTotalWin':
		case 'setWin':
			s.total = e.amount;
			break;
		case 'finalWin':
			Object.assign(s, {
				total: e.amount,
				tier: null,
				freeSpin: 0,
				totalFs: 0,
				remaining: 0,
				gateOpen: false,
				reward: null,
			});
			break;
		case 'mysterySelect':
			break;
		case 'freeSpinTrigger':
			Object.assign(s, {
				tier: e.tier,
				totalFs: e.totalFs,
				freeSpin: 0,
				remaining: e.totalFs,
				multiplier: 1,
				multiplierActive: false,
				sticky: [],
				progress: 0,
				gateOpen: false,
			});
			break;
		case 'updateFreeSpin':
			Object.assign(s, {
				tier: e.tier,
				freeSpin: e.amount,
				totalFs: e.total,
				remaining: e.remaining,
			});
			break;
		case 'freeSpinEnd':
			s.bonusWin = e.amount;
			break;
		case 'maxWin':
			s.capped = true;
			break;
		default:
			throw new Error(`Unsupported event: ${(e as BookEvent).type}`);
	}
	return s;
}
/** Cursor is next event to play, not the last reveal to restore. */
export function restorePrefix(events: BookEvent[], cursor: number): GameState {
	if (!Number.isInteger(cursor) || cursor < 0 || cursor > events.length)
		throw new Error('Invalid resume cursor');
	return events.slice(0, cursor).reduce(reduceEvent, initialState());
}
