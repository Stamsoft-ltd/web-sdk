// Generated from src/game/premiumSymbolParts.ts; source SHA256 a771a156019909d67043eba92b958e2fea8e1751f68cdee64f5b1e31c4da75cc.
// Regenerate: node tools/symbol-motion-preview/build-premium-preview.mjs
/** One-time Canvas alignment/extraction of supplied PNG components. Originals stay unchanged. */
import { wildCrystalMask } from './live-premium-motion.mjs';
const surface = () => {
    const c = document.createElement('canvas');
    c.width = c.height = 300;
    return c;
};
export function preparePremiumParts(source, fit) {
    // Pharaoh parts use the supplied 304×286 face canvas as their single coordinate system.
    const pharaohPart = (image, cx, cy, w, h, mirror = false) => {
        const out = surface(), c = out.getContext('2d'), s = 270 / 304;
        c.translate(150 - 152 * s, 150 - 143 * s);
        c.scale(s, s);
        c.translate(cx, cy);
        c.scale(mirror ? -1 : 1, 1);
        c.drawImage(image, -w / 2, -h / 2, w, h);
        return out;
    };
    const seal = surface(), c = seal.getContext('2d');
    // Approved full-seal isolation from the closed composite; lower supplied half restores its edge.
    // Crop retains painted white glints, unlike a red-only color key.
    c.drawImage(source.envelopeClosed, 114, 85, 86, 79, 109, 112.3, 81.8, 75.2);
    // Keep each row's red wax silhouette, including enclosed white shine; discard paper.
    const wax = c.getImageData(0, 0, 300, 300);
    for (let y = 0; y < 300; y++) {
        let left = 300, right = -1;
        for (let x = 0; x < 300; x++) {
            const i = (y * 300 + x) * 4, d = wax.data;
            if (d[i] > 60 &&
                d[i + 1] < 90 &&
                d[i + 2] < 90 &&
                d[i] > d[i + 1] * 1.5 &&
                d[i] > d[i + 2] * 1.5 &&
                d[i + 3] > 32) {
                left = Math.min(left, x);
                right = x;
            }
        }
        for (let x = 0; x < 300; x++)
            if (x < left || x > right)
                wax.data[(y * 300 + x) * 4 + 3] = 0;
    }
    c.putImageData(wax, 0, 0);
    c.drawImage(source.envelopeSealLower, 109, 112.3, 81.8, 75.2);
    // Separate the supplied broken lower fragment from the approved full-seal crop.
    // It stays on the body; only the complementary upper fragment follows the flap.
    const sealLower = surface(), lower = sealLower.getContext('2d');
    lower.drawImage(source.envelopeSealLower, 109, 112.3, 81.8, 75.2);
    const sealUpper = surface(), upper = sealUpper.getContext('2d');
    upper.drawImage(seal, 0, 0);
    upper.globalCompositeOperation = 'destination-out';
    upper.drawImage(sealLower, 0, 0);
    const wild = fit(source.wildFlower), mask = surface(), m = mask.getContext('2d'), pixels = wild.getContext('2d').getImageData(0, 0, 300, 300);
    const coverage = wildCrystalMask(pixels.data, 300, 300, 15, 270);
    for (let n = 0; n < coverage.length; n++) {
        const i = n * 4, d = pixels.data, luminance = Math.round(0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]);
        d[i] = d[i + 1] = d[i + 2] = luminance;
        d[i + 3] = coverage[n];
    }
    m.putImageData(pixels, 0, 0);
    // Normalize the separate front export to the closed envelope's outer paper bounds.
    // Both sources retain their original pixels; this affine alignment closes hinge gaps.
    const front = fit(source.envelopeBody, 270, 143, 150, 156), envelopeBody = surface(), frontContext = envelopeBody.getContext('2d');
    frontContext.translate(0, 228);
    frontContext.scale(1, 156 / 143);
    frontContext.drawImage(front, 0, -228);
    return {
        pharaohBody: fit(source.pharaohBody),
        pharaohEyeLeft: pharaohPart(source.pharaohEyeLeft, 112, 154, 68, 40),
        pharaohEyeRight: pharaohPart(source.pharaohEyeRight, 192, 154, 68, 40),
        pharaohBrowLeft: pharaohPart(source.pharaohBrowLeft, 112, 126, 49, 15),
        // ZIP includes two byte-identical brows. Use its right file, mirrored toward the face.
        pharaohBrowRight: pharaohPart(source.pharaohBrowRight, 192, 126, 49, 15, true),
        pharaohGem: pharaohPart(source.pharaohGem, 152, 80, 68, 68),
        envelopeBody,
        // Point-up flap base at local y=150; hinge overlaps body top by 6px.
        envelopeFlap: fit(source.envelopeFlap, 266, 109.25, 150, 95.375),
        envelopeSealUpper: sealUpper,
        envelopeSealLower: sealLower,
        wildFlower: wild,
        wildLight: mask,
    };
}
