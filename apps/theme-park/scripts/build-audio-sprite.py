#!/usr/bin/env python3
"""Build the Howler audio sprite for theme-park from the individual source WAVs.

Concatenates every clip into one timeline (with a short silence gap so one-shots
do not bleed into each other), encodes the timeline to ogg + mp3, and writes the
Howler sprite map (name -> [offsetMs, durationMs, loop?]) to sounds.json.

Loops (music + looping sfx) get their duration FLOORED to stay strictly inside
the clip, so Howler's segment loop never crosses into the trailing silence and
clicks. One-shots keep their full (rounded) length.

Usage: python3 scripts/build-audio-sprite.py "/path/to/source/wav/folder"
"""
import json
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
OUT_DIR = HERE.parent / "static" / "assets" / "audio"
GAP_S = 0.30                     # silence between clips
RATE = 48000
CHANNELS = 2

# Source clips that sit well below the rest of the mix; pre-boost them here (in
# dB) since Howler's per-sound volume can only attenuate, never amplify.
GAIN_DB = {
    "regular_win.wav": 8.0,
    "win_count_loop.wav": 3.0,
    "roller_wilds_bonus_end_final_screen.wav": 3.5,
}

# Per-sound playback volume written into sounds.json config (the player can only
# attenuate, 0-1). Music beds sit quietly under the SFX like the old ambient bed
# (~0.16 effective); the big-win beds ride louder; SFX play at source level.
VOLUME = {
    "bgm_main": 0.40, "bgm_freespin": 0.40, "bgm_coaster_setup": 0.40,
    "bgm_duck_bonus": 0.40, "bgm_roller_wilds": 0.40,
    "bgm_bigwin_sweet": 0.80, "bgm_bigwin_wild": 0.80, "bgm_bigwin_epic": 0.80,
    "bgm_bigwin_legendary": 0.80, "bgm_bigwin_mythic": 0.80,
    "sfx_reel_spin_loop": 0.60, "sfx_win_count_loop": 0.90,
}
DEFAULT_VOLUME = 1.0

# (source file, sprite name, loop, aliases). One entry per source clip; aliases
# reuse the same [offset,duration] window under another name.
CLIPS = [
    ("music_base_theme_loop.wav",                 "bgm_main",              True,  []),
    ("music_mega_coaster_freespins_loop.wav",     "bgm_freespin",          True,  []),
    ("music_mega_coaster_setup.wav",              "bgm_coaster_setup",     True,  []),
    ("music_duck_your_luck_loop.wav",             "bgm_duck_bonus",        True,  []),
    ("music_roller_wilds_loop.wav",               "bgm_roller_wilds",      True,  []),
    ("music_bigwin_sweet_win_loop.wav",           "bgm_bigwin_sweet",      True,  []),
    ("music_bigwin_wild_win_loop.wav",            "bgm_bigwin_wild",       True,  []),
    ("music_bigwin_epic_win_loop.wav",            "bgm_bigwin_epic",       True,  []),
    ("music_bigwin_legendary_win_loop.wav",       "bgm_bigwin_legendary",  True,  []),
    ("music_bigwin_mythic_win_loop.wav",          "bgm_bigwin_mythic",     True,  []),
    ("spin_press.wav",                            "sfx_btn_spin",          False, ["sfx_btn_general"]),
    ("reel_stop.wav",                             "sfx_reel_stop",         False, []),
    ("reel_spin_loop.wav",                        "sfx_reel_spin_loop",    True,  []),
    ("regular_win.wav",                           "sfx_regular_win",       False, []),
    ("win_count_loop.wav",                        "sfx_win_count_loop",    True,  []),
    ("megawild_drop.wav",                         "sfx_megawild_drop",     False, []),
    ("megawild_reel_expand.wav",                  "sfx_megawild_expand",   False, []),
    ("duck_land.wav",                             "sfx_duck_land",         False, []),
    ("duck_click_insade_Duck_Your_Luck_Bonus.wav","sfx_duck_click",        False, []),
    ("mega_coaster_scatter_land.wav",             "sfx_coaster_scatter_land", False, []),
    ("duck_you_luck_scatter_land.wav",            "sfx_duck_scatter_land", False, []),
    ("roller_wilds_scatter_land.wav",             "sfx_roller_scatter_land", False, []),
    ("mega_coaster_bonus_end_final_screen.wav",   "sfx_coaster_bonus_end", False, []),
    ("duck_your_luck_bonus_end_final_screen.wav", "sfx_duck_bonus_end",    False, []),
    ("roller_wilds_bonus_end_final_screen.wav",   "sfx_roller_bonus_end",  False, []),
    ("mega_coaster_bonus_duck_pukeing_splash.wav","sfx_coaster_duck_splash", False, []),
]


