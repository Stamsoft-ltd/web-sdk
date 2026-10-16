<script lang="ts">
	import { Container, Sprite } from 'pixi.js';
	import { loadAssetImage } from '../game/imageAssets';
	import { useGpu } from '../game/gpuContext';
	import { winCoinFountain, WIN_COIN_ORIGIN_Y } from '../game/winCoins';
	import { winCoinSize } from '../game/visualRandom';
	let {
		tier,
		reduced = false,
		origin,
	}: { tier: number; reduced?: boolean; origin?: HTMLElement } = $props();
	const gpu = useGpu();
	let marker = $state<HTMLDivElement>();
	$effect(() => {
		const engine = gpu.engine,
			source = origin,
			element = marker,
			level = tier;
		if (!engine || !element || reduced) return;
		let dead = false,
			remove = () => {},
			width = 0,
			height = 0,
			originX = 0,
			originY = 0;
		const layout = () => {
			width = engine.app.screen.width;
			height = engine.app.screen.height;
			const canvas = engine.origin,
				art = source?.getBoundingClientRect();
			originX = art ? art.left - canvas.left + art.width / 2 : width / 2;
			originY = art ? art.top - canvas.top + art.height * WIN_COIN_ORIGIN_Y : height / 2;
			element.dataset.originX = String(originX);
			element.dataset.originY = String(originY);
		};
		const observer = new ResizeObserver(() => {
			layout();
			engine.invalidate();
		});
		observer.observe(element);
		if (source) observer.observe(source);
		void loadAssetImage('./assets/the-gates/win-coin-20261015/coin.png')
			.then((image) => {
				if (dead) return;
				const root = new Container(),
					texture = engine.texture(image),
					{ max, frequency, burst } = winCoinFountain(level),
					gravity = 520;
				const pool = Array.from({ length: max }, () => {
					const sprite = new Sprite(texture);
					sprite.anchor.set(0.5);
					sprite.visible = false;
					root.addChild(sprite);
					return { sprite, x: 0, y: 0, vx: 0, vy: 0, angle: 0, turn: 0, size: 0, age: 0 };
				});
				const free = pool.map((_, i) => i),
					active: number[] = [];
				let emission = frequency * burst;
				remove = engine.register({
					root,
					overlay: element.closest<HTMLElement>('[data-pixi-overlay]'),
					priority: 10,
					layout,
					draw: (delta) => {
						const dt = Math.min(delta, 0.04);
						emission += dt;
						while (emission >= frequency) {
							emission -= frequency;
							if (!free.length) continue;
							const id = free.pop()!,
								p = pool[id],
								angle = ((Math.random() - 0.5) * (22 + level * 4) * Math.PI) / 180,
								speed =
									Math.sqrt(2 * gravity * (Math.max(100, originY) + 60)) *
									(1 + Math.random() * 0.12);
							p.x = originX + (Math.random() - 0.5) * Math.min(width * 0.08, 80);
							p.y = originY;
							p.vx = Math.sin(angle) * speed;
							p.vy = -Math.cos(angle) * speed;
							p.angle = Math.random() * Math.PI;
							p.turn = 3 + Math.random() * 5;
							p.size = winCoinSize(level, Math.random(), width);
							p.age = 0;
							p.sprite.visible = true;
							active.push(id);
						}
						for (let i = active.length - 1; i >= 0; i--) {
							const id = active[i],
								p = pool[id];
							p.age += dt;
							p.x += p.vx * dt;
							p.vy += gravity * dt;
							p.y += p.vy * dt;
							p.angle += p.turn * dt;
							if (p.age > 8 || p.y > height + p.size) {
								p.sprite.visible = false;
								free.push(id);
								active[i] = active[active.length - 1];
								active.pop();
								continue;
							}
							p.sprite.position.set(p.x, p.y);
							p.sprite.rotation = p.angle * 0.25;
							p.sprite.scale.set(
								(p.size / image.naturalWidth) * Math.max(0.16, Math.abs(Math.cos(p.angle))),
								p.size / image.naturalWidth,
							);
						}
						return true;
					},
				});
			})
			.catch((error) => console.error('Pixi coin art unavailable', error));
		return () => {
			dead = true;
			observer.disconnect();
			remove();
		};
	});
</script>

{#if !reduced}<div
		bind:this={marker}
		class="win-coins"
		data-renderer="pixi-webgl"
		aria-hidden="true"
	></div>{/if}

<style>
	.win-coins {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
		z-index: 0;
	}
</style>
