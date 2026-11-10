import { Container, Sprite } from 'pixi.js';
import type { GpuEngine } from './gpuRenderer';
import { loadAssetImage } from './imageAssets.ts';
import type { SceneBox } from './sceneLayout';
import { logoWordScale } from './logoIdle.ts';
export const LOGO_LAYERS = [
	{
		src: './assets/the-gates/logo/badge.png',
		ink: [11, 81, 767, 422],
		box: [0, 0, 767, 418],
	},
	{
		src: './assets/the-gates/logo/the.png',
		ink: [9, 1, 171, 73],
		box: [286, 104, 195, 83],
	},
	{
		src: './assets/the-gates/logo/gates.png',
		ink: [3, 0, 402, 136],
		box: [108, 180, 551, 186],
	},
] as const;
/** One shared texture per native PNG; only containers/sprites belong to this adapter. */
export async function createLogoArt(engine: GpuEngine) {
	const images = await Promise.all(LOGO_LAYERS.map((layer) => loadAssetImage(layer.src)));
	const root = new Container(),
		words = new Container();
	words.label = 'wordmark';

	LOGO_LAYERS.forEach((layer, i) => {
		const sprite = new Sprite(engine.texture(images[i]));
		const [ix, iy, iw, ih] = layer.ink,
			[x, y, w, h] = layer.box;
		const scale = Math.min(w / iw, h / ih);
		sprite.scale.set(scale);
		sprite.position.set(
			x + (w - iw * scale) / 2 - ix * scale,
			y + (h - ih * scale) / 2 - iy * scale,
		);
		if (i === 0) root.addChild(sprite);
		else {
			const word = new Container();
			word.label = i === 1 ? 'the' : 'gates';
			word.pivot.set(x + w / 2, y + h / 2);
			word.position.set(x + w / 2, y + h / 2);
			word.addChild(sprite);
			words.addChild(word);
		}
	});
	root.addChild(words);
	return root;
}
export function fitLogoArt(root: Container, box: SceneBox) {
	const scale = Math.min(box.width / 767, box.height / 418);
	root.scale.set(scale);
	root.position.set(box.x + (box.width - 767 * scale) / 2, box.y + (box.height - 418 * scale) / 2);
}
export function pulseLogoText(root: Container, age: number, reduced = false) {
	const words = root.getChildByLabel('wordmark');
	if (!words) return;
	for (const name of ['the', 'gates'] as const)
		words.getChildByLabel(name)?.scale.set(logoWordScale(age, name, reduced));
}
