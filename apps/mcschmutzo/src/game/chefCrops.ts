// The chefs' overlay layers (bottle, arm, hand, brows, label) used to be FULL-FRAME canvases
// (1304×1699 / 1611×1912) that were mostly transparent — ~72 MB of decoded texture memory for a few
// small pieces. Each is now cropped to its visible bounds; this table says where the crop sits in the
// original frame ([x, y, w, h] as fractions of the frame), so every layer still lands exactly where
// it did. Pivots stay expressed in FRAME fractions and are converted here.
export const CHEF_CROPS = {
	mascotBottle: [0.05982, 0.37493, 0.38267, 0.40906],
	mascotHand: [0.58589, 0.54444, 0.40184, 0.26192],
	mascotBrows: [0.30445, 0.19188, 0.25537, 0.08476],
	mascotLabel: [0.51994, 0.60094, 0.19939, 0.08299],
	specialArm: [0.06642, 0.25105, 0.39106, 0.42207],
	specialHand: [0.63439, 0.54446, 0.36499, 0.26098],
	specialBrows: [0.38485, 0.20241, 0.22533, 0.07427],
} as const;
export type ChefCropKey = keyof typeof CHEF_CROPS;

/** AnimatedGuy `extras` entry for a cropped layer, with its pivot given in frame fractions. */
export const cropExtra = (key: ChefCropKey, pivot?: [number, number]) => {
	const [x, y, w, h] = CHEF_CROPS[key];
	return {
		key,
		nx: x,
		ny: y,
		nw: w,
		nh: h,
		...(pivot ? { px: (pivot[0] - x) / w, py: (pivot[1] - y) / h } : {}),
	};
};

/** Anchor + size factors for a cropped layer drawn as a Sprite pinned at a frame-fraction pivot. */
export const cropSprite = (key: ChefCropKey, pivX: number, pivY: number) => {
	const [x, y, w, h] = CHEF_CROPS[key];
	return { anchor: { x: (pivX - x) / w, y: (pivY - y) / h }, sw: w, sh: h };
};
