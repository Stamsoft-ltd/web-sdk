// The scene walk that IS the sprite clock (see SceneAnimationDriver.svelte for why `Ticker.shared`
// stays stopped and this owns the advance instead).
//
// It lives in a plain module rather than inside the component so a test can drive it with a fixed
// delta — that is the whole of plan 14's "deterministic clock". Be honest about its reach: this
// advances AnimatedSprites and Spines in a subtree and NOTHING else. Board's pulse rAF, Win's
// breathe rAF, ExpandedSymbolOverlay's rAF, Svelte `Tween`s and the sequence `setTimeout`s all run
// on their own wall clocks and are untouched by it.

type SceneNode = {
	children?: SceneNode[];
	// AnimatedSprite
	gotoAndStop?: unknown;
	playing?: boolean;
	textures?: { length: number };
	// Spine
	skeleton?: unknown;
	state?: unknown;
	update?: unknown;
};

/**
 * Advance every playing AnimatedSprite (delta in PIXI frames) and every Spine (delta in SECONDS)
 * in the subtree. Both deltas are INJECTED rather than read from a ticker, so a deterministic
 * clock can drive this with a fixed step.
 * Every node is guarded individually: one bad frame must not take down the ticker.
 */
export const advance = (node: SceneNode, deltaFrames: number, deltaSeconds: number) => {
	// AnimatedSprite: has gotoAndStop + a textures array + update(). Advance only while playing.
	if (
		typeof node.gotoAndStop === 'function' &&
		typeof node.update === 'function' &&
		node.playing &&
		node.textures?.length
	) {
		try {
			(node.update as (t: { deltaTime: number }) => void)({ deltaTime: deltaFrames });
		} catch {
			/* ignore a bad frame */
		}
	} else if (node.skeleton && node.state && typeof node.update === 'function') {
		// Spine (spine-pixi v8): advance its AnimationState/skeleton. update() takes SECONDS.
		try {
			(node.update as (seconds: number) => void)(deltaSeconds);
		} catch {
			/* ignore a bad frame */
		}
	}
	const kids = node.children;
	if (kids) for (let i = 0; i < kids.length; i++) advance(kids[i], deltaFrames, deltaSeconds);
};
