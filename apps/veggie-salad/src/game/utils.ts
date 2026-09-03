import _ from 'lodash';
import { stateBet } from 'state-shared';
import { createPlayBookUtils } from 'utils-book';

import { bookEventHandlerMap } from './bookEventHandlerMap';
import { eventEmitter } from './eventEmitter';
import type { Bet, BookEvent, BookEventOfType } from './typesBookEvent';

export const { playBookEvent, playBookEvents } = createPlayBookUtils({ bookEventHandlerMap });

export const playBet = async (bet: Bet) => {
	stateBet.winBookEventAmount = 0;
	await playBookEvents(bet.state);
	eventEmitter.broadcast({ type: 'stopButtonEnable' });
};

export const convertToResumableBet = (betToResume: Bet): Bet => {
	const resumingIndex = Math.max(0, Number(betToResume.event ?? 0));
	const before = betToResume.state.filter((event) => event.index < resumingIndex);
	const after = betToResume.state.filter((event) => event.index >= resumingIndex);
	const lastReveal = _.findLast(before, (event) => event.type === 'reveal') as
		| BookEventOfType<'reveal'>
		| undefined;
	const lastTotalWin = _.findLast(before, (event) => event.type === 'setTotalWin') as
		| BookEventOfType<'setTotalWin'>
		| undefined;
	const lastFreeSpin = _.findLast(before, (event) => event.type === 'updateFreeSpin') as
		| BookEventOfType<'updateFreeSpin'>
		| undefined;
	const trigger = _.findLast(before, (event) => event.type === 'freeSpinTrigger') as
		| BookEventOfType<'freeSpinTrigger'>
		| undefined;
	const spinStartTotal = lastFreeSpin
		? ((
				_.findLast(
					before,
					(event) => event.type === 'setTotalWin' && event.index < lastFreeSpin.index,
				) as BookEventOfType<'setTotalWin'> | undefined
			)?.amount ?? 0)
		: 0;

	const snapshot: BookEventOfType<'restoreSnapshot'> = {
		index: -1,
		type: 'restoreSnapshot',
		board: lastReveal?.board,
		gridSize: lastReveal?.gridSize ?? trigger?.gridSize ?? 7,
		gameType: lastReveal?.gameType ?? trigger?.tier ?? 'basegame',
		totalWin: lastTotalWin?.amount ?? 0,
		spinStartTotal,
		freeSpinCurrent: lastFreeSpin ? Math.min(lastFreeSpin.amount + 1, lastFreeSpin.total) : 0,
		freeSpinTotal: lastFreeSpin?.total ?? trigger?.totalFs ?? 0,
		tier: lastFreeSpin?.tier ?? trigger?.tier ?? null,
	};

	return { ...betToResume, state: [snapshot, ...(after as BookEvent[])] };
};
