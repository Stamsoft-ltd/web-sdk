import { readFileSync } from 'node:fs';
import { createSecureContext } from 'node:tls';

/** Opt-in local TLS only. Never loaded by production builds. No trust-store changes. */
export function localTls(env = process.env) {
	if (env.GATES_HTTPS !== '1') return undefined;
	if (Boolean(env.GATES_TLS_CERT) !== Boolean(env.GATES_TLS_KEY)) {
		throw new Error('Set both GATES_TLS_CERT and GATES_TLS_KEY, or neither.');
	}
	const cert = readFileSync(
		env.GATES_TLS_CERT || new URL('../../../mock-rgs/certs/localhost-cert.pem', import.meta.url),
	);
	const key = readFileSync(
		env.GATES_TLS_KEY || new URL('../../../mock-rgs/certs/localhost-key.pem', import.meta.url),
	);
	// Validate the pair before opening the server; do not fall back to HTTP on errors.
	createSecureContext({ cert, key });
	return { cert, key };
}

export function localDevServer(command, env = process.env) {
	if (command !== 'serve') return undefined;
	const https = localTls(env);
	return https ? { host: 'localhost', port: 3020, strictPort: true, https } : undefined;
}
