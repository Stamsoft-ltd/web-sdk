import { stateBet } from 'state-shared';
import { recordBookEvent, checkIsMultipleRevealEvents, type BookEventHandlerMap } from 'utils-book';
import { waitForTimeout } from 'utils-shared/wait';
import { SECOND } from 'constants-shared/time';

import type { BookEvent, BookEventContext, BookEventOfType } from './typesBookEvent';
import type { RollerReel } from './types';
import { winLevelMap, type WinLevel, type WinLevelData } from './winLevelMap';
import { stateGame, stateGameDerived } from './stateGame.svelte';
import { eventEmitter } from './eventEmitter';
import { playBookEvent } from './utils';
import config from './config';

const getWinLevelData = (winLevel: number): WinLevelData => {
	const clamped = Math.min(10, Math.max(1, Math.round(winLevel))) as WinLevel;
	return winLevelMap[clamped];
};

const getWinLevelDataForAmount = (amount: number): WinLevelData => {
	const multiplier = amount / 100;
	const level =
		multiplier <= 0
			? 1
			: multiplier < 2
				? 2
				: multiplier < 5
					? 3
					: multiplier < 10
						? 4
						: multiplier < 20
							? 5
							: multiplier < 50
								? 6
								: multiplier < 100
									? 7
									: multiplier < 250
										? 8
										: multiplier < 1000
											? 9
											: 10;
	return getWinLevelData(level);
};

