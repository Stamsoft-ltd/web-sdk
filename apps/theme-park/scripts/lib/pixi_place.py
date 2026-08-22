"""Draw a PIL image the way pixi draws a Sprite.

Every build script here cuts a symbol into parts, measures where each part goes, and writes the
numbers out as a table that a Svelte component feeds to pixi `<Sprite>`s. The scripts also composite
a flattened still and a verify sheet — and the ONLY thing that makes those two worth looking at is
that they place parts exactly as the game will.

Hand-rolled compositing does not. Pasting pre-rotated art at a computed top-left agrees with a
sprite while the anchor is the centre, and silently stops agreeing the moment a part turns about
some other point — which is the entire reason parts get cut out. The duck shipped for three rounds
with its wing folded into its chest while the still beside it showed the wing fanned correctly,
because the still, the verify sheet and the game each placed it differently and the table nobody was
actually testing was the wrong one.

So: one function, used by every script, for every draw. Then a bad number in a table is a visibly
bad still, in the build output, instead of a bug that only exists in the browser.
"""

import numpy as np
from PIL import Image


def sprite_place(canvas, art, *, cx, cy, width=None, height=None, anchor=(0.5, 0.5), rotation=0.0):
	"""Composite `art` onto `canvas` as pixi would draw it.

	`cx`/`cy` are where the sprite's `anchor` lands, in canvas pixels; `anchor` is a fraction of the
	texture; `rotation` is in radians about that anchor. Sizes are the drawn size, not the source's.

	pixi turns clockwise in screen coordinates and PIL turns counter-clockwise, which is the one
	negation below. In y-down image coordinates PIL carries a point by [cos, sin; -sin, cos], so a
	script recovering an anchor from a placement has to come back the other way, by
	[cos, -sin; sin, cos]. Getting that inverse backwards is the duck bug above.
	"""
	scaled = art.resize((max(1, round(width if width else art.width)),
	                     max(1, round(height if height else art.height))), Image.LANCZOS)
	theta = -rotation
	turned = scaled.rotate(np.degrees(theta), resample=Image.BICUBIC, expand=True)

	# Where the anchor ended up once expand=True grew the box around it.
	ox = (anchor[0] - 0.5) * scaled.width
	oy = (anchor[1] - 0.5) * scaled.height
	px = ox * np.cos(theta) + oy * np.sin(theta)
	py = -ox * np.sin(theta) + oy * np.cos(theta)
	canvas.alpha_composite(turned, (round(cx - turned.width / 2 - px),
	                                round(cy - turned.height / 2 - py)))


def unrotate(point, *, centre, rotation):
	"""A point in rotated-art space, back in the unrotated art's space.

	The inverse of the turn `sprite_place` applies — use it to turn a placement you measured into
	the `anchor` a sprite needs.
	"""
	theta = -rotation
	ox, oy = point[0] - centre[0], point[1] - centre[1]
	return (ox * np.cos(theta) - oy * np.sin(theta),
	        ox * np.sin(theta) + oy * np.cos(theta))
