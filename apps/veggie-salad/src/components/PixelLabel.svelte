<script lang="ts">
	import { Graphics } from 'pixi-svelte';

	type Props = {
		text: string;
		x?: number;
		y?: number;
		pixelSize?: number;
		color?: number;
		outlineColor?: number;
		extrudeColor?: number;
		weight?: number;
	};

	const {
		text,
		x = 0,
		y = 0,
		pixelSize = 14,
		color = 0xffffff,
		outlineColor = 0x160803,
		extrudeColor = 0xb62a09,
		weight = 0.11,
	}: Props = $props();

	// Deliberately tiny 5x7 bitmap alphabet. Drawing the glyph cells as Pixi geometry avoids the
	// antialiased canvas-font texture that made the previous signs read as merely low resolution.
	const GLYPHS: Record<string, readonly string[]> = {
		A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
		B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
		C: ['01111', '10000', '10000', '10000', '10000', '10000', '01111'],
		D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
		E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
		F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
		G: ['01111', '10000', '10000', '10111', '10001', '10001', '01111'],
		H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
		I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
		J: ['00111', '00010', '00010', '00010', '10010', '10010', '01100'],
		K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
		L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
		M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
		N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
		O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
		P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
		Q: ['01110', '10001', '10001', '10001', '10101', '10010', '01101'],
		R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
		S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
		T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
		U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
		V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
		W: ['10001', '10001', '10001', '10101', '10101', '10101', '01010'],
		X: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
		Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
		Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
		' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
	};

	const draw = (graphics: import('pixi.js').Graphics) => {
		const glyphText = text.toUpperCase();
		const cell = Math.max(2, Math.round(pixelSize));
		const faceGrow = Math.max(1, Math.round(cell * weight));
		const outline = Math.max(3, Math.round(cell * 0.2));
		const extrudeX = Math.max(3, Math.round(cell * 0.22));
		const extrudeY = Math.max(5, Math.round(cell * 0.34));
		const advance = cell * 6;
		const totalWidth = Math.max(0, glyphText.length * advance - cell);
		const originX = -Math.round(totalWidth * 0.5);
		const pixels: Array<[number, number]> = [];

		for (let charIndex = 0; charIndex < glyphText.length; charIndex += 1) {
			const glyph = GLYPHS[glyphText[charIndex]] ?? GLYPHS[' '];
			for (let row = 0; row < glyph.length; row += 1) {
				for (let column = 0; column < 5; column += 1) {
					if (glyph[row][column] === '1')
						pixels.push([originX + charIndex * advance + column * cell, row * cell]);
				}
			}
		}

		// Slightly overdraw each bitmap cell. Adjacent cells join into broad strokes, preserving the
		// bitmap grid while avoiding the thin wire-font look on large win signs.
		for (const [px, py] of pixels)
			graphics.rect(
				px - faceGrow + extrudeX,
				py - faceGrow + extrudeY,
				cell + faceGrow * 2,
				cell + faceGrow * 2,
			);
		graphics.fill(extrudeColor);
		for (const [px, py] of pixels)
			graphics.rect(
				px - faceGrow - outline,
				py - faceGrow - outline,
				cell + (faceGrow + outline) * 2,
				cell + (faceGrow + outline) * 2,
			);
		graphics.fill(outlineColor);
		for (const [px, py] of pixels)
			graphics.rect(
				px - faceGrow,
				py - faceGrow,
				cell + faceGrow * 2,
				cell + faceGrow * 2,
			);
		graphics.fill(color);
		for (const [px, py] of pixels)
			graphics.rect(
				px - faceGrow + 2,
				py - faceGrow + 2,
				Math.max(1, cell + faceGrow * 2 - 4),
				Math.max(1, Math.round(cell * 0.16)),
			);
		graphics.fill({ color: 0xffffff, alpha: 0.27 });
	};
</script>

<Graphics {x} {y} {draw} />
