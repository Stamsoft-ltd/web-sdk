/** Hand-authored UI choreography, NOT generated/validated math or a live game engine.
 * Imported only behind the SvelteKit dev flag. No random outcomes or wallet writes.
 */
import { SYMBOLS, type Board, type BookEvent, type Mode, type Tier } from './contract.ts';
export const displayBoard = (): Board =>
	Array.from({ length: 6 }, (_, c) =>
		Array.from({ length: 5 }, (_, r) => ({ name: SYMBOLS[(c * 3 + r * 2) % 10] })),
	);
export function previewEvents(mode: Mode): BookEvent[] {
	const events: BookEvent[] = [];
	const emit = (e: Omit<BookEvent, 'index'>) =>
		events.push({ ...e, index: events.length } as BookEvent);
	// Helper accepts each discriminated payload without widening public runtime types.
	const add = (e: unknown) => emit(e as Omit<BookEvent, 'index'>);
	const tier: Tier | null =
		mode === 'BONUS' ? 'normal' : mode === 'SUPER' ? 'super' : mode === 'MYSTERY' ? 'hidden' : null;
	const positions = Array.from({ length: 8 }, (_, i) => ({ reel: Math.floor(i / 5), row: i % 5 }));
	let total = 0;
	function spin(id: number, bonus: Tier | null, fs: number, gate: boolean, keys = 0) {
		add({
			type: 'spinStart',
			spinId: id,
			gameType: bonus ? 'freegame' : 'basegame',
			tier: bonus,
			freeSpin: fs,
			multiplier: 1,
			multiplierActive: false,
			stickyPositions: [],
		});
		const board = displayBoard();
		if (keys) for (let c = 0; c < keys; c++) board[c][4] = { name: 'KEY' };
		if (gate) for (const p of positions) board[p.reel][p.row] = { name: 'PURPLE_GEM' };
		add({
			type: 'reveal',
			spinId: id,
			cascadeIndex: 0,
			gameType: bonus ? 'freegame' : 'basegame',
			board,
			movements: [],
		});
		if (gate)
			for (let n = 1; n <= 3; n++) {
				add({
					type: 'cascadeWin',
					spinId: id,
					cascadeIndex: n,
					wins: [{ symbol: 'PURPLE_GEM', size: 8, positions, rawAmount: 25 }],
					rawAmount: 25,
					rawSpinWin: n * 25,
				});
				add({ type: 'gateProgress', spinId: id, cascadeIndex: n, progress: n });
				if (n === 3) {
					add({
						type: 'gateOpen',
						spinId: id,
						gate: 1,
						cascadeIndex: 3,
						rewardCount: bonus === 'hidden' ? 2 : 1,
					});
					add({
						type: 'gateReward',
						spinId: id,
						gate: 1,
						order: 1,
						reward: { kind: 'addMultiplier', value: 5 },
						previousMultiplier: 1,
						multiplier: 5,
						multiplierActive: true,
						totalFs: 15,
						stickyPositions: [],
					});
					if (bonus === 'hidden')
						add({
							type: 'gateReward',
							spinId: id,
							gate: 1,
							order: 2,
							reward: { kind: 'multiplyMultiplier', value: 2 },
							previousMultiplier: 5,
							multiplier: 10,
							multiplierActive: true,
							totalFs: 15,
							stickyPositions: [],
						});
				}
				add({ type: 'tumbleRemove', spinId: id, cascadeIndex: n, positions });
				add({
					type: 'reveal',
					spinId: id,
					cascadeIndex: n,
					gameType: bonus ? 'freegame' : 'basegame',
					board: n === 3 ? displayBoard() : board,
					movements: [],
				});
			}
		const amount = gate ? (bonus === 'hidden' ? 750 : 375) : 0;
		total += amount;
		add({
			type: 'spinWin',
			spinId: id,
			rawAmount: gate ? 75 : 0,
			multiplier: gate ? (bonus === 'hidden' ? 10 : 5) : 1,
			uncappedAmount: amount,
			amount,
			cascades: gate ? 3 : 0,
			capped: false,
		});
		add({ type: 'setTotalWin', amount: total });
	}
	spin(0, null, 0, !tier, tier ? (tier === 'normal' ? 3 : tier === 'super' ? 4 : 5) : 0);
	if (tier) {
		const positions = Array.from(
			{ length: tier === 'normal' ? 3 : tier === 'super' ? 4 : 5 },
			(_, reel) => ({ reel, row: 4 }),
		);
		if (mode === 'MYSTERY')
			add({ type: 'mysterySelect', tier, scatterCount: positions.length, positions });
		add({
			type: 'freeSpinTrigger',
			tier,
			source: mode === 'MYSTERY' ? 'mystery' : 'buy',
			scatterCount: positions.length,
			positions,
			totalFs: 15,
		});
		for (let fs = 1; fs <= 15; fs++) {
			add({ type: 'updateFreeSpin', amount: fs, total: 15, remaining: 15 - fs, tier });
			spin(fs, tier, fs, fs === 15);
		}
		add({
			type: 'freeSpinEnd',
			tier,
			amount: total,
			spinsPlayed: 15,
			totalSpinsAwarded: 15,
			capped: false,
		});
	}
	add({ type: 'setWin', amount: total });
	add({ type: 'finalWin', amount: total });
	return events;
}
