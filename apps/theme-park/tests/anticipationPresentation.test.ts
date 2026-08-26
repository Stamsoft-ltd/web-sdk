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
		// The cap releases the REELS only. Clearing the flag on every reel tore the marquee off
		// whichever reel was still spinning, and the third scatter nearly always lands on the reel
		// before the last one — so the last reel's sign used to live ~150ms, under its own fade-in.
		expect(anticipations).not.toContain('for (const reel of context.stateGame.board)');
		expect(anticipations).toContain('if (anticipatingReels.has(reel)) continue');
		expect(anticipations).toContain('const GRID_CLEARANCE = 1.5');
		expect(anticipations).toContain('reel * CELL_W + GRID_CLEARANCE');
		expect(anticipations).toContain('CELL_W - GRID_CLEARANCE * 2');
		expect(anticipations).toContain('BOARD_SIZES.height - GRID_CLEARANCE * 2');
		expect(anticipations).not.toContain('.roundRect(');
		expect(anticipations).toContain('.fill(0x05000f)');
	});

	it('wraps the active reel in the bulb marquee, lit by the shared light layer', () => {
		const anticipation = source('Anticipation.svelte');
		expect(anticipation).toContain('key="anticipationFrame"');
		// The sign's height comes from the ART's aspect, never from the board: a frame stretched to
		// the board's height would draw every bulb on it as an oval.
		expect(anticipation).toContain('frameWidth / ANTICIPATION_ASPECT');
		expect(anticipation).toContain('<WinCardLights');
		expect(anticipation).toContain('places={ANTICIPATION_PLACES}');
		expect(anticipation).toContain('bulb={ANTICIPATION_BULB}');
		// The bespoke neon chase the marquee replaced.
		expect(anticipation).not.toContain('drawMotion');
		expect(anticipation).toContain(
			'if (context.stateGame.scatterCounter < MAX_SCATTERS) return false',
		);
		const scatterCapHandler = anticipation.slice(
			anticipation.indexOf('const stopAtScatterCap'),
			anticipation.indexOf('let fading = $state'),
		);
		expect(scatterCapHandler).not.toContain('props.reel.forceStop()');
		// The cap may stop a tease STARTING, never a tease already on screen: onMount is its only
		// caller. A live sign ends when its own reel lands, through the fade below.
		expect(anticipation.match(/stopAtScatterCap\(\)/g)).toHaveLength(1);
		expect(anticipation).toContain(
			"$effect(() => {\n\t\tif (props.reel.reelState.motion === 'stopped') fading = 'out';\n\t});",
		);
	});

	it('runs the chase around the frame rather than by angle about its centre', () => {
		const lights = source('WinCardLights.svelte');
		// A reel-high frame has nearly every bulb at some angle near straight up or straight down, so
		// the default ordering would light the two long rails as two lumps.
		expect(lights).toContain('const along = places?.[index] ??');
		expect(lights).toContain('phase: along * cycles + jitter');

		const table = fs.readFileSync(
			path.join(appRoot, 'src', 'game', 'anticipationFrame.ts'),
			'utf8',
		);
		expect(table).toContain('export const ANTICIPATION_PLACES');
		expect(table).toContain('export const ANTICIPATION_ASPECT');
		expect(table).toContain('export const ANTICIPATION_BULB');
	});
});
