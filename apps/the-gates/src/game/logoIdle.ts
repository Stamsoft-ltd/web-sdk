/** Staggered word-only pulses: THE first, GATES starts 500ms before THE peaks. Badge never moves. */
export const LOGO_IDLE_MS = 2500;
const WORD_PULSE_MS = 2000;
export function logoWordScale(age: number, word: 'the' | 'gates', reduced = false) {
	if (reduced || age <= 0) return 1;
	const phase = age % LOGO_IDLE_MS;
	const start = word === 'the' ? 0 : 500;
	const local = phase - start;
	if (local < 0 || local >= WORD_PULSE_MS) return 1;
	return 1 + 0.04 * (1 - Math.cos((local / (WORD_PULSE_MS)) * Math.PI * 2));
}
