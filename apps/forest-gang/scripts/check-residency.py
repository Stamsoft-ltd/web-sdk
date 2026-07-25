#!/usr/bin/env python3
"""Asset residency by load pass — run from the repo root:

    python3 apps/forest-gang/scripts/check-residency.py

Plan 11 (docs/plans/11-asset-residency-and-prewarm.md) Verify #4 asks for a residency figure
WITH ITS SCOPE STATED, because the audit's key-summed totals double-counted assets whose keys
share a source URL (PIXI caches by URL, so a page shared by three keys is resident once).

SCOPE, explicitly:
  * counted: every distinct image URL reachable from src/game/assets.ts — single sprites, the
    atlas page of each sprite sheet, and every page of each Spine atlas — deduplicated by URL.
  * decoded = width x height x 4 bytes. That is the CPU-side decode; since plan 11 the prewarm
    uploads the same set to the GPU at load time, so treat it as the GPU figure too.
  * NOT counted: fonts, audio, render targets, framebuffers, and pixi's own internal textures.
    This is the art pool, not total process memory.

The pass split mirrors the loader:
  preload   Asset.preload  — before the loading screen paints
  blocking  neither flag   — gates `loaded`, i.e. first playability
  defer wN  Asset.defer    — background stream, ascending Asset.deferPriority
  demand    Asset.deferDemand — withheld until game/utils.ts asks for it (bonus art). A session
            that never enters a bonus never pays this, which is the point of the plan.

No third-party imports on purpose (check_sheet_sizes.py needs PIL; this one does not).
"""
import json
import os
import re
import struct
import sys
from collections import defaultdict

APP = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
SRC = open(os.path.join(APP, 'src/game/assets.ts')).read()


def parse_entries():
    """key -> {type, src[]}, by brace-matching each top-level entry (they are written both
    single-line and multi-line, so a line regex is not enough)."""
    out = {}
    for m in re.finditer(r"^\t(\w+): \{", SRC, re.M):
        i, depth = m.end() - 1, 0
        while True:
            if SRC[i] == '{':
                depth += 1
            elif SRC[i] == '}':
                depth -= 1
            if depth == 0:
                break
            i += 1
        body = SRC[m.end():i]
        atlas = re.search(r"atlas: '([^']+)'", body)
        srcs = [atlas.group(1)] if atlas else re.findall(r"src: '([^']+)'", body)
        kind = re.search(r"type: '(\w+)'", body)
        out[m.group(1)] = {
            'type': kind.group(1) if kind else '?',
            'src': srcs,
            'preload': 'preload: true' in body,
        }
    return out


def key_list(name):
    m = re.search(name + r"[^=]*= \[(.*?)\];", SRC, re.S)
    return re.findall(r"'(\w+)'", m.group(1)) if m else []


def dims(url):
    """(width, height, bytes-on-disk) straight from the PNG/WebP header."""
    path = os.path.join(APP, 'static', url.split('?')[0].lstrip('./'))
    if not os.path.exists(path):
        return None
    head = open(path, 'rb').read(64)
    size = os.path.getsize(path)
    if head[:8] == b'\x89PNG\r\n\x1a\n':
        w, h = struct.unpack('>II', head[16:24])
        return w, h, size
    if head[:4] == b'RIFF' and head[8:12] == b'WEBP':
        codec = head[12:16]
        if codec == b'VP8X':
            return (int.from_bytes(head[24:27], 'little') + 1,
                    int.from_bytes(head[27:30], 'little') + 1, size)
        if codec == b'VP8L':
            bits = int.from_bytes(head[21:25], 'little')
            return (bits & 0x3FFF) + 1, ((bits >> 14) & 0x3FFF) + 1, size
        if codec == b'VP8 ':
            return (int.from_bytes(head[26:28], 'little') & 0x3FFF,
                    int.from_bytes(head[28:30], 'little') & 0x3FFF, size)
    return 0, 0, size


def urls_for(entry):
    """Every image URL whose pixels end up resident for this asset key."""
    out = []
    for s in entry['src']:
        base, folder = s.split('?')[0], os.path.dirname(s.split('?')[0])
        path = os.path.join(APP, 'static', base.lstrip('./'))
        if base.endswith('.json') and entry['type'] in ('sprites', 'spriteSheet'):
            if os.path.exists(path):
                out.append(folder + '/' + json.load(open(path))['meta']['image'])
        elif base.endswith('.atlas'):  # Spine: one line per page
            if os.path.exists(path):
                out += [folder + '/' + ln.strip() for ln in open(path)
                        if ln.strip().endswith(('.png', '.webp'))]
        elif base.endswith(('.png', '.webp', '.jpg', '.avif')):
            out.append(base)
    return out


def main():
    entries = parse_entries()
    demand = set(key_list('DEMAND_BONUS_ART'))
    wave0 = set(key_list('DEFER_WAVE_0'))
    deferred = set(key_list('DEFERRED_KEYS')) | set(key_list('MOBILE_ONLY_KEYS')) | set(
        key_list('DESKTOP_ONLY_KEYS'))

    def pass_of(key, e):
        if key in demand:
            return 'demand'
        if e['preload']:
            return 'preload'
        if key in deferred:
            return 'defer w0' if key in wave0 else 'defer w1'
        return 'blocking'

    grouped = defaultdict(list)
    for key, e in entries.items():
        grouped[pass_of(key, e)].append(key)

    unresolved, seen, report = [], {}, {}
    for name in ('preload', 'blocking', 'defer w0', 'defer w1', 'demand'):
        uniq = {}
        for key in grouped[name]:
            for url in urls_for(entries[key]):
                if url in uniq:
                    continue
                d = dims(url)
                if d is None:
                    unresolved.append(f'{key} -> {url}')
                else:
                    uniq[url] = d
        report[name] = (len(grouped[name]), len(uniq),
                        sum(w * h * 4 for w, h, _ in uniq.values()),
                        sum(b for _, _, b in uniq.values()))
        seen.update(uniq)

    mib = lambda n: n / 1048576
    print(f"{'pass':<10}{'keys':>6}{'urls':>6}{'decoded MiB':>14}{'transfer MiB':>14}")
    for name, (nk, nu, dec, disk) in report.items():
        print(f'{name:<10}{nk:>6}{nu:>6}{mib(dec):>14.1f}{mib(disk):>14.1f}')
    total_dec = sum(w * h * 4 for w, h, _ in seen.values())
    total_disk = sum(b for _, _, b in seen.values())
    print(f'{"TOTAL":<10}{len(entries):>6}{len(seen):>6}{mib(total_dec):>14.1f}{mib(total_disk):>14.1f}')

    dem = report['demand']
    print(f'\nresident for a session that never enters a bonus: '
          f'{mib(total_dec - dem[2]):.1f} MiB decoded '
          f'({mib(total_disk - dem[3]):.1f} MiB transferred)')
    print(f'withheld until game/utils.ts asks for it:         '
          f'{mib(dem[2]):.1f} MiB decoded ({mib(dem[3]):.1f} MiB transferred)')

    if unresolved:
        print('\nFAILURES — asset URLs that resolve to no file:')
        for u in unresolved:
            print(' -', u)
        return 1
    print('\nALL PASS')
    return 0


if __name__ == '__main__':
    sys.exit(main())
