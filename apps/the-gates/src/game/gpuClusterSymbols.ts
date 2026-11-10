/** Native Pixi layered symbols. Static Canvas preparation only; no per-frame bitmap uploads. */
import { Container, Sprite, Graphics, Texture, CanvasSource, Matrix } from 'pixi.js';
import type { SymbolName } from './contract';
import type { GpuPose } from './gpuRenderer';
import { loadAssetImage } from './imageAssets';
import { preparePremiumParts } from './premiumSymbolParts';
import {
	premiumSymbolFrame,
	wildSymbolFrame,
	envelopeLidPose,
	ENVELOPE_HINGE_Y,
} from './premiumSymbolMotion';
import {
	CLUSTER_SYMBOLS,
	SYMBOL_PART_FILES,
	clusterFrame,
	clusterGestureMs,
	clusterArtUnits,
} from './symbolClusterMotion';
const SIZE = 300;
function surface(w = SIZE, h = SIZE) {
	const c = document.createElement('canvas');
	c.width = w;
	c.height = h;
	return c;
}
function fit(image: HTMLImageElement, w = 270, h = w, cx = 150, cy = 150) {
	const scan = surface(image.naturalWidth, image.naturalHeight),
		c = scan.getContext('2d')!;
	c.drawImage(image, 0, 0);
	const pixels = c.getImageData(0, 0, scan.width, scan.height).data;
	let left = scan.width,
		top = scan.height,
		right = 0,
		bottom = 0;
	for (let y = 0; y < scan.height; y++)
		for (let x = 0; x < scan.width; x++)
			if (pixels[(y * scan.width + x) * 4 + 3] > 96) {
				left = Math.min(left, x);
				right = Math.max(right, x);
				top = Math.min(top, y);
				bottom = Math.max(bottom, y);
			}
	if (right < left || bottom < top) throw Error('Empty layered symbol asset');
	const out = surface(),
		o = out.getContext('2d')!,
		width = right - left + 1,
		height = bottom - top + 1,
		s = Math.min(w / width, h / height);
	o.drawImage(
		image,
		left,
		top,
		width,
		height,
		cx - (width * s) / 2,
		cy - (height * s) / 2,
		width * s,
		height * s,
	);
	return out;
}
export async function loadClusterSymbols() {
	const sources = Object.fromEntries(
		await Promise.all(
			Object.entries(SYMBOL_PART_FILES).map(async ([k, url]) => [k, await loadAssetImage(url)]),
		),
	) as Record<keyof typeof SYMBOL_PART_FILES, HTMLImageElement>;
	const textures: Texture[] = [];
	const texture = (canvas: HTMLCanvasElement) => {
		const t = new Texture({
			source: new CanvasSource({
				resource: canvas,
				autoGenerateMipmaps: true,
				scaleMode: 'linear',
			}),
		});
		textures.push(t);
		return t;
	};
	const prepared = {
		sunBadge: fit(sources.sunBadge),
		sunRays: fit(sources.sunRays, 209),
		sunFace: fit(sources.sunFace, 112),
		orbFrame: fit(sources.orbFrame),
		orbSpiral: fit(sources.orbSpiral, (142 * 270) / 272, (108 * 270) / 272, 150, 128),
		eyeBorder: fit(sources.eyeBorder, 299, 200),
		eyeMask: fit(sources.eyeBackground, 251, 123),
		eyeIris: fit(sources.eyeIris, 131),
		...preparePremiumParts(sources, fit),
	};
	const parts = {} as Record<keyof typeof prepared, Texture>;
	for (const key of Object.keys(prepared) as (keyof typeof prepared)[])
		parts[key] = texture(prepared[key]);
	// Smooth approved eyeball volume; supplied blue interior retained, its hard edge stays masked.
	const blue = surface(),
		b = blue.getContext('2d')!;
	b.save();
	b.translate(150, 150);
	b.scale(1, 0.56);
	const volume = b.createRadialGradient(-10, -15, 8, -10, -15, 137);
	volume.addColorStop(0, '#0875ff');
	volume.addColorStop(0.45, '#0759f5');
	volume.addColorStop(0.78, '#1233be');
	volume.addColorStop(1, '#08165f');
	b.fillStyle = volume;
	b.fillRect(-150, -270, 300, 540);
	b.restore();
	b.save();
	b.globalAlpha = 0.5;
	b.translate(150, 150);
	b.scale(2.3, 2.3);
	b.drawImage(prepared.eyeMask, -150, -150);
	b.restore();
	b.globalCompositeOperation = 'destination-in';
	b.drawImage(prepared.eyeMask, 0, 0);
	const blueTexture = texture(blue);
	const light = surface(),
		l = light.getContext('2d')!,
		gloss = l.createRadialGradient(150, 150, 0, 150, 150, 100);
	gloss.addColorStop(0, '#8bdeff77');
	gloss.addColorStop(1, '#8bdeff00');
	l.fillStyle = gloss;
	l.fillRect(0, 0, 300, 300);
	const lightTexture = texture(light);
	const stripe = surface(),
		s = stripe.getContext('2d')!,
		g = s.createLinearGradient(114, 0, 186, 0);
	g.addColorStop(0, '#fff0');
	g.addColorStop(0.5, '#fffbc2aa');
	g.addColorStop(1, '#fff0');
	s.fillStyle = g;
	s.fillRect(0, 0, 300, 300);
	const stripeTexture = texture(stripe);
	const gems = new Map<SymbolName, Texture>();
	try {
		for (const [name, file] of [
			['RED_GEM', 'red-gem'],
			['BLUE_GEM', 'blue-gem'],
			['GREEN_GEM', 'green-gem'],
			['PURPLE_GEM', 'purple-gem'],
			['AMBER_GEM', 'gold-gem'],
		] as const)
			gems.set(
				name,
				texture(fit(await loadAssetImage(`./assets/the-gates/art/symbols/${file}.png`))),
			);
	} catch (error) {
		for (const t of textures) t.destroy(true);
		throw error;
	}
	const sprite = (t: Texture) => {
		const s = new Sprite(t);
		s.anchor.set(0.5);
		s.eventMode = 'none';
		return s;
	};
	function create(name: SymbolName) {
		if (!CLUSTER_SYMBOLS.includes(name)) return;
		const view = new Container(),
			art = new Container();
		view.eventMode = 'none';
		view.addChild(art);
		// Parent follows Spine's Y-up body. Child content is authored Y-down in 300px space.
		const units = clusterArtUnits(name) / 300;
		art.scale.set(units, -units);
		let pharaohEyes: Sprite[] = [],
			pharaohBrows: Sprite[] = [],
			envelopeLid: Container | undefined,
			envelopeGroup: Container | undefined,
			envelopeFlap: Sprite | undefined,
			envelopeSealUpper: Sprite | undefined,
			envelopeSealLower: Sprite | undefined,
			envelopeLight: Sprite | undefined,
			wildLight: Sprite | undefined,
			wildHalo: Sprite | undefined;
		const wildGlints: Graphics[] = [];
		let rotate: Sprite | undefined,
			iris: Sprite | undefined,
			eyeLight: Sprite | undefined,
			shine: Sprite | undefined,
			facets: Graphics | undefined,
			spark: Graphics | undefined;
		const add = (t: Texture) => {
			const s = sprite(t);
			art.addChild(s);
			return s;
		};
		if (name === 'GUARDIAN_MASK') {
			add(parts.pharaohBody);
			pharaohEyes = [add(parts.pharaohEyeLeft), add(parts.pharaohEyeRight)];
			for (const eye of pharaohEyes) {
				eye.pivot.y = ((154 - 143) * 270) / 304;
				eye.y = eye.pivot.y;
			}
			pharaohBrows = [add(parts.pharaohBrowLeft), add(parts.pharaohBrowRight)];
			add(parts.pharaohGem);
		} else if (name === 'RUNE_CHALICE') {
			envelopeGroup = new Container();
			art.addChild(envelopeGroup);
			envelopeLight = sprite(lightTexture);
			envelopeLight.tint = 0xffd04b;
			envelopeLight.y = -25;
			envelopeGroup.addChild(envelopeLight);
			envelopeFlap = sprite(parts.envelopeFlap);
			envelopeFlap.y = ENVELOPE_HINGE_Y - 150;
			envelopeLid = new Container();
			envelopeSealUpper = sprite(parts.envelopeSealUpper);
			envelopeLid.addChild(envelopeFlap, envelopeSealUpper);
			envelopeSealLower = sprite(parts.envelopeSealLower);
			envelopeGroup.addChild(sprite(parts.envelopeBody), envelopeLid, envelopeSealLower);
		} else if (name === 'WILD') {
			wildHalo = add(lightTexture);
			wildHalo.scale.set(1.65);
			add(parts.wildFlower);
			wildLight = add(parts.wildLight);
			for (let i = 0; i < 6; i++) {
				const angle = -Math.PI / 2 + (i * Math.PI) / 3,
					star = new Graphics()
						.moveTo(0, -5)
						.lineTo(1, -1)
						.lineTo(5, 0)
						.lineTo(1, 1)
						.lineTo(0, 5)
						.lineTo(-1, 1)
						.lineTo(-5, 0)
						.lineTo(-1, -1)
						.closePath()
						.fill(0xfff9e8);
				star.position.set(Math.cos(angle) * 78, Math.sin(angle) * 78);
				art.addChild(star);
				wildGlints.push(star);
			}
		} else if (name === 'CRYSTAL_ORB') {
			add(parts.orbFrame);
			rotate = add(parts.orbSpiral);
			rotate.pivot.set(0, -22);
			rotate.y = -22;
		} else if (name === 'SUN_MEDALLION') {
			add(parts.sunBadge);
			rotate = add(parts.sunRays);
			add(parts.sunFace);
		} else if (name === 'SACRED_EYE') {
			add(blueTexture);
			// One stencil mask for both moving layers, no per-eye alpha-filter targets.
			const inner = new Container();
			art.addChild(inner);
			eyeLight = sprite(lightTexture);
			eyeLight.scale.set(1, 0.4);
			inner.addChild(eyeLight);
			iris = sprite(parts.eyeIris);
			inner.addChild(iris);
			const opening = new Graphics()
				.moveTo(-125.5, 0)
				.bezierCurveTo(-65, -82, 65, -82, 125.5, 0)
				.bezierCurveTo(65, 82, -65, 82, -125.5, 0)
				.closePath()
				.fill(0xffffff);
			art.addChild(opening);
			inner.mask = opening;
			add(parts.eyeBorder);
		} else {
			const base = gems.get(name)!;
			add(base);
			const highlights = new Container();
			art.addChild(highlights);
			shine = sprite(stripeTexture);
			shine.blendMode = 'screen';
			highlights.addChild(shine);
			facets = new Graphics()
				.moveTo(0, -82)
				.lineTo(79, 0)
				.lineTo(0, 82)
				.lineTo(0, 0)
				.closePath()
				.fill({ color: 0xffffff, alpha: 0.13 });
			highlights.addChild(facets);
			const outline = new Graphics()
				.moveTo(0, -135)
				.lineTo(135, 0)
				.lineTo(0, 135)
				.lineTo(-135, 0)
				.closePath()
				.fill(0xffffff);
			art.addChild(outline);
			highlights.mask = outline;
			spark = new Graphics()
				.moveTo(0, -15)
				.lineTo(3, -3)
				.lineTo(15, 0)
				.lineTo(3, 3)
				.lineTo(0, 15)
				.lineTo(-3, 3)
				.lineTo(-15, 0)
				.lineTo(-3, -3)
				.closePath()
				.fill(0xfff9ce);
			spark.position.set(1, -116);
			art.addChild(spark);
		}
		const transform = new Matrix();
		return {
			view,
			update(pose: GpuPose, age: number, reduced: boolean, color = 0xffde47) {
				const body = pose.actor.skeleton.findBone('body'),
					slot = pose.actor.skeleton.findSlot('body');
				if (!body || !slot) throw Error(`Missing layered symbol body: ${name}`);
				// Preserve landing / portal suction transforms and alpha from the original rig.
				transform.set(body.a, body.c, body.b, body.d, body.worldX, body.worldY);
				view.setFromMatrix(transform);
				view.alpha = slot.color.a * pose.actor.skeleton.color.a;
				slot.color.a = 0;
				const f = clusterFrame(age, reduced, clusterGestureMs(name));
				if (rotate) rotate.rotation = name === 'CRYSTAL_ORB' ? f.orbAngle : f.sunAngle;
				if (iris) {
					iris.position.set(f.eyeX, f.eyeY);
					iris.scale.set(f.irisWidth / 131, f.irisHeight / 131);
				}
				if (eyeLight) {
					eyeLight.position.set(-42 + f.eyeX * 0.5, -26 + f.eyeY * 0.4);
					eyeLight.alpha = 0.65;
				}
				if (shine) {
					shine.x = f.shineX - 150;
					shine.alpha = f.active;
				}
				if (facets) facets.alpha = f.active;
				if (spark) spark.alpha = f.sparkle;
				if (pharaohEyes.length || envelopeGroup) {
					const p = premiumSymbolFrame(age, reduced);
					for (const eye of pharaohEyes) eye.scale.y = 1 - 0.94 * p.blink;
					pharaohBrows.forEach((b, i) => {
						b.y = -p.brow * (i === 0 ? 3 : 1);
					});
					if (
						envelopeGroup &&
						envelopeLid &&
						envelopeFlap &&
						envelopeSealUpper &&
						envelopeSealLower &&
						envelopeLight
					) {
						// One assembly for the entire gesture: no crossfade to different paper geometry.
						const lid = envelopeLidPose(p.flap, p.seal);
						const index = lid.inFront ? 2 : 1;
						if (envelopeGroup.getChildIndex(envelopeLid) !== index)
							envelopeGroup.setChildIndex(envelopeLid, index);
						envelopeFlap.scale.y = lid.flapScale;
						envelopeSealUpper.y = lid.upperY - 150;
						envelopeSealUpper.scale.y = lid.upperScale;
						envelopeSealLower.y = lid.lowerY - 150;
						envelopeLight.alpha = 0.55 * p.flap;
					}
				}
				if (wildLight && wildHalo) {
					const w = wildSymbolFrame(age, reduced);
					wildLight.tint = wildHalo.tint = color;
					wildLight.alpha = w.light * 0.9;
					wildHalo.alpha = w.halo * 0.45;
					wildGlints.forEach((g, i) => {
						g.tint = color;
						g.alpha = w.glints[i] * 0.8;
					});
				}
			},
			destroy() {
				view.destroy({ children: true });
			},
		};
	}
	return {
		create,
		destroy() {
			for (const t of textures) t.destroy(true);
		},
	};
}
export type ClusterSymbol = NonNullable<
	ReturnType<Awaited<ReturnType<typeof loadClusterSymbols>>['create']>
>;