const dedupePositions = (positions: { reel: number; row: number }[]) => {
	const seen = new Set<string>();
	return positions.filter((pos) => {
		const key = `${pos.reel},${pos.row}`;
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
};

export const bookEventHandlerMap: BookEventHandlerMap<BookEvent, BookEventContext> = {
	reveal: async (bookEvent: BookEventOfType<'reveal'>, { bookEvents }: BookEventContext) => {
		// WIN is per spin, not the cumulative bonus total.
		stateGame.roundWin = 0;
		const isBonusGame = checkIsMultipleRevealEvents({ bookEvents });
		const hasAnticipation = bookEvent.anticipation?.some(Boolean);
		if (isBonusGame || hasAnticipation) eventEmitter.broadcast({ type: 'stopButtonEnable' });
		if (isBonusGame) recordBookEvent({ bookEvent });

		stateGame.gameType = bookEvent.gameType;
		if (bookEvent.gameType === 'basegame') {
			stateGameDerived.resetBonusState();
			stateGame.bonusSummaryShown = false;
		}

		// Per-spin state: duck collect is per spin. Prior Roller Wilds stay
		// visible through the result beat and are released when the next spin starts.
		stateGame.duckCollect = null;
		stateGame.hasAnticipationPending = !!hasAnticipation;
		stateGame.anticipationSkipped = false;

		// Brief beat between bonus spins so the player can read the previous result
		if (isBonusGame && bookEvent.gameType === 'freegame' && !stateBet.isSuperTurbo) {
			await waitForTimeout(500);
		}
		// Keep the prior free-spin payline visible during the result beat. Clearing
		// before the delay made only the final 500x spin readable.
		stateGame.paylineWins = [];

		const hadPendingStop = stateGame.pendingStop && stateGame.awaitingFirstReveal;
		stateGame.awaitingFirstReveal = false;
		stateGame.pendingStop = false;
		stateGame.activeRollerReels = [];

		const spinPromise = stateGameDerived.enhancedBoard.spin({
			revealEvent: bookEvent,
			paddingBoard: config.paddingReels[bookEvent.gameType],
		});
		if (hadPendingStop) stateGameDerived.enhancedBoard.stop();
		await spinPromise;
		stateGame.hasAnticipationPending = false;
		eventEmitter.broadcast({ type: 'soundScatterCounterClear' });
	},

	winInfo: async (bookEvent: BookEventOfType<'winInfo'>) => {
		if (bookEvent.wins.length === 0) return;
		stateGame.roundWin = bookEvent.totalWin;

		const animatePositions = dedupePositions(bookEvent.wins.flatMap((w) => w.positions));
		await eventEmitter.broadcastAsync({
			type: 'boardWithAnimateSymbols',
			symbolPositions: animatePositions,
		});

		// Show full 5-reel payline paths (meta.lineIndex is 0-based; config keys are 1-based)
		stateGame.paylineWins = bookEvent.wins
			.map((w) => {
				const rows = config.paylines[String(w.meta.lineIndex + 1)];
				if (!rows) return null;
				return { lineIndex: w.meta.lineIndex, path: rows.map((row, reel) => ({ reel, row })) };
			})
			.filter(
				(p): p is { lineIndex: number; path: Array<{ reel: number; row: number }> } => p !== null,
			);

		// Theme Park math emits setWin only once, after the complete bonus.
		// Present each free-spin win here so it behaves like Forest Gang:
		// current-spin amount, current-spin tier, then continue to the next spin.
		if (stateGame.gameType === 'freegame') {
			const winLevelData = getWinLevelDataForAmount(bookEvent.totalWin);
			eventEmitter.broadcast({ type: 'winShow' });
			await eventEmitter.broadcastAsync({
				type: 'winUpdate',
				amount: bookEvent.totalWin,
				winLevelData,
			});
			eventEmitter.broadcast({ type: 'winHide' });
		}
	},

	setTotalWin: async (bookEvent: BookEventOfType<'setTotalWin'>) => {
		stateBet.winBookEventAmount = bookEvent.amount;
	},

	setWin: async (bookEvent: BookEventOfType<'setWin'>) => {
		if (!bookEvent.amount) return;
		// freeSpinEnd already showed the dedicated bonus-total board. Do not
		// incorrectly reuse the per-round tier board for the same grand total.
		if (stateGame.bonusSummaryShown) return;
		// Pick bonuses can settle without a normal winInfo event.
		if (stateGame.roundWin === 0) stateGame.roundWin = bookEvent.amount;
		const winLevelData = getWinLevelData(bookEvent.winLevel);
		eventEmitter.broadcast({ type: 'winShow' });
		await eventEmitter.broadcastAsync({
			type: 'winUpdate',
			amount: bookEvent.amount,
			winLevelData,
		});
		eventEmitter.broadcast({ type: 'winHide' });
	},

	finalWin: async (bookEvent: BookEventOfType<'finalWin'>) => {
		stateBet.winBookEventAmount = bookEvent.amount;
		stateGame.roundWin = bookEvent.amount;
		eventEmitter.broadcast({ type: 'winHide' });
		stateGame.paylineWins = [];
		stateGame.bonusSummaryShown = false;
		if (stateGame.gameType === 'basegame') {
			const settledRollerReels = stateGame.activeRollerReels;
			stateGameDerived.resetBonusState();
			// Keep the completed multiplier reel while idle.
			// The following reveal releases it as the next spin starts.
			stateGame.activeRollerReels = settledRollerReels;
		}
	},

	// Only Roller Wilds / Mega Coaster emit freeSpinTrigger (Duck Your Luck has none)
	freeSpinTrigger: async (bookEvent: BookEventOfType<'freeSpinTrigger'>) => {
		if (stateGame.stopAutoOnBonus && stateBet.autoSpinsCounter > 0) {
			stateBet.autoSpinsCounter = 0;
		}

		eventEmitter.broadcast({ type: 'soundScatterCounterClear' });
		eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_scatter_win' });
		if (bookEvent.positions.length > 0) {
			await eventEmitter.broadcastAsync({
				type: 'boardWithAnimateSymbols',
				symbolPositions: bookEvent.positions,
			});
		}
		await waitForTimeout(SECOND * 0.5);

		stateGame.bonusType = bookEvent.bonusType;

		// Intro screen (press to continue)
		eventEmitter.broadcast({ type: 'freeSpinIntroShow' });
		await eventEmitter.broadcastAsync({
			type: 'freeSpinIntroUpdate',
			totalFreeSpins: bookEvent.totalFs,
			title: bookEvent.bonusType === 'coaster' ? 'MEGA COASTER' : 'ROLLER WILDS',
		});
		eventEmitter.broadcast({ type: 'freeSpinIntroHide' });
		await eventEmitter.broadcastAsync({ type: 'transition' });

		stateGame.bonusMode = 'freegame';
		stateGame.gameType = 'freegame';
		eventEmitter.broadcast({ type: 'boardFrameGlowShow' });
		eventEmitter.broadcast({ type: 'freeSpinCounterUpdate', total: bookEvent.totalFs });
		eventEmitter.broadcast({ type: 'soundMusic', name: 'bgm_freespin' });
	},

	updateFreeSpin: async (bookEvent: BookEventOfType<'updateFreeSpin'>) => {
		// amount is the 0-based index of the upcoming spin
		eventEmitter.broadcast({
			type: 'freeSpinCounterUpdate',
			current: bookEvent.amount + 1,
			total: bookEvent.total,
		});
	},

	freeSpinEnd: async (bookEvent: BookEventOfType<'freeSpinEnd'>) => {
		stateGame.roundWin = bookEvent.amount;
		stateGame.bonusSummaryShown = true;
		eventEmitter.broadcast({ type: 'boardFrameGlowHide' });
		eventEmitter.broadcast({ type: 'freeSpinCounterHide' });
		await waitForTimeout(SECOND * 0.5);

		const winLevelData = getWinLevelData(bookEvent.winLevel);
		eventEmitter.broadcast({ type: 'freeSpinOutroShow' });
		eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_youwon_panel' });
		await eventEmitter.broadcastAsync({
			type: 'freeSpinOutroCountUp',
			amount: bookEvent.amount,
			winLevelData,
		});
		eventEmitter.broadcast({ type: 'freeSpinOutroHide' });

		await eventEmitter.broadcastAsync({ type: 'transition' });

		stateGameDerived.resetBonusState();
		stateGame.gameType = 'basegame';
		eventEmitter.broadcast({ type: 'soundMusic', name: 'bgm_main' });
	},

	// Hard cap reached (25,000x); round then ends
	wincap: async (bookEvent: BookEventOfType<'wincap'>) => {
		// Real books emit wincap AND a following setWin(winLevel 10), so this
		// handler only clamps the displayed total and plays the max-win sting —
		// the count-up/big-win screen is presented once, by the setWin handler.
		stateBet.winBookEventAmount = bookEvent.amount;
		eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_youwon_panel' });
		await waitForTimeout(SECOND * 0.4);
	},

	// ── Duck Collect (DC symbols on the board) ────────────────────────────────
	duckCollectStart: async (bookEvent: BookEventOfType<'duckCollectStart'>) => {
		stateGame.duckCollect = { positions: bookEvent.positions, revealed: [] };
		stateGame.duckRunningTotal = 0;
		if (bookEvent.positions.length > 0) {
			await eventEmitter.broadcastAsync({
				type: 'boardWithAnimateSymbols',
				symbolPositions: bookEvent.positions,
			});
		}
		eventEmitter.broadcast({ type: 'duckCollectShow', positions: bookEvent.positions });
		await waitForTimeout(400);
	},

	duckReveal: async (bookEvent: BookEventOfType<'duckReveal'>) => {
		if (stateGame.duckCollect) {
			stateGame.duckCollect.revealed = [
				...stateGame.duckCollect.revealed,
				{ position: bookEvent.position, kind: bookEvent.kind, value: bookEvent.value },
			];
		}
		stateGame.duckRunningTotal = bookEvent.runningTotal;
		await eventEmitter.broadcastAsync({
			type: 'duckCollectReveal',
			position: bookEvent.position,
			kind: bookEvent.kind,
			value: bookEvent.value,
			runningTotal: bookEvent.runningTotal,
		});
	},

	duckCollectEnd: async (bookEvent: BookEventOfType<'duckCollectEnd'>) => {
		await eventEmitter.broadcastAsync({ type: 'duckCollectFinish', amount: bookEvent.amount });
		eventEmitter.broadcast({ type: 'duckCollectHide' });
		stateGame.duckCollect = null;
		stateGame.duckRunningTotal = 0;
	},

	// ── Duck Your Luck bonus (pond pick screen) ───────────────────────────────
	duckPickStart: async (bookEvent: BookEventOfType<'duckPickStart'>) => {
		stateGame.duckPicks = {
			totalPicks: bookEvent.totalPicks,
			pool: bookEvent.pool,
			picks: [],
			finalAmount: null,
		};
		stateGame.duckRunningTotal = 0;
		eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_scatter_win' });
		eventEmitter.broadcast({
			type: 'duckPondShow',
			totalPicks: bookEvent.totalPicks,
			pool: bookEvent.pool,
		});
		await waitForTimeout(600);
	},

	duckPick: async (bookEvent: BookEventOfType<'duckPick'>) => {
		if (stateGame.duckPicks) {
			stateGame.duckPicks.picks = [
				...stateGame.duckPicks.picks,
				{
					pickIndex: bookEvent.pickIndex,
					kind: bookEvent.kind,
					value: bookEvent.value,
					runningTotal: bookEvent.runningTotal,
				},
			];
		}
		stateGame.duckRunningTotal = bookEvent.runningTotal;
		await eventEmitter.broadcastAsync({
			type: 'duckPondPick',
			pickIndex: bookEvent.pickIndex,
			kind: bookEvent.kind,
			value: bookEvent.value,
			runningTotal: bookEvent.runningTotal,
		});
	},

	duckPickEnd: async (bookEvent: BookEventOfType<'duckPickEnd'>) => {
		if (stateGame.duckPicks) {
			stateGame.duckPicks = { ...stateGame.duckPicks, finalAmount: bookEvent.amount };
		}
		await eventEmitter.broadcastAsync({ type: 'duckPondFinish', amount: bookEvent.amount });
		// The pond's BONUS COMPLETE panel is this bonus's total board. Suppress
		// the settlement setWin tier board that follows it.
		stateGame.bonusSummaryShown = true;
		eventEmitter.broadcast({ type: 'duckPondHide' });
		stateGame.duckPicks = null;
		stateGame.duckRunningTotal = 0;
	},

	// ── Roller Wilds: trigger lands, animation plays, then reel transforms ─────
	rollerWildsApply: async (bookEvent: BookEventOfType<'rollerWildsApply'>) => {
		const reels: RollerReel[] = bookEvent.reels.map((entry) => {
			const triggerRow = entry.triggerRow ?? 2;
			// Legacy books repeat the final reel multiplier on all five W cells.
			// That is one reel value, not five values to add. New books may supply
			// sparse row multipliers explicitly for the apply → sum presentation.
			const multipliers =
				Array.isArray(entry.multipliers) && entry.multipliers.length > 0
					? entry.multipliers.map((value) => ({ ...value }))
					: [{ row: triggerRow, multiplier: entry.multiplier }];
			const summedMultiplier = multipliers.reduce((sum, value) => sum + value.multiplier, 0);
			return {
				reel: entry.reel,
				triggerRow,
				multiplier: Math.max(1, summedMultiplier || entry.multiplier),
				multipliers,
			};
		});

		// reveal handler has already awaited the reel stop. Animation therefore
		// always starts after the complete board has settled.
		await eventEmitter.broadcastAsync({ type: 'rollerWildsShow', reels });

		for (const roller of reels) {
			for (let row = 0; row < 5; row += 1) {
				const symbol = stateGame.board[roller.reel]?.reelState.symbols[row + 1];
				if (!symbol) continue;
				symbol.rawSymbol = {
					name: 'W',
					wild: true,
					reelMultiplier: roller.multiplier,
					rollerTrigger: true,
				};
				symbol.symbolState = 'static';
			}
		}
		stateGame.activeRollerReels = reels;
		// Let the settled multiplier reel render before removing the animation
		// layer. This prevents a normal-W flash before paylines appear.
		await waitForTimeout(20);
		eventEmitter.broadcast({ type: 'rollerWildsHide' });
	},

	// ── Mega Coaster setup (after freeSpinTrigger, before first freegame reveal) ─
	coasterSetup: async (bookEvent: BookEventOfType<'coasterSetup'>) => {
		await eventEmitter.broadcastAsync({
			type: 'coasterSetupShow',
			pukes: bookEvent.pukes,
			tiles: bookEvent.tiles,
		});
		stateGame.coasterTiles = bookEvent.tiles;
		eventEmitter.broadcast({ type: 'coasterSetupHide' });
	},

	createBonusSnapshot: async (bookEvent: BookEventOfType<'createBonusSnapshot'>) => {
		const triggerIndex = bookEvent.bookEvents.findIndex(
			(event) => event.type === 'freeSpinTrigger',
		);
		if (triggerIndex === -1) return;

		const revealBeforeTrigger = [...bookEvent.bookEvents]
			.slice(0, triggerIndex)
			.reverse()
			.find((event) => event.type === 'reveal');
		const startIndex = revealBeforeTrigger
			? bookEvent.bookEvents.indexOf(revealBeforeTrigger)
			: triggerIndex;

		for (const event of bookEvent.bookEvents.slice(startIndex)) {
			await playBookEvent(event, { bookEvents: bookEvent.bookEvents });
		}
	},
};
