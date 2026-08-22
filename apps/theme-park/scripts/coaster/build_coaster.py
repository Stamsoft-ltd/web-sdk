#!/usr/bin/env python3
"""Cut the coaster car (Figma 7093:25555) into a car and two loose arms, so the family can wave.

    python3 scripts/coaster/build_coaster.py

The symbol shipped as one flat drawing of a car with two arms already up, which meant the only
thing it ever did was sit there — a photograph of a moment rather than a ride. The design also
supplies the pieces to fix that: `car_r4` is the SAME car with both arms down (99.3% of its ink
lands inside the flat symbol), and `hand_a4` is a loose arm. So the arms come off, and the two
riders in the back row wave while the board idles.

WHAT IS MEASURED AND WHAT IS MODELLED. The car is measured — it is the same drawing, found where
it was drawn, by sliding it over the flat symbol. Each arm is placed by its HAND, which is the only
part of it the flat symbol actually shows: differencing the flat symbol against the armless car
recovers two clean hand-shaped blobs and nothing else, because everything below a wrist is behind
somebody. Those two blobs are 37x41 and 41x44 — the SAME SIZE. Both arms are therefore drawn at one
shared scale, and the first build of this got that wrong: it sized each arm from a guessed shoulder,
made the father's 1.8x too big, and the symbol came back described as "one big hand".

The scale itself is measured against the flat symbol rather than derived, because the arm art is
mostly forearm and the hand is only its top 45% — reasoning from the hand's size to the whole
drawing's compounds every error in the estimate. Rendering the candidates over the reference and
comparing settles it in one look.

An arm still needs a joint to turn about, and that is NOT a thing anybody can see here. It is
derived: the art's own shoulder end, carried into the frame by the same scale and rotation that put
its hand where the design has it. So the hand lands where it was drawn and the arm swings from a
shoulder, without either of those being guessed.

The still is then rebuilt FROM the exported table rather than from the fit, so it cannot drift out
of step with what the game draws. See scripts/lib/pixi_place.py for why that matters.
"""

import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from lib.pixi_place import sprite_place  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
SOURCE = Path(__file__).resolve().parent / "source"
SYMBOL_DIR = ROOT / "static/assets/theme-park/v2/symbols"
TABLE = ROOT / "src/game/coasterParts.ts"
VERIFY = Path(__file__).resolve().parent / "verify_coaster.png"

FRAME = (448, 360)

# The car, fitted into the flat symbol by sliding it over at every scale and offset and scoring the
# share of its own ink that lands on the symbol's: 99.26% at these, which is a match rather than a
# guess — the remaining 0.74% is the anti-aliased rim of a 1255px drawing shrunk to 341px.
CAR_SCALE = 0.272
CAR_AT = (52, 36)

# The two riders who wave, as (shoulder, hand) in frame pixels — read off the flat symbol, which is
# the pose the artist drew. `reach` and the rest angle both fall out of the pair, so the two points
# are the only things here anyone should ever need to re-tune.
#
# The father's arm is the larger of the two because it is: his hand spans 38px in the flat symbol
# and hers 23px, his being nearer the viewer and further extended. Deriving each arm's size from
# its own reach reproduces that difference for free.
# How big an arm is drawn, as a fraction of the arm art's own size. One number for both, because
# the flat symbol draws both hands at the same size (37x41 and 41x44). Fitted by rendering the
# candidates over the flat symbol: 0.040 is visibly small, 0.070 already too big.
ARM_SCALE = 0.055

# The two riders who wave. `hand` is the centre of the hand blob the flat symbol shows, in frame
# pixels; `rest` is the small turn that carries the arm art's own pose onto the drawn one. `mirror`
# is which way the arm faces — it is ONE drawing, and Figma 7093:24248/24249 are the same image
# placed twice, so the left arm is the right one flipped.
ARMS = [
	# The father, back left. Drawn UNDER the car: his forearm ends in a cut edge that belongs
	# inside his own shoulder, and the car is what hides it.
	dict(name="father", hand=(125.7, 84.7), rest=6.0, mirror=True, front=False),
	# The mother, back right. Drawn OVER it, because her hand crosses the loop of track arching
	# away behind the car — put her under and the loop's spokes cut her hand into three pieces.
	dict(name="mother", hand=(340.8, 119.2), rest=2.0, mirror=False, front=True),
]

