/**
 * Shared constants for the confirm popup — plate node 9076:28671 inside Figma's "confirm popup"
 * frame 4036:3584 (SECTION 9078:18631 POPUPS).
 *
 * THREE dialogs wear this plate — CustomBuyBonusModal's buy confirmation, BonusResumeModal and
 * InsufficientFundsModal — and they must stay identical, so the type metrics the text fitter needs
 * live here rather than being copied into all three. The layout numbers themselves stay in each
 * component's <style> block (CSS can't read from here) and carry the same design node id.
 *
 * There is no plate ART any more: the design's panel is a flat rounded rectangle, so it is drawn in
 * CSS and the components lay their contents out in flow rather than at absolute percentages of a
 * fixed-aspect bitmap. The old `confirm_panel.webp` was a blue steel frame from the Version2 theme
 * and looked like a different game next to the MOTHERSHIP art.
 *
 * The plate is 467 design px wide; every fraction below is of that WIDTH.
 *
 * Re-measured 2026-09-03: 9076:28671 replaced the 4036-era plate these numbers used to come from,
 * and it changed the FACES as well as the sizes — Audiowide for the title, Poppins for the body,
 * where the old plate was Chakra Petch throughout.
 */

/** Title: Audiowide Regular 32px (32 / 467). */
export const CONFIRM_TITLE_FONT_F = 0.0685;
/** Body: Poppins Regular 20px (20 / 467). */
export const CONFIRM_TEXT_FONT_F = 0.0428;

/** Line widths available inside the frame's bevel, as fractions of the plate width. */
export const CONFIRM_TITLE_FIT_W = 0.86;
export const CONFIRM_TEXT_FIT_W = 0.84;

// These are NOT decorative: the dialogs measure their strings offscreen with these to compute the
// shrink-to-fit factor (--confirm-title-fit / --confirm-text-fit), and the title renders `nowrap`.
// They MUST track the <style> blocks exactly — measuring in Chakra Petch while rendering Audiowide
// yields a fit factor for the wrong glyph widths (Audiowide is far wider), and the title silently
// overflows the plate.
export const CONFIRM_TITLE_FAMILY = "'Audiowide', 'Chakra Petch', 'Inter', sans-serif";
export const CONFIRM_TEXT_FAMILY = "'Poppins', 'Chakra Petch', 'Inter', sans-serif";
/** Body weight, matching `.confirm-text` — Regular, as the design sets it. */
export const CONFIRM_TEXT_WEIGHT = 400;
