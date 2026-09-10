/**
 * Who is holding the HUD down.
 *
 * `stateGame.celebrationActive` dims and disables the HTML HUD (HudHtml) while a celebration is on
 * screen — it is DOM above the pixi canvas, so no pixi scrim can reach it. THREE components raise
 * it: the big-win card (Win), the two congratulations panels (WonPanel) and the Mystery draw
 * (MysteryReveal). Each used to write the boolean directly, with an effect cleanup that set it back
 * to FALSE unconditionally — so whenever two of them overlapped by even one frame, the one leaving
 * cleared the hold of the one arriving and the bright bottom bar came back over a live celebration
 * (reported 2026-09-09 on the bonus-end outro, which follows a big-win card).
 *
 * So a hold is a TOKEN, not a boolean: the flag is true while any token is out, and releasing one
 * can only ever drop the flag if it was the last.
 */
export type CelebrationHost = { celebrationActive: boolean };

const holders = new Set<symbol>();

/** Raise the flag and return the release — call it from an `$effect`'s cleanup. */
export const holdCelebration = (stateGame: CelebrationHost) => {
	const token = Symbol('celebration');
	holders.add(token);
	stateGame.celebrationActive = true;
	return () => {
		holders.delete(token);
		stateGame.celebrationActive = holders.size > 0;
	};
};
