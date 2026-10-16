// @ts-ignore
import config from 'config-vite';
import { localDevServer } from './tools/local-tls.mjs';

export default ({ command }) => {
	const shared = config();
	// Gates supplies its own art/metadata. Do not ship other templates' remote asset defaults.
	shared.plugins = [
		...(shared.plugins ?? []),
		{
			name: 'gates-local-template-assets',
			enforce: 'pre',
			transform(code, id) {
				if (!id.replaceAll('\\', '/').endsWith('/packages/state-shared/src/constants.ts')) return;
				return { code: code.replace(/(['"])https?:\/\/[^'"\s]+\1/g, "''"), map: null };
			},
		},
	];
	const server = localDevServer(command);
	return server ? { ...shared, server: { ...shared.server, ...server } } : shared;
};
