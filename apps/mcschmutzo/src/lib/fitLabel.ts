// Svelte action: shrink a label to fit its parent's width when a (translated) string is
// too long for a fixed-size button/badge. Only ever scales DOWN — English/short strings
// render at full size. Re-measures on content change (the `dep` arg) and on resize.
// Keeps text on its natural line(s); scales the WIDEST LINE to fit (and, when the label runs to
// more than one line, caps its height by the same fraction so a round badge isn't overflowed).
// Optional param: pass `{ dep, maxFraction }` to also cap the target to a fraction of the
// parent's content width — needed for ROUND badges, where the usable flat area is only part
// of the (square) button box. Plain (string/number) param = fit the full content box.
type FitParam = { dep?: unknown; maxFraction?: number } | unknown;

export function fitLabel(node: HTMLElement, param?: FitParam) {
	const cfg = () =>
		param && typeof param === 'object' && 'maxFraction' in (param as Record<string, unknown>)
			? (param as { maxFraction?: number })
			: {};
	const fit = () => {
		const slot = node.parentElement;
		if (!slot) return;
		node.style.transformOrigin = 'center center';
		node.style.transform = 'none';
		// Fit the parent's CONTENT box (clientWidth includes padding — on a framed/pill button
		// that padding is the rounded/decorated ends, so text must stay inside it).
		const cs = getComputedStyle(slot);
		const pad = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
		const fraction = cfg().maxFraction ?? 1;
		const avail = (slot.clientWidth - pad) * fraction;
		// Measure the real text width with a Range — scrollWidth misses the LEFT overflow of
		// centred nowrap text, which under-measured and left labels clipped ("BUY BONU").
		const range = document.createRange();
		range.selectNodeContents(node);
		// Per-LINE rects, not the union: a multi-line label ("BUY" over "BONUS") has a union rect as
		// wide as its widest line only by accident — for wrapped text it spans the whole container,
		// which over-measures and shrinks the label far past what it needs. The widest single line
		// is what has to fit.
		const lineWidths = Array.from(range.getClientRects(), (r) => r.width);
		const full = Math.max(node.scrollWidth, ...lineWidths, 0);
		const widthScale = full > avail && avail > 0 ? avail / full : 1;
		// Height matters once a label can occupy more than one line: on a ROUND badge the usable
		// area is limited vertically as well, so a two-line block that fits widthwise can still
		// spill past the disc. Same fraction — the badge's flat area is round.
		const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
		const availH = (slot.clientHeight - padY) * fraction;
		const fullH = node.scrollHeight;
		const heightScale = fullH > availH && availH > 0 ? availH / fullH : 1;
		const scale = Math.min(widthScale, heightScale);
		node.style.transform = scale < 1 ? `scale(${scale})` : 'none';
	};
	const schedule = () => requestAnimationFrame(fit);
	const ro = new ResizeObserver(schedule);
	if (node.parentElement) ro.observe(node.parentElement);
	schedule();
	// Re-measure once web fonts (Cinzel/Poppins) have loaded — the first pass runs with a
	// narrower fallback font, which under-measures long strings and lets them overflow.
	if (typeof document !== 'undefined' && document.fonts?.ready) {
		document.fonts.ready.then(schedule).catch(() => {});
	}
	return { update: schedule, destroy: () => ro.disconnect() };
}
