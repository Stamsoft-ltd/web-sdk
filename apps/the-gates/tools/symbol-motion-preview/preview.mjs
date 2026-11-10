import { createSymbolRenderer, SYMBOLS } from './render.mjs';
import { DURATION_MS } from './motion.mjs';
import { WILD_CLUSTERS } from './wild-motion.mjs';
const $ = (id) => document.getElementById(id),
	hero = $('hero').getContext('2d'),
	board = $('board').getContext('2d');
const render = await createSymbolRenderer();
let selected =
		SYMBOLS.find((s) => s.id === new URLSearchParams(location.search).get('symbol'))?.id ??
		'pharaoh',
	age = 0,
	started = performance.now(),
	paused = false,
	cpuTotal = 0,
	cpuFrames = 0;
const cards = [];
$('cluster').replaceChildren(
	...WILD_CLUSTERS.map((v) => {
		const o = document.createElement('option');
		o.value = v.colour;
		o.textContent = v.name;
		return o;
	}),
);
$('cluster').value = '#58ff14';
for (const symbol of SYMBOLS) {
	const option = document.createElement('option');
	option.value = symbol.id;
	option.textContent = symbol.name;
	$('symbol').append(option);
	const button = document.createElement('button');
	button.className = 'study';
	button.type = 'button';
	button.setAttribute('aria-label', 'Preview ' + symbol.name);
	button.setAttribute('aria-pressed', String(selected === symbol.id));
	const canvas = document.createElement('canvas');
	canvas.width = canvas.height = 220;
	canvas.setAttribute('aria-hidden', 'true');
	button.append(canvas);
	const label = document.createElement('span');
	label.textContent = symbol.name;
	button.append(label);
	$('gallery').append(button);
	button.onclick = () => {
		selected = symbol.id;
		select();
		restart();
		window.scrollTo({ top: 0, behavior: $('reduced').checked ? 'instant' : 'smooth' });
	};
	cards.push({ button, c: canvas.getContext('2d'), id: symbol.id });
}
function select() {
	$('symbol').value = selected;
	const symbol = SYMBOLS.find((s) => s.id === selected);
	$('selected-name').textContent = symbol.name;
	$('selected-note').textContent = symbol.note;
	$('asset-note').textContent =
		symbol.quality ??
		(symbol.split
			? 'Final split needed: ' + symbol.split + '.'
			: 'Existing art sufficient for this study.');
	for (const card of cards) card.button.setAttribute('aria-pressed', String(card.id === selected));
}
function restart() {
	age = 0;
	started = performance.now();
	paused = false;
	$('pause').textContent = 'Pause';
}
$('symbol').onchange = () => {
	selected = $('symbol').value;
	select();
	restart();
};
$('play').onclick = restart;
$('speed').onchange = restart;
$('pause').onclick = () => {
	paused = !paused;
	if (!paused) started = performance.now() - age;
	$('pause').textContent = paused ? 'Resume' : 'Pause';
};
$('scrub').oninput = () => {
	age = ((Number($('scrub').value) / 1000) * DURATION_MS) / Number($('speed').value);
	paused = true;
	$('pause').textContent = 'Resume';
};
const paying = new Set([1, 4, 7, 9, 12, 17, 21, 28]);
select();
function tick(now) {
	if (document.hidden) {
		requestAnimationFrame(tick);
		return;
	}
	const cpuStart = performance.now();
	if (!paused) age = Math.max(0, now - started);
	const options = {
			speed: Number($('speed').value),
			reduced: $('reduced').checked,
			anchors: $('hinges').checked,
			cluster: $('cluster').value,
		},
		duration = DURATION_MS / options.speed;
	hero.clearRect(0, 0, 640, 500);
	const halo = hero.createRadialGradient(320, 245, 0, 320, 245, 235);
	halo.addColorStop(0, '#1c7fc344');
	halo.addColorStop(1, '#1c7fc300');
	hero.fillStyle = halo;
	hero.fillRect(0, 0, 640, 500);
	render(hero, selected, age, { ...options, size: 400, x: 120, y: 35 });
	render(hero, selected, 0, { ...options, reduced: true, size: 90, x: 20, y: 375 });
	hero.fillStyle = '#b6cbe2';
	hero.font = '14px system-ui';
	hero.fillText('REST', 39, 486);
	board.clearRect(0, 0, 900, 750);
	for (let row = 0; row < 5; row++)
		for (let col = 0; col < 6; col++) {
			const i = row * 6 + col,
				x = col * 145 + 15,
				y = row * 145 + 12,
				win = paying.has(i);
			board.fillStyle = '#102b49';
			board.strokeStyle = win ? '#ffdc40' : '#315477';
			board.lineWidth = win ? 3 : 2;
			board.beginPath();
			board.roundRect(x, y, 137, 137, 12);
			board.fill();
			board.stroke();
			if (win) {
				const colour =
						selected === 'wild' ? options.cluster : SYMBOLS.find((s) => s.id === selected).colour,
					g = board.createRadialGradient(x + 68, y + 68, 4, x + 68, y + 68, 70);
				g.addColorStop(0, colour + '55');
				g.addColorStop(1, colour + '00');
				board.fillStyle = g;
				board.fillRect(x, y, 137, 137);
			}
			render(
				board,
				win ? selected : ['red-gem', 'blue-gem', 'purple-gem', 'green-gem', 'gold-gem'][i % 5],
				win ? age : 0,
				{ ...options, size: 133, x: x + 2, y: y + 2, reduced: win ? options.reduced : true },
			);
		}
	for (const card of cards) {
		card.c.clearRect(0, 0, 220, 220);
		render(card.c, card.id, age, { ...options, size: 200, x: 10, y: 10 });
	}
	$('scrub').value = Math.min(1000, (age / duration) * 1000);
	$('time').textContent = `${Math.min(duration, Math.round(age)) | 0} / ${Math.round(duration)} ms`;
	if (!paused && $('loop').checked && age > duration + 400) restart();
	cpuTotal += performance.now() - cpuStart;
	cpuFrames++;
	if (cpuFrames === 120) {
		$('perf').textContent =
			`${(cpuTotal / cpuFrames).toFixed(1)} ms / rendered frame · Canvas study`;
		cpuTotal = cpuFrames = 0;
	}
	requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
