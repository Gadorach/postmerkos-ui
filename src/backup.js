import { aesDecrypt, aesEncrypt, deriveBackupKey, OPENSSL_HEADER, randomBytes } from './crypto.js';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const concat = (...arrays) => {
	const length = arrays.reduce((sum, array) => sum + array.length, 0);
	const output = new Uint8Array(length);
	let offset = 0;
	for (const array of arrays) { output.set(array, offset); offset += array.length; }
	return output;
};

const startsWith = (bytes, prefix) => prefix.every((value, index) => bytes[index] === value);

export async function createBackup(config, password = '') {
	const plain = encoder.encode(`${JSON.stringify(config, null, 2)}\n`);
	if (!password) return new Blob([plain], { type: 'application/json' });
	const salt = randomBytes(8);
	const { key, iv } = deriveBackupKey(password, salt);
	return new Blob([concat(OPENSSL_HEADER, salt, aesEncrypt(plain, key, iv))], { type: 'application/octet-stream' });
}

export async function readBackup(file, password = '') {
	const bytes = new Uint8Array(await file.arrayBuffer());
	let plain;
	if (startsWith(bytes, OPENSSL_HEADER)) {
		if (!password) throw new Error('This backup is encrypted; enter its password');
		if (bytes.length < 32) throw new Error('Encrypted backup is truncated');
		const { key, iv } = deriveBackupKey(password, bytes.slice(8, 16));
		try { plain = aesDecrypt(bytes.slice(16), key, iv); }
		catch { throw new Error('Backup password is incorrect or the file is damaged'); }
	} else plain = bytes;
	let config;
	try { config = JSON.parse(decoder.decode(plain)); }
	catch { throw new Error('Backup does not contain valid JSON configuration'); }
	if (!config || typeof config !== 'object' || Array.isArray(config)) throw new Error('Backup configuration must be a JSON object');
	return config;
}

export function downloadBlob(blob, filename) {
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url; link.download = filename;
	document.body.appendChild(link); link.click(); link.remove();
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}
