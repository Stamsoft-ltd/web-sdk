/** Lossless PNG IDAT encoding only. Never alters pixels, filters, palette or metadata. */
import { inflateSync, deflateSync } from 'node:zlib';
import { createHash } from 'node:crypto';
const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const table = Uint32Array.from({ length: 256 }, (_, i) => {
	let c = i;
	for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
	return c >>> 0;
});
export function crc32(bytes) {
	let c = 0xffffffff;
	for (const b of bytes) c = table[(c ^ b) & 255] ^ (c >>> 8);
	return (c ^ 0xffffffff) >>> 0;
}
export function readPng(bytes) {
	if (!bytes.subarray(0, 8).equals(signature)) throw Error('Invalid PNG signature');
	const chunks = [];
	let cursor = 8,
		ended = false;
	while (cursor < bytes.length) {
		if (cursor + 12 > bytes.length) throw Error('Truncated PNG chunk');
		const length = bytes.readUInt32BE(cursor);
		const end = cursor + 12 + length;
		if (end > bytes.length) throw Error('Truncated PNG payload');
		const type = bytes.toString('ascii', cursor + 4, cursor + 8);
		const data = bytes.subarray(cursor + 8, end - 4);
		if (crc32(bytes.subarray(cursor + 4, end - 4)) !== bytes.readUInt32BE(end - 4))
			throw Error(`Invalid ${type} CRC`);
		chunks.push({ type, data, bytes: bytes.subarray(cursor, end) });
		cursor = end;
		if (type === 'IEND') {
			ended = true;
			break;
		}
	}
	if (
		!ended ||
		cursor !== bytes.length ||
		chunks[0]?.type !== 'IHDR' ||
		!chunks.some((c) => c.type === 'IDAT')
	)
		throw Error('Invalid PNG structure');
	return chunks;
}
const scanlines = (chunks) =>
	inflateSync(Buffer.concat(chunks.filter((c) => c.type === 'IDAT').map((c) => c.data)), {
		maxOutputLength: 256 * 1024 * 1024,
	});
const metadata = (chunks) =>
	Buffer.concat(chunks.filter((c) => c.type !== 'IDAT').map((c) => c.bytes));
export function samePixelPng(source, output) {
	try {
		const a = readPng(source),
			b = readPng(output);
		return metadata(a).equals(metadata(b)) && scanlines(a).equals(scanlines(b));
	} catch {
		return false;
	}
}
function idat(data) {
	const chunk = Buffer.alloc(data.length + 12);
	chunk.writeUInt32BE(data.length);
	chunk.write('IDAT', 4);
	data.copy(chunk, 8);
	chunk.writeUInt32BE(crc32(chunk.subarray(4, -4)), chunk.length - 4);
	return chunk;
}
export function optimizePng(source) {
	const chunks = readPng(source);
	// Do not touch animation encodings. Current game assets are ordinary PNGs.
	if (chunks.some((c) => c.type === 'acTL')) return { bytes: source, saved: 0 };
	const raw = scanlines(chunks),
		compressed = deflateSync(raw, { level: 9 });
	let emitted = false;
	const result = Buffer.concat([
		signature,
		...chunks.flatMap((c) => {
			if (c.type !== 'IDAT') return [c.bytes];
			if (emitted) return [];
			emitted = true;
			return [idat(compressed)];
		}),
	]);
	const bytes = result.length < source.length ? result : source;
	if (!samePixelPng(source, bytes)) throw Error('PNG scanline/metadata verification failed');
	return {
		bytes,
		saved: source.length - bytes.length,
		scanlineSha256: createHash('sha256').update(raw).digest('hex'),
	};
}
