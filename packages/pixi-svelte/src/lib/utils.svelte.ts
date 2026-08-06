import type { PixiPoint, Sizes } from './types';

export const REM = 16;
export const MIN_CLICKABLE_SIZE = 3 * REM; // 44 x 44 is minimum clickable size

export const getPointValues = ({
	point,
	defaultValue,
}: {
	point: PixiPoint;
	defaultValue: number;
}) => {
	const finalDefaultValue = defaultValue === undefined ? 0 : defaultValue;
	if (typeof point === 'number') return [point, point];
	return [point?.x || finalDefaultValue, point?.y || finalDefaultValue];
};

export const anchorToPivot = ({ anchor, sizes }: { anchor: PixiPoint; sizes: Sizes }) => {
	const { width, height } = sizes;
	const [anchorX, anchorY] = getPointValues({ point: anchor, defaultValue: 0 });
	return { x: width * anchorX, y: height * anchorY };
};

/**
 * Detects if WebGL is enabled.
 * Inspired from http://www.browserleaks.com/webgl#howto-detect-webgl
 *
 * @return { number } -1 for not Supported,
 *										0 for disabled
 *										1 for enabled
 */
export function detectWebGL() {
	// Check for the WebGL rendering context
	if (window && !!window.WebGLRenderingContext) {
		let canvas = document.createElement('canvas'),
			names = ['webgl', 'experimental-webgl', 'moz-webgl', 'webkit-3d'],
			context = false;

		for (const i in names) {
			try {
				// @ts-ignore
				context = canvas.getContext(names[i]);
				// @ts-ignore
				if (context && typeof context.getParameter === 'function') {
					// WebGL is enabled.
					return 1;
				}
			} catch (e) {}
		}

		// WebGL is supported, but disabled.
		return 0;
	}

	// WebGL not supported.
	return -1;
}

let webfontLoaderPromise: Promise<typeof import('webfontloader') | null> | null = null;

const loadWebFontLoader = async () => {
	if (typeof window === 'undefined') {
		return null;
	}

	if (!webfontLoaderPromise) {
		webfontLoaderPromise = import('webfontloader').catch((error) => {
			console.error('Unable to import webfontloader', error);
			return null;
		});
	}

	return webfontLoaderPromise;
};

export const preloadFont = () =>
	new Promise<void>(async (resolve) => {
		if (typeof window === 'undefined') {
			resolve();
			return;
		}

		try {
			const loaderModule = await loadWebFontLoader();
			// The interop branch is a runtime necessity — webfontloader is CJS, and bundlers hand it
			// back either bare or wrapped in `{ default }`. It is invisible to the types, though:
			// `@types/webfontloader` uses `export =`, so the namespace has no `default`, the `in`
			// check narrows that arm to `unknown`, and the union collapses to `{}` — losing `load`.
			// The annotation states the shape the branch actually produces; nothing here changes.
			const WebFont = (
				loaderModule && 'default' in loaderModule ? loaderModule.default : loaderModule
			) as typeof import('webfontloader') | null;

			if (!WebFont) {
				resolve();
				return;
			}

			WebFont.load({
				typekit: {
					id: 'aba0ebl',
				},
				active: () => {
					resolve();
				},
				inactive: () => {
					console.error('Web font load inactive');
					resolve();
				},
			});
		} catch (error) {
			console.error('Web font load failed', error);
			resolve();
		}
	});

export function propsSyncEffect<TProps extends object, TTarget>({
	props,
	target,
	ignore,
}: {
	props: TProps;
	target?: TTarget | (() => TTarget);
	ignore?: (keyof TProps)[];
}) {
	// One $effect PER PROP, not one over all of them. The single all-props effect subscribed to
	// every prop, so a sprite whose `y` tweens 60×/s re-assigned EVERY prop each frame and
	// allocated two arrays doing it — across a board of ~40 sprites that is thousands of
	// allocations and tens of thousands of redundant pixi setter calls per second, which Safari's
	// GC turns into repeated 100-250ms frame stalls. Per-prop effects re-run only what changed and
	// allocate nothing per frame.
	//
	// Keys are captured ONCE at mount: call sites pass static template attributes, so the key set
	// never grows. A prop absent on first render would never sync — pass it explicitly (even as
	// undefined) if it can appear later.
	const resolveTarget = () => (target instanceof Function ? target() : target);
	// Pixi's width/height setters store scale RELATIVE to the current texture, so they must be
	// re-applied when the texture swaps — the three share one effect to keep that ordering.
	const SIZE_KEYS = ['texture', 'width', 'height'] as (keyof TProps)[];
	const keys = (Object.keys(props) as (keyof TProps)[]).filter((key) => !ignore?.includes(key));
	const sizeKeys = SIZE_KEYS.filter((key) => keys.includes(key));

	for (const key of keys) {
		if (sizeKeys.includes(key)) continue;
		$effect(() => {
			const targetInstance = resolveTarget();
			const value = props[key];
			if (targetInstance && value !== undefined) {
				// @ts-ignore
				targetInstance[key] = value;
			}
		});
	}

	if (sizeKeys.length > 0) {
		$effect(() => {
			const targetInstance = resolveTarget();
			if (!targetInstance) return;
			for (const key of sizeKeys) {
				const value = props[key];
				if (value !== undefined) {
					// @ts-ignore
					targetInstance[key] = value;
				}
			}
		});
	}
}
