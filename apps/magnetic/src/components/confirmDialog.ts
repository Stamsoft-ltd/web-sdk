/**
 * Shared constants for the Version2 confirm popup (Figma 4036-3584, art node 7002:11406).
 *
 * Two dialogs wear this plate — CustomBuyBonusModal's buy confirmation and BonusResumeModal — and
 * they must stay identical, so the art path and the type metrics the text fitter needs live here
 * rather than being copied into both. The layout percentages themselves stay in each component's
 * <style> block (CSS can't read from here) and are commented with the same design node ids.
 *
 * The keyed art box is 507.33 x 283 design px; every fraction below is of that WIDTH.
 */
export const CONFIRM_PANEL_BG = './assets/components/ui/confirm_panel.webp?v=20260807b';

/** Title: IBM Plex Sans Condensed Bold 32px (32 / 507.33). */
export const CONFIRM_TITLE_FONT_F = 0.0631;
/** Body: Inter Medium 20px (20 / 507.33). */
export const CONFIRM_TEXT_FONT_F = 0.0394;

/** Line widths available inside the frame's bevel, as fractions of the plate width. */
export const CONFIRM_TITLE_FIT_W = 0.86;
export const CONFIRM_TEXT_FIT_W = 0.84;

export const CONFIRM_TITLE_FAMILY = "'IBM Plex Sans Condensed', Inter, sans-serif";
export const CONFIRM_TEXT_FAMILY = 'Inter, sans-serif';
