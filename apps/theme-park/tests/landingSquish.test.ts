import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(appRoot, '..', '..');
const source = (relativePath: string) =>
	fs.readFileSync(path.join(appRoot, 'src', relativePath), 'utf8');
const sharedReel = fs.readFileSync(
	path.join(repoRoot, 'packages', 'utils-slots', 'src', 'createReelForSpinning.svelte.ts'),
	'utf8',
);

describe('Theme Park reel landing squash', () => {
	it('emits one reel-local landing token on normal, fast, turbo, and force-stop paths', () => {
		expect(sharedReel).toContain('landingSequence: 0');
		const normalLanding = sharedReel.slice(
			sharedReel.indexOf('const removePaddingAndBounceBack'),
			sharedReel.indexOf('const preSpinPadding'),
		);
		expect(normalLanding).toContain('reelState.landingSequence += 1');

		const forceLanding = sharedReel.slice(
			sharedReel.indexOf("if (forcedStopMode === 'snap')"),
			sharedReel.indexOf("if (forcedStopMode === 'settle')"),
		);
		expect(forceLanding).toContain('reelState.landingSequence += 1');

		const releaseStart = sharedReel.indexOf("if (forcedStopMode === 'settle')");
		const releaseEnd = sharedReel.indexOf(
			"reelState.motion = 'bouncing'",
			sharedReel.indexOf('pendingForcedStopMode = null;', releaseStart) + 1,
		);
		const releasedAnticipationLanding = sharedReel.slice(releaseStart, releaseEnd);
		expect(releasedAnticipationLanding).toContain('removePaddingAndBounceBack()');
	});

	it('starts every symbol squash from its own reel token at the physical bounce duration', () => {
		const board = source('components/Board.svelte');
		const squish = source('components/LandingSquish.svelte');
		expect(board).toContain(
			'trigger={showsReelImpact() ? reel.reelState.landingSequence : 0}',
		);
		expect(board).toContain('(CELL_H * options.reelBounceSizeMulti) / options.reelBounceBackSpeed');
		expect(board).not.toContain("reel.reelState.motion === 'bouncing'");
		expect(squish).toContain('if (trigger === seenTrigger) return');
		expect(squish).toContain('if (trigger > 0) void play()');
	});

	it('drops the whole landing impact in turbo and super turbo', () => {
		const impact = source('game/reelImpact.ts');
		expect(impact).toContain('!stateBet.isTurbo && !stateBet.isSuperTurbo');

		// All three parts of the impact — the board's jolt, the sparks, the squash — read the same
		// rule, so a mode can never get one of them without the others.
		const board = source('components/Board.svelte');
		expect(board).toContain("import { showsReelImpact } from '../game/reelImpact'");
		expect(board).toContain('if (!first && showsReelImpact()) {');

		const bursts = source('components/ReelLandBursts.svelte');
		expect(bursts).toContain("import { showsReelImpact } from '../game/reelImpact'");
		expect(bursts).toContain('if (!first && showsReelImpact()) elapsed[reel] = 0;');
	});
});
