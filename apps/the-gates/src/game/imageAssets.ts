/** One decoded image per canonical URL, shared by preloads, Spine and coin FX.
 * Failures stay cached until page reload: UI interactions are not network retries. */
const images = new Map<string, Promise<HTMLImageElement>>();
const activity = { imageStarts: 0, imageFailures: 0, fetchStarts: 0 };
export const assetLoadActivity = () => ({ ...activity });
export function recordAssetFetch() {
	activity.fetchStarts++;
}
export function loadAssetImage(src: string): Promise<HTMLImageElement> {
	const url = new URL(src, document.baseURI).href;
	let request = images.get(url);
	if (!request) {
		activity.imageStarts++;
		request = Promise.resolve().then(async () => {
			const image = new Image();
			image.src = url;
			await image.decode();
			return image;
		});
		images.set(url, request);
		// Observe failure once without removing the original rejected promise.
		void request.catch(() => activity.imageFailures++);
	}
	return request;
}
