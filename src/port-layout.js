export function chunkPorts(items, size = 12) {
	const groups = [];
	for (let index = 0; index < items.length; index += size) groups.push(items.slice(index, index + size));
	return groups;
}

export function splitPortBanks(portNumbers) {
	const keys = [...portNumbers].map(Number).filter(Number.isFinite).sort((a, b) => a - b);
	const sfpCount = keys.length > 10 ? 4 : 2;
	const firstSfp = keys.length ? keys.length - sfpCount + 1 : 1;
	return {
		ethernetBanks: chunkPorts(keys.filter(number => number < firstSfp), 12),
		sfpPorts: keys.filter(number => number >= firstSfp),
	};
}
