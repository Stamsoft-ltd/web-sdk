/** Fit native scene art without changing aspect ratio. CSS pixels, never device pixels. */
export type SceneBox = { x: number; y: number; width: number; height: number };
export function fitSceneImage(
	sourceWidth: number,
	sourceHeight: number,
	box: SceneBox,
	cover = false,
) {
	const scale = (cover ? Math.max : Math.min)(box.width / sourceWidth, box.height / sourceHeight);
	return {
		x: box.x + (box.width - sourceWidth * scale) / 2,
		y: box.y + (box.height - sourceHeight * scale) / 2,
		width: sourceWidth * scale,
		height: sourceHeight * scale,
	};
}
