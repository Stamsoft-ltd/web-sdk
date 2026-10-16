import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const src = (file) => readFileSync(new URL('../src/' + file, import.meta.url), 'utf8');
test('rules navigation uses sharp vector arrows, reverses next, keeps keyboard paging', () => {
	const ui = src('components/Rules.svelte');
	assert.match(ui, /<RulesArrow/);
	assert.doesNotMatch(ui, /rules-arrow.png/);
	assert.match(src('components/RulesArrow.svelte'), /transform: rotate\(180deg\)/);
	assert.match(ui, /event.key === 'ArrowRight'/);
	assert.match(ui, /content.scrollTop = 0/);
});
test('native rules cards hold aspect and fit bold copy without scrolling', () => {
	const ui = src('components/Rules.svelte'),
		css = src('figma.css');
	assert.match(ui, /aspect-ratio: 1121 \/ 922;\s*min-height: 0;\s*overflow: hidden/);
	assert.match(ui, /aspect-ratio: 320 \/ 480/);
	assert.match(ui, /aspect-ratio: 565 \/ 480/);
	assert.match(ui, /\.native-cards \.card-copy\s*\{[^}]*min-height: 0;[^}]*overflow: hidden/);
	assert.match(ui, /\.general-copy\s*\{[^}]*min-height: 0;[^}]*overflow: hidden/);
	assert.match(css, /\.cartoon-modal.rules \.rules-cards p\s*\{[^}]*font-weight: 800/);
	assert.match(ui, /aria-label=\{t\('LEGAL NOTICE'\)\}/);
});
test('legal frame uses original nine-sliced artwork, without stretching corner pixels', () => {
	const frame = src('components/RulesFrame.svelte');
	assert.match(frame, /d883a.png/);
	assert.match(frame, /grid-template-columns: 26px minmax\(0, 1fr\) 26px/);
	const xs = [99, 199, 1120],
		ys = [135, 235, 957],
		widths = [100, 921, 100],
		heights = [100, 722, 100];
	assert.equal(xs[0] + widths.reduce((a, b) => a + b), 1220);
	assert.equal(ys[0] + heights.reduce((a, b) => a + b), 1057);
	for (let i = 1; i < 3; i++) {
		assert.equal(xs[i - 1] + widths[i - 1], xs[i]);
		assert.equal(ys[i - 1] + heights[i - 1], ys[i]);
	}
});

test('updated info copy is separate from modal copy and matches v7.1 Key accounting', async () => {
	const { rulesCopy } = await import('../src/i18n/rulesCopy.ts');
	const { RULE_OVERVIEW, RULE_FEATURES, RULE_WIN_METHODS, RULE_BUYS, RULE_BUY_INFO } = await import(
		'../src/game/rulesPages.ts'
	);
	for (const item of [
		...RULE_OVERVIEW,
		...RULE_FEATURES,
		...RULE_WIN_METHODS,
		...RULE_BUYS.map((mode) => RULE_BUY_INFO[mode]),
	]) {
		assert.ok(rulesCopy[item.title]);
		assert.ok(rulesCopy[item.copy]);
	}
	assert.match(
		rulesCopy['INFO BONUS TRIGGERS COPY'],
		/3 Keys award 2×.*4 Keys award 10×.*5 or more Keys award 50×/,
	);
	assert.match(rulesCopy['INFO BONUS TRIGGERS COPY'], /not multiplied by Gates/);
	assert.match(rulesCopy['INFO MYSTERY BONUS BUY COPY'], /65%.*30%.*5%/);
	assert.match(rulesCopy['INFO MAX WIN COPY'], /selected base bet/);
	const ui = src('components/Rules.svelte');
	assert.match(ui, /overview.slice\(start, start \+ capacity\) as item/);
	assert.match(ui, /t\(RULE_BUY_INFO\[mode\].copy\)/);
});

test('rules scroll small viewports without subpages and contain no development claims', () => {
	const ui = src('components/Rules.svelte');
	assert.doesNotMatch(ui, /t\('(?:TARGET RTP|UNVALIDATED)'\)/);
	assert.match(ui, /use:measure/);
	assert.doesNotMatch(ui, /activeSheet|let sheet/);
	assert.match(ui, /class:scrollable/);
	assert.match(ui, /overflow-y: auto/);
	assert.match(ui, /const capacity = \$derived\(itemCount\)/);
	assert.match(ui, /observer.disconnect\(\)/);
	assert.match(ui, /node.scrollHeight > node.clientHeight/);
});
