import type { paths } from './schema';
import { fetcher } from 'utils-fetcher';

type RgsErrorPayload = string | Record<string, unknown> | null;

const retryAfterMs = (response: Response) => {
	const value = response.headers.get('retry-after');
	if (!value) return null;
	const seconds = Number(value);
	if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
	const date = Date.parse(value);
	return Number.isFinite(date) ? Math.max(0, date - Date.now()) : null;
};

const readResponseBody = async (response: Response): Promise<unknown> => {
	const text = await response.text();
	if (!text) return null;
	try {
		return JSON.parse(text);
	} catch {
		return text;
	}
};

const payloadMessage = (payload: RgsErrorPayload) => {
	if (typeof payload === 'string') return payload;
	if (!payload) return '';
	const message = payload.message ?? payload.error;
	return typeof message === 'string' ? message : '';
};

export class RgsHttpError extends Error {
	readonly name = 'RgsHttpError';
	readonly error: string;
	readonly status: number;
	readonly statusText: string;
	readonly payload: RgsErrorPayload;
	readonly retryAfterMs: number | null;

	constructor(response: Response, payload: RgsErrorPayload) {
		const isRateLimited = response.status === 429;
		const waitMs = retryAfterMs(response);
		const waitText = waitMs
			? ` Try again in ${Math.max(1, Math.ceil(waitMs / 1000))} seconds.`
			: '';
		super(
			isRateLimited
				? `Too many requests. Please wait before trying again.${waitText}`
				: payloadMessage(payload) ||
						`RGS request failed with status ${response.status}${response.statusText ? ` ${response.statusText}` : ''}.`,
		);
		this.error = isRateLimited ? 'TOO_MANY_REQUESTS' : 'RGS_REQUEST_FAILED';
		this.status = response.status;
		this.statusText = response.statusText;
		this.payload = payload;
		this.retryAfterMs = waitMs;
	}
}

const readRgsResponse = async <TResponse>(response: Response): Promise<TResponse> => {
	const payload = await readResponseBody(response);
	if (!response.ok) {
		throw new RgsHttpError(response, payload as RgsErrorPayload);
	}
	return payload as TResponse;
};

// Local dev only: when the game itself runs on insecure localhost and targets a localhost RGS
// (the mock server), talk plain HTTP so the self-signed-cert interstitial isn't needed.
// Any non-localhost RGS always stays HTTPS.
const rgsProtocol = (rgsUrl: string) => {
	const isLocalRgs = /^(localhost|127\.0\.0\.1)([:/]|$)/.test(rgsUrl);
	const isInsecurePage = typeof window !== 'undefined' && window.location.protocol === 'http:';
	return isLocalRgs && isInsecurePage ? 'http' : 'https';
};

export const rgsFetcher = {
	post: async function post<
		T extends keyof paths,
		TResponse = paths[T]['post']['responses'][200]['content']['application/json'],
	>(options: {
		url: T;
		rgsUrl: string;
		variables?: paths[T]['post']['requestBody']['content']['application/json'];
	}): Promise<TResponse> {
		const response = await fetcher({
			method: 'POST',
			variables: options.variables,
			endpoint: `${rgsProtocol(options.rgsUrl)}://${options.rgsUrl}${options.url}`,
		});

		return readRgsResponse<TResponse>(response);
	},
	// The generated schema contains no GET operations (replay is the only GET consumer and isn't
	// in schema.ts yet), so this takes a plain string URL and an explicit response type.
	get: async function get<TResponse = unknown>(options: {
		url: string;
		rgsUrl: string;
	}): Promise<TResponse> {
		const response = await fetcher({
			method: 'GET',
			endpoint: `${rgsProtocol(options.rgsUrl)}://${options.rgsUrl}${options.url}`,
		});

		return readRgsResponse<TResponse>(response);
	},
};
