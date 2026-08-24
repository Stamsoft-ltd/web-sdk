import type { Bet } from '../../game/typesBookEvent';
export const loadBaseBooks = async () =>
	(await fetch('/fixtures/base-books.json').then((response) => response.json())) as Array<
		Bet & { events: Bet['state'] }
	>;
