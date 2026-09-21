Source sounds, one file per name in src/game/sound.ts (<soundName>.<ext>). Run
`node scripts/build-sounds.mjs` to rebuild the Howler sprite in static/assets/veggie-salad/audio/.

Delivered 2026-09-18 as "Sounds Gorgo" (10 files); the original names were:
  bgm_base         Base game loop.m4a                          (20.8s, loops)
  bgm_bonus        Bonuses loop.m4a                            (20.8s, loops)
  bgm_bigwin       big win loop.m4a                            (8.0s, loops)
  sfx_win_loop     small win loop.m4a                          (4.4s, loops)
  jng_bonus_intro  Entering Bonus window music.m4a             (6.6s)
  jng_bonus_outro  end of bonus final screen win music.m4a     (9.6s)
  sfx_reels_fall   Reels faling sound.mp3                      (2.0s)
  sfx_reels_land   reels landing sound.mp3                     (0.5s)
  sfx_scatter_land Scatter Land sound.mp3                      (0.5s)
  sfx_button       button click sound.mp3                      (0.5s)
Delivered 2026-09-21 (2 files), the cluster chimes:
  sfx_cluster       connection cluster normal.mp3              (0.5s)  a cluster pays at 1x
  sfx_cluster_multi connection cluster with multi.mp3          (0.5s)  a cluster pays through a multiplier
The .m4a files are Opus-in-MP4, which Safari cannot decode — another reason everything goes
through the sprite build (mp3 + ogg) rather than being served as delivered.

bgm_base.wav (2026-09-21) replaces the delivered bgm_base.m4a (kept in original/): the export was
20.773s for a 27-beat phrase at 77.5 bpm (20.903s) — 70ms of silence before the music, the last
beat's decay cut 130ms short — so every loop stumbled and dipped at the seam. The wav is the same
audio re-cut to the exact period: downbeat first, the cut-off decay bridged by mirroring the tail
(continuous at the join, faded out), then the 230ms pre-roll leading back into the downbeat.
Rebuilt by the numpy recipe in the 2026-09-21 session; grid fitted from the onsets, not guessed.