#: Alpha at or below this is the export's fringe, not the drawing.
INK = 40


def trimmed(part):
	"""The drawing without the export's transparent margin, which is not part of the art."""
	ink = np.asarray(part)[..., 3] > 8
	ys, xs = np.nonzero(ink)
	return part.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))


def arm_landmarks(art):
	"""Where this arm's hand and shoulder are, as pixels in its own art.

	The arm is a long thin drawing, so its principal axis IS the arm, and the two ends of that axis
	are the hand and the shoulder — the shoulder being whichever end is lower, because that is the
	end that goes into a body.

	The hand is the CENTRE of the drawing's top 45% rather than its furthest pixel. Measuring the
	cross-section along the axis shows why: it runs 373, 448, 497, 680, 685, 656, 555, 469, 410 and
	then settles at about 280 for the rest — the wide part is the hand and the narrow tail is the
	forearm, and the split is a little under halfway. The furthest pixel is a fingertip, and pinning
	a fingertip where a palm belongs puts the whole hand a finger's length out.
	"""
	ink = np.asarray(art)[..., 3] > INK
	ys, xs = np.nonzero(ink)
	points = np.stack([xs, ys], 1).astype(float)
	centre = points.mean(0)
	_, _, axes = np.linalg.svd(points - centre, full_matrices=False)
	axis = axes[0]
	if axis[1] < 0:  # point it from the hand end down towards the shoulder end
		axis = -axis
	along = (points - centre) @ axis
	hand = points[along <= np.quantile(along, 0.45)].mean(0)
	shoulder = points[along >= np.quantile(along, 0.97)].mean(0)
	return hand, shoulder


