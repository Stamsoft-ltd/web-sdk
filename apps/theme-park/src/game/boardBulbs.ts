/**
 * Marquee bulbs painted into board-lines.webp, extracted from the 1462x972 art. Blobs are found by
 * brightness, then walked around the ring — top left-to-right, down the right edge, back along the
 * bottom, up the left — 76 in all (23 top, 23 bottom, 15 right, 15 left).
 *
 * Each entry is [x, y, radius, group, colour]:
 *  - x and radius are fractions of the art's width, y a fraction of its height, so they survive any
 *    board scale.
 *  - `colour` is that bulb's OWN painted hue, sampled from the ring just outside its blown-out core
 *    and pushed to full value. A bulb has to glow its own colour — lighting a blue bulb orange is
 *    the one thing that reads as broken.
 *  - `group` alternates around the ring. This art runs the bulbs through the whole spectrum rather
 *    than through two families, so a chase is every other bulb; <BoardFrame> lifts one group while
 *    the other is dark.
 *
 * Regenerate only if the board art changes.
 */
export const BOARD_BULBS: [x: number, y: number, radius: number, group: 0 | 1, colour: number][] = [
	[0.0411, 0.0330, 0.0030, 0, 0xff4fea],
	[0.0814, 0.0301, 0.0046, 1, 0x34ffe9],
	[0.1226, 0.0303, 0.0046, 0, 0xff4b84],
	[0.1637, 0.0301, 0.0029, 1, 0xff46db],
	[0.2052, 0.0306, 0.0040, 0, 0x226aff],
	[0.2468, 0.0301, 0.0047, 1, 0xff6264],
	[0.2882, 0.0302, 0.0028, 0, 0xbe4fff],
	[0.3296, 0.0299, 0.0029, 1, 0xff49d2],
	[0.3705, 0.0299, 0.0044, 0, 0x2099ff],
	[0.4117, 0.0299, 0.0043, 1, 0x1d40ff],
	[0.4535, 0.0299, 0.0033, 0, 0xff4bfa],
	[0.4940, 0.0297, 0.0046, 1, 0xff626e],
	[0.5356, 0.0300, 0.0043, 0, 0x203bff],
	[0.5776, 0.0297, 0.0029, 1, 0xff4cd5],
	[0.6185, 0.0310, 0.0043, 0, 0xff3bb3],
	[0.6593, 0.0300, 0.0045, 1, 0x3bffe4],
	[0.7008, 0.0298, 0.0030, 0, 0xb24aff],
	[0.7422, 0.0299, 0.0032, 1, 0xff45c3],
	[0.7836, 0.0302, 0.0047, 0, 0xff6b60],
	[0.8255, 0.0299, 0.0042, 1, 0x0e65ff],
	[0.8666, 0.0297, 0.0032, 0, 0xb940ff],
	[0.9077, 0.0299, 0.0031, 1, 0xff3fc2],
	[0.9459, 0.0326, 0.0048, 0, 0xff6160],
	[0.9657, 0.0742, 0.0046, 1, 0x34ffe0],
	[0.9656, 0.1349, 0.0030, 0, 0xd13cff],
	[0.9655, 0.1954, 0.0047, 1, 0xff596e],
	[0.9651, 0.2588, 0.0036, 0, 0x205bff],
	[0.9654, 0.3191, 0.0030, 1, 0xff46e2],
	[0.9655, 0.3794, 0.0030, 0, 0xff42df],
	[0.9659, 0.4405, 0.0041, 1, 0x135aff],
	[0.9656, 0.5008, 0.0032, 0, 0xff4cb2],
	[0.9656, 0.5620, 0.0033, 1, 0xff49ee],
	[0.9658, 0.6212, 0.0047, 0, 0x3dfffa],
	[0.9657, 0.6811, 0.0044, 1, 0x4319ff],
	[0.9657, 0.7414, 0.0030, 0, 0xff41d6],
	[0.9657, 0.8026, 0.0045, 1, 0xff6065],
	[0.9658, 0.8647, 0.0037, 0, 0x1d58ff],
	[0.9656, 0.9234, 0.0028, 1, 0xff39fa],
	[0.9485, 0.9684, 0.0047, 0, 0xff605e],
	[0.9089, 0.9726, 0.0042, 1, 0x192fff],
	[0.8674, 0.9724, 0.0030, 0, 0xff3ed2],
	[0.8264, 0.9723, 0.0031, 1, 0xaf36ff],
	[0.7849, 0.9725, 0.0045, 0, 0x1c6cff],
	[0.7434, 0.9725, 0.0047, 1, 0xff5c5e],
	[0.7023, 0.9724, 0.0031, 0, 0xff3dd3],
	[0.6616, 0.9723, 0.0030, 1, 0xb238ff],
	[0.6204, 0.9723, 0.0045, 0, 0x36ffe7],
	[0.5788, 0.9721, 0.0044, 1, 0x1553ff],
	[0.5365, 0.9723, 0.0029, 0, 0xff3ded],
	[0.4947, 0.9723, 0.0032, 1, 0xa732ff],
	[0.4534, 0.9725, 0.0047, 0, 0xff5a71],
	[0.4119, 0.9720, 0.0042, 1, 0x222cff],
	[0.3704, 0.9722, 0.0030, 0, 0xff4ac9],
	[0.3297, 0.9722, 0.0046, 1, 0x34ffd9],
	[0.2882, 0.9722, 0.0044, 0, 0x1d2fff],
	[0.2464, 0.9720, 0.0030, 1, 0xff3ade],
	[0.2052, 0.9721, 0.0047, 0, 0xff615c],
	[0.1641, 0.9713, 0.0041, 1, 0x0e60ff],
	[0.1229, 0.9720, 0.0030, 0, 0xb740ff],
	[0.0819, 0.9720, 0.0030, 1, 0xff4fae],
	[0.0410, 0.9679, 0.0036, 0, 0x1971ff],
	[0.0233, 0.9230, 0.0044, 1, 0x1557ff],
	[0.0228, 0.8612, 0.0047, 0, 0xff6169],
	[0.0231, 0.7989, 0.0029, 1, 0xff4be3],
	[0.0240, 0.7379, 0.0037, 0, 0x207cff],
	[0.0232, 0.6775, 0.0029, 1, 0xc246ff],
	[0.0231, 0.6178, 0.0029, 0, 0xff4ec7],
	[0.0230, 0.5576, 0.0045, 1, 0x42ffe4],
	[0.0232, 0.4960, 0.0039, 0, 0x2530ff],
	[0.0230, 0.4352, 0.0046, 1, 0xff616f],
	[0.0232, 0.3741, 0.0030, 0, 0xbc4aff],
	[0.0233, 0.3128, 0.0029, 1, 0xff49c6],
	[0.0233, 0.2519, 0.0041, 0, 0x156bff],
	[0.0230, 0.1925, 0.0028, 1, 0xcf47ff],
	[0.0230, 0.1314, 0.0047, 0, 0xff6272],
	[0.0227, 0.0707, 0.0040, 1, 0x1d36ff],
];
