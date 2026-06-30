export const LEVEL_PARTICLE_COIN_MAP = {
	zero: null,
	standard: null,
	small: null,
	nice: null,
	// Level 5 — light drizzle, narrow strip
	substantial: {
		speedOption: {
			list: [
				{ value: 300, time: 0 },
				{ value: 420, time: 0 },
			],
		},
		frequency: 0.18,
		emitterLifetime: -1,
		spawnOption: { type: 'rect', spawnRect: { x: -150, y: 0, w: 300, h: 0 } },
	},
	// SWEET WIN — gentle shower
	big: {
		speedOption: {
			list: [
				{ value: 600, time: 0 },
				{ value: 700, time: 0 },
			],
		},
		frequency: 0.11,
		emitterLifetime: -1,
		spawnOption: { type: 'rect', spawnRect: { x: -180, y: 0, w: 360, h: 0 } },
	},
	// WILD WIN — steady shower, wider
	superwin: {
		speedOption: {
			list: [
				{ value: 700, time: 0 },
				{ value: 820, time: 0 },
			],
		},
		frequency: 0.075,
		emitterLifetime: -1,
		spawnOption: { type: 'rect', spawnRect: { x: -230, y: 0, w: 460, h: 0 } },
	},
	// EPIC WIN — heavy rain, broad spread
	mega: {
		speedOption: {
			list: [
				{ value: 820, time: 0 },
				{ value: 960, time: 0 },
			],
		},
		frequency: 0.048,
		emitterLifetime: -1,
		spawnOption: { type: 'rect', spawnRect: { x: -290, y: 0, w: 580, h: 0 } },
	},
	// MYTHIC WIN — coin storm
	epic: {
		speedOption: {
			list: [
				{ value: 960, time: 0 },
				{ value: 1100, time: 0 },
			],
		},
		frequency: 0.030,
		emitterLifetime: -1,
		spawnOption: { type: 'rect', spawnRect: { x: -360, y: 0, w: 720, h: 0 } },
	},
	// LEGENDARY WIN — coin explosion
	max: {
		speedOption: {
			list: [
				{ value: 1100, time: 0 },
				{ value: 1280, time: 0 },
			],
		},
		frequency: 0.018,
		emitterLifetime: -1,
		spawnOption: { type: 'rect', spawnRect: { x: -440, y: 0, w: 880, h: 0 } },
	},
} as const;

export const LEVEL_PARTICLE_COIN_MAP_BURST = {
	standard: null,
	small: null,
	nice: null,
	substantial: {
		speedOption: {
			list: [
				{ value: 450, time: 0 },
				{ value: 550, time: 0 },
			],
		},
		frequency: 0.0625,
		emitterLifetime: 1,
		scaleOption: { list: [{ value: 0.35 }, { value: 0.35 }] },
		spawnOption: { type: 'rect', spawnRect: { x: -150, y: 0, w: 300, h: 0 } },
	},
	big: {
		speedOption: {
			list: [
				{ value: 700, time: 0 },
				{ value: 750, time: 0 },
			],
		},
		frequency: 0.045,
		emitterLifetime: 1,
		scaleOption: { list: [{ value: 0.35 }, { value: 0.35 }] },
		spawnOption: { type: 'rect', spawnRect: { x: -150, y: 0, w: 300, h: 0 } },
	},
	superwin: {
		speedOption: {
			list: [
				{ value: 800, time: 0 },
				{ value: 850, time: 0 },
			],
		},
		frequency: 0.0375,
		emitterLifetime: 1,
		scaleOption: { list: [{ value: 0.35 }, { value: 0.35 }] },
		spawnOption: { type: 'rect', spawnRect: { x: -150, y: 0, w: 300, h: 0 } },
	},
	mega: {
		speedOption: {
			list: [
				{ value: 900, time: 0 },
				{ value: 950, time: 0 },
			],
		},
		frequency: 0.03,
		emitterLifetime: 1,
		scaleOption: { list: [{ value: 0.35 }, { value: 0.35 }] },
		spawnOption: { type: 'rect', spawnRect: { x: -200, y: 0, w: 400, h: 0 } },
	},
	epic: {
		speedOption: {
			list: [
				{ value: 1000, time: 0 },
				{ value: 1100, time: 0 },
			],
		},
		frequency: 0.0275,
		emitterLifetime: 1,
		scaleOption: { list: [{ value: 0.35 }, { value: 0.35 }] },
		spawnOption: { type: 'rect', spawnRect: { x: -200, y: 0, w: 400, h: 0 } },
	},
	max: {
		speedOption: {
			list: [
				{ value: 1150, time: 0 },
				{ value: 1250, time: 0 },
			],
		},
		frequency: 0.02,
		emitterLifetime: 1,
		scaleOption: { list: [{ value: 0.35 }, { value: 0.35 }] },
		spawnOption: { type: 'rect', spawnRect: { x: -225, y: 0, w: 450, h: 0 } },
	},
} as const;
