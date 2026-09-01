#!/usr/bin/env python3
"""Cut the Mega Coaster bumper car into a body, a head and a wheel, so the driver can drive.

    python3 scripts/coaster-driver/build_coaster_driver.py

WHAT WAS WRONG. `idle` in coaster_vomit.json is ONE held frame — the rig's 128 poses all belong to
the vomit clip — so a cart crossing the board was a photograph being slid sideways. The ride
(<CoasterSetupPresenter>'s distance-driven hop and lean) fixed the cart's motion over the track, but
the duck inside it still never moved: it stared straight ahead with its head welded on and its
wheels frozen, for the whole feature (2026-08-28).

WHAT THIS BUILDS. The design supplies the same bumper car in three pieces — Figma 7269:4432 is the
car WITHOUT a head, 7269:4431 is the head, 7269:4429 is one wheel — which is exactly the rig that
lets the head bob and the wheels roll. The three drop into the same 256 frame the Spine cart is
packed into, at the same width and on the same ground line, so a cart that starts vomiting hands
over to the Spine without moving or resizing.

WHAT IS MEASURED AND WHAT IS MODELLED. The BODY is measured: it fills the frame exactly where
`build-coaster-vomit-spine.py` puts its cart, because that is what the swap has to agree with. The
NECK is measured off the body art — the head lobe the car draws is a real place on a real drawing,
and the head is hung on it.

Everything else is a MODEL, because a rest-pose measurement breaks the moment the part moves:

  * A wheel is a wheel. It turns about its own centre and it ROLLS — the component derives its
    angle from the distance the cart has travelled and this table's radius, so a cart that is going
    quickly spins quickly, without a single authored frame. That only works if the radius here is
    the radius the art is DRAWN at, which is why the wheel's size is one number and both wheels use
    it.
  * A head is hung on a neck. The pivot is the base of the head, in the head's own art, so the
    component nods it by turning about that point; the head then swings on the body instead of
    sliding across it. Placing the head by its middle is what makes a nod look like a head coming
    off.

The HEADLAMP is measured too, and it is only a measurement: the light itself is drawn live by
<CoasterDriver> out of a gradient and the shared spark, so there is no lamp art to ship and none of
it appears on the verify sheet below. All this hands over is where the glass is.

The still is rebuilt FROM the exported table rather than from the fit, and the verify sheet draws
the rig through its whole range beside the Spine's own happy and vomit frames — the two pictures
this thing has to match. See scripts/lib/pixi_place.py for why that matters.
"""

import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from lib.figma_paper import resized  # noqa: E402
from lib.pixi_place import sprite_place  # noqa: E402
from lib.web_image import save_web  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
SOURCE = Path(__file__).resolve().parent / "source"
FEATURES = ROOT / "static/assets/theme-park/v2/features"
TABLE = ROOT / "src/game/coasterDriverParts.ts"
VERIFY = Path(__file__).resolve().parent / "verify_coaster_driver.png"

# The Spine cart's own frame, from scripts/build-coaster-vomit-spine.py. Matching all three is the
# whole reason the happy rig and the vomit clip can be the same cart: same box, same width, same
# ground. Change one of these without changing it there and the cart jumps when the duck is sick.
FRAME = 256
CART_WIDTH = 180
CART_LEFT = 18
GROUND_BASELINE = 238

# The car faces LEFT in the design and RIGHT in the Spine rig. The presenter mirrors a cart by the
# direction it is travelling, so both agree only if they start out facing the same way.
FACES_LEFT = True
# The park's emblem, in the car art. Mirroring the car mirrors everything on it, and everything on
# it is a swirl EXCEPT this — a stylised P, which comes back reading backwards. So it is flipped
# once here, before the car is, and lands the right way round. The rect is the emblem plus a margin
# of the flat red it sits on, whose two edges are within 2/255 of each other, so flipping the block
# whole cannot leave a seam.
EMBLEM = (628, 358, 730, 550)

