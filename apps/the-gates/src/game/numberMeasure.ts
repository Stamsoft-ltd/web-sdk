/** Shared, bounded glyph measurements. Context is private; source art/text stays unchanged. */
export function createNumericMeasurer(
	context: Pick<CanvasRenderingContext2D, 'font' | 'measureText'>,
) {
	const digits = new Map<string, string>();
	const widths = new Map<string, number>();
	return {
		clear() {
			digits.clear();
			widths.clear();
		},
		measure(font: string, base: number, text: string) {
			if (!(base > 0)) return undefined;
			context.font = font;
			let digit = digits.get(font);
			if (digit === undefined) {
				let widest = -Infinity;
				for (const candidate of '0123456789') {
					const width = context.measureText(candidate).width;
					if (width > widest) {
						widest = width;
						digit = candidate;
					}
				}
				if (digits.size >= 32) digits.delete(digits.keys().next().value!);
				digits.set(font, digit!);
			}
			const sample = text.replace(/\d/g, digit!);
			const key = `${font}\n${base}\n${sample}`;
			let width = widths.get(key);
			if (width === undefined) {
				width = context.measureText(sample).width / base;
				if (!Number.isFinite(width) || width <= 0) return undefined;
				if (widths.size >= 512) widths.delete(widths.keys().next().value!);
				widths.set(key, width);
			}
			return width;
		},
	};
}
let shared: ReturnType<typeof createNumericMeasurer> | undefined;
let lastFontEvent: object | undefined;
export function measureNumericEm(font: string, base: number, text: string) {
	if (!shared) {
		const context = document.createElement('canvas').getContext('2d');
		if (!context) return undefined;
		shared = createNumericMeasurer(context);
	}
	return shared.measure(font, base, text);
}
export function invalidateNumericMeasurements(fontEvent: object) {
	if (lastFontEvent === fontEvent) return;
	lastFontEvent = fontEvent;
	shared?.clear();
}
