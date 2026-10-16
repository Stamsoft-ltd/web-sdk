import { Physics, RegionAttachment, type Skeleton } from '@esotericsoftware/spine-core';

/** Fit portal/reward independently from full-screen door panels. */
export function gateViewport(width: number, height: number, leafWidth: number, leafHeight: number) {
	if (![width, height, leafWidth, leafHeight].every((value) => Number.isFinite(value) && value > 0))
		throw new Error('Invalid gate viewport');
	const scale = Math.min(width, height) / 440;
	const doorScale = Math.max(width / (2 * leafWidth * scale), height / (leafHeight * scale)) * 1.03;
	// Height-cover in portrait magnified each leaf far beyond the whole screen width,
	// cropping its border/motif away. Fit each leaf to its screen half instead.
	const doorScaleX = width < height ? (width / (2 * leafWidth * scale)) * 1.03 : doorScale;
	const doorScaleY = width < height ? (height / (leafHeight * scale)) * 1.03 : doorScale;
	return {
		scale,
		doorScaleX,
		doorScaleY,
		halfDoorWidth: (leafWidth * doorScaleX) / 2,
		// Inner seam fully clears either screen edge, including portrait cropping.
		travelScale: (width / 2 + Math.min(width, height) * 0.05) / (650 * scale),
		// Keep the impact recoil and canvas antialiasing from exposing a seam.
		overlap: (Math.min(width, height) * 0.005) / scale,
	};
}

/** Call after the authored pose, before draw; setup/sample resets it every frame. */
export function projectFullscreenGate(skeleton: Skeleton, width: number, height: number) {
	const left = skeleton.findBone('door-left'),
		right = skeleton.findBone('door-right');
	const leaf = skeleton.findSlot('door-left')?.getAttachment();
	if (!left || !right || !(leaf instanceof RegionAttachment))
		throw new Error('Missing gate leaves');
	const view = gateViewport(width, height, leaf.width, leaf.height);
	left.x = (left.x - left.data.x) * view.travelScale - view.halfDoorWidth + view.overlap;
	right.x = (right.x - right.data.x) * view.travelScale + view.halfDoorWidth - view.overlap;
	for (const bone of [left, right]) {
		bone.scaleX *= view.doorScaleX;
		bone.scaleY *= view.doorScaleY;
	}
	skeleton.updateWorldTransform(Physics.update);
	return view.scale;
}
