import { stateBet } from 'state-shared';
import { recordBookEvent, checkIsMultipleRevealEvents, type BookEventHandlerMap } from 'utils-book';
import { waitForTimeout } from 'utils-shared/wait';
import { SECOND } from 'constants-shared/time';
import { tick } from 'svelte';

import type { BookEvent, BookEventContext, BookEventOfType } from './typesBookEvent';
import type { RollerReel } from './types';
import { winLevelMap, type WinLevel, type WinLevelData } from './winLevelMap';
import { stateGame, stateGameDerived } from './stateGame.svelte';
import { eventEmitter } from './eventEmitter';
import { playBookEvent } from './utils';
import config from './config';
import { BOARD_DIMENSIONS, REEL_SKIP_GAP_MS } from './constants';
import { duckLookForPosition, duckVariantForPosition, seededEventChoice } from './duckVisual';

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

const duckTriggerPositionsFromBoard = () =>
	stateGame.board.flatMap((reel, reelIndex) =>
		reel.reelState.symbols.flatMap((symbol, symbolIndex) => {
			const row = symbolIndex - 1;
			return row >= 0 && row < BOARD_DIMENSIONS.y && symbol.rawSymbol.name === 'S_DUCK'
				? [{ reel: reelIndex, row }]
				: [];
		}),
	);

