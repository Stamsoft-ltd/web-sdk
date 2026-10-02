import type { SplatShape } from './wildSplat';

const css = (c: number, a: number) => `rgba(${(c >> 16) & 255},${(c >> 8) & 255},${c & 255},${a})`;

/** Paint a splat shape list (unit coordinates) onto a 2D canvas: origin (cx, cy), `u` px per unit. */
export function drawSplatCanvas(ctx: CanvasRenderingContext2D, list: SplatShape[], cx: number, cy: number, u: number) {
	for (const s of list) {
		ctx.fillStyle = css(s.color, s.alpha);
		ctx.beginPath();
		if (s.kind === 'poly') {
			for (let i = 0; i < s.pts.length; i += 2) {
				const x = cx + s.pts[i] * u;
				const y = cy + s.pts[i + 1] * u;
				if (i === 0) ctx.moveTo(x, y);
				else ctx.lineTo(x, y);
			}
			ctx.closePath();
		} else if (s.kind === 'circle') {
			ctx.arc(cx + s.x * u, cy + s.y * u, s.r * u, 0, Math.PI * 2);
		} else {
			ctx.ellipse(cx + s.x * u, cy + s.y * u, s.rx * u, s.ry * u, 0, 0, Math.PI * 2);
		}
		ctx.fill();
	}
}
