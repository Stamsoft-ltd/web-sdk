import type { getContext } from './context';
import { boardFrameScreenRect } from './boardLogo';

type Context = ReturnType<typeof getContext>;

/**
 * Phone-landscape placements — Figma McShmutzo 8295:22703 (base) / 8302:23371 (free games), an
 * 800 × 360 frame whose board FRAME is 358 × 329 at (220, 25). Everything is measured off those
 * frames in design px and placed here in canvas px (= HTML px) as multiples of u, the size of one
 * design px on this screen (the board frame's height / 329), anchored to the frame or the screen
 * edge the way the design anchors it. Shared by the pixi chef (LandscapeChef) and the HTML HUD /
 * free-spin panels, so they line up.
 *
 * The left gutter (frame.left) is 220u in the design but narrower on squarer screens (≈141u on a
 * 16:9 popout): the bet box always hugs the frame, and the chef slides left — his hanging-arm side
 * goes off-screen — so the prop stays fully visible left of the bet box. Only when that would cut
 * into his face (node x 55) do he and the pot shrink, by k.
 */
const FRAME_H = 329;

// chef node (Figma units = design px): its prop's right edge (node x) and where it stands
const CHEF = {
	base: { x: -22, right: 169.8, sink: 9, h: 240 },
	// (free games: he stands higher than the design's 8 px cut so the pot hides less of him)
	free: { x: -19.5, right: 185.5, sink: -6, h: 240 },
};

export const landscapeLayout = (context: Context, freegame: boolean) => {
	const canvas = context.stateLayoutDerived.canvasSizes();
	const frame = boardFrameScreenRect(context);
	const u = (frame.bottom - frame.top) / FRAME_H;

	// bet box: 60 × 91, 4 px left of the frame, its bottom 6 px above the frame's
	const bet = { right: frame.left - 4 * u, bottom: frame.bottom - 6 * u, w: 60 * u, h: 91 * u };
	const betLeft = bet.right - bet.w;

	const c = CHEF[freegame ? 'free' : 'base'];
	// the prop ends 4 px short of the bet box
	const avail = betLeft - 4 * u;
	const k = Math.max(0.5, Math.min(1, avail / ((c.right - 55) * u)));
	const chef = {
		x: Math.min(c.x * u * k, avail - c.right * u * k),
		// the bust is cut by the screen's bottom edge (by `sink` design px)
		y: canvas.height + c.sink * u * k - c.h * u * k,
		unit: u * k,
	};

	// free games: the soup pot in front of him (its plaque reads MULTIPLIER ×n), hiding him from the
	// bow tie down as in the design (its rim just under the bow, soup heaped to ~228). It moves with
	// him (centre 88 px right of his node's left edge) and sits a little below the screen's bottom edge; the art is
	// 1271 × 914.
	// It stays whole on screen (only the tip of its left handle may go off), right of him when he has
	// slid left; its right handle may tuck behind the bet box but not its body (89% of the art), and
	// where even that does not fit it shrinks.
	const potW = Math.min(185 * u * k, betLeft / 0.86);
	const pot = {
		cx: Math.max(chef.x + 88 * u * k, potW * 0.47),
		cy: canvas.height + 10 * u * k - (potW * 914) / 1271 / 2,
		w: potW,
	};


	// free games: FREE SPINS over TOTAL WIN, top-left (22 px in, 114 × 52 each, 7 px apart)
	const cs = Math.min(1, (frame.left - 10 * u) / (136 * u));
	const cards = { left: 22 * u * cs, top: frame.top - 7 * u, w: 114 * u * cs, h: 52 * u * cs, gap: 7 * u * cs };

	// BALANCE over WIN, right of the frame: 110 wide, WIN's bottom 5 px above the frame's
	const readouts = { left: frame.right + 26 * u, bottom: canvas.height - frame.bottom + 5 * u, w: 110 * u };

	return { u, frame, bet, chef, k, pot, cards, readouts, canvas };
};
