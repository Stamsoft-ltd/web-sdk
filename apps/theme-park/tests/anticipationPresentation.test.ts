import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = (name: string) =>
	fs.readFileSync(path.join(appRoot, 'src', 'components', name), 'utf8');

describe('Theme Park anticipation presentation', () => {
	it('darkens every non-anticipating reel without covering the authored grid', () => {
		const anticipations = source('Anticipations.svelte');
		expect(anticipations).toContain('const anticipatingReels = $derived(');
		expect(anticipations).toContain('const DIM_ALPHA = 0.34');
		expect(anticipations).toContain('alpha={DIM_ALPHA}');
		expect(anticipations).toContain('const MAX_SCATTERS = 3');
		expect(anticipations).toContain('context.stateGame.scatterCounter < MAX_SCATTERS');
		expect(anticipations).toContain('reel.releaseAnticipation()');
		expect(anticipations).toContain('const NORMAL_POST_CAP_SPIN_MS = 420');
		expect(anticipations).toContain('postCapSpinMs + SPIN_OPTIONS_DEFAULT.reelSpinDelay * index');
		expect(anticipations).toContain('reel.reelState.anticipating = false');
		expect(anticipations).toContain('if (anticipatingReels.has(reel)) continue');
		expect(anticipations).toContain('const GRID_CLEARANCE = 1.5');
		expect(anticipations).toContain('reel * CELL_W + GRID_CLEARANCE');
		expect(anticipations).toContain('CELL_W - GRID_CLEARANCE * 2');
		expect(anticipations).toContain('BOARD_SIZES.height - GRID_CLEARANCE * 2');
		expect(anticipations).not.toContain('.roundRect(');
		expect(anticipations).toContain('.fill(0x05000f)');
	});

	it('wraps the active reel in an animated four-sided Theme Park marquee', () => {
		const anticipation = source('Anticipation.svelte');
		expect(anticipation).toContain('const CHASE_SPEED = 0.075');
		expect(anticipation).toContain('const drawMotion = $derived.by');
		expect(anticipation).toContain('key="anticipationFrame"');
		expect(anticipation).toContain('height={baseHeight * board.boardScale}');
		expect(anticipation).toContain('Bright bulbs chase around all four sides');
		expect(anticipation).toContain('blendMode="add"');
		expect(anticipation).toContain(
			'if (context.stateGame.scatterCounter < MAX_SCATTERS) return false',
		);
		const scatterCapHandler = anticipation.slice(
			anticipation.indexOf('const stopAtScatterCap'),
			anticipation.indexOf('let fading = $state'),
		);
		expect(scatterCapHandler).not.toContain('props.reel.forceStop()');
	});
});