export const bookEventHandlerMap: BookEventHandlerMap<BookEvent, BookEventContext> = {
	reveal: async (bookEvent: BookEventOfType<'reveal'>, { bookEvents }: BookEventContext) => {
		// WIN is per spin, not the cumulative bonus total.
		stateGame.roundWin = 0;
		// Capture before base-game reset clears the metadata. The overlay has its own local reels and
		// otherwise survived into the next spin because the later length check could no longer see it.
		const hadActiveRollerReels = stateGame.activeRollerReels.length > 0;
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

		const rollerRollOutPromise = hadActiveRollerReels
			? eventEmitter.broadcastAsync({ type: 'rollerWildsRollOut' })
			: Promise.resolve();
		stateGame.activeRollerReels = [];

		// Bind Duck art to the reveal event itself. Old reel symbols keep their prior seed while they
		// roll out; the next spin cannot restyle them merely by starting.
		const seededRevealEvent = {
			...bookEvent,
			board: bookEvent.board.map((reel, reelIndex) =>
				reel.map((symbol, symbolIndex) => {
					if (symbol.name !== 'DC' && symbol.name !== 'S_DUCK') return symbol;
					const position = { reel: reelIndex, row: symbolIndex - 1 };
					return {
						...symbol,
						duckStyleSeed: bookEvent.index,
						duckVariant: duckVariantForPosition(position, bookEvent.index),
						duckLook: duckLookForPosition(position, bookEvent.index),
					};
				}),
			),
		};
		// Looping spin whoosh under the reels; stateGame stops it as the last reel lands.
		eventEmitter.broadcast({ type: 'soundLoop', name: 'sfx_reel_spin_loop' });
		const spinPromise = stateGameDerived.enhancedBoard.spin({
			revealEvent: seededRevealEvent,
			paddingBoard: config.paddingReels[bookEvent.gameType],
			onWaitingForReady: () => {
				stateGame.revealPreparing = true;
			},
			onPrepared: () => {
				const hadPendingStop = stateGame.pendingStop;
				stateGame.awaitingFirstReveal = false;
				stateGame.revealPreparing = false;
				stateGame.pendingStop = false;
				if (!hadPendingStop) return;
				const delayMs = stateBet.isSuperTurbo
					? REEL_SKIP_GAP_MS.turbo
					: stateBet.isTurbo
						? REEL_SKIP_GAP_MS.fast
						: REEL_SKIP_GAP_MS.normal;
				// The click arrived before the reveal was prepared. Once its target is known, an
				// anticipation reveal must force-stop every noStop reel; a plain stop only interrupts the
				// ordinary reels and leaves the anticipated tail running indefinitely.
				if (hasAnticipation) stateGame.anticipationSkipped = true;
				stateGameDerived.enhancedBoard.stopSequentially({
					force: !!hasAnticipation,
					delayMs,
				});
			},
		});
		await Promise.all([spinPromise, rollerRollOutPromise]);
		stateGame.revealPreparing = false;
		stateGame.hasAnticipationPending = false;
		// Backstop for the spin whoosh: the per-reel stop in stateGame can be skipped when a bought
		// bonus (or a fast skip) settles the board without the last reel's onReelStopping firing, which
		// left the loop droning into the Duck Your Luck bonus. The spin has fully settled here.
		eventEmitter.broadcast({ type: 'soundStop', name: 'sfx_reel_spin_loop' });
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
		// Keep winning paths mounted and ticking after the count-up/result event. The next reveal owns
		// their teardown immediately before the reels start, so paylines never vanish during the idle
		// result hold between spins.
		stateGame.bonusSummaryShown = false;
		if (stateGame.gameType === 'basegame') {
			stateGameDerived.resetBonusState();
			// Settled Roller plaques remain on their board symbols. Clearing feature metadata cannot
			// change their visuals; the following reveal makes those same symbols roll out.
		}
	},

	// Reel bonuses use freeSpinTrigger. Duck Your Luck celebrates its landed scatters in
	// duckPickStart because it transitions directly into the pond instead of free spins.
	freeSpinTrigger: async (bookEvent: BookEventOfType<'freeSpinTrigger'>) => {
		if (stateGame.stopAutoOnBonus && stateBet.autoSpinsCounter > 0) {
			stateBet.autoSpinsCounter = 0;
		}

		// Silence the spin whoosh before the free-spin intro (bought bonus + skip can settle without the
		// reveal's own stop firing).
		eventEmitter.broadcast({ type: 'soundStop', name: 'sfx_reel_spin_loop' });
		eventEmitter.broadcast({ type: 'soundScatterCounterClear' });
		eventEmitter.broadcast({
			type: 'soundOnce',
			name: bookEvent.bonusType === 'coaster' ? 'sfx_coaster_scatter_land' : 'sfx_roller_scatter_land',
		});
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
			count: bookEvent.totalFs,
			title: bookEvent.bonusType === 'coaster' ? 'MEGA COASTER' : 'ROLLER WILDS',
		});
		eventEmitter.broadcast({ type: 'freeSpinIntroHide' });
		await eventEmitter.broadcastAsync({ type: 'transition' });

		stateGame.bonusMode = 'freegame';
		stateGame.gameType = 'freegame';
		eventEmitter.broadcast({ type: 'boardFrameGlowShow' });
		eventEmitter.broadcast({ type: 'freeSpinCounterUpdate', total: bookEvent.totalFs });
		// The two reel bonuses share the free-spin flow but not the music: Mega Coaster rides its
		// free-spins loop, Roller Wilds its own theme.
		eventEmitter.broadcast({
			type: 'soundMusic',
			name: bookEvent.bonusType === 'coaster' ? 'bgm_freespin' : 'bgm_roller_wilds',
		});
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
		eventEmitter.broadcast({
			type: 'soundOnce',
			name: stateGame.bonusType === 'coaster' ? 'sfx_coaster_bonus_end' : 'sfx_roller_bonus_end',
		});
		await eventEmitter.broadcastAsync({
			type: 'freeSpinOutroCountUp',
			amount: bookEvent.amount,
			winLevelData,
		});
		eventEmitter.broadcast({ type: 'freeSpinOutroHide' });
		// Stop the final-screen sting with the screen it belongs to — the coaster one runs ~10s and was
		// still playing into base game once the shorter outro closed. bonusType is still set here (reset
		// below), so it targets whichever sting played.
		eventEmitter.broadcast({
			type: 'soundStop',
			name: stateGame.bonusType === 'coaster' ? 'sfx_coaster_bonus_end' : 'sfx_roller_bonus_end',
		});

		await eventEmitter.broadcastAsync({ type: 'transition' });

		stateGameDerived.resetBonusState();
		// Final Roller plaques stay on board symbols through the transition and into the next spin.
		stateGame.gameType = 'basegame';
		eventEmitter.broadcast({ type: 'soundMusic', name: 'bgm_main' });
	},

	// Hard cap reached (25,000x); round then ends
	wincap: async (bookEvent: BookEventOfType<'wincap'>) => {
		// Real books emit wincap AND a following setWin(winLevel 10), so this
		// handler only clamps the displayed total; the count-up/big-win screen (and
		// its max-win music) is presented once, by the setWin handler.
		stateBet.winBookEventAmount = bookEvent.amount;
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
		if (stateGame.stopAutoOnBonus && stateBet.autoSpinsCounter > 0) {
			stateBet.autoSpinsCounter = 0;
		}

		// Show the same trigger celebration as the other bonus buys, but keep the post-turn hold
		// short now that the duck uses one fast motion. Legacy books recover S_DUCK cells from Board.
		const triggerPositions =
			bookEvent.positions?.length > 0 ? bookEvent.positions : duckTriggerPositionsFromBoard();
		// Make sure the spin whoosh is silenced before the pond opens (a bought bonus + skip can settle
		// the board without the reveal's own stop firing).
		eventEmitter.broadcast({ type: 'soundStop', name: 'sfx_reel_spin_loop' });
		eventEmitter.broadcast({ type: 'soundScatterCounterClear' });
		eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_duck_scatter_land' });
		if (triggerPositions.length > 0) {
			await eventEmitter.broadcastAsync({
				type: 'boardWithAnimateSymbols',
				symbolPositions: triggerPositions,
			});
			await waitForTimeout(SECOND * 0.12);
		}

		// Match the other bought bonuses: announce the awarded feature, wait for the player,
		// then change scenes under the transition cover before mounting the pond.
		eventEmitter.broadcast({ type: 'freeSpinIntroShow' });
		await eventEmitter.broadcastAsync({
			type: 'freeSpinIntroUpdate',
			count: bookEvent.totalPicks,
			title: 'DUCK YOUR LUCK',
			countLabel: 'DUCK PICKS',
		});
		eventEmitter.broadcast({ type: 'freeSpinIntroHide' });
		await eventEmitter.broadcastAsync({ type: 'transition' });

		stateGame.duckPicks = {
			totalPicks: bookEvent.totalPicks,
			pool: bookEvent.pool,
			picks: [],
			finalAmount: null,
		};
		stateGame.duckRunningTotal = 0;
		// Duck Your Luck has no free-spin flow, so it swaps the base bed for its own pond theme here;
		// duckPickEnd restores bgm_main.
		eventEmitter.broadcast({ type: 'soundMusic', name: 'bgm_duck_bonus' });
		eventEmitter.broadcast({
			type: 'duckPondShow',
			totalPicks: bookEvent.totalPicks,
			pool: bookEvent.pool,
			seed: bookEvent.index,
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
		stateGame.roundWin = bookEvent.amount;
		await eventEmitter.broadcastAsync({ type: 'duckPondFinish', amount: bookEvent.amount });
		eventEmitter.broadcast({ type: 'duckPondHide' });

		// First celebrate the won tier like a normal settled win. Duck Your Luck has no winInfo event,
		// so without this explicit beat it jumped directly from the pond to the bonus summary.
		const winLevelData = getWinLevelDataForAmount(bookEvent.amount);
		eventEmitter.broadcast({ type: 'winShow' });
		await eventEmitter.broadcastAsync({
			type: 'winUpdate',
			amount: bookEvent.amount,
			winLevelData,
		});
		eventEmitter.broadcast({ type: 'winHide' });

		// Then use the dedicated final-winnings board. Keep pond state alive behind both screens until
		// the player acknowledges the total; the later setWin is settlement data and stays suppressed.
		stateGame.bonusSummaryShown = true;
		eventEmitter.broadcast({ type: 'freeSpinOutroShow' });
		eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_duck_bonus_end' });
		await eventEmitter.broadcastAsync({
			type: 'freeSpinOutroCountUp',
			amount: bookEvent.amount,
			winLevelData,
		});
		eventEmitter.broadcast({ type: 'freeSpinOutroHide' });
		// Pond theme gave way back to the base bed now the feature is over.
		eventEmitter.broadcast({ type: 'soundMusic', name: 'bgm_main' });

		stateGame.duckPicks = null;
		stateGame.duckRunningTotal = 0;
	},

	// ── Roller Wilds: trigger lands, animation plays, then reel transforms ─────
	rollerWildsApply: async (bookEvent: BookEventOfType<'rollerWildsApply'>) => {
		const reels: RollerReel[] = bookEvent.reels.map((entry) => ({
			reel: entry.reel,
			triggerRow: entry.triggerRow ?? 2,
			// Legacy books lacked the fake first face. Keep them playable until math is regenerated.
			fakeMultiplier: Math.max(1, entry.fakeMultiplier ?? entry.multiplier),
			multiplier: Math.max(1, entry.multiplier),
			// Stable in live/replay and independent per reel. Salt isolates this from duck cosmetics.
			initialReal: seededEventChoice(bookEvent.index, entry.reel, 17, 2) === 1,
		}));

		// reveal handler has already awaited the reel stop. Animation therefore
		// always starts after the complete board has settled. Pop every landed Mega Wild first so
		// the trigger reads before its cart enters from behind the upper bulb frame.
		const triggerPositions = reels.map(({ reel, triggerRow }) => ({ reel, row: triggerRow }));
		await eventEmitter.broadcastAsync({
			type: 'boardWithAnimateSymbols',
			symbolPositions: triggerPositions,
		});
		await waitForTimeout(380);
		for (const { reel, row } of triggerPositions) {
			const symbol = stateGame.board[reel]?.reelState.symbols[row + 1];
			if (symbol) symbol.symbolState = 'static';
		}

		await eventEmitter.broadcastAsync({ type: 'rollerWildsShow', reels });
		stateGame.activeRollerReels = reels;
		// Keep the authored reveal symbols intact underneath the full-reel presentation. The math uses
		// its transformed copy for payout; mutating the client board left five fake Wild cells behind
		// when the full-reel art was removed.
		await tick();
		await eventEmitter.broadcastAsync({ type: 'rollerWildsHandoff' });
	},

	// ── Mega Coaster setup (after freeSpinTrigger, before first freegame reveal) ─
	coasterSetup: async (bookEvent: BookEventOfType<'coasterSetup'>) => {
		// The cart-stamping setup has its own short theme; hand back to the free-spins loop after.
		eventEmitter.broadcast({ type: 'soundMusic', name: 'bgm_coaster_setup' });
		await eventEmitter.broadcastAsync({
			type: 'coasterSetupShow',
			pukes: bookEvent.pukes,
			tiles: bookEvent.tiles,
			seed: bookEvent.index,
		});
		stateGame.coasterTiles = bookEvent.tiles;
		eventEmitter.broadcast({ type: 'coasterSetupHide' });
		eventEmitter.broadcast({ type: 'soundMusic', name: 'bgm_freespin' });
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
