<script lang="ts">
	import { ap } from '../lib/preloadArt';
	import { POT_DRIPS, POT_IMG, dripPose, paintDrop } from '../game/potDrips';

	// The HTML pot's drips (phone / landscape free games — FreeSpinPanelHtml .fp-pot): the same model
	// as the pixi pot (game/potDrips), drawn on one canvas laid over the pot image. It fills the pot's
	// box and runs on below it (EXTRA) so a falling drop isn't cut off at the pot's foot.
	const EXTRA = 0.45; // × the pot's height

	const imgs = POT_DRIPS.map((d) => {
		const im = new Image();
		im.src = ap(d.src);
		return im;
	});

	let canvas: HTMLCanvasElement | undefined = $state();
	$effect(() => {
		const cv = canvas;
		const ctx = cv?.getContext('2d');
		if (!cv || !ctx) return;
		if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		let raf = 0;
		const frame = (now: number) => {
			raf = requestAnimationFrame(frame);
			const w = cv.clientWidth;
			if (w <= 0) return;
			const dpr = Math.min(2, window.devicePixelRatio || 1);
			const h = cv.clientHeight;
			if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
				cv.width = Math.round(w * dpr);
				cv.height = Math.round(h * dpr);
			}
			const k = w / POT_IMG.w; // pot-image px → css px
			ctx.setTransform(dpr * k, 0, 0, dpr * k, 0, 0);
			ctx.clearRect(0, 0, POT_IMG.w, POT_IMG.h * (1 + EXTRA));
			const painter = {
				ellipse: (x: number, y: number, rx: number, ry: number, color: number, alpha: number) => {
					ctx.globalAlpha = alpha;
					ctx.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
					ctx.beginPath();
					ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
					ctx.fill();
				},
			};
			POT_DRIPS.forEach((d, i) => {
				const pose = dripPose(d, now);
				const im = imgs[i];
				ctx.globalAlpha = 1;
				if (im.complete && im.naturalWidth) ctx.drawImage(im, d.x, d.y, d.w, d.h * pose.stretch);
				if (pose.bead) paintDrop(painter, pose.bead.x, pose.bead.y, pose.bead.r, pose.bead.r * 1.05, 1, 1);
				if (pose.drop) paintDrop(painter, pose.drop.x, pose.drop.y, pose.drop.rx, pose.drop.ry, pose.drop.alpha, 1);
			});
			ctx.globalAlpha = 1;
		};
		raf = requestAnimationFrame(frame);
		return () => cancelAnimationFrame(raf);
	});
</script>

<canvas class="pot-drips" bind:this={canvas} style={`height:${(1 + EXTRA) * 100}%`} aria-hidden="true"></canvas>

<style>
	.pot-drips {
		position: absolute;
		left: 0;
		top: 0;
		width: 100%;
		pointer-events: none;
	}
</style>