# WHERE THE HEAD GOES, and how big — both FITTED, by registration against the Spine's own happy
# frame rather than by anybody's eye. `fit_head_to_spine` in this script slides the head across the
# car at every plausible size and keeps the one whose silhouette differs least from that frame,
# which is the authored duck in this authored car in this exact 256 box.
#
# It is fitted because eyeballing it failed four times running (2026-08-31). The mistake underneath
# all four: the car art draws a yellow lobe with a rounded tip at the FRONT, the tip was read as the
# neck, and the head was hung on it — which puts the head out over the bonnet, in front of the
# steering wheel, where no duck is driving from. The lobe is the duck's CHEST seen side-on; its tip
# is the breast, and the head belongs above the middle of it, back over the seat. The fit lands the
# head's centre at 0.47 of the car — the middle — not the 0.64 it was hung at.
#
# HEAD_WIDTH is a fraction of the car's width, NECK a point on the car art.
HEAD_WIDTH = 0.31
NECK = (0.534, 0.248)
# The same point in the HEAD's own art — the base of the skull, between the jaw and the back of the
# neck. This is what the head turns about, so a nod pivots at the shoulders.
HEAD_PIVOT = (0.52, 0.94)

# A wheel, as a fraction of the car's width. Sized off the Spine cart's own wheels, which are about
# an eighth of it across — the design draws the car without any, so there is nothing here to
# measure and the picture the swap has to match is the only reference there is.
WHEEL_WIDTH = 0.125
# How far a wheel hangs below the car's black bumper skirt, as a fraction of its diameter. Their
# bottoms are the ground line and the car is lifted off it by this much, which is the only thing
# that says the car is sitting on them rather than floating over them.
#
# They are drawn OVER the body, which sounds wrong and is not: the tyre is black and the skirt it
# crosses is black, so the tyre disappears into it either way, and drawing over is what keeps the
# GOLD HUB — the one part of a wheel anybody can see turning — above the skirt instead of behind it.
WHEEL_DROP = 0.34
#: Where the axles are along the car, as a fraction of its width.
WHEELS_AT = (0.225, 0.775)

# THE HEADLAMP is a real thing in the car art — a gold lens in a black bezel, on the nose, drawn
# side-on so it reads as a tall narrow ellipse rather than as a disc. It is found rather than typed:
# the only gold in the front of the car is that lens, so the gold in this much of the nose IS it.
LAMP_NOSE = 0.12
#: What the lens has to look like for the find to be believed: tall, narrow, and on the nose.
LAMP_SHAPE = dict(max_width=0.06, min_aspect=1.5)

#: Alpha at or below this is the export's fringe, not the drawing.
INK = 8


def trimmed(part):
	"""The drawing without the export's transparent margin, which is not part of the art."""
	ink = np.asarray(part)[..., 3] > INK
	ys, xs = np.nonzero(ink)
	return part.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))


def facing_right(part):
	return part.transpose(Image.FLIP_LEFT_RIGHT) if FACES_LEFT else part


def unmirrored(art, box):
	"""Flip one block of the drawing in place, so mirroring the drawing leaves it as it was."""
	art = art.copy()
	art.paste(art.crop(box).transpose(Image.FLIP_LEFT_RIGHT), box)
	return art


def lamp_lens(car):
	"""The headlamp's glass on the car AS SHIPPED, as fractions of it: centre, then size."""
	art = np.asarray(car).astype(int)
	red, green, blue, alpha = (art[..., channel] for channel in range(4))
	gold = (alpha > 200) & (red > 200) & (green > 140) & (green < 220) & (blue < 110)
	nose = np.zeros(gold.shape, bool)
	nose[:, round(car.width * (1 - LAMP_NOSE)) :] = True
	ys, xs = np.nonzero(gold & nose)
	left, right, top, bottom = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
	width, height = (right - left) / car.width, (bottom - top) / car.height
	assert width < LAMP_SHAPE["max_width"], f"the nose gold is not a lens, it is {width:.3f} wide"
	assert height / width > LAMP_SHAPE["min_aspect"], "the nose gold is not a lens, it is a blob"
	return ((left + right) / 2 / car.width, (top + bottom) / 2 / car.height), (width, height)


