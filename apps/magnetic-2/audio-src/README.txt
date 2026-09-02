Individual source sounds go here, named <soundName>.<ext> (e.g. sfx_reel_stop.wav).
Replace any file and run 'node scripts/build-sounds.mjs' to (re)generate the sprite in
static/assets/audio/. Names come from src/game/sound.ts; names without a source file map
to silence. NOTE: these wavs were extracted from the shipped sprite (lossy once) — swap in
originals whenever you have them.
