/** Wrap only at word boundaries, then fit the widest line. No clipping/ellipsis. */
export function buttonLabelLayout(
	text: string,
	measure: (text: string) => number,
	available: number,
	maxLines = 2,
) {
	const words = text.trim().split(/\s+/u);
	const single = words.join(' ');
	let lines = [single];
	let width = measure(single);
	if (maxLines > 1 && words.length > 1 && width > available * 0.94) {
		for (let split = 1; split < words.length; split++) {
			const candidate = [words.slice(0, split).join(' '), words.slice(split).join(' ')];
			const widest = Math.max(...candidate.map(measure));
			if (widest < width) {
				lines = candidate;
				width = widest;
			}
		}
	}
	return {
		text: lines.join('\n'),
		scale: Math.max(0, Math.min(1, (available * 0.94) / Math.max(1, width))),
	};
}
