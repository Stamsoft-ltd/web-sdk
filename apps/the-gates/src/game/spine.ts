/** Shared Spine 4.2 loader/actor for the single Pixi renderer.
 * Optional Canvas2D authoring renderer lives in tools/spine-canvas.ts, not the game bundle. */
import {
	AnimationState,
	AnimationStateData,
	AtlasAttachmentLoader,
	FakeTexture,
	Physics,
	Skeleton,
	SkeletonData,
	SkeletonJson,
	TextureAtlas,
	type Animation,
} from '@esotericsoftware/spine-core';

import { loadAssetImage, recordAssetFetch } from './imageAssets.ts';
import { motionMetrics } from './motionMetrics.ts';
export const spineMetrics = () => motionMetrics(0);

export const WILD_ROOT = './assets/the-gates/rainbow-wild-20261016/';
export const LEGACY_SPINE_ROOT = './assets/the-gates/spine/';
const atlasCache = new Map<string, Promise<TextureAtlas>>();
const rigCache = new Map<string, Promise<SkeletonData>>();
const jsonCache = new Map<string, Promise<Record<string, unknown>>>();
async function checked(url: string) {
	recordAssetFetch();
	const r = await fetch(url);
	if (!r.ok) throw new Error(`Spine asset ${r.status}: ${url}`);
	return r;
}
async function loadAtlas(name: string, root: string) {
	const url = new URL(`${root}${name}.atlas`, document.baseURI).href;
	if (!atlasCache.has(url)) {
		const request = (async () => {
			const atlas = new TextureAtlas(await (await checked(url)).text());
			await Promise.all(
				atlas.pages.map(async (page) => {
					const pageUrl = new URL(page.name, url).href;
					page.setTexture(new FakeTexture(await loadAssetImage(pageUrl)));
				}),
			);
			return atlas;
		})();
		atlasCache.set(url, request);
	}
	return atlasCache.get(url)!;
}
/** Seeded overrides are per actor, never cached by event ID (bounded memory). */
export async function loadRig(
	name: string,
	atlasName: string,
	root = LEGACY_SPINE_ROOT,
	animations?: Record<string, unknown>,
): Promise<SkeletonData> {
	if (name === 'WILD' && root === LEGACY_SPINE_ROOT) root = WILD_ROOT;
	const key = `${root}:${atlasName}:${name}`;
	const parse = async () => {
		const url = `${root}${name}.json`;
		if (!jsonCache.has(url)) {
			const request = checked(url).then((r) => r.json());
			jsonCache.set(url, request);
		}
		const [atlas, json] = await Promise.all([loadAtlas(atlasName, root), jsonCache.get(url)!]);
		const source = animations
			? { ...json, animations: { ...(json.animations as Record<string, unknown>), ...animations } }
			: json;
		return new SkeletonJson(new AtlasAttachmentLoader(atlas)).readSkeletonData(source);
	};
	if (animations) {
		// Share immutable attachments/bones; parse only event tracks, not the whole rig again.
		const original = await loadRig(name, atlasName, root);
		const data = Object.assign(new SkeletonData(), original, {
			animations: original.animations.filter((a) => !Object.hasOwn(animations, a.name)),
		});
		const reader = new SkeletonJson(new AtlasAttachmentLoader(await loadAtlas(atlasName, root)));
		for (const [animation, tracks] of Object.entries(animations))
			reader.readAnimation(tracks, animation, data);
		return data;
	}
	if (!rigCache.has(key)) {
		const request = parse();
		rigCache.set(key, request);
	}
	return rigCache.get(key)!;
}

export class SpinePose {
	readonly skeleton: Skeleton;
	readonly state: AnimationState;
	readonly data: SkeletonData;
	constructor(data: SkeletonData, animation: string, offset = 0) {
		// Attachments/bones stay shared; event-specific animation tracks belong to this actor.
		this.data = Object.assign(new SkeletonData(), data, { animations: [...data.animations] });
		this.skeleton = new Skeleton(this.data);
		const mixes = new AnimationStateData(this.data);
		mixes.defaultMix = 0.14;
		this.state = new AnimationState(mixes);
		this.setAnimation(animation, offset);
	}
	overrideAnimation(animation: Animation) {
		this.data.animations = this.data.animations.filter((entry) => entry.name !== animation.name);
		this.data.animations.push(animation);
		if (this.state.getCurrent(0)?.animation?.name === animation.name) this.state.clearTracks();
	}
	setAnimation(animation: string, offset = 0) {
		if (this.state.getCurrent(0)?.animation?.name === animation) return;
		this.state.setAnimation(0, animation, true).trackTime = offset;
	}
	playIntro(intro: string, next: string) {
		this.state.setAnimation(0, intro, false);
		this.state.addAnimation(0, next, true, 0);
	}
	/** Exact non-looping pose, used by book-controlled waves and gate phases. */
	sample(animation: string, time: number) {
		// Older native WILD rig has idle/paying only. A setup pose is a skeleton state,
		// not a mandatory authored animation; don't throw when an award reveals a Wild.
		if (animation === 'setup' && !this.data.findAnimation('setup')) {
			this.state.clearTracks();
			this.skeleton.setToSetupPose();
			this.skeleton.updateWorldTransform(Physics.update);
			return;
		}
		if (this.state.getCurrent(0)?.animation?.name !== animation || this.state.getCurrent(0)?.loop) {
			this.state.clearTracks();
			this.state.setAnimation(0, animation, false);
		}
		this.skeleton.setToSetupPose();
		this.state.getCurrent(0)!.trackTime = Math.max(0, time);
		this.state.apply(this.skeleton);
		this.skeleton.updateWorldTransform(Physics.update);
	}
	update(delta: number) {
		this.state.update(delta);
		this.state.apply(this.skeleton);
		this.skeleton.update(delta);
		this.skeleton.updateWorldTransform(Physics.update);
	}
}
