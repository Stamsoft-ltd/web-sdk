import { untrack } from 'svelte';
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

/**
 * Re-applies `width`/`height` whenever the texture under a sprite changes.
 *
 * pixi turns `width` into a SCALE against whatever texture the object was holding when it was set.
 * A sprite sized while its art is still `Texture.EMPTY` — a deferred asset, a sheet that merges into
 * `loadedAssets` after mount — therefore keeps a scale of ONE PIXEL, and renders at the full pixel
 * size of the art the moment it arrives.
 *
 * This used to happen by accident: `propsSyncEffect` was a single effect over every prop, so a
 * texture change re-ran the whole body and re-wrote the size on the way past. Per-key effects do
 * not, so the coupling has to be stated rather than inherited.
 */
export function textureSizeSyncEffect<TTarget extends { width: number; height: number }>({
	props,
	target,
	texture,
}: {
	props: { width?: number; height?: number };
	target: TTarget;
	texture: () => unknown;
}) {
	let applied: unknown;
	$effect(() => {
		const next = texture();
		if (next === applied) return;
		applied = next;
		// Untracked: this effect exists to follow the TEXTURE. Subscribing it to the size props
		// too would run it on every frame of a win pop only to fall out of the guard above.
		untrack(() => {
			if (props.width !== undefined) target.width = props.width;
			if (props.height !== undefined) target.height = props.height;
		});
	});
}

export function propsSyncEffect<TProps extends object, TTarget>({
	props,
	target,
	ignore,
}: {
	props: TProps;
	target?: TTarget | (() => TTarget);
	ignore?: (keyof TProps)[];
}) {
	// ONE EFFECT PER PROP, and the key list read once at mount.
	//
	// This used to be a single effect that walked `Object.keys(props)` and read every `props[key]`
	// inside it. Reading them all is what subscribed it to them all, so ANY one prop changing re-ran
	// the whole body: a full `ownKeys` + `getOwnPropertyDescriptor` walk of the props proxy, a `get`
	// trap per prop, and a write of every prop back onto the pixi object — each write dirtying that
	// object's transform whether or not the value had moved.
	//
	// With a few hundred display objects on screen that was the hottest thing in the game: measured
	// on a desktop Chrome spin, this function plus the proxy traps it drove came to roughly a third
	// of all main-thread time. JSC pays several times more per proxy trap than V8 does, which is why
	// it showed up as Safari-only stutter — the work was always there.
	//
	// Split per key, a prop change runs exactly one effect: one `get`, one write, no key walk.
	//
	// The constraint this takes on: a component's prop NAMES are fixed at mount. That is how these
	// components are used — `<Sprite x={} y={} key={} />` and rest-spreads of the same — but a caller
	// that spreads a conditionally-shaped object (`{...(cond ? { tint } : {})}`) would find the late
	// key never syncs. Pass the prop with `undefined` instead of omitting it.
	const keys = (Object.keys(props) as (keyof TProps)[]).filter((key) =>
		ignore ? !ignore.includes(key) : true,
	);

	for (const key of keys) {
		$effect(() => {
			const targetInstance = target instanceof Function ? target() : target;
			if (!targetInstance) return;
			const value = props[key];
			// Deliberately no `targetInstance[key] === value` guard: pixi's getters are not all cheap
			// (`width`/`height` compute from bounds), so reading to avoid a write can cost more than
			// the write.
			if (value === undefined) return;
			// @ts-ignore
			targetInstance[key] = value;
		});
	}
}
