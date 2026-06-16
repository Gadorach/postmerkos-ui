import CryptoJS from 'crypto-js';

export const OPENSSL_HEADER = new TextEncoder().encode('Salted__');
export const BACKUP_ITERATIONS = 100000;

export function bytesToWordArray(bytes) {
	const words = [];
	for (let i = 0; i < bytes.length; i++) words[i >>> 2] = (words[i >>> 2] ?? 0) | (bytes[i] << (24 - (i % 4) * 8));
	return CryptoJS.lib.WordArray.create(words, bytes.length);
}

export function wordArrayToBytes(wordArray) {
	const bytes = new Uint8Array(wordArray.sigBytes);
	for (let i = 0; i < wordArray.sigBytes; i++) bytes[i] = (wordArray.words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
	return bytes;
}

export function sha256Hex(bytes) {
	return CryptoJS.SHA256(bytesToWordArray(bytes)).toString(CryptoJS.enc.Hex);
}

export function randomBytes(size) {
	return wordArrayToBytes(CryptoJS.lib.WordArray.random(size));
}

export function deriveBackupKey(password, salt) {
	const derived = CryptoJS.PBKDF2(password, bytesToWordArray(salt), {
		keySize: 48 / 4,
		iterations: BACKUP_ITERATIONS,
		hasher: CryptoJS.algo.SHA256,
	});
	return {
		key: CryptoJS.lib.WordArray.create(derived.words.slice(0, 8), 32),
		iv: CryptoJS.lib.WordArray.create(derived.words.slice(8, 12), 16),
	};
}

export function aesEncrypt(bytes, key, iv) {
	return wordArrayToBytes(CryptoJS.AES.encrypt(bytesToWordArray(bytes), key, {
		iv,
		mode: CryptoJS.mode.CBC,
		padding: CryptoJS.pad.Pkcs7,
	}).ciphertext);
}

export function aesDecrypt(bytes, key, iv) {
	const decrypted = CryptoJS.AES.decrypt({ ciphertext: bytesToWordArray(bytes) }, key, {
		iv,
		mode: CryptoJS.mode.CBC,
		padding: CryptoJS.pad.Pkcs7,
	});
	if (decrypted.sigBytes < 0) throw new Error('decryption failed');
	return wordArrayToBytes(decrypted);
}
