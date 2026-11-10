import { createComponentKnight } from './component-knight-render.mjs';
import { KNIGHT_MS, knightOpen } from './component-knight-motion.mjs';
const $ = (id) => document.getElementById(id);
try {
	const render = await createComponentKnight(),
		contexts = ['animated', 'closed', 'open'].map((id) => $(id).getContext('2d'));
	let age = 0,
		paused = false,
		last = performance.now(),
		hidden = document.hidden,
		dirty = true;
	$('reduced').checked = matchMedia('(prefers-reduced-motion: reduce)').matches;
	const reset = () => {
		age = 0;
		paused = false;
		dirty = true;
		last = performance.now();
		$('pause').textContent = 'Pause';
	};
	$('replay').onclick = reset;
	$('pause').onclick = () => {
		paused = !paused;
		last = performance.now();
		$('pause').textContent = paused ? 'Resume' : 'Pause';
	};
	$('scrub').oninput = () => {
		age = (Number($('scrub').value) * KNIGHT_MS) / 1000;
		paused = true;
		dirty = true;
		$('pause').textContent = 'Resume';
	};
	for (const id of ['pins', 'reduced', 'visor-visible'])
		$(id).onchange = () => {
			dirty = true;
		};
	document.addEventListener('visibilitychange', () => {
		hidden = document.hidden;
		last = performance.now();
	});
	function tick(now) {
		const dt = Math.max(0, now - last);
		last = now;
		if (!hidden) {
			if (!paused) {
				age += Math.min(dt, 100);
				if (age > KNIGHT_MS + 500) age = 0;
				dirty = true;
			}
			if (dirty) {
				const flags = { anchors: $('pins').checked, showVisor: $('visor-visible').checked };
				render(contexts[0], knightOpen(age, { reduced: $('reduced').checked }), flags);
				render(contexts[1], 0, flags);
				render(contexts[2], 1, flags);
				$('time').textContent = `${Math.min(KNIGHT_MS, Math.round(age))} / ${KNIGHT_MS} ms`;
				$('scrub').value = Math.min(1000, (age / KNIGHT_MS) * 1000);
				dirty = false;
			}
		}
		requestAnimationFrame(tick);
	}
	requestAnimationFrame(tick);
} catch (error) {
	$('time').textContent = 'Unable to load components: ' + error.message;
	console.error(error);
}
