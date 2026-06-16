const formatPortTooltip = (number, port, poe) => {
	const link = port?.link?.established ? 'up' : 'down';
	const speed = port?.link?.speed ? `${port.link.speed} Mbps` : 'not negotiated';
	const lines = [
		`Port ${number}${port?.name ? ` — ${port.name}` : ''}`,
		`Administrative state: ${(port?.enabled ?? true) ? 'enabled' : 'disabled'}`,
		`Link: ${link} (${speed})`,
		`VLAN: ${port?.vlan?.mode ?? 'access'}, PVID ${port?.vlan?.pvid ?? 1}`,
		`STP: ${port?.stp?.enabled ? 'enabled' : 'disabled'}${port?.stp?.state ? `, ${port.stp.state}` : ''}`,
	];
	if (poe) {
		lines.push(`PoE: ${port?.poe?.enabled ? `enabled (${port?.poe?.mode ?? 'at'})` : 'disabled'}`);
		if (Number.isFinite(port?.poe?.power)) lines.push(`PoE draw: ${port.poe.power.toFixed(2)} W`);
	}
	return lines.join('\n');
};

export default function Port({ number, port, poe, selected, onSelect }) {
	let className = 'port';
	const speed = port?.link?.speed;
	const enabled = port?.enabled ?? true;
	if (speed) className += ` speed-${speed}`;
	if (!enabled) className += ' disabled';
	if (selected) className += ' selected';
	const select = () => onSelect?.(String(number));
	return (
		<div className={className} title={formatPortTooltip(number, port, poe)} role="button" tabIndex="0" aria-label={`Edit port ${number}`}
			onClick={select} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); select(); } }}>
			{port?.stp?.enabled && <span className="port-badge port-badge-stp">&bull;</span>}
			{poe && port?.poe?.enabled && <span className="port-poe">{port?.poe?.mode}</span>}
			{number}<span className="port-vlan">{port?.vlan?.pvid}</span>
		</div>
	);
}
