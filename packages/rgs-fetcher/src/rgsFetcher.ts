import type { paths } from './schema';
import { fetcher } from 'utils-fetcher';
import { normalizeRgsUrl } from './rgsUrl';

/** Bound network + body reads. Never retry wallet mutations automatically. */
async function request(rgsUrl: string, url: string, method: 'POST' | 'GET', variables?: object) {
	const endpoint = normalizeRgsUrl(
		rgsUrl,
		typeof window !== 'undefined' && window.location.protocol === 'http:',
	);
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), 20_000);
	try {
		const response = await fetcher({
			method,
			variables,
			endpoint: `${endpoint}${url}`,
			signal: controller.signal,
		});
		const data = await response.json();
		if (!response.ok || data?.error) throw data?.error ? data : { error: 'ERR_GEN' };
		return data;
	} finally {
		clearTimeout(timer);
	}
}
export const rgsFetcher = {
	post: async function post<
		T extends keyof paths,
		TResponse = paths[T]['post']['responses'][200]['content']['application/json'],
	>(options: {
		url: T;
		rgsUrl: string;
		variables?: paths[T]['post']['requestBody']['content']['application/json'];
	}): Promise<TResponse> {
		return (await request(options.rgsUrl, options.url, 'POST', options.variables)) as TResponse;
	},
	get: async function get<TResponse = unknown>(options: {
		url: string;
		rgsUrl: string;
	}): Promise<TResponse> {
		return (await request(options.rgsUrl, options.url, 'GET')) as TResponse;
	},
};
