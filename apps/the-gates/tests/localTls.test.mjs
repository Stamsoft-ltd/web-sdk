import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { X509Certificate } from 'node:crypto';
import { localDevServer, localTls } from '../tools/local-tls.mjs';

test('HTTP development and production builds do not load TLS files', () => {
	assert.equal(localDevServer('serve', {}), undefined);
	assert.equal(
		localDevServer('build', {
			GATES_HTTPS: '1',
			GATES_TLS_CERT: '/missing/cert',
			GATES_TLS_KEY: '/missing/key',
		}),
		undefined,
	);
});
test('HTTPS uses existing localhost certificate on a strict loopback-only server', () => {
	const server = localDevServer('serve', { GATES_HTTPS: '1' });
	assert.equal(server.host, 'localhost');
	assert.equal(server.port, 3020);
	assert.equal(server.strictPort, true);
	assert.ok(Buffer.isBuffer(server.https.key));
	const certificate = new X509Certificate(server.https.cert);
	assert.equal(certificate.checkHost('localhost'), 'localhost');
	assert.equal(certificate.checkIP('127.0.0.1'), '127.0.0.1');
});
test('incomplete, missing or invalid custom certificate pairs fail instead of downgrading', () => {
	assert.throws(() => localTls({ GATES_HTTPS: '1', GATES_TLS_CERT: '/missing/cert' }), /both/);
	assert.throws(() => localTls({ GATES_HTTPS: '1', GATES_TLS_KEY: '/missing/key' }), /both/);
	assert.throws(
		() =>
			localTls({
				GATES_HTTPS: '1',
				GATES_TLS_CERT: '/missing/cert',
				GATES_TLS_KEY: '/missing/key',
			}),
		/ENOENT/,
	);
	const notACertificate = new URL('../package.json', import.meta.url);
	assert.throws(() =>
		localTls({
			GATES_HTTPS: '1',
			GATES_TLS_CERT: notACertificate,
			GATES_TLS_KEY: notACertificate,
		}),
	);
});
test('secure command is app-local; assets stay relative and no mixed-content bypass is installed', () => {
	const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
	const scripts = JSON.parse(read('package.json')).scripts;
	assert.match(scripts['dev:https'], /GATES_HTTPS=1/);
	assert.match(scripts['dev:https'], /--host localhost.*--strictPort/);
	assert.doesNotMatch(read('src/game/art.ts'), /https?:\/\//);
	assert.doesNotMatch(read('src/app.html'), /upgrade-insecure-requests|block-all-mixed-content/);
	assert.doesNotMatch(
		read('tools/local-tls.mjs'),
		/rejectUnauthorized|NODE_TLS_REJECT_UNAUTHORIZED/,
	);
});
