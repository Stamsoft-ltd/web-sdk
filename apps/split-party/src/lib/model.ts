export const MODES = { base: 1, feature: 50, normal: 100, super: 500, mystery: 500 } as const;
export type Mode = keyof typeof MODES;
export const SYMBOLS = [
	'WATERMELON',
	'CHERRIES',
	'GRAPES',
	'STRAWBERRY',
	'BLUEBERRY',
	'ORANGE',
	'LEMON',
	'KIWI',
	'PLUM',
	'APPLE',
	'BASKET',
];
export type BookEvent = { index: number; type: string; [key: string]: any };
export type Round = {
	state: BookEvent[];
	amount: number;
	mode: Mode;
	active?: boolean;
	payout?: number;
};
export type BoardState = {
	board: string[][];
	blades: number[][];
	highlight: string[];
	total: number;
	paid: number;
	freeSpin: number;
	tier: string;
	phase: string;
	finished: boolean;
};
export const initialState = (): BoardState => ({
	board: Array.from({ length: 7 }, (_, c) =>
		Array.from({ length: 7 }, (_, r) => SYMBOLS[(c * 3 + r * 7) % 10]),
	),
	blades: Array.from({ length: 7 }, () => Array(7).fill(0)),
	highlight: [],
	total: 0,
	paid: 0,
	freeSpin: 0,
	tier: '',
	phase: 'ready',
	finished: false,
});
const known = new Set([
	'baseSpinStart',
	'featureSpinStart',
	'mysteryChoice',
	'bonusStart',
	'reveal',
	'clusterWin',
	'winInfo',
	'bladeUpdate',
	'tumble',
	'spinEnd',
	'scatterTrigger',
	'bonusEnd',
	'setWin',
	'setTotalWin',
	'finalWin',
]);
const integer = (n: unknown) => Number.isSafeInteger(n) && Number(n) >= 0;
export function validateEvents(events: unknown): asserts events is BookEvent[] {
	if (!Array.isArray(events) || !events.length) throw Error('Missing round events');
	let paid = 0;
	for (const [index, e] of events.entries()) {
		if (e.index !== index || !known.has(e.type))
			throw Error(`Unsupported event ${index}: ${e.type}`);
		if (e.type === 'reveal' || e.type === 'tumble') {
			if (
				!Array.isArray(e.board) ||
				e.board.length !== 7 ||
				e.board.some(
					(c: any) =>
						!Array.isArray(c) || c.length !== 7 || c.some((s: any) => !SYMBOLS.includes(s)),
				)
			)
				throw Error('Invalid 7×7 board');
			if (
				!Array.isArray(e.blades) ||
				e.blades.length !== 7 ||
				e.blades.some(
					(c: any) =>
						!Array.isArray(c) || c.length !== 7 || c.some((b: any) => !integer(b) || b > 5),
				)
			)
				throw Error('Invalid blade state');
		}
		if (e.type === 'clusterWin' || e.type === 'scatterTrigger') {
			if (!integer(e.paidAward)) throw Error('Invalid event award');
			paid += e.paidAward;
		}
		if (e.type === 'finalWin' && (!integer(e.amount) || e.amount !== paid || e.amount > 2000000))
			throw Error('Final award mismatch');
	}
	if (events.at(-1)?.type !== 'finalWin') throw Error('Missing finalWin');
}
export function parseRound(data: any, fallbackAmount: number, fallbackMode: Mode): Round {
	const source = data?.round ?? data;
	validateEvents(source?.state ?? source?.events);
	const mode = String(source.mode ?? fallbackMode).toLowerCase();
	if (!(mode in MODES)) throw Error('Unsupported mode');
	const amount = source.amount ?? fallbackAmount;
	if (!integer(amount) || amount <= 0) throw Error('Invalid round amount');
	return { ...source, state: source.state ?? source.events, amount, mode: mode as Mode };
}
export function applyEvent(s: BoardState, e: BookEvent): BoardState {
	let n = { ...s };
	switch (e.type) {
		case 'baseSpinStart':
		case 'featureSpinStart':
			n = { ...initialState(), board: s.board, blades: s.blades };
			break;
		case 'reveal':
		case 'tumble':
			n.board = e.board.map((c: string[]) => [...c]);
			n.blades = e.blades.map((c: number[]) => [...c]);
			n.highlight = [];
			n.phase = e.type;
			n.freeSpin = e.freeSpin ?? s.freeSpin;
			break;
		case 'clusterWin':
			n.highlight = e.wins.flatMap((w: any) => w.positions.map((p: any) => `${p.reel},${p.row}`));
			n.paid = e.paidAward;
			n.total += e.paidAward;
			n.phase = 'win';
			break;
		case 'scatterTrigger':
			n.total += e.paidAward;
			n.phase = 'bonus';
			break;
		case 'bladeUpdate':
			n.blades = s.blades.map((c) => [...c]);
			for (const p of e.changes) n.blades[p.reel][p.row] = p.to;
			n.phase = 'split';
			break;
		case 'bonusStart':
			n.tier = e.tier;
			n.freeSpin = 0;
			n.phase = 'bonus';
			break;
		case 'mysteryChoice':
			n.tier = e.tier;
			n.phase = 'mystery';
			break;
		case 'finalWin':
			n.total = e.amount;
			n.finished = true;
			n.highlight = [];
			n.phase = 'finished';
			break;
	}
	return n;
}
export const winMoney = (baseAmount: number, bookAmount: number) => (baseAmount * bookAmount) / 100;
