import { createShortKnight } from './short-knight-render.mjs';
import { shortClosed } from './short-knight-motion.mjs';
const $ = (id) => document.getElementById(id),
	contexts = ['open', 'closed', 'animated'].map((id) => $(id).getContext('2d'));
const render = await createShortKnight();
let age = 0,
	last = performance.now(),
	paused = false,
	hidden = document.hidden;
function restart() {
	age = 0;
	paused = false;
	last = performance.now();
	$('pause').textContent = 'Pause';
}
$('replay').onclick = restart;
$('speed').onchange = restart;
$('pause').onclick = () => {
	paused = !paused;
	$('pause').textContent = paused ? 'Resume' : 'Pause';
};
$('scrub').oninput = () => {
	paused = true;
	age = (Number($('scrub').value) * 1.8) / Number($('speed').value);
	$('pause').textContent = 'Resume';
};
$('reduced').checked = matchMedia('(prefers-reduced-motion: reduce)').matches;
document.addEventListener('visibilitychange', () => {
	hidden = document.hidden;
	last = performance.now();
});
function tick(now) {
	const delta = Math.max(0, now - last);
	last = now;
	if (!hidden) {
		const speed = Number($('speed').value),
			duration = 1800 / speed;
		if (!paused) age += delta;
		const flags = { anchors: $('pins').checked };
		render(contexts[0], 0, flags);
		render(contexts[1], 1, flags);
		render(contexts[2], $('reduced').checked ? 0 : shortClosed(age * speed), flags);
		$('time').textContent = `${Math.min(duration, Math.round(age))} / ${Math.round(duration)} ms`;
		$('scrub').value = Math.min(1000, (age / duration) * 1000);
		if (!paused && age > duration + 450) age = 0;
	}
	requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
