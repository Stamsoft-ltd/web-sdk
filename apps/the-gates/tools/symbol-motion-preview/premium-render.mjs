import { preparePremiumParts } from './live-premium-parts.mjs';
import { premiumSymbolFrame, envelopeLidPose, ENVELOPE_HINGE_Y } from './live-premium-motion.mjs';
import { SYMBOL_PART_FILES } from './live-cluster-motion.mjs';
/** Same source PNGs, preparation and pivots as live Pixi; Canvas approval rendering only. */
export async function createPremiumRenderer(load, fit) {
	const sources = Object.fromEntries(
		await Promise.all(
			Object.entries(SYMBOL_PART_FILES)
				.filter(([key]) => /^(pharaoh|envelope|wild)/.test(key))
				.map(async ([key, path]) => [key, await load('../../static/' + path.replace(/^\.\//, ''))]),
		),
	);
	const parts = preparePremiumParts(sources, (image, w = 270, h = w, cx = 150, cy = 150) =>
		fit(image, 96, w, h, cx, cy),
	);
	return function renderPremium(c, name, ms, { speed = 1, reduced = false } = {}) {
		// Study is stretched to 1.8s; live uses its existing 900ms cosmetic clock.
		const p = premiumSymbolFrame((ms * Math.max(0.1, speed)) / 2, reduced);
		if (name === 'pharaoh') {
			c.drawImage(parts.pharaohBody, 0, 0);
			for (const eye of [parts.pharaohEyeLeft, parts.pharaohEyeRight]) {
				const pivot = 150 + ((154 - 143) * 270) / 304;
				c.save();
				c.translate(150, pivot);
				c.scale(1, 1 - 0.94 * p.blink);
				c.drawImage(eye, -150, -pivot);
				c.restore();
			}
			c.drawImage(parts.pharaohBrowLeft, 0, -p.brow * 3);
			c.drawImage(parts.pharaohBrowRight, 0, -p.brow);
			c.drawImage(parts.pharaohGem, 0, 0);
		} else {
			const lid = envelopeLidPose(p.flap, p.seal);
			if (p.flap) {
				const glow = c.createRadialGradient(150, 125, 0, 150, 125, 90);
				glow.addColorStop(0, `rgba(255,208,75,${p.flap * 0.35})`);
				glow.addColorStop(1, '#ffd04b00');
				c.fillStyle = glow;
				c.fillRect(50, 25, 200, 200);
			}
			const drawLid = () => {
				c.save();
				c.translate(150, ENVELOPE_HINGE_Y);
				c.scale(1, lid.flapScale);
				c.drawImage(parts.envelopeFlap, -150, -150);
				c.restore();
				c.save();
				c.translate(150, lid.upperY);
				c.scale(1, lid.upperScale);
				c.drawImage(parts.envelopeSealUpper, -150, -150);
				c.restore();
			};
			if (!lid.inFront) drawLid();
			c.drawImage(parts.envelopeBody, 0, 0);
			if (lid.inFront) drawLid();
			c.drawImage(parts.envelopeSealLower, 0, lid.lowerY - 150);
		}
	};
}
