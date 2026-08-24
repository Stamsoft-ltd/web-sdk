import type { Bet } from '../../game/typesBookEvent';
export const loadBonusBooks = async () =>
	(await fetch('/fixtures/bonus-books.json').then((response) => response.json())) as Array<
		Bet & { events: Bet['state'] }
	>;
