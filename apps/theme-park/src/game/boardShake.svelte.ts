/**
 * A presentation-only jolt applied to the whole board.
 *
 * It lives outside any component because the reels and the frame are drawn from separate
 * <MainContainer>s: if only the symbol layer moved, the reels would slide around inside a frame that
 * stayed nailed down, which reads as a bug rather than as impact. Both read this and add it to their
 * container position, so the board moves as one object.
 *
 * Units are the board's own design units (the same space `boardLayout()` returns), so it must be
 * applied before <MainContainer>'s scale — i.e. added straight to the container's x/y.
 */
export const boardShake = $state({ x: 0, y: 0 });
