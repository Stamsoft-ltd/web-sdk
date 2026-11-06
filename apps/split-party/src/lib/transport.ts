// Same shared request functions used by Veggie Salad's Authenticate/actor.
import { requestAuthenticate, requestBet, requestEndRound, requestReplay } from 'rgs-requests';
import { MODES, parseRound, type Mode, type Round } from './model.ts';
const check = (d: any) => {
	if (!d || d.error || d.code?.startsWith?.('ERR'))
		throw Error(d?.message ?? d?.error?.message ?? 'RGS request failed');
	return d;
};
// The no-RGS visual preview (?demo=1) is for development only: a production build never plays
// without a valid rgs_url (Stake review 2026-11-06). Under the Node tests there is no Vite env.
const DEMO_ALLOWED = (import.meta as { env?: { PROD?: boolean } }).env?.PROD !== true;
export function launch(search: string) {
	const p = new URLSearchParams(search);
	return {
		sessionID: p.get('sessionID') ?? p.get('session_id') ?? '',
		rgsUrl: (p.get('rgs_url') ?? '').replace(/^https?:\/\//, '').replace(/\/$/, ''),
		lang: p.get('lang') ?? 'en',
		social: p.get('social') === 'true',
		demo: DEMO_ALLOWED && p.get('demo') === '1',
		replay: p.get('replay') === 'true',
		game: p.get('game') ?? '',
		version: p.get('version') ?? '',
		event: p.get('event') ?? '',
		mode: (p.get('mode') ?? 'base').toLowerCase() as Mode,
		amount: Number(p.get('amount') ?? 1000000),
		currency: p.get('currency') ?? 'USD',
		// Preview only: jurisdiction flags to switch on (e.g. displaySessionTimer,displayNetPosition),
		// so their UI can be checked without an RGS. Ignored outside demo.
		flags: (p.get('jurisdiction') ?? '').split(',').filter(Boolean),
	};
}
export type Launch = ReturnType<typeof launch>;
// A usable RGS address: a host name (or IP), optionally with a port and path, nothing else.
function validRgs(host: string) {
	if (!host || /[\s@?#\\]/.test(host)) return false;
	try {
		const { hostname } = new URL(`https://${host}`);
		return hostname === 'localhost' || /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(hostname);
	} catch {
		return false;
	}
}
/** Why a live launch can't run: no valid rgs_url, or no session. Null when it can (or in demo). */
export function launchProblem(q: Launch): 'rgs' | 'session' | null {
	if (q.demo) return null;
	if (!validRgs(q.rgsUrl)) return 'rgs';
	if (!q.replay && !q.sessionID) return 'session';
	return null;
}
export function createTransport(q: Launch) {
	let demoBalance = 10000;
	const cursor: Partial<Record<Mode, number>> = {};
	let pending: Round | null = null;
	return {
		async authenticate() {
			if (launchProblem(q)) throw Error('Invalid launch: missing or invalid rgs_url or session');
			if (q.demo)
				return {
					balance: { amount: demoBalance * 1e6, currency: q.social ? 'XGC' : 'USD' },
					config: {
						betLevels: [0.1, 0.2, 0.5, 1, 2, 5, 10].map((x) => x * 1e6),
						defaultBetLevel: 1e6,
						jurisdiction: Object.fromEntries(q.flags.map((f) => [f, true])),
					},
					round: pending,
				};
			return check(await requestAuthenticate({ ...q, language: q.lang }));
		},
		async replay() {
			if (launchProblem(q) || !q.game || !q.version || !q.event) throw Error('Incomplete replay launch');
			return parseRound(check(await requestReplay({ ...q, language: q.lang })), q.amount, q.mode);
		},
		async play(mode: Mode, amount: number, currency: string) {
			if (q.replay) throw Error('Wallet calls disabled in replay');
			if (q.demo) {
				if (pending) throw Error('Unfinished preview round');
				const response = await fetch(`${import.meta.env?.BASE_URL ?? '/'}fixtures/${mode}.json`);
				if (!response.ok) throw Error('Missing preview fixture');
				const books = (await response.json()).books;
				const b = books[(cursor[mode] ?? 0) % books.length];
				cursor[mode] = (cursor[mode] ?? 0) + 1;
				pending = parseRound(
					{ ...b, mode, amount: Math.round(amount * 1e6), active: true },
					Math.round(amount * 1e6),
					mode,
				);
				demoBalance -= amount * MODES[mode];
				return { round: pending, balance: { amount: Math.round(demoBalance * 1e6), currency } };
			}
			// Never a wallet request without a valid launch.
			if (launchProblem(q)) throw Error('Invalid launch: missing or invalid rgs_url or session');
			// requestBet accepts display base-bet amount and applies API 1e6 itself.
			return check(await requestBet({ ...q, mode, amount, currency }));
		},
		async end() {
			if (q.replay) throw Error('Wallet calls disabled in replay');
			if (q.demo) {
				if (pending) {
					demoBalance += ((pending.amount / 1e6) * pending.state.at(-1)!.amount) / 100;
					pending = null;
				}
				return {
					balance: { amount: Math.round(demoBalance * 1e6), currency: q.social ? 'XGC' : 'USD' },
				};
			}
			if (launchProblem(q)) throw Error('Invalid launch: missing or invalid rgs_url or session');
			return check(await requestEndRound(q));
		},
	};
}