def main():
	car = trimmed(Image.open(SOURCE / "car.png").convert("RGBA"))
	car = car.resize((round(car.width * CAR_SCALE), round(car.height * CAR_SCALE)), Image.LANCZOS)

	# The car's speed arcs, which the armless drawing does not carry. Lifted out of the flat symbol
	# once (everything outside the car's silhouette, past the riders) and kept as a source file, so
	# this script never has to read the picture it is about to overwrite.
	swoosh = Image.open(SOURCE / "swoosh.png").convert("RGBA")

	plate = Image.new("RGBA", FRAME, (0, 0, 0, 0))
	plate.alpha_composite(car, CAR_AT)
	plate.alpha_composite(swoosh)
	plate.save(SYMBOL_DIR / "coaster-car.png")
	print(f"car {car.width}x{car.height} at {CAR_AT}, speed arcs baked in")

	fw, fh = FRAME
	art = trimmed(Image.open(SOURCE / "arm.png").convert("RGBA"))
	rows = []
	for arm in ARMS:
		drawing = art.transpose(Image.FLIP_LEFT_RIGHT) if arm["mirror"] else art
		hand_px, shoulder_px = arm_landmarks(drawing)
		rest = np.radians(arm["rest"])
		width, height = drawing.width * ARM_SCALE, drawing.height * ARM_SCALE

		# The shoulder, carried into the frame: take the art's own hand->shoulder offset, draw it at
		# the size and angle this arm is drawn at, and add it to where the hand goes. pixi turns a
		# vector by [cos, -sin; sin, cos] in these coordinates, so this is that, once.
		offset = (shoulder_px - hand_px) * ARM_SCALE
		turned = np.array([
			offset[0] * np.cos(rest) - offset[1] * np.sin(rest),
			offset[0] * np.sin(rest) + offset[1] * np.cos(rest),
		])
		shoulder = np.array(arm["hand"]) + turned
		anchor = (shoulder_px[0] / drawing.width, shoulder_px[1] / drawing.height)

		name = f"coaster-arm-{arm['name']}.png"
		drawing.save(SYMBOL_DIR / name)
		print(f"{arm['name']}: drawn {width:.0f}x{height:.0f}, hand at "
		      f"({arm['hand'][0]:.0f}, {arm['hand'][1]:.0f}), shoulder at "
		      f"({shoulder[0]:.0f}, {shoulder[1]:.0f}), rest {arm['rest']:+.0f} deg")

		rows.append(dict(name=arm["name"], file=name, front=arm["front"],
		                 x=shoulder[0] / fw, y=shoulder[1] / fh,
		                 width=width / fw, height=height / fh,
		                 anchorX=anchor[0], anchorY=anchor[1], rest=rest,
		                 art=drawing))

	def draw(canvas, waves=(0.0, 0.0)):
		"""One car, drawn exactly as <CoasterCar> draws it: arms behind, plate, arms in front."""
		for front in (False, True):
			if front:
				canvas.alpha_composite(plate)
			for row, wave in zip(rows, waves):
				if row["front"] != front:
					continue
				sprite_place(canvas, row["art"], cx=row["x"] * fw, cy=row["y"] * fh,
				             width=row["width"] * fw, height=row["height"] * fh,
				             anchor=(row["anchorX"], row["anchorY"]), rotation=row["rest"] + wave)

	still = Image.new("RGBA", FRAME, (0, 0, 0, 0))
	draw(still)
	# h1-coaster-STILL, not -marquee, and the rename is deliberate. This picture used to be the
	# whole symbol with both arms drawn into it, and a browser that has fetched that one goes on
	# serving it from the same URL for as long as it likes — which is how the duck kept a wing it no
	# longer had through three rebuilds. Renaming is the only reliable way to retire art here; a
	# ?v= query does not survive the way this game's assets are fetched.
	still.save(SYMBOL_DIR / "h1-coaster-still.png")
	print("wrote the still from the exported table")

	lines = [
		"// GENERATED by scripts/coaster/build_coaster.py — edit that, not this.",
		"//",
		"// The coaster car in pieces, so the family in the back row can wave. Every number is a",
		"// fraction of the 448x360 symbol frame, which is what lets one table serve every size the",
		"// board draws a symbol at.",
		"//",
		"// An arm is a SHOULDER and a turn about it: `x`/`y` are the shoulder in the frame, the",
		"// anchor is that same point in the arm's own art, and `rest` is the angle the artist drew",
		"// it at. Adding to `rest` swings the arm; nothing else has to move with it.",
		"",
		"export type CoasterArm = {",
		"\tkey: string;",
		"\t/** The shoulder, as a fraction of the symbol frame: what the arm turns about. */",
		"\tx: number;",
		"\ty: number;",
		"\twidth: number;",
		"\theight: number;",
		"\t/** The same shoulder, as a fraction of the arm's own art. */",
		"\tanchorX: number;",
		"\tanchorY: number;",
		"\t/** Radians it rests at — the pose in the drawing. */",
		"\trest: number;",
		"\t/**",
		"\t * Whether this arm draws over the car rather than under it. The mother's crosses the red",
		"\t * loop and has to; the father's ends inside his own shoulder and wants to be hidden there.",
		"\t */",
		"\tfront: boolean;",
		"};",
		"",
		"export const COASTER_ARMS: CoasterArm[] = [",
	]
	keys = {"father": "tpCoasterArmFather", "mother": "tpCoasterArmMother"}
	for row in rows:
		lines.append(
			f"\t{{ key: '{keys[row['name']]}', x: {row['x']:.4f}, y: {row['y']:.4f}, "
			f"width: {row['width']:.4f}, height: {row['height']:.4f}, "
			f"anchorX: {row['anchorX']:.4f}, anchorY: {row['anchorY']:.4f}, "
			f"rest: {row['rest']:.4f}, front: {str(row['front']).lower()} }},")
	lines += ["];", ""]
	TABLE.write_text("\n".join(lines))
	print(f"wrote {TABLE.relative_to(ROOT)}")

	# Eyeball it: the rest pose, then both arms driven to the ends of their wave. If an arm detaches
	# from its shoulder or swings out of the car, it is visible here.
	poses = [(0.0, 0.0), (0.35, -0.35), (-0.35, 0.35), (0.35, 0.35)]
	sheet = Image.new("RGBA", (fw * len(poses), fh), (26, 26, 34, 255))
	for i, waves in enumerate(poses):
		pose = Image.new("RGBA", FRAME, (0, 0, 0, 0))
		draw(pose, waves)
		sheet.alpha_composite(pose, (fw * i, 0))
	sheet.save(VERIFY)
	print(f"wrote {VERIFY.relative_to(ROOT)}")


if __name__ == "__main__":
	main()
