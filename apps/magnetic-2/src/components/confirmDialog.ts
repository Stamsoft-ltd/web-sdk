/**
 * Shared constants for the confirm popup (Figma 4036-3584).
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
 * The plate is 458 design px wide; every fraction below is of that WIDTH.
 */

/** Title: Chakra Petch Bold 30px (30 / 458). */
export const CONFIRM_TITLE_FONT_F = 0.0655;
/** Body: Chakra Petch SemiBold 20px (20 / 458). */
export const CONFIRM_TEXT_FONT_F = 0.0437;

/** Line widths available inside the frame's bevel, as fractions of the plate width. */
export const CONFIRM_TITLE_FIT_W = 0.86;
export const CONFIRM_TEXT_FIT_W = 0.84;

// These are NOT decorative: both dialogs measure their strings offscreen with these to compute the
// shrink-to-fit factor (--confirm-title-fit / --confirm-text-fit), and the title renders `nowrap`.
// They MUST track the <style> blocks exactly — measuring in Inter while rendering Chakra Petch
// yields a fit factor for the wrong glyph widths, and the title silently overflows the plate.
export const CONFIRM_TITLE_FAMILY = "'Chakra Petch', 'Inter', sans-serif";
export const CONFIRM_TEXT_FAMILY = "'Chakra Petch', 'Inter', sans-serif";
/** Body weight, matching `.confirm-text` in both components (Chakra Petch has no 500 face). */
export const CONFIRM_TEXT_WEIGHT = 600;
