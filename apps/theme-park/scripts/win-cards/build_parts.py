"""Cut the Theme Park win cards into their separate, animatable parts.

The Figma win screens are not one flat card any more — each tier is a stack of loose images (panel,
tier wordmark, medallion ring, P badge, six coins) that the game is meant to animate independently.
This script turns those Figma nodes into game assets and emits the layout table the Svelte component
needs to put them back together.

Two traps, both already paid for once on the magnetic redesign:

  * the node EXPORT has a white fill baked in — every pixel comes back opaque. The transparent art is
    in `rawImages`, which arrives as a full-res RGBA and a quarter-size thumbnail of the same image.
    We take the largest raw that actually HAS transparency.
  * placement can't come from the trimmed art. A raw is the whole node box including its transparent
    margin, so the trim offsets have to be carried back into the layout numbers or every part lands
    slightly wrong.

Everything is expressed as a fraction of the PANEL node's box, so the component only needs one size
(the card size) and the parts follow.
"""

import json
import os
import pathlib

from PIL import Image

BASE = os.path.dirname(os.path.abspath(__file__))
APP = pathlib.Path(__file__).resolve().parents[2]
OUT = str(APP / 'static/assets/theme-park/v2/wins/parts')

# Node boxes as Figma reports them, in each Win frame's own coordinates. `src` is the downloaded raw.
# The coin source is shared by every tier and every position, so it is cut once.
TIERS = {
    'sweet': {
        'panel': ('raw3/swe_panel_d.png', 290.5, 25.5, 620, 620),
        'text': ('raw3/swe_text_d.png', 419.5, 25.5, 362, 362),
        'ring': ('raw3/swe_ring_d.png', 477, 291, 245, 245),
        'badge': ('raw/badge1.png', 568, 350, 85, 128),
        'coins': [(377.5, 244.5, 73, 76), (377.5, 319.5, 73, 76), (377.5, 401.5, 73, 76),
                  (737.5, 248.5, 74, 76), (737.5, 323.5, 74, 76), (737.5, 404.5, 74, 77)],
    },
    'wild': {
        'panel': ('raw3/wild_panel_d.png', 280, 16, 641, 641),
        'text': ('raw3/wild_text_d.png', 430, 14, 342, 355),
        'ring': ('raw3/wild_ring_d.png', 459, 248, 284, 284),
        'badge': ('raw3/wild_badge_d.png', 524, 305, 173, 173),
        'coins': [(351, 209, 89, 92), (351, 305, 89, 92), (351, 407, 89, 93),
                  (761, 205, 89, 93), (761, 299, 89, 93), (761, 403, 89, 93)],
    },
    'epic': {
        'panel': ('raw2/epi_panel_d.png', 277, 8, 646, 646),
        'text': ('raw2/epi_text_d.png', 389, 36, 405, 304),
        'ring': ('raw2/epi_ring_d.png', 487, 283, 249, 248),
        'badge': ('raw/badge1.png', 574, 340, 87, 131),
        'coins': [(369, 226, 81, 85), (369, 310, 81, 85), (369, 401, 81, 84),
                  (756, 230, 82, 85), (756, 314, 82, 85), (756, 405, 82, 85)],
    },
    'mythic': {
        'panel': ('raw/panel4.png', 276, 13, 649, 649),
        'text': ('raw/text1.png', 396, 45, 409, 272),
        'ring': ('raw/ring1.png', 494, 246, 212, 318),
        'badge': ('raw/badge1.png', 556, 332, 89, 133),
        'coins': [(372, 270, 69, 71), (372, 340, 69, 71), (372, 416, 69, 70),
                  (760, 270, 68, 71), (760, 340, 68, 71), (760, 416, 68, 70)],
    },
    'legendary': {
        'panel': ('raw2/leg_panel_a.png', 285, 27, 631, 631),
        'text': ('raw2/leg_text_a.png', 380, -29, 441, 441),
        'ring': ('raw2/leg_ring_a.png', 478, 278, 244, 244),
        'badge': ('raw/badge1.png', 562, 327, 97, 146),
        'coins': [(380, 254, 74, 77), (380, 330, 74, 77), (380, 412, 74, 77),
                  (747, 254, 74, 77), (747, 330, 74, 77), (747, 412, 74, 77)],
    },
}

