import type { paths } from './schema';
import { fetcher } from 'utils-fetcher';

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

		if (response.status !== 200) console.error('error', response);
		const data = await response.json();
		return data as TResponse;
	},
	get: async function get<
		T extends keyof paths,
		TResponse = paths[T]['get']['responses'][200]['content']['application/json'],
	>(options: { url: T; rgsUrl: string }): Promise<TResponse> {
		const response = await fetcher({
			method: 'GET',
			endpoint: `${rgsProtocol(options.rgsUrl)}://${options.rgsUrl}${options.url}`,
		});

		if (response.status !== 200) console.error('error', response);
		const data = await response.json();
		return data as TResponse;
	},
};
