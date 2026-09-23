<script lang="ts">
	import { winCoinSize } from '../game/visualRandom';
	let { tier, reduced = false }: { tier: number; reduced?: boolean } = $props();
	let canvas = $state<HTMLCanvasElement>();
	$effect(() => {
		const surface = canvas;
		if (!surface || reduced) return;
		const context = surface.getContext('2d');
		if (!context) return;
		const sprite = new Image();
		sprite.src = './assets/the-gates/wins/coin.png';
		let frame = 0,
			previous = 0,
			emission = 0;
		let width = 0,
			height = 0;
		const particles: {
			x: number;
			y: number;
			vx: number;
			vy: number;
			angle: number;
			turn: number;
			size: number;
			age: number;
		}[] = [];
		// Veggie fountain: center launch, gravity return, increasing tier density and spread.
		// DOM runtime uses one bounded canvas rather than creating a second Pixi renderer.
		const max = [40, 60, 82, 110, 150][tier];
		const frequency = [0.15, 0.105, 0.075, 0.052, 0.036][tier];
		const gravity = 520;
		const resize = () => {
			width = surface.clientWidth;
			height = surface.clientHeight;
			const dpr = Math.min(2, window.devicePixelRatio || 1);
			surface.width = Math.round(width * dpr);
			surface.height = Math.round(height * dpr);
			context.setTransform(dpr, 0, 0, dpr, 0, 0);
		};
		const observer = new ResizeObserver(resize);
		observer.observe(surface);
		resize();
		const tick = (now: number) => {
			const dt = previous ? Math.min((now - previous) / 1000, 0.04) : 0;
			previous = now;
			emission += dt;
			context.clearRect(0, 0, width, height);
			while (emission >= frequency) {
				emission -= frequency;
				if (particles.length >= max || !sprite.complete || !sprite.naturalWidth) continue;
				const spread = ((22 + tier * 4) * Math.PI) / 180;
				const angle = (Math.random() - 0.5) * spread;
				const speed = Math.sqrt(2 * gravity * (height * 0.7 + 100)) * (1 + Math.random() * 0.12);
				particles.push({
					x: width / 2,
					y: height * 0.72,
					vx: Math.sin(angle) * speed,
					vy: -Math.cos(angle) * speed,
					angle: Math.random() * Math.PI,
					turn: 3 + Math.random() * 5,
					size: winCoinSize(tier, Math.random(), width),
					age: 0,
				});
			}
			for (let i = particles.length - 1; i >= 0; i--) {
				const p = particles[i];
				p.age += dt;
				p.x += p.vx * dt;
				p.vy += gravity * dt;
				p.y += p.vy * dt;
				p.angle += p.turn * dt;
				if (p.age > 8 || p.y > height + p.size) {
					particles.splice(i, 1);
					continue;
				}
				context.save();
				context.translate(p.x, p.y);
				context.rotate(p.angle * 0.25);
				context.scale(Math.max(0.16, Math.abs(Math.cos(p.angle))), 1);
				context.drawImage(sprite, -p.size / 2, -p.size / 2, p.size, p.size);
				context.restore();
			}
			frame = requestAnimationFrame(tick);
		};
		frame = requestAnimationFrame(tick);
		return () => {
			cancelAnimationFrame(frame);
			observer.disconnect();
			particles.length = 0;
		};
	});
</script>

{#if !reduced}<canvas bind:this={canvas} class="win-coins" aria-hidden="true"></canvas>{/if}

<style>
	.win-coins {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
	}
</style>
