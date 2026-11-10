import { createSymbolRenderer } from './render.mjs';
import { WILD_CLUSTERS, WILD_GLOW_MS } from './wild-motion.mjs';
const $ = (id) => document.getElementById(id);
async function start() {
	const render = await createSymbolRenderer();
	const cards = WILD_CLUSTERS.map((variant) => {
		const card = document.createElement('article'),
			title = document.createElement('h2'),
			swatch = document.createElement('span');
		swatch.className = 'swatch';
		swatch.style.setProperty('--colour', variant.colour);
		title.append(swatch, variant.name + ' → Wild');
		const canvas = document.createElement('canvas');
		canvas.width = 440;
		canvas.height = 390;
		canvas.setAttribute('role', 'img');
		canvas.setAttribute('aria-label', variant.name + ' cluster with animated Crystal Lotus Wild');
		const caption = document.createElement('p');
		caption.className = 'caption';
		caption.textContent =
			variant.colour.toUpperCase() + ' light · ' + variant.accent.toUpperCase() + ' accent';
		card.append(title, canvas, caption);
		$('variants').append(card);
		// Static source icons sampled once; the row below each Wild stays readable.
		const source = document.createElement('canvas');
		source.width = source.height = 100;
		render(source.getContext('2d'), variant.id, 0, { size: 100, reduced: true });
		return { variant, c: canvas.getContext('2d'), source };
	});
	let age = 0,
		started = performance.now(),
		paused = false,
		hiddenAt = null,
		cpu = 0,
		frames = 0;
	const duration = () => WILD_GLOW_MS / Number($('speed').value);
	const restart = () => {
		age = 0;
		started = performance.now();
		paused = false;
		$('pause').textContent = 'Pause';
	};
	$('reduced').checked = matchMedia('(prefers-reduced-motion: reduce)').matches;
	$('play').onclick = restart;
	$('speed').onchange = restart;
	$('pause').onclick = () => {
		paused = !paused;
		if (!paused) started = performance.now() - age;
		$('pause').textContent = paused ? 'Resume' : 'Pause';
	};
	$('scrub').oninput = () => {
		age = (Number($('scrub').value) / 1000) * duration();
		paused = true;
		$('pause').textContent = 'Resume';
	};
	document.addEventListener('visibilitychange', () => {
		if (document.hidden) hiddenAt = performance.now();
		else if (hiddenAt !== null) {
			started += performance.now() - hiddenAt;
			hiddenAt = null;
		}
	});
	$('status').textContent = 'Ready · 10 synchronized variants · exact selected PNG, unchanged';
	function tick(now) {
		if (document.hidden) {
			requestAnimationFrame(tick);
			return;
		}
		const before = performance.now();
		if (!paused) age = Math.max(0, now - started);
		const options = { speed: Number($('speed').value), reduced: $('reduced').checked };
		for (const { c, variant, source } of cards) {
			c.clearRect(0, 0, 440, 390);
			render(c, 'wild', age, { ...options, cluster: variant.id, size: 302, x: 69, y: 0 });
			for (let i = 0; i < 5; i++) {
				const x = 14 + i * 83,
					y = 302;
				c.fillStyle = '#0a1c32';
				c.strokeStyle = variant.colour;
				c.lineWidth = 1.5;
				c.beginPath();
				c.roundRect(x, y, 79, 79, 9);
				c.fill();
				c.stroke();
				if (i === 2) render(c, 'wild', age, { ...options, cluster: variant.id, size: 79, x, y });
				else c.drawImage(source, x, y, 79, 79);
			}
		}
		$('scrub').value = Math.min(1000, (age / duration()) * 1000);
		$('time').textContent =
			`${Math.round(Math.min(age, duration()))} / ${Math.round(duration())} ms`;
		if (!paused && $('loop').checked && age > duration() + 500) restart();
		cpu += performance.now() - before;
		frames++;
		if (frames === 120) {
			$('perf').textContent =
				`${(cpu / frames).toFixed(1)} ms / Canvas frame · 10 large Wilds + 10 cell Wilds · source icons cached. Not GPU/mobile certification.`;
			cpu = frames = 0;
		}
		requestAnimationFrame(tick);
	}
	requestAnimationFrame(tick);
}
start().catch((error) => {
	$('status').textContent = 'Preview failed: ' + error.message;
	console.error(error);
});
