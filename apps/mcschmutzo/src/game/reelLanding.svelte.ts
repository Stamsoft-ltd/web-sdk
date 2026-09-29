// When each reel last LANDED (performance.now() ms) — set the moment a reel's motion enters
// 'bouncing'. Symbols read this to play their landing bounce, so it works even though the reel swaps
// in fresh symbol objects around the landing (instances that mount mid-bounce still animate in sync).
export const reelLandedAt = $state<number[]>([]);
