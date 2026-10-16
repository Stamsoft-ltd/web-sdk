/** Forest Gang's reactive, fixed-slot glyph-width fitting; conservative for Titan One.
 * No transform-only scaling, truncation, K/M abbreviations or layout shifts.
 */
export function numericTextEm(text: string) {
	let width = 0;
	for (const char of text) {
		if (char >= '0' && char <= '9') width += 0.8;
		else if (/[.,\s]/u.test(char)) width += 0.4;
		else if (/[-+×/]/u.test(char)) width += 0.7;
		else if (/[$€£¥]/u.test(char)) width += 0.85;
		else if (/[a-z]/iu.test(char)) width += 1;
		else width += 1.2;
	}
	return Math.max(0.01, width);
}

/** Reserving final count-up width keeps the font stable throughout the celebration. */
export const numericSlotEm = (text: string, finalText = text) =>
	Math.max(numericTextEm(text), numericTextEm(finalText));

export const numericFontScale = (text: string, width: number, fontSize: number, finalText = text) =>
	Math.max(
		0,
		Math.min(1, (width * 0.94) / (numericSlotEm(text, finalText) * Math.max(1, fontSize))),
	);
