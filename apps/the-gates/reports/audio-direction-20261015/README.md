# Gates audio direction — approval sketches v1

Status: user approved direction and local SFX integration. 26 compressed MP3 cues now wired into the game. No upload/publication performed; soundbank licensing remains an unresolved release gate. Approved base + initial bonus music are locally integrated with independent Music volume, scene crossfades and win ducking. All three bonus tracks are approved and locally integrated.
Original compositions, rendered with local macOS General MIDI sampled instruments.
Soundbank redistribution/commercial output licensing has not been cleared: these are reference sketches, not production-approved assets. Replace/clear the sound source before shipping.

## Listen / audio map

- `01-reel-landings.wav`: six marimba + pizzicato landings, 140ms apart. Six individual `reel-land-N.wav` assets retain the same mix gain. Actual game integration must use actual per-reel animation completion (not this fixed demo timing), once per moving reel, never once per cell. Cascades play only for reels with incoming symbols. Fast/Turbo need shorter tails/voice limiting; not integrated yet.
- `02-cascade.wav`: harp/celesta ascent with light string punctuation.
- `03-gate-portal.wav`: timpani impact → ascending harp + soft choir → horn/bell reveal. Combined direction demo; split/sync to gate animation for production.
- `04-win-fanfare.wav`: compact trumpet/horn motif, warm low brass, harp and timpani. Reference for tier progression, not all win tiers yet.

## Validation

27 stereo 44.1kHz PCM16 WAVs; non-silent, no clipped samples, fades at ends. No loops in this pack. Measured integrated levels and true peaks in `validation.json`. Reels ~−18 LUFS; cascade −17; portal/fanfare −16. Peaks below −4 dBTP, leaving mixing headroom. Short transient effects are not independently forced to −14 LUFS. Musical quality still needs human listening approval; no device listening QA claimed.

## Reproduce (macOS)

```sh
mkdir -p /tmp/gates-audio-v1
CLANG_MODULE_CACHE_PATH=/tmp/gates-swift-cache swift apps/the-gates/reports/audio-direction-20261015/render-preview.swift /tmp/gates-audio-v1
python3 apps/the-gates/reports/audio-direction-20261015/finish-preview.py /tmp/gates-audio-v1
```

Requires AVFoundation, local `gs_instruments.dls`, ffmpeg. Offline rendering may require host permission for AudioUnit discovery; no microphone or speaker playback requested.

## Next gate

Approve/reject the four sketches before full asset production or runtime integration. Direction approved. Expanded sketches now cover UI, spin start, wisp arrival, additive multiplier, multiplier boost, Wild, extra spin, retrigger, bonus entry/summary, gate close, portal retract, Key landing and Sweet/Epic/Mythic/Legendary variations (files 05–21). Local SFX and all four music scenes are now wired. Remaining release work: production source licensing/replacement and listening/device QA. These previews use a shared musical motif; not a claim of finished sound-design/mastering.


## Runtime integration

- `src/game/audio.ts`: lazy gesture-only AudioContext, fetch/decode once, no late cue replay, existing Sound volume/mute, visibility suspension, disconnect/abort/close on teardown. MP3 delivery ~710 kB total. Ten global voices maximum; six reel / three ordinary cue / one fanfare; short fade-outs and compressor for headroom. Fast/Turbo trim reel tails to 280/160ms.
- `src/game/reelAudio.ts` + GPU board: one cue per affected reel at final incoming tile contact, from actual `cellMotion`/wave clock. No per-cell triggers. Skip/resize does not duplicate; stale background contacts are dropped. Key has one soft accent per wave.
- Playback: spin start, cascade highlight, win tier, bonus entry/summary/retract/cap. Cancellation and presentation dismissal stop voices.
- Gate actor: crash/open sounds cross actual animation beats; no timer scheduled outside renderer. Reward cues play on the guarded first delivery arrival. Tumble wisp cue on its actual panel arrival.
- `tools/package-assets.mjs` retains all audio and provenance; no pruning or publication executed.
- Automated tests cover source assets, gesture gating, mute/unmute, voice budget, hidden-tab cleanup, six contacts, affected reels, skip/reset and reduced motion. Local no-money Chrome smoke has no audio errors; subjective listening/mobile hardware validation remains with user.


## Background music previews

- `base-music-preview.mp3` / `.wav`: 96 BPM, eight bars / 20 seconds, gentle harp/pizzicato bass, sparse celesta and marimba phrases.
- `bonus-music-preview.mp3` / `.wav`: 120 BPM, eight bars / 16 seconds, related D-minor adventure harmony with French horn, restrained trumpet, timpani and busier harp.
- Original notes/sequencing in `render-music.swift`; instrument recordings are the macOS GM soundbank, not original recordings and not AI-generated audio. No web downloads.
- Three consecutive cycles rendered; middle cycle extracted to preserve reverb at repeat. WAV loops have exact bar-length frame counts, no appended silence/fades. Boundary delta is below normal waveform 99th-percentile adjacent-sample changes; measured in `music-validation.json`. This is an automated seam check, not human listening approval or proof of gapless playback in every decoder.
- Previews mixed to −22 LUFS, leaving room for existing louder SFX. Music controls, ducking and scene crossfades are wired for the two approved tracks. Licensing clearance still required before publishing.

```sh
CLANG_MODULE_CACHE_PATH=/tmp/gates-swift-cache swift apps/the-gates/reports/audio-direction-20261015/render-music.swift /tmp/gates-audio-v1
python3 apps/the-gates/reports/audio-direction-20261015/finish-music.py /tmp/gates-audio-v1
```


## Three bonus identities (requested follow-up)

- Normal: retain approved `bonus-music-preview` (120 BPM, 16s, brass/timpani).
- Super preview: `super-music-preview` (128 BPM, 15s); distinct syncopated pizzicato pulse, horn/trumpet call-and-response, Dm/C/Bb/A harmony. Not a speed/pitch transform of Normal.
- Hidden preview: `hidden-music-preview` (100 BPM, 19.2s); broad majestic horns, soft choir, glinting harp/celesta, Dm/Gm/Bb/A harmony. Not a speed/pitch transform of Normal.
- Base retains gentle 96 BPM track. Runtime now routes visible Normal/Super/Hidden scenes to their respective tracks; base remains independent. All four tracks are in the runtime asset closure.
- All loops measured −22 LUFS, no clipped samples; exact eight-bar durations and sample-seam checks in `music-validation.json`. User approved Super/Hidden. Source licensing remains a release gate.
- Reproduce new scores: `swift apps/the-gates/reports/audio-direction-20261015/render-bonus-variants.swift /tmp/gates-audio-v1`, then `finish-music.py` as above.
