import { afterEach, describe, expect, it, vi } from 'vitest';

import { RgsHttpError, rgsFetcher } from '../../../packages/rgs-fetcher/src/rgsFetcher';

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('RGS HTTP errors', () => {
	it('turns a plain-text 429 into a readable rate-limit error', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue(
				new Response('Too Many Requests', {
					status: 429,
					headers: { 'Retry-After': '2' },
				}),
			),
		);

		const request = rgsFetcher.get({
			rgsUrl: 'rgs.example.test',
			url: '/wallet/play',
		});

		await expect(request).rejects.toMatchObject({
			name: 'RgsHttpError',
			error: 'TOO_MANY_REQUESTS',
			status: 429,
			retryAfterMs: 2000,
			payload: 'Too Many Requests',
		});
		await expect(request).rejects.toBeInstanceOf(RgsHttpError);
		await expect(request).rejects.toThrow('Too many requests. Please wait before trying again.');
	});

	it('keeps a JSON server error readable without leaking a JSON parse failure', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue(
				new Response(JSON.stringify({ message: 'Player has active bet' }), {
					status: 400,
					headers: { 'Content-Type': 'application/json' },
				}),
			),
		);

		await expect(
			rgsFetcher.get({ rgsUrl: 'rgs.example.test', url: '/wallet/play' }),
		).rejects.toThrow('Player has active bet');
	});
});
