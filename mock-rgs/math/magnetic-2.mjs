// magnetic-2 starts from magnetic's math. Replace these re-exports with a real
// implementation as soon as the two games' books diverge — until then, sharing
// the module keeps a magnetic math fix from silently skipping magnetic-2.
export { getRoundForMode, getReplayRound } from './magnetic.mjs';
