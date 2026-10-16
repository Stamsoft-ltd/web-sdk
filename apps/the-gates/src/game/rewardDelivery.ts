/** Presentation only. The reducer receives its award immediately; views settle on arrival. */
import type { BookEvent, Position, Board } from './contract';
import type { GameState } from './reducer';
import { GATE_REWARD_ENTER_MS, GATE_REWARD_HOLD_MS } from './gatePlayback.ts';
export const REWARD_FLIGHT_MS = 720;
export const REWARD_STAGGER_MS = 8;
export const REWARD_PULSE_MS = 300;
export const REWARD_FLIGHT_START_MS = GATE_REWARD_ENTER_MS + GATE_REWARD_HOLD_MS;
export type RewardTarget = { x: number; y: number; width: number; height: number };
export type RewardDelivery = {
	speedFactor?: number;
	id: string;
	reward: Extract<BookEvent, { type: 'gateReward' }>['reward'];
	startedAt: number;
	beforeMultiplier: number;
	beforeTotalFs: number;
	beforeRemaining: number;
	beforeCells: { position: Position; cell: Board[number][number]; sticky: boolean }[];
	arrived: number[];
};
export function createRewardDelivery(
	event: Extract<BookEvent, { type: 'gateReward' }>,
	before: GameState,
	startedAt: number,
	round: string,
): RewardDelivery {
	return {
		id: `${round}:${before.gateEventId}:${event.order}:${event.index}`,
		reward: event.reward,
		startedAt,
		beforeMultiplier: before.multiplier,
		beforeTotalFs: before.totalFs,
		beforeRemaining: before.remaining,
		beforeCells:
			event.reward.kind === 'stickyWild'
				? event.reward.positions.map((position) => ({
						position: { ...position },
						cell: before.board[position.reel]?.[position.row]
							? { ...before.board[position.reel][position.row]! }
							: null,
						sticky: before.sticky.some((p) => p.reel === position.reel && p.row === position.row),
					}))
				: [],
		arrived: [],
	};
}
export function deliveryTargets(delivery: Pick<RewardDelivery, 'reward'>) {
	const reward = delivery.reward;
	return reward.kind === 'stickyWild'
		? reward.positions.map((p) => `cell:${p.reel}:${p.row}`)
		: ['value' in reward ? 'multiplier' : 'spins'];
}
/** No invented intermediate outcomes. Hold only the affected presentation values/cells. */
export function presentedReward(game: GameState, delivery: RewardDelivery | null): GameState {
	if (!delivery) return game;
	const reward = delivery.reward;
	if ('value' in reward && !delivery.arrived.includes(0))
		return { ...game, multiplier: delivery.beforeMultiplier };
	if ('spinsAdded' in reward && !delivery.arrived.includes(0))
		return { ...game, totalFs: delivery.beforeTotalFs, remaining: delivery.beforeRemaining };
	if (reward.kind !== 'stickyWild') return game;
	const pending = delivery.beforeCells.filter((_, i) => !delivery.arrived.includes(i));
	if (!pending.length) return game;
	const board = game.board.map((col) => col.slice());
	for (const { position, cell } of pending) board[position.reel][position.row] = cell;
	const sticky = game.sticky.filter(
		(p) =>
			!pending.some((v) => v.position.reel === p.reel && v.position.row === p.row && !v.sticky),
	);
	return { ...game, board, sticky };
}
const clamp = (n: number) => Math.max(0, Math.min(1, n));
export function rewardFlight(age: number, index: number, reduced = false) {
	const stagger = reduced ? 0 : Math.min(232, index * REWARD_STAGGER_MS),
		duration = reduced ? 100 : REWARD_FLIGHT_MS;
	const start = reduced ? 0 : REWARD_FLIGHT_START_MS;
	const progress = clamp((age - start - stagger) / duration);
	const arrival = start + stagger + duration;
	return {
		progress,
		started: age >= start + stagger,
		arrived: age >= arrival,
		pulse: clamp((age - arrival) / REWARD_PULSE_MS),
	};
}
/** Curved ease-out swoop; endpoints are live canvas coordinates, so resize never resets the clock. */
export function rewardFlightPoint(
	from: { x: number; y: number },
	to: { x: number; y: number },
	p: number,
) {
	const t = 1 - (1 - clamp(p)) ** 2,
		arc = Math.min(140, Math.hypot(to.x - from.x, to.y - from.y) * 0.22);
	return {
		x: from.x + (to.x - from.x) * t,
		y: from.y + (to.y - from.y) * t - Math.sin(Math.PI * t) * arc,
	};
}
