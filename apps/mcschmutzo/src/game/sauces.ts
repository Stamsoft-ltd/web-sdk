// Each symbol's sauce (ketchup, mustard, mayo, BBQ, green ranch slime): the colour of its win line
// (PaylineOverlay) and of the flecks it throws when it wins (Symbol).
export type Sauce = { rim: number; body: number; lit: number };
export const KETCHUP: Sauce = { rim: 0x5e0603, body: 0xcf160e, lit: 0xff7a5c };
export const MUSTARD: Sauce = { rim: 0x7a4a02, body: 0xf2b21c, lit: 0xfff0a0 };
export const MAYO: Sauce = { rim: 0x8a7a55, body: 0xf3ead2, lit: 0xffffff };
export const BBQ: Sauce = { rim: 0x2e0d04, body: 0x7a2a12, lit: 0xc8704a };
export const RANCH: Sauce = { rim: 0x2f4a06, body: 0x8fc22a, lit: 0xd8f58a };
const SAUCE_BY_SYMBOL: Record<string, Sauce> = {
	L1: KETCHUP,
	L2: MAYO,
	L3: MUSTARD,
	L4: BBQ,
	L5: RANCH,
	H1: KETCHUP, // burger
	H2: RANCH, // cola cup → slime
	H3: MUSTARD, // sausage
	H4: MUSTARD, // cheese
	H5: MAYO, // onion rings
	W: KETCHUP,
};
export const sauceOf = (symbol?: string) => SAUCE_BY_SYMBOL[symbol ?? ''] ?? KETCHUP;
