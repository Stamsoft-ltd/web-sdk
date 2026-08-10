// Emissive machine elements in each room background, so Background.svelte can LIGHT them instead
// of leaving the room a still photograph (the Stake review's "low quality resources" is partly
// that nothing in the scene moves between spins).
//
// The art has these lamps painted flat and blurred, so they were located by measurement, not by
// eye: scratchpad/audit/measure_bg_lights.py keys pixels that are LOCALLY brighter than the
// blurred room around them (a hue key fails — the bonus/super rooms are tinted end to end, so the
// whole frame comes back as one blob) and prints the surviving blobs as fractions of the sprite.
// Colours are each blob's own mean, pushed to full saturation so the glow reads as the lamp's
// light rather than grey-blue.
export type BackgroundLight = { cx: number; cy: number; w: number; h: number; color: number };

export const BACKGROUND_LIGHTS: Record<string, BackgroundLight[]> = {
	bgBase: [
		{ cx: 0.8451, cy: 0.2726, w: 0.0861, h: 0.1498, color: 0xdad0ff },
		{ cx: 0.9016, cy: 0.5329, w: 0.1178, h: 0.1711, color: 0x7cafff },
		{ cx: 0.8206, cy: 0.4245, w: 0.1029, h: 0.1265, color: 0xf0f8ff },
		{ cx: 0.0449, cy: 0.3836, w: 0.0538, h: 0.1849, color: 0x80d0ff },
		{ cx: 0.1074, cy: 0.3794, w: 0.0317, h: 0.1998, color: 0x9bd6fe },
		{ cx: 0.174, cy: 0.2604, w: 0.0419, h: 0.1615, color: 0xc8dcff },
		{ cx: 0.2383, cy: 0.3932, w: 0.0425, h: 0.1211, color: 0xc7dcff },
		{ cx: 0.6956, cy: 0.433, w: 0.0335, h: 0.1307, color: 0xc7dcff },
	],
	bgBonus: [
		{ cx: 0.0858, cy: 0.3464, w: 0.0496, h: 0.2125, color: 0xaf2aff },
		{ cx: 0.948, cy: 0.3092, w: 0.049, h: 0.1913, color: 0xa129ff },
		{ cx: 0.8322, cy: 0.3964, w: 0.0939, h: 0.1296, color: 0xef7eff },
		{ cx: 0.0517, cy: 0.3587, w: 0.0353, h: 0.1838, color: 0x9913ff },
		{ cx: 0.7925, cy: 0.6132, w: 0.1148, h: 0.0659, color: 0xa73eff },
		{ cx: 0.8837, cy: 0.2827, w: 0.0425, h: 0.0808, color: 0x6925ff },
		{ cx: 0.9357, cy: 0.5085, w: 0.0843, h: 0.1201, color: 0x612afe },
		{ cx: 0.1627, cy: 0.212, w: 0.0335, h: 0.1307, color: 0xad3eff },
	],
	bgSuper: [
		{ cx: 0.0786, cy: 0.3438, w: 0.0855, h: 0.2221, color: 0x4dff48 },
		{ cx: 0.8215, cy: 0.398, w: 0.1047, h: 0.1328, color: 0x62ff4a },
		{ cx: 0.9441, cy: 0.2864, w: 0.0269, h: 0.1732, color: 0x50ff37 },
		{ cx: 0.8535, cy: 0.2099, w: 0.0766, h: 0.0818, color: 0x7cff86 },
		{ cx: 0.1307, cy: 0.526, w: 0.0628, h: 0.0659, color: 0x59fe33 },
		{ cx: 0.2389, cy: 0.3863, w: 0.0425, h: 0.084, color: 0x61ff67 },
		{ cx: 0.6965, cy: 0.3895, w: 0.0293, h: 0.0946, color: 0x68ff6d },
		{ cx: 0.698, cy: 0.1998, w: 0.0299, h: 0.136, color: 0x65ff65 },
	],
	bgMobileBase: [
		{ cx: 0.2134, cy: 0.3745, w: 0.1014, h: 0.2074, color: 0x9ad5ff },
		{ cx: 0.0531, cy: 0.3852, w: 0.095, h: 0.187, color: 0x7ad6ff },
		{ cx: 0.5588, cy: 0.0437, w: 0.2222, h: 0.0874, color: 0xa29bff },
		{ cx: 0.118, cy: 0.2122, w: 0.1731, h: 0.0331, color: 0xd5e4ff },
		{ cx: 0.4291, cy: 0.0867, w: 0.0741, h: 0.0557, color: 0xa3c9ff },
		{ cx: 0.533, cy: 0.1433, w: 0.1095, h: 0.0784, color: 0xadd1ff },
		{ cx: 0.8148, cy: 0.065, w: 0.0773, h: 0.0557, color: 0xc8deff },
		{ cx: 0.3446, cy: 0.8424, w: 0.0966, h: 0.0906, color: 0x84b1ff },
	],
	bgMobileBonus: [
		{ cx: 0.2122, cy: 0.3526, w: 0.1441, h: 0.2034, color: 0xaf2cff },
		{ cx: 0.1035, cy: 0.3684, w: 0.0781, h: 0.1716, color: 0x9a13fe },
		{ cx: 0.6067, cy: 0.0417, w: 0.2134, h: 0.0833, color: 0x9c29ff },
		{ cx: 0.3382, cy: 0.603, w: 0.2061, h: 0.0448, color: 0x9a3cff },
		{ cx: 0.4545, cy: 0.074, w: 0.0733, h: 0.0503, color: 0x9635ff },
		{ cx: 0.837, cy: 0.0503, w: 0.0749, h: 0.0516, color: 0xa934ff },
		{ cx: 0.347, cy: 0.8478, w: 0.037, h: 0.1159, color: 0x8538ff },
		{ cx: 0.3889, cy: 0.399, w: 0.0757, h: 0.0661, color: 0x8c36ff },
	],
	bgMobileSuper: [
		{ cx: 0.3426, cy: 0.5245, w: 0.1957, h: 0.0625, color: 0x57ff34 },
		{ cx: 0.5966, cy: 0.041, w: 0.1997, h: 0.082, color: 0x73ff65 },
		{ cx: 0.3394, cy: 0.1379, w: 0.2907, h: 0.0548, color: 0x51ff65 },
		{ cx: 0.874, cy: 0.4823, w: 0.1296, h: 0.0571, color: 0x57ff51 },
		{ cx: 0.6695, cy: 0.1798, w: 0.0668, h: 0.0607, color: 0x57ff60 },
		{ cx: 0.2178, cy: 0.202, w: 0.0829, h: 0.0326, color: 0x87ff94 },
		{ cx: 0.7903, cy: 0.2246, w: 0.0282, h: 0.1051, color: 0x63ff62 },
		{ cx: 0.3998, cy: 0.4019, w: 0.0781, h: 0.0602, color: 0x41fe62 },
	],
};
