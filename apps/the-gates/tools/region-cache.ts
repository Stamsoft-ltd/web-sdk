import type { TextureAtlasRegion } from '@esotericsoftware/spine-core';
/** Immutable mip-like region copies. Resize buckets stay bounded; native assets untouched. */
const pages = new WeakMap<object, Map<string, HTMLCanvasElement>>();
export function cachedRegion(
	region: TextureAtlasRegion,
	image: HTMLImageElement,
	pixelWidth: number,
	pixelHeight: number,
) {
	if (typeof document === 'undefined' || !image.naturalWidth) return null;
	const needed = Math.max(pixelWidth, (pixelHeight * region.width) / region.height);
	const width = Math.max(64, 2 ** Math.ceil(Math.log2(Math.max(1, needed))));
	if (width >= region.width || width > 1024) return null;
	let cache = pages.get(image);
	if (!cache) {
		cache = new Map();
		pages.set(image, cache);
	}
	const key = `${region.x}:${region.y}:${region.width}:${region.height}:${width}`;
	if (!cache.has(key)) {
		const canvas = document.createElement('canvas');
		canvas.width = width;
		canvas.height = Math.max(1, Math.ceil((width * region.height) / region.width));
		const ctx = canvas.getContext('2d');
		if (!ctx) return null;
		ctx.imageSmoothingEnabled = true;
		ctx.imageSmoothingQuality = 'high';
		ctx.drawImage(
			image,
			region.x,
			region.y,
			region.width,
			region.height,
			0,
			0,
			canvas.width,
			canvas.height,
		);
		cache.set(key, canvas);
	}
	return cache.get(key)!;
}
