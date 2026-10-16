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
		const scatterAmount = fs === 0 ? ({ 3: 200, 4: 1000, 5: 5000 }[Math.min(keys, 5)] ?? 0) : 0;
		const amount = (gate ? (bonus === 'hidden' ? 750 : 375) : 0) + scatterAmount;
		total += amount;
		add({
			type: 'spinWin',
			spinId: id,
			rawAmount: gate ? 75 : 0,
			multiplier: gate ? (bonus === 'hidden' ? 10 : 5) : 1,
			uncappedAmount: amount,
			scatterAmount,
			scatterCount: fs === 0 ? keys : 0,
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

/** Developer art-review fixtures. Never imported by a production wagering path. */
export function previewPresentationEvents(key: string | null): BookEvent[] | null {
	if (key === 'scatter-board') {
		const board = displayBoard();
		for (const [reel, row] of [
			[1, 2],
			[3, 1],
			[4, 3],
		])
			board[reel][row] = { name: 'KEY' };
		return [
			{
				index: 0,
				type: 'spinStart',
				spinId: 0,
				gameType: 'basegame',
				tier: null,
				freeSpin: 0,
				multiplier: 1,
				multiplierActive: false,
				stickyPositions: [],
			},
			{
				index: 1,
				type: 'reveal',
				spinId: 0,
				cascadeIndex: 0,
				gameType: 'basegame',
				board,
				movements: [],
			},
			{
				index: 2,
				type: 'spinWin',
				spinId: 0,
				rawAmount: 0,
				multiplier: 1,
				scatterCount: 3,
				scatterAmount: 200,
				uncappedAmount: 200,
				amount: 200,
				cascades: 0,
				capped: false,
			},
			{ index: 3, type: 'setTotalWin', amount: 200 },
			{ index: 4, type: 'setWin', amount: 200 },
			{ index: 5, type: 'finalWin', amount: 200 },
		];
	}

	if (
		key &&
		['reward-add', 'reward-multiply', 'reward-spins', 'reward-retrigger', 'reward-wild'].includes(
			key,
		)
	) {
		const events = previewPresentationEvents('gate-super')!;
		const positions = [
			{ reel: 2, row: 2 },
			{ reel: 4, row: 0 },
			{ reel: 5, row: 4 },
		];
		const reward: Extract<BookEvent, { type: 'gateReward' }>['reward'] =
			key === 'reward-wild'
				? { kind: 'stickyWild', positions }
				: key === 'reward-spins'
					? { kind: 'extraSpin', spinsAdded: 3 }
					: key === 'reward-retrigger'
						? { kind: 'retrigger', spinsAdded: 5 }
						: {
								kind: key === 'reward-multiply' ? 'multiplyMultiplier' : 'addMultiplier',
								value: 5,
							};
		const multiplier = 'value' in reward ? (reward.kind === 'multiplyMultiplier' ? 5 : 6) : 1;
		return events.map((event) => {
			if (event.type === 'gateReward')
				return {
					...event,
					reward,
					previousMultiplier: 1,
					multiplier,
					multiplierActive: 'value' in reward,
					totalFs: 'spinsAdded' in reward ? 15 + reward.spinsAdded : 15,
					stickyPositions: reward.kind === 'stickyWild' ? positions : [],
				};
			if (event.type === 'spinWin')
				return {
					...event,
					multiplier,
					amount: event.rawAmount * multiplier + (event.scatterAmount ?? 0),
					uncappedAmount: event.rawAmount * multiplier + (event.scatterAmount ?? 0),
				};
			if (['setTotalWin', 'setWin', 'finalWin'].includes(event.type))
				return { ...event, amount: 75 * multiplier } as BookEvent;
			return event;
		});
	}
	if (key === 'bonus-cycle-normal') {
		// Short entry/one-free-spin/summary choreography; no live wallet/outcome path.
		const source = previewEvents('BONUS');
		const firstSpin = source.findIndex((e) => e.type === 'spinStart' && e.freeSpin === 2);
		return [
			...source.slice(0, firstSpin - 1),
			{
				type: 'freeSpinEnd',
				tier: 'normal',
				amount: 0,
				spinsPlayed: 1,
				totalSpinsAwarded: 15,
				capped: false,
			},
			{ type: 'finalWin', amount: 0 },
		].map((e, index) => ({ ...e, index })) as BookEvent[];
	}
	if (key === 'intro-normal' || key === 'intro-super' || key === 'intro-hidden') {
		const mode: Mode =
			key === 'intro-hidden' ? 'MYSTERY' : key === 'intro-super' ? 'SUPER' : 'BONUS';
		const source = previewEvents(mode),
			trigger = source.findIndex((event) => event.type === 'freeSpinTrigger');
		const events = source.slice(0, trigger + 1);
		events.push(
			{ index: events.length, type: 'setWin', amount: 0 },
			{ index: events.length + 1, type: 'finalWin', amount: 0 },
		);
		return events;
	}
	if (key === 'gate-normal' || key === 'gate-super' || key === 'gate-hidden') {
		const mode: Mode = key === 'gate-hidden' ? 'MYSTERY' : key === 'gate-super' ? 'SUPER' : 'BONUS';
		const source = previewEvents(mode);
		const first = source.findIndex((e) => e.type === 'spinStart' && e.freeSpin === 15);
		return source
			.slice(first)
			.filter((e) => e.type !== 'freeSpinEnd')
			.map((e, index) => ({ ...e, index }));
	}

	const amounts: Record<string, number> = {
		precision: 20025,
		plain: 20000,
		inline: 1500,
		sweet: 2000,
		wild: 5000,
		epic: 10000,
		mythic: 20000,
		legendary: 50000,
		max: 2500000,
	};
	if (key && Object.hasOwn(amounts, key)) {
		const amount = amounts[key];
		const events: BookEvent[] = [
			{ index: 0, type: 'setTotalWin', amount },
			{ index: 1, type: 'setWin', amount },
		];
		if (key === 'max') events.push({ index: 2, type: 'maxWin', amount });
		events.push({ index: events.length, type: 'finalWin', amount });
		return events;
	}
	const tier = key?.startsWith('summary-') ? key.slice(8) : null;
	if (tier === 'normal' || tier === 'super' || tier === 'hidden')
		return [
			{ index: 0, type: 'setTotalWin', amount: 7500 },
			{
				index: 1,
				type: 'freeSpinEnd',
				tier,
				amount: 7500,
				spinsPlayed: 15,
				totalSpinsAwarded: 15,
				capped: false,
			},
			{ index: 2, type: 'finalWin', amount: 7500 },
		];
	return null;
}
