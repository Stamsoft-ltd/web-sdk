#!/usr/bin/env python3
"""The super and hidden bonuses' music, made from the bonus music (public/audio/music-bonus.mp3,
the user's "Bonus Game Music v2", which the normal bonus keeps as it is). User 2026-10-29: "separate
sounds for the 3 bonuses to be different and cool".

  super   the sunset dunes and candy tree: two semitones up, 6% quicker, brighter on top, wider,
          with a sugar shimmer (the track an octave up, high-passed, mixed in low)
  hidden  the neon cavern: three semitones down, 6% slower, darker, warmer underneath, with a
          slow phaser and the cavern's echo off the walls
  mystery the mystery egg's reveal (user 2026-11-04: "make the music on mystery screen to be
          mystery"): four semitones down at 80% speed, muffled, a slow tremble, a long hall
          echo, and a ghostly octave-up whisper of itself drifting over the top

Each one loops: the track is rendered three times end to end and the middle pass kept, so its
start carries the echo tail and the pitch-shifter's state from the end of the pass before it,
the way it plays back to back (sound.ts's bedPass). Loudness is matched to the source's mean.

    python3 apps/split-party/scripts/build-bonus-music.py [variant ...]   (default: all)
"""
import re
import sys
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
AUDIO = ROOT / 'public' / 'audio'
SRC = AUDIO / 'music-bonus.mp3'
RATE = 48000

VARIANTS = {
    'music-bonus-super': {
        'tempo': 1.06,
        'chain': (
            '[0:a]rubberband=pitch=1.12246:tempo=1.06:pitchq=quality,asplit[a][b];'
            '[b]rubberband=pitch=2:pitchq=quality,highpass=f=2600,volume=0.16[s];'
            '[a][s]amix=inputs=2:normalize=0,highshelf=f=6500:g=3,'
            'equalizer=f=900:t=q:w=1:g=-1.5,extrastereo=m=1.25'
        ),
    },
    'music-bonus-hidden': {
        'tempo': 0.94,
        'chain': (
            '[0:a]rubberband=pitch=0.84090:tempo=0.94:pitchq=quality,'
            'lowpass=f=4200,equalizer=f=110:t=q:w=1:g=3,'
            'aphaser=in_gain=0.8:out_gain=0.9:delay=3:decay=0.3:speed=0.22:type=t,'
            'aecho=0.85:0.75:260|540:0.3|0.18,extrastereo=m=1.35'
        ),
    },
    'music-mystery': {
        'tempo': 0.8,
        'chain': (
            '[0:a]rubberband=pitch=0.79370:tempo=0.8:pitchq=quality,asplit[a][b];'
            '[b]rubberband=pitch=2:pitchq=quality,highpass=f=3200,'
            'aecho=0.8:0.9:700|1300:0.45|0.3,volume=0.12[w];'
            '[a]lowpass=f=1900,equalizer=f=90:t=q:w=1:g=3,tremolo=f=0.6:d=0.25[d];'
            '[d][w]amix=inputs=2:normalize=0,'
            'aecho=0.8:0.8:420|880:0.35|0.22,extrastereo=m=1.4'
        ),
    },
}
WANT = sys.argv[1:] or list(VARIANTS)


def run(*args: str) -> str:
    return subprocess.run(['ffmpeg', '-hide_banner', '-nostdin', '-y', *args], check=True, capture_output=True, text=True).stderr


def samples(path: Path) -> int:
    out = subprocess.run(
        ['ffprobe', '-v', 'error', '-select_streams', 'a:0', '-count_packets', '-show_entries', 'stream=duration_ts,sample_rate',
         '-of', 'default=nw=1', str(path)], check=True, capture_output=True, text=True).stdout
    return int(re.search(r'duration_ts=(\d+)', out).group(1))


def mean_db(path: Path) -> float:
    err = run('-i', str(path), '-af', 'volumedetect', '-f', 'null', '-')
    return float(re.search(r'mean_volume: (-?[\d.]+) dB', err).group(1))


with tempfile.TemporaryDirectory() as tmp:
    tmp = Path(tmp)
    one = tmp / 'one.wav'
    run('-i', str(SRC), '-ar', str(RATE), '-ac', '2', '-c:a', 'pcm_f32le', str(one))
    n = samples(one)
    three = tmp / 'three.wav'
    run('-stream_loop', '2', '-i', str(one), '-c:a', 'pcm_f32le', str(three))
    target = mean_db(SRC)
    for name, v in ((k, VARIANTS[k]) for k in WANT):
        wet = tmp / f'{name}-wet.wav'
        run('-i', str(three), '-filter_complex', v['chain'], '-ar', str(RATE), '-c:a', 'pcm_f32le', str(wet))
        # The middle pass, in the stretched timeline.
        a, b = round(n / v['tempo']), round(2 * n / v['tempo'])
        mid = tmp / f'{name}.wav'
        run('-i', str(wet), '-af', f'atrim=start_sample={a}:end_sample={b},asetpts=N/SR/TB', '-c:a', 'pcm_f32le', str(mid))
        gain = target - mean_db(mid)
        out = AUDIO / f'{name}.mp3'
        run('-i', str(mid), '-af', f'volume={gain:.2f}dB,alimiter=limit=0.97:level=false', '-c:a', 'libmp3lame', '-q:a', '2',
            '-map_metadata', '-1', str(out))
        print(f'{out.name}: {(b - a) / RATE:.2f}s, gain {gain:+.2f}dB, mean {mean_db(out):.1f}dB (source {target:.1f})')
