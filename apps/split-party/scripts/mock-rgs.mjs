// Local development wallet ONLY. Outcomes cycle; not weighted simulation.
import http from 'node:http';
import fs from 'node:fs';
const port = Number(process.env.PORT ?? 4021);
const modes = { base: 1, feature: 50, normal: 100, super: 500, mystery: 500 };
const books = Object.fromEntries(
	Object.keys(modes).map((m) => [
		m,
		JSON.parse(fs.readFileSync(new URL(`../public/fixtures/${m}.json`, import.meta.url))).books,
	]),
);
const levels = [100000, 200000, 500000, 1000000, 2000000, 5000000, 10000000];
const sessions = new Map();
let failEnd = process.env.MOCK_FAIL_END === '1';
http
	.createServer(async (req, res) => {
		const origin = req.headers.origin ?? '';
		if (/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(origin))
			res.setHeader('Access-Control-Allow-Origin', origin);
		res.setHeader('Vary', 'Origin');
		res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
		res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
		res.setHeader('Content-Type', 'application/json');
		if (req.method === 'OPTIONS') {
			res.writeHead(204);
			res.end();
			return;
		}
		const send = (value, status = 200) => {
			res.writeHead(status);
			res.end(JSON.stringify(value));
		};
		try {
			const url = new URL(req.url, 'http://localhost');
			if (req.method === 'GET' && url.pathname.startsWith('/bet/replay/')) {
				const parts = url.pathname.split('/');
				const mode = parts[5];
				if (!books[mode]) throw Error('Unknown replay mode');
				const b = books[mode][Number(parts[6] ?? 0) % books[mode].length];
				send({ state: b.events, amount: 1000000, payout: b.payoutMultiplier * 10000, mode });
				return;
			}
			if (req.method !== 'POST') throw Error('POST required');
			let raw = '';
			for await (const chunk of req) {
				raw += chunk;
				if (raw.length > 10000) throw Error('Request too large');
			}
			const body = JSON.parse(raw || '{}');
			if (!body.sessionID) throw Error('sessionID required');
			if (!sessions.has(body.sessionID))
				sessions.set(body.sessionID, { balance: 10000000000, round: null, cursor: 0 });
			const s = sessions.get(body.sessionID);
			const balance = () => ({ amount: s.balance, currency: 'USD' });
			if (url.pathname === '/wallet/authenticate') {
				send({
					balance: balance(),
					config: {
						minBet: levels[0],
						maxBet: levels.at(-1),
						defaultBetLevel: 1000000,
						betLevels: levels,
						jurisdiction: {
							disabledTurbo: false,
							disabledAutoplay: false,
							disabledBuyFeature: false,
							minimumRoundDuration: 0,
						},
					},
					round: s.round,
				});
				return;
			}
			if (url.pathname === '/wallet/play') {
				if (s.round) throw Error('Active round: authenticate to resume');
				if (!levels.includes(body.amount)) throw Error('Invalid bet level');
				if (!(body.mode in modes)) throw Error('Unknown mode');
				const cost = body.amount * modes[body.mode];
				if (cost > s.balance) throw Error('Insufficient mock balance');
				const b = books[body.mode][s.cursor++ % books[body.mode].length];
				s.balance -= cost;
				s.round = {
					betID: s.cursor,
					amount: body.amount,
					active: true,
					mode: body.mode,
					state: b.events,
					payout: Math.round((body.amount * b.payoutMultiplier) / 100),
					payoutMultiplier: b.payoutMultiplier / 100,
				};
				send({ balance: balance(), round: s.round });
				return;
			}
			if (url.pathname === '/wallet/end-round') {
				if (failEnd) {
					failEnd = false;
					throw Error('Injected settlement failure. Retry recovery.');
				}
				if (s.round) {
					s.balance += s.round.payout;
					s.round = null;
				}
				send({ balance: balance() });
				return;
			}
			throw Error('Unknown mock route');
		} catch (e) {
			send({ error: { message: e.message } }, 400);
		}
	})
	.listen(port, '127.0.0.1', () =>
		console.log(
			`Local MOCK RGS: http://127.0.0.1:${port}\nhttp://127.0.0.1:3021/?rgs_url=127.0.0.1:${port}&sessionID=split-test&lang=en\nFixtures cycle. No real funds, no weighted RTP simulation.`,
		),
	);