def probe_duration(path: Path) -> float:
    out = subprocess.check_output([
        "ffprobe", "-v", "error", "-show_entries", "format=duration",
        "-of", "csv=p=0", str(path),
    ])
    return float(out.strip())


def to_pcm(src: Path, dst: Path, gain_db: float = 0.0) -> None:
    cmd = [
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(src),
        "-ac", str(CHANNELS), "-ar", str(RATE),
    ]
    if gain_db:
        cmd += ["-af", f"volume={gain_db}dB"]
    cmd += ["-c:a", "pcm_s16le", str(dst)]
    subprocess.check_call(cmd)


def make_silence(dst: Path, seconds: float) -> None:
    subprocess.check_call([
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
        "-f", "lavfi", "-i", f"anullsrc=r={RATE}:cl=stereo",
        "-t", f"{seconds}", "-c:a", "pcm_s16le", str(dst),
    ])


def main() -> None:
    if len(sys.argv) < 2:
        sys.exit("usage: build-audio-sprite.py <source-wav-folder>")
    srcdir = Path(sys.argv[1]).expanduser()
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    missing = [c[0] for c in CLIPS if not (srcdir / c[0]).exists()]
    if missing:
        sys.exit(f"missing source files: {missing}")

    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        silence = tmp / "silence.wav"
        make_silence(silence, GAP_S)

        concat_lines = []
        sprite: dict[str, list] = {}
        offset_ms = 0.0
        for i, (fname, name, loop, aliases) in enumerate(CLIPS):
            src = srcdir / fname
            pcm = tmp / f"{i:02d}.wav"
            to_pcm(src, pcm, GAIN_DB.get(fname, 0.0))
            dur_s = probe_duration(pcm)
            dur_ms = dur_s * 1000.0
            start = round(offset_ms)
            # Loops floor (never cross into the gap); one-shots keep full tail.
            length = int(dur_ms) if loop else round(dur_ms)
            entry = [start, length] + ([True] if loop else [])
            sprite[name] = entry
            for alias in aliases:
                sprite[alias] = list(entry)
            concat_lines.append(f"file '{pcm.as_posix()}'")
            concat_lines.append(f"file '{silence.as_posix()}'")
            offset_ms += dur_ms + GAP_S * 1000.0

        listfile = tmp / "concat.txt"
        listfile.write_text("\n".join(concat_lines) + "\n")
        master = tmp / "master.wav"
        subprocess.check_call([
            "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
            "-f", "concat", "-safe", "0", "-i", str(listfile),
            "-c:a", "pcm_s16le", str(master),
        ])

        # ogg (libvorbis) + mp3 (libmp3lame). Stereo 48k, quality tuned for web.
        # This ffmpeg build ships only the native (experimental) Vorbis encoder,
        # not libvorbis; -strict -2 unlocks it. The mp3 is the fallback source, so
        # Safari (no ogg/vorbis) is covered regardless.
        subprocess.check_call([
            "ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(master),
            "-c:a", "vorbis", "-strict", "-2", "-q:a", "5", str(OUT_DIR / "sounds.ogg"),
        ])
        subprocess.check_call([
            "ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(master),
            "-c:a", "libmp3lame", "-b:a", "192k", str(OUT_DIR / "sounds.mp3"),
        ])

    doc = {
        "sprite": dict(sorted(sprite.items())),
        "src": ["./assets/audio/sounds.ogg", "./assets/audio/sounds.mp3"],
        # config.volume is a per-sound multiplier the player reads; the engine
        # crashes if the map is absent, so emit an entry for every sprite name.
        "config": {
            name: {"volume": VOLUME.get(name, DEFAULT_VOLUME)}
            for name in sorted(sprite)
        },
    }
    (OUT_DIR / "sounds.json").write_text(json.dumps(doc, indent="\t") + "\n")
    print(f"wrote {len(sprite)} sprite entries; total timeline "
          f"{offset_ms/1000:.1f}s -> {OUT_DIR}")
    for name, entry in sorted(sprite.items()):
        print(f"  {name:26s} {entry}")


if __name__ == "__main__":
    main()
