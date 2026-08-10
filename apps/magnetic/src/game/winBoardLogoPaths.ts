// The outer contours of the gold P logo on each win-board art. The glyph is TWO
// separate pieces (the bowl piece and the sliced-off stem bar), so each tier has two
// closed polylines of arc-length-even points in sprite-box fractions relative to the
// sprite centre (+y down). Extracted programmatically from the PNGs (gold-mask ->
// Moore boundary trace -> arc-length resample); used by WinBoardFx to run rim lights
// along the P. The MAX WIN screen art has a different composition, so no entry.
export const WIN_BOARD_LOGO_PATHS: Record<string, [number, number][][]> = {
};