def main():
	body = unmirrored(Image.open(SOURCE / "body.png").convert("RGBA"), EMBLEM)
	body = facing_right(trimmed(body))
	head = facing_right(trimmed(Image.open(SOURCE / "head.png").convert("RGBA")))
	wheel = trimmed(Image.open(SOURCE / "wheel.png").convert("RGBA"))

	scale = CART_WIDTH / body.width
	body_height = body.height * scale
	wheel_size = WHEEL_WIDTH * CART_WIDTH
	# The wheels reach the ground, and the car sits on them.
	body_bottom = GROUND_BASELINE - WHEEL_DROP * wheel_size
	body_top = body_bottom - body_height

	def on_cart(point):
		"""A point on the car AS SHIPPED — measured off the drawing that ships — in frame pixels."""
		return (CART_LEFT + point[0] * CART_WIDTH, body_top + point[1] * body_height)

	def in_frame(point):
		"""A point on the car ART, in frame pixels — mirrored with the car if it was mirrored."""
		return on_cart((1 - point[0], point[1]) if FACES_LEFT else point)

	head_width = HEAD_WIDTH * CART_WIDTH
	head_height = head_width * head.height / head.width
	head_pivot = (1 - HEAD_PIVOT[0], HEAD_PIVOT[1]) if FACES_LEFT else HEAD_PIVOT
	neck = in_frame(NECK)

	wheel_at = [(in_frame((x, 0))[0], GROUND_BASELINE - wheel_size / 2) for x in WHEELS_AT]

	lamp_at, (lamp_w, lamp_h) = lamp_lens(body)
	lamp = on_cart(lamp_at)
	lamp_size = (lamp_w * CART_WIDTH, lamp_h * body_height)

	# Premultiplied, like every resample of keyed art here — see the note in lib/figma_paper.py.
	body_art = resized(body, (round(CART_WIDTH), round(body_height)))
	head_art = resized(head, (round(head_width), round(head_height)))
	wheel_art = resized(wheel, (round(wheel_size), round(wheel_size)))

	save_web(body_art, FEATURES / "coaster-driver-body.webp")
	save_web(head_art, FEATURES / "coaster-driver-head.webp")
	save_web(wheel_art, FEATURES / "coaster-driver-wheel.webp")

	def draw(canvas, *, roll=0.0, nod=0.0, lift=0.0):
		"""One driving duck, drawn exactly as <CoasterDriver> draws it: body, wheels, head."""
		sprite_place(canvas, body_art, cx=CART_LEFT + CART_WIDTH / 2,
		             cy=body_bottom - body_height / 2)
		for cx, cy in wheel_at:
			sprite_place(canvas, wheel_art, cx=cx, cy=cy, rotation=roll)
		sprite_place(canvas, head_art, cx=neck[0], cy=neck[1] + lift,
		             width=head_width, height=head_height, anchor=head_pivot, rotation=nod)

	still = Image.new("RGBA", (FRAME, FRAME), (0, 0, 0, 0))
	draw(still)
	print(f"cart {CART_WIDTH}x{body_height:.0f} on {GROUND_BASELINE}, rig bbox {still.getbbox()}")
	print(f"head {head_width:.0f}x{head_height:.0f} on the neck at "
	      f"({neck[0]:.0f}, {neck[1]:.0f}), wheels {wheel_size:.0f} across")
	print(f"headlamp lens {lamp_size[0]:.1f}x{lamp_size[1]:.1f} at "
	      f"({lamp[0]:.0f}, {lamp[1]:.0f})")

	fx, fy = FRAME, FRAME
	lines = [
		"// GENERATED by scripts/coaster-driver/build_coaster_driver.py — edit that, not this.",
		"//",
		"// The Mega Coaster bumper car in pieces, so the duck driving it can drive. Every number is",
		"// a fraction of the 256x256 frame the Spine cart is packed into, which is what lets the",
		"// loose rig and the vomit clip be the same cart at the same size on the same ground line.",
		"//",
		"// A wheel is a wheel: `radius` is the radius it is DRAWN at, so <CoasterDriver> can roll it",
		"// by the distance the cart has travelled rather than by a clock. A head is hung on a neck:",
		"// `x`/`y` are that neck in the frame, the anchor is the same point in the head's own art,",
		"// and turning about it nods the head instead of sliding it off the body.",
		"",
		"export type CoasterDriverPart = {",
		"\tkey: string;",
		"\t/** The centre, as a fraction of the frame — or the pivot, where the part has one. */",
		"\tx: number;",
		"\ty: number;",
		"\twidth: number;",
		"\theight: number;",
		"};",
		"",
		"/** A part that turns about a point of its own, given as a fraction of its texture. */",
		"export type CoasterDriverJoint = CoasterDriverPart & { anchorX: number; anchorY: number };",
		"",
		f"export const COASTER_DRIVER_BODY: CoasterDriverPart = {{ key: 'coasterDriverBody', "
		f"x: {(CART_LEFT + CART_WIDTH / 2) / fx:.4f}, y: {(body_bottom - body_height / 2) / fy:.4f}, "
		f"width: {CART_WIDTH / fx:.4f}, height: {body_height / fy:.4f} }};",
		"",
		"/** Hung on the neck: `x`/`y` are the neck in the frame, the anchor is it in the head's art. */",
		f"export const COASTER_DRIVER_HEAD: CoasterDriverJoint = {{ key: 'coasterDriverHead', "
		f"x: {neck[0] / fx:.4f}, y: {neck[1] / fy:.4f}, "
		f"width: {head_width / fx:.4f}, height: {head_height / fy:.4f}, "
		f"anchorX: {head_pivot[0]:.4f}, anchorY: {head_pivot[1]:.4f} }};",
		"",
		"/** Both wheels, and the radius they are drawn at: rolling is distance / radius. */",
		f"export const COASTER_DRIVER_WHEEL_RADIUS = {wheel_size / 2 / fx:.4f};",
		"export const COASTER_DRIVER_WHEELS: CoasterDriverPart[] = [",
	]
	for cx, cy in wheel_at:
		lines.append(
			f"\t{{ key: 'coasterDriverWheel', x: {cx / fx:.4f}, y: {cy / fy:.4f}, "
			f"width: {wheel_size / fx:.4f}, height: {wheel_size / fy:.4f} }},")
	lines += [
		"];",
		"",
		"/** The headlamp's GLASS — there is no lamp art: <CoasterDriver> lights this rectangle. */",
		f"export const COASTER_DRIVER_LAMP = {{ x: {lamp[0] / fx:.4f}, y: {lamp[1] / fy:.4f}, "
		f"width: {lamp_size[0] / fx:.4f}, height: {lamp_size[1] / fy:.4f} }};",
		"",
	]
	TABLE.write_text("\n".join(lines))
	print(f"wrote {TABLE.relative_to(ROOT)}")

	# Eyeball it: the rest pose and both ends of the head's nod, beside the two Spine frames this
	# rig has to stand in for. If the head detaches, a wheel floats, or the cart is a different size
	# from the clip that takes over from it, it is visible here.
	poses = [
		dict(roll=0.0, nod=0.0, lift=0.0),
		dict(roll=1.1, nod=-0.13, lift=-3.0),
		dict(roll=2.2, nod=0.13, lift=2.0),
	]
	rigs = [Image.open(FEATURES / name).convert("RGBA")
	        for name in ("coaster-rig-happy.webp", "coaster-rig-vomit.webp")]
	sheet = Image.new("RGBA", (FRAME * (len(poses) + len(rigs)), FRAME), (26, 26, 34, 255))
	for index, pose in enumerate(poses):
		frame = Image.new("RGBA", (FRAME, FRAME), (0, 0, 0, 0))
		draw(frame, **pose)
		sheet.alpha_composite(frame, (FRAME * index, 0))
	for index, rig in enumerate(rigs):
		sheet.alpha_composite(rig, (FRAME * (len(poses) + index), 0))
	sheet.save(VERIFY)
	print(f"wrote {VERIFY.relative_to(ROOT)}")


if __name__ == "__main__":
	main()
