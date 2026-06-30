export function chunkPorts(items, size = 12) {
	const groups = [];
	for (let index = 0; index < items.length; index += size) groups.push(items.slice(index, index + size));
	return groups;
}

export function splitPortBanks(portNumbers, capabilities = {}, phone = false) {
	const keys = [...portNumbers].map(Number).filter(Number.isFinite).sort((a, b) => a - b);
	const configuredUplinks = Number(capabilities?.uplink_ports ?? capabilities?.uplink?.count ?? 0);
	const uplinkCount = configuredUplinks > 0 ? configuredUplinks : (keys.length > 10 ? 4 : 2);
	const copperCount = Number(capabilities?.copper_ports ?? Math.max(0, keys.length - uplinkCount));
	const copperPorts = keys.slice(0, copperCount);
	const uplinkPorts = keys.slice(copperCount, copperCount + uplinkCount);
	const copperBankSize = phone ? 6 : 12;
	return {
		copperBanks: chunkPorts(copperPorts, copperBankSize).map(bank => ({
			ports: bank,
			label: bank.length ? `${bank[0]}–${bank.at(-1)}` : '',
		})),
		uplinkPorts,
		uplinkPairs: chunkPorts(uplinkPorts, 2),
		uplinkLabel: capabilities?.uplink?.label ?? (Number(capabilities?.uplink?.max_speed_mbps) >= 10000 ? 'SFP+' : 'SFP'),
	};
}
