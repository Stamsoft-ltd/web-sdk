import { PUBLIC_CHROMATIC } from 'envs';
import { stateUrlDerived } from 'state-shared';
import { requestEndEvent } from 'rgs-requests';

import type { BaseBookEvent } from './types';

export function recordBookEvent<TBookEvent extends BaseBookEvent>({
	bookEvent,
}: {
	bookEvent: TBookEvent;
}) {
	if (PUBLIC_CHROMATIC || stateUrlDerived.replay()) {
		console.log('mock request end-event:', { index: bookEvent.index, type: bookEvent.type });
		return;
	}

	// Fire-and-forget by design (the reveal must not block on the network), but the
	// rejection has to be caught here — a try/catch around an un-awaited async call
	// only covers synchronous throws and leaves failures as unhandled rejections.
	requestEndEvent({
		eventIndex: bookEvent.index,
		rgsUrl: stateUrlDerived.rgsUrl(),
		sessionID: stateUrlDerived.sessionID(),
	}).catch((error) =>
		console.error('end-event confirmation failed', { index: bookEvent.index, error }),
	);
}

export function checkIsMultipleRevealEvents<TBookEvent extends BaseBookEvent>({
	bookEvents,
}: {
	bookEvents: TBookEvent[];
}) {
	const revealEventCount = bookEvents.filter((bookEvent) => bookEvent.type === 'reveal').length;
	const isMultipleReveals = revealEventCount > 1;
	return isMultipleReveals;
}
