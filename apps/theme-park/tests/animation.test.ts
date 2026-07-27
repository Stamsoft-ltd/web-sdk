import { describe, expect, it, vi } from 'vitest';

import { advance } from '../src/game/sceneAnimation';

describe('scene animation clock', () => {
	it('advances playing animated sprites in frame units', () => {
		const update = vi.fn();
		advance(
			{
				gotoAndStop: () => {},
				playing: true,
				textures: [{ length: 1 }],
				update,
			},
			1.5,
			0.025,
		);
		expect(update).toHaveBeenCalledWith({ deltaTime: 1.5 });
	});

	it('does not advance stopped animated sprites', () => {
		const update = vi.fn();
		advance(
			{
				gotoAndStop: () => {},
				playing: false,
				textures: [{ length: 1 }],
				update,
			},
			1,
			1 / 60,
		);
		expect(update).not.toHaveBeenCalled();
	});

	it('advances Spine nodes in seconds and walks children', () => {
		const update = vi.fn();
		advance({ children: [{ skeleton: {}, state: {}, update }] }, 2, 1 / 30);
		expect(update).toHaveBeenCalledWith(1 / 30);
	});

	it('contains a bad node without stopping siblings', () => {
		const siblingUpdate = vi.fn();
		advance(
			{
				children: [
					{
						gotoAndStop: () => {},
						playing: true,
						textures: [{ length: 1 }],
						update: () => {
							throw new Error('bad frame');
						},
					},
					{ skeleton: {}, state: {}, update: siblingUpdate },
				],
			},
			1,
			1 / 60,
		);
		expect(siblingUpdate).toHaveBeenCalledOnce();
	});
});
