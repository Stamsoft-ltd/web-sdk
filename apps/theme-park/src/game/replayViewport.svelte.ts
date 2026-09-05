import { stateUi } from 'state-shared';

/**
 * How much of the viewport's bottom edge the replay HUD occupies, in canvas px.
 *
 * Replay mode does not render <HudHtml>, so the control-bar reservation every branch of
 * `boardLayout()` makes is reserving a bar that is not there — and the replay panel, which IS there,
 * is reserved by nobody. That is what put the bottom reel row behind the panel in Popout S: the
 * panel never overflowed the window (so every overflow check passed), it overlapped the board.
 *
 * The panel is HTML, and its height depends on the container breakpoint it lands in, the translated
 * labels and the currency string — nothing the pixi layout can predict. <ReplayHud> measures the
 * rendered panel and publishes it here; `boardLayout()` then reserves it exactly the way it reserves
 * the control bar. Zero until measured, and zero outside replay, so play mode is untouched.
 */
export const stateReplayViewport = $state({
	bottomReservePx: 0,
});

export const replayBottomReservePx = () =>
	stateUi.config.mode === 'replay' ? stateReplayViewport.bottomReservePx : 0;
