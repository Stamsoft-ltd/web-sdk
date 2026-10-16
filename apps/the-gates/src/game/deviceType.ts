/** Device evidence, never viewport dimensions: resizing desktop alone is not mobile.
 * A desktop launch hint must not veto an actual/emulated phone or touch pointer.
 */
export function isMobileDevice({
	device,
	userAgent = '',
	clientHintMobile = false,
	maxTouchPoints = 0,
	coarsePointer = false,
}: {
	device?: string | null;
	userAgent?: string;
	clientHintMobile?: boolean;
	maxTouchPoints?: number;
	coarsePointer?: boolean;
}) {
	const explicit = device?.trim().toLowerCase();
	return (
		explicit === 'mobile' ||
		explicit === 'tablet' ||
		clientHintMobile ||
		/Android|iPhone|iPad|iPod/i.test(userAgent) ||
		(/Macintosh/i.test(userAgent) && maxTouchPoints > 1) ||
		(coarsePointer && maxTouchPoints > 0)
	);
}
