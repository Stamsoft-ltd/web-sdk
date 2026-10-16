/** Preserve a supplied scheme; never substitute another RGS host. */
export function normalizeRgsUrl(raw: string, insecurePage = false) {
	const value = raw.trim();
	if (!value) throw new Error('Missing RGS URL');
	const url = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(value) ? value : `https://${value}`);
	const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
	if (
		!['https:', 'http:'].includes(url.protocol) ||
		(url.protocol === 'http:' && !(local && insecurePage))
	)
		throw new Error('Invalid RGS protocol');
	if (url.username || url.password || url.search || url.hash) throw new Error('Invalid RGS URL');
	if (local && insecurePage && !/^[a-z][a-z\d+.-]*:\/\//i.test(value)) url.protocol = 'http:';
	return url.href.replace(/\/+$/, '');
}
