import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../../../packages/utils-xstate/package.json', import.meta.url));
const { setup, createActor, fromPromise } = require('xstate');
const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const withoutImports = (source) => source.replace(/^import[\s\S]*?;\n/gm, '');
const shared = stripTypeScriptTypes(withoutImports(read('../../../packages/utils-xstate/src/createGameActor.ts')))
	.replace('export { createGameActor };', 'return createGameActor;');
const makeActor = new Function('setup', 'createActor', 'context', 'STATE_RENDERING', 'STATE_IDLE', 'STATE_BET', 'STATE_AUTOBET', 'STATE_RESUME_BET', shared)(
	setup, createActor, { bet: null, rawBet: null }, 'rendering', 'idle', 'bet', 'autoBet', 'resumeBet',
);
const source = read('../src/game/actor.ts');
const factoryBody = stripTypeScriptTypes(withoutImports(source))
	.replace('export function createGatesActor', 'function createGatesActor');

test('Gates remount owns a fresh actor and fresh primary state; resumed round is actionable', async () => {
	let primaryInstances = 0;
	let resumeCalls = 0;
	let release;
	const freshFactory = new Function('createPrimaryMachines', 'createIntermediateMachines', 'createGameActor',
		`${factoryBody}\nreturn createGatesActor;`)(
		() => ({ instance: ++primaryInstances }),
		() => ({
			bet: fromPromise(async () => {}),
			autoBet: fromPromise(async () => {}),
			resumeBet: fromPromise(async () => {
				resumeCalls++;
				await new Promise((resolve) => { release = resolve; });
			}),
		}), makeActor,
	);
	const first = freshFactory();
	first.start();
	first.send({ type: 'RENDERED' });
	assert.equal(first.getSnapshot().value, 'idle');
	first.stop();
	// XState stop is terminal: start() on the singleton would leave controls locked.
	first.start();
	assert.equal(first.getSnapshot().status, 'stopped');
	const next = freshFactory();
	assert.notEqual(first, next);
	assert.equal(primaryInstances, 2);
	let idle = false;
	const sub = next.subscribe((snapshot) => { idle = snapshot.value === 'idle'; });
	next.start();
	next.send({ type: 'RENDERED' });
	assert.equal(idle, true);
	next.send({ type: 'RESUME_BET' });
	assert.equal(idle, false); // genuine work still locks controls
	next.send({ type: 'RESUME_BET' });
	assert.equal(resumeCalls, 1); // no duplicate resume
	release();
	await new Promise((resolve) => setImmediate(resolve));
	assert.equal(idle, true);
	sub.unsubscribe();
	next.stop();
});

test('component creates its actor per instance and retains busy guards', () => {
	const game = read('../src/components/Game.svelte');
	assert.match(game, /const gameActor = createGatesActor\(\)/);
	assert.match(game, /subscription.unsubscribe\(\);\s*gameActor.stop\(\)/);
	assert.match(game, /const busy = \$derived\(!idle \|\| runtime.busy \|\| inFlight\)/);
	assert.doesNotMatch(source, /export const gameActor/);
});
