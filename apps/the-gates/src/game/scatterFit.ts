/** Native standalone Key: trim export margins, preserve angle and protrude beyond its generated frame. */
export const SCATTER_ART_WIDTH = 144;
export const SCATTER_ART_HEIGHT = (144 * 431) / 500;
export function scatterCellScale(width: number, height: number) {
	return 1.14 * Math.min(width / SCATTER_ART_WIDTH, height / SCATTER_ART_HEIGHT);
}

/** Moving Keys use the masked reel field. Promote only after contact, never on reel exit. */
export function scatterOverFrame(
	phase: string,
	travelling: boolean,
	reduced: boolean,
	elapsed: number,
	contact: { delay: number; duration: number },
) {
	if (!travelling) return true;
	if (phase === 'spinning') return false;
	return reduced || elapsed >= contact.delay + contact.duration;
}

/** Standalone Wild attachment: preserve its aspect; tips extend 17.5% past the short cell edge. */
export const WILD_ART_WIDTH = 260;
export const WILD_ART_HEIGHT = (260 * 292) / 278;
export function wildCellScale(width: number, height: number) {
	return 1.35 * Math.min(width / WILD_ART_WIDTH, height / WILD_ART_HEIGHT);
}
