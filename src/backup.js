export async function createBackup(config) {
	return new Blob([`${JSON.stringify(config, null, 2)}\n`], { type: 'application/json' });
}

export async function readBackup(file) {
	let config;
	try { config = JSON.parse(await file.text()); }
	catch { throw new Error('Backup does not contain valid JSON configuration'); }
	if (!config || typeof config !== 'object' || Array.isArray(config))
		throw new Error('Backup configuration must be a JSON object');
	return config;
}

export function downloadBlob(blob, filename) {
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url; link.download = filename;
	document.body.appendChild(link); link.click(); link.remove();
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}
