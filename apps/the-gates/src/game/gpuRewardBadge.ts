import type { Graphics } from 'pixi.js';
import type { rewardVisual } from './rewardVisual';

/** Distinct silhouettes retain the operation cue even without colour or motion. */
export function drawRewardBadge(
	graphics: Graphics,
	visual: ReturnType<typeof rewardVisual>,
	width: number,
	height: number,
) {
	graphics.clear();
	if (!visual.badge) return;
	const w = width / 2 + 18,
		h = height / 2 + 10;
	if (visual.badge === 'diamond')
		graphics.poly([-w - 16, 0, -w + 2, -h, w - 2, -h, w + 16, 0, w - 2, h, -w + 2, h]);
	else graphics.roundRect(-w, -h, w * 2, h * 2, 18);
	graphics
		.fill({ color: visual.background, alpha: 0.96 })
		.stroke({ color: visual.accent, width: 3 });
}
