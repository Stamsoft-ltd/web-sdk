import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buttonLabelLayout } from '../src/game/buttonLabel.ts';
const measure = (text) => text.length * 10;

test('return to base uses two readable lines, not overflowing one long line', () => {
	const label = buttonLabelLayout('Return to base', measure, 68);
	assert.equal(label.text, 'Return\nto base');
	assert.ok(Math.max(...label.text.split('\n').map(measure)) * label.scale <= 68 * 0.94 + 1e-9);
});
test('short captions stay full-size and long localized captions fit without ellipsis', () => {
	assert.deepEqual(buttonLabelLayout('Buy', measure, 100), { text: 'Buy', scale: 1 });
	for (const text of [
		'Return to base',
		'Върни се в основната игра',
		'Продължи',
		'Replay event',
		'Paytable & rules',
	]) {
		for (const width of [44, 56, 120, 168]) {
			const label = buttonLabelLayout(text, measure, width);
			assert.ok(label.text.split('\n').length <= 2);
			assert.equal(label.text.replace(/\s+/g, ' '), text);
			assert.ok(label.scale > 0 && label.scale <= 1);
			assert.ok(
				Math.max(...label.text.split('\n').map(measure)) * label.scale <= width * 0.94 + 1e-9,
			);
		}
	}
});
test('explicit one-line labels fit without adding a line', () => {
	const label = buttonLabelLayout('Return to base', measure, 68, 1);
	assert.equal(label.text, 'Return to base');
	assert.ok(label.scale < 1);
});
test('Non-buy text buttons retain fitted labels after restoring the authored buy menu', () => {
	for (const name of ['Game', 'ReplaySummary']) {
		const source = readFileSync(
			new URL(`../src/components/${name}.svelte`, import.meta.url),
			'utf8',
		);
		assert.match(source, /ButtonLabel/);
	}
	const css = readFileSync(new URL('../src/figma.css', import.meta.url), 'utf8');
	assert.match(css, /width: max\(100%, calc\(44px \/ var\(--stage-scale, 1\)\)\)/);
	assert.match(css, /\.feature-button\.return-to-base > span/);
});
