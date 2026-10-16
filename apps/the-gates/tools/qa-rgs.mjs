/** Local-only deterministic QA fixture. NOT an RGS implementation, math engine or wallet.
 * Run: node --experimental-strip-types tools/qa-rgs.mjs
 * Only accepts the public gates-qa-* sessions below; never paste a real session here.
 */
import http from 'node:http';
import { displayBoard } from '../src/game/preview.ts';
const sessions = new Map();
const accepted = new Set(['gates-qa-kwd', 'gates-qa-social', 'gates-qa-resume']);
const events = [
	{
		type: 'spinStart',
		spinId: 1,
		gameType: 'basegame',
		tier: null,
		freeSpin: 0,
		multiplier: 1,
		multiplierActive: false,
		stickyPositions: [],
	},
	{
		type: 'reveal',
		spinId: 1,
		cascadeIndex: 0,
		gameType: 'basegame',
		board: displayBoard(),
		movements: [],
	},
	{ type: 'setTotalWin', amount: 50 },
	{ type: 'setWin', amount: 50 },
	{ type: 'finalWin', amount: 50 },
].map((event, index) => ({ ...event, index }));
const send = (res, status, body) => {
	res.writeHead(status, { 'content-type': 'application/json' });
	res.end(JSON.stringify(body));
};
const server = http.createServer(async (req, res) => {
	const origin = req.headers.origin;
	if (origin && !/^http:\/\/(localhost|127\.0\.0\.1):3020$/.test(origin))
		return send(res, 403, { error: 'Local QA origin only' });
	if (origin) res.setHeader('access-control-allow-origin', origin);
	res.setHeader('access-control-allow-methods', 'POST,GET,OPTIONS');
	res.setHeader('access-control-allow-headers', 'content-type');
	if (req.method === 'OPTIONS') {
		res.writeHead(204);
		return res.end();
	}
	if (req.method === 'GET' && req.url === '/qa')
		return send(res, 200, Object.fromEntries(sessions));
	if (req.method !== 'POST') return send(res, 404, { error: 'Unknown fixture endpoint' });
	let body;
	try {
		let raw = '';
		for await (const chunk of req) {
			raw += chunk;
			if (raw.length > 4096) throw Error();
		}
		body = JSON.parse(raw);
	} catch {
		return send(res, 400, { error: 'Invalid fixture request' });
	}
	if (!accepted.has(body.sessionID))
		return send(res, 403, {
			error: 'Public QA fixture session required; real sessions are forbidden',
		});
	const id = body.sessionID;
	if (!sessions.has(id)) sessions.set(id, { balance: 123456789000, requests: [], round: null });
	const session = sessions.get(id),
		currency = id.endsWith('social') ? 'XSC' : 'KWD';
	session.requests.push({ path: req.url, ...body });
	const balance = () => ({ amount: session.balance, currency });
	const round = (amount = 25000) => ({
		betID: 7001,
		amount,
		payout: Math.round(amount / 2),
		payoutMultiplier: 0.5,
		active: true,
		mode: 'BASE',
		event: null,
		state: events,
	});
	if (req.url === '/wallet/authenticate')
		return send(res, 200, {
			balance: balance(),
			config: {
				minBet: 10000,
				maxBet: 1000000,
				stepBet: 1000,
				defaultBetLevel: 25000,
				betLevels: [10000, 25000, 100000, 1000000],
				jurisdiction: {
					socialCasino: currency === 'XSC',
					disabledAutoplay: true,
					disabledTurbo: true,
					disabledBuyFeature: currency === 'XSC',
					minimumRoundDuration: 0.2,
				},
			},
			round: id.endsWith('resume') ? (session.round ??= round()) : null,
		});
	if (req.url === '/wallet/play') {
		if (
			body.mode !== 'BASE' ||
			body.currency !== currency ||
			![10000, 25000, 100000, 1000000].includes(body.amount)
		)
			return send(res, 400, { error: 'Fixture received non-authenticated level/currency/mode' });
		if (session.round) return send(res, 409, { error: 'Fixture round already active' });
		session.round = round(body.amount);
		session.balance -= body.amount;
		return send(res, 200, { balance: balance(), round: session.round });
	}
	if (req.url === '/bet/event') return send(res, 200, { event: body.event });
	if (req.url === '/wallet/end-round') {
		if (session.round) {
			session.balance += session.round.payout;
			session.round = null;
		}
		return send(res, 200, { balance: balance() });
	}
	return send(res, 404, { error: 'Unknown fixture endpoint' });
});
server.listen(3044, '127.0.0.1', () =>
	console.log('Gates QA fixture: http://127.0.0.1:3044 (public test sessions only)'),
);
for (const signal of ['SIGINT', 'SIGTERM'])
	process.on(signal, () => server.close(() => process.exit(0)));