COIN_SRC = 'raw/coin1.png'

# Longest edge each part is saved at. Sized against how big the part gets on a ~1400px (2x DPR) card:
# the panel carries the whole frame so it keeps its native resolution, the small parts do not need it.
MAX_EDGE = {'panel': 1254, 'text': 1100, 'ring': 760, 'badge': 460, 'coin': 340}


/** Alpha below this counts as empty when trimming. */
ALPHA_FLOOR = 8


def trim(img):
    """Crop transparent margin, returning the crop box alongside so placement can be corrected.

    Two things `Image.getbbox()` gets wrong here, both of which cost the coin its shape:

      * on an RGBA image it treats a pixel as non-empty if ANY channel is non-zero, and these raws
        carry faint non-zero RGB out in their fully transparent margin;
      * the alpha itself is not clean either — there is an invisible 1-to-7 halo spreading well past
        the art, so even an alpha-only bbox came back 20% wider than the coin.

    So the bbox is taken on alpha above a floor. This is invisible on the parts whose placement is
    corrected by the crop box below, but the coin is placed by its Figma node box instead (its fill
    is cropped, so the trim maths does not apply to it) and the dead margin squashed the disc into
    an ellipse.
    """
    alpha = np.array(img)[..., 3]
    ys, xs = np.where(alpha > ALPHA_FLOOR)
    box = (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1)
    return img.crop(box), box


def emit(img, path, max_edge):
    if max(img.size) > max_edge:
        s = max_edge / max(img.size)
        img = img.resize((max(1, round(img.width * s)), max(1, round(img.height * s))), Image.LANCZOS)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(path, 'WEBP', quality=90, method=6)
    return img.size, os.path.getsize(path)


def place(node, raw_size, crop):
    """Map a trim box in raw pixels onto the node's box in frame units."""
    nx, ny, nw, nh = node
    W, H = raw_size
    l, t, r, b = crop
    return (nx + nw * l / W, ny + nh * t / H, nw * (r - l) / W, nh * (b - t) / H)


# The coin fill is cropped by Figma (a 1536x1024 source shown in a ~70px square), so the trim-offset
# maths above does not apply to it: its node box already IS the visible disc. Cut once, place as-is.
coin_img, _ = trim(Image.open(os.path.join(BASE, COIN_SRC)).convert('RGBA'))
coin_size, coin_bytes = emit(coin_img, f'{OUT}/coin.webp', MAX_EDGE['coin'])
print(f'coin.webp              {coin_size}  {coin_bytes / 1024:.0f}KB')

layout = {}
total = coin_bytes
for tier, parts in TIERS.items():
    panel_node = parts['panel'][1:]
    px, py, pw, ph = panel_node
    entry = {}

    def rel(box):
        """Centre + size of a placed box, as fractions of the panel box (origin at panel centre)."""
        x, y, w, h = box
        return {
            'x': round((x + w / 2 - (px + pw / 2)) / pw, 5),
            'y': round((y + h / 2 - (py + ph / 2)) / ph, 5),
            'w': round(w / pw, 5),
            'h': round(h / ph, 5),
        }

    for role in ('panel', 'text', 'ring', 'badge'):
        src, *node = parts[role]
        img = Image.open(os.path.join(BASE, src)).convert('RGBA')
        cut, crop = trim(img)
        name = f'{OUT}/{tier}/{role}.webp'
        size, nbytes = emit(cut, name, MAX_EDGE[role])
        total += nbytes
        entry[role] = rel(place(node, img.size, crop))
        print(f'{tier:10s} {role:6s} {str(size):12s} {nbytes / 1024:6.0f}KB  {entry[role]}')

    entry['coins'] = [rel(c) for c in parts['coins']]
    layout[tier] = entry

with open(os.path.join(BASE, 'layout.json'), 'w') as f:
    json.dump(layout, f, indent=2)
print(f'\ntotal {total / 1024 / 1024:.2f}MB')
