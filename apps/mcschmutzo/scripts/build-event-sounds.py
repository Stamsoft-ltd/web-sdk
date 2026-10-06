#!/usr/bin/env python3
"""
Builds McSchmutzo's event sounds into audio-src/, out of the game's own sounds wherever it can (so
they sit in the same palette) plus a few kitchen layers; then run `node scripts/build-sounds.mjs`.

  sfx_wild_land    the WILD letters slam onto the board: the reel-stop thud pitched down (heavier)
                   + the soup's splash burst + a ketchup splat with droplets
  sfx_pot_pop      the pot's multiplier pops to its new value: the soup "bloop" + the opening
                   rising phrase of the win tone, pitched up + bubbles popping
  sfx_line_squirt  a sauce win line draws: a short sputtering bottle squirt over a touch of splash
  sfx_chef_squirt  the chef's celebration squirt (big wins): a long squeeze, the stream, the glug

Every sound hits at 0 ms, so firing it on its visual's frame keeps the two in sync.
Needs numpy + ffmpeg.

    python3 scripts/build-event-sounds.py && node scripts/build-sounds.mjs
"""
import os
import subprocess
import tempfile

import numpy as np

SR = 44100
SRC = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'audio-src')
rng = np.random.default_rng(11)


def ffmpeg(*args):
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', *args], check=True)


def load(name, start_ms, ms, speed=1.0):
    """`ms` of stereo audio from an audio-src clip starting at start_ms, played at `speed`
    (< 1: slower and lower, > 1: faster and higher — resampled, like a tape)"""
    with tempfile.TemporaryDirectory() as tmp:
        raw = os.path.join(tmp, 'x.raw')
        # resample to SR/speed and play back at SR: a source second lasts 1/speed seconds
        ffmpeg('-ss', str(start_ms / 1000), '-t', str(ms / 1000 * speed), '-i', os.path.join(SRC, f'{name}.mp3'),
               '-ac', '2', '-ar', str(round(SR / speed)), '-f', 's16le', raw)
        x = np.frombuffer(open(raw, 'rb').read(), dtype='<i2').astype(float).reshape(-1, 2) / 32768
    fade = int(SR * 0.004)
    x[:fade] *= np.linspace(0, 1, fade)[:, None]  # no click where the slice starts
    return x.copy()


def lowpass(x, cutoff):
    """one-pole low-pass, per-sample cutoff (Hz)"""
    cutoff = np.broadcast_to(np.asarray(cutoff, float), x.shape)
    a = np.exp(-2 * np.pi * cutoff / SR)
    y = np.empty_like(x)
    s = 0.0
    for i in range(len(x)):
        s = (1 - a[i]) * x[i] + a[i] * s
        y[i] = s
    return y


def bandpass(x, f, q):
    """RBJ band-pass (constant peak), per-sample centre frequency"""
    f = np.broadcast_to(np.asarray(f, float), x.shape)
    y = np.zeros_like(x)
    x1 = x2 = y1 = y2 = 0.0
    for i in range(len(x)):
        w = 2 * np.pi * f[i] / SR
        al = np.sin(w) / (2 * q)
        a0 = 1 + al
        yi = (al * x[i] - al * x2 + 2 * np.cos(w) * y1 - (1 - al) * y2) / a0
        x2, x1, y2, y1 = x1, x[i], y1, yi
        y[i] = yi
    return y


def env(n, attack_ms, decay_ms):
    t = np.arange(n) / SR
    return np.minimum(1, t / max(attack_ms / 1000, 1e-4)) * np.exp(-t / (decay_ms / 1000))


def chirp(f0, f1, ms):
    n = int(SR * ms / 1000)
    u = np.arange(n) / n
    return np.sin(2 * np.pi * np.cumsum(f0 * (f1 / f0) ** u) / SR)


def stereo(m, pan=0.0, spread=0):
    """mono → stereo: pan -1..1, `spread` samples of L/R offset for width"""
    return np.stack([m * (1 - pan), np.roll(m, spread) * (1 + pan)], axis=1)


def place(buf, x, at_ms, gain):
    i = int(SR * at_ms / 1000)
    n = min(len(x), len(buf) - i)
    buf[i : i + n] += gain * x[:n]


def decay(x, ms):
    return x * np.exp(-np.arange(len(x)) / SR / (ms / 1000))[:, None]


def droplets(buf, drops, gain):
    for at, f0, pan in drops:
        place(buf, stereo(chirp(f0, f0 * 2.1, 26) * env(int(SR * 0.026), 1, 9), pan), at, gain)


def squirt(ms, f0, f1, sputter_hz, seed):
    """sauce forced through a nozzle: band-passed noise gliding f0 → f1, chopped by the sputter"""
    r = np.random.default_rng(seed)
    n = int(SR * ms / 1000)
    t = np.arange(n) / SR
    u = t / t[-1]
    noise = bandpass(r.standard_normal(n), f0 + (f1 - f0) * u ** 0.6, 2.2)
    chop = lowpass(0.55 + 0.45 * np.sign(np.sin(2 * np.pi * (sputter_hz + 12 * u) * t + r.uniform(0, 6.28))), 160)
    shape = np.minimum(1, t / 0.008) * np.where(u < 0.75, 1, 1 - (u - 0.75) / 0.25)
    return noise * chop * shape


def finish(name, out, peak_db):
    out = out - out.mean(axis=0)
    tail = int(SR * 0.03)
    out[-tail:] *= np.linspace(1, 0, tail)[:, None]
    out *= 10 ** (peak_db / 20) / np.abs(out).max()
    with tempfile.TemporaryDirectory() as tmp:
        raw = os.path.join(tmp, 'o.raw')
        open(raw, 'wb').write((out * 32767).astype('<i2').tobytes())
        ffmpeg('-f', 's16le', '-ar', str(SR), '-ac', '2', '-i', raw, '-b:a', '192k', os.path.join(SRC, f'{name}.mp3'))
    print('wrote', name)


def wild_land():
    out = np.zeros((int(SR * 0.56), 2))
    place(out, load('sfx_reel_stop', 440, 520, speed=0.88), 0, 0.9)  # the game's thud, heavier
    place(out, decay(load('sfx_soup_boost', 355, 520), 220), 0, 1.1)  # the soup's splash burst
    n = int(SR * 0.3)
    splat = lowpass(rng.standard_normal(n), 350 + 4650 * np.exp(-np.arange(n) / SR / 0.045)) * env(n, 1.5, 85)
    place(out, stereo(splat, spread=40), 0, 0.55)
    droplets(out, [(65, 720, 0.3), (110, 950, -0.4), (150, 640, 0.1), (205, 1100, -0.2), (275, 840, 0.45)], 0.09)
    finish('sfx_wild_land', out, -1.0)


def pot_pop():
    out = np.zeros((int(SR * 0.32), 2))
    place(out, decay(load('sfx_soup_boost', 0, 120), 70), 0, 0.8)  # the soup's bloop
    # the win tone's rising opening phrase (400 → 1000 Hz), a major third up and quicker
    place(out, decay(load('sfx_win_normal', 15, 260, speed=1.26), 160), 0, 1.0)
    # bubbles popping on the surface as the number lands
    for at, f0, pan in [(0, 380, 0.0), (45, 520, -0.3), (90, 460, 0.35), (150, 640, -0.15)]:
        place(out, stereo(chirp(f0, f0 * 2.4, 34) * env(int(SR * 0.034), 1, 12), pan), at, 0.22)
    finish('sfx_pot_pop', out, -2.0)


def line_squirt():
    out = np.zeros((int(SR * 0.34), 2))
    place(out, stereo(squirt(260, 750, 2300, 28, 3), spread=25), 0, 1.0)
    place(out, decay(load('sfx_soup_boost', 380, 200), 60), 0, 0.25)  # a touch of the soup's splash
    place(out, stereo(chirp(480, 190, 45) * env(int(SR * 0.045), 1, 16)), 235, 0.35)  # the last blob plops
    finish('sfx_line_squirt', out, -6.0)


def chef_squirt():
    out = np.zeros((int(SR * 0.72), 2))
    # the squeeze: a short low push of air before the sauce comes
    n = int(SR * 0.07)
    place(out, stereo(lowpass(rng.standard_normal(n), 900) * env(n, 4, 30)), 0, 0.5)
    place(out, stereo(squirt(480, 600, 1900, 22, 5), spread=60), 25, 1.0)
    # the bottle runs dry: two glugs
    place(out, stereo(chirp(420, 170, 60) * env(int(SR * 0.06), 2, 22), -0.1), 470, 0.45)
    place(out, stereo(chirp(360, 150, 70) * env(int(SR * 0.07), 2, 26), 0.1), 560, 0.35)
    finish('sfx_chef_squirt', out, -4.0)


if __name__ == '__main__':
    wild_land()
    pot_pop()
    line_squirt()
    chef_squirt()
