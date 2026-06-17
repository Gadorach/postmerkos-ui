const formatTimestamp = value => value ? new Date(Number(value) * 1000).toLocaleString() : '—';

const formatSeconds = value => {
	const seconds = Number(value || 0);
	if (!seconds) return '—';
	if (seconds < 60) return `${seconds}s`;
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return `${minutes}m`;
	return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
};

export default function NetworkPanel({ config, status, updateConfig, diff }) {
	const ipv4 = config?.network?.ipv4 ?? {};
	const runtime = status?.network?.ipv4 ?? {};
	const mode = ipv4.mode ?? 'dhcp';
	const changed = Boolean(diff?.network);

	const changeMode = event => {
		const nextMode = event.target.value;
		if (nextMode === 'static') {
			const currentAddress = String(runtime.address ?? '192.168.1.2/24');
			updateConfig('network.ipv4', {
				mode: 'static',
				address: currentAddress,
				gateway: runtime.gateway || '192.168.1.1',
				mtu: ipv4.mtu || 1500,
			});
		} else {
			updateConfig('network.ipv4', {
				mode: 'dhcp',
				fallback_address: '169.254.0.10/16',
				mtu: ipv4.mtu || 1500,
			});
		}
	};

	return (
		<section className={`network-panel${changed ? ' diff-background' : ''}`}>
			<div className="network-heading">
				<h2>Management IPv4</h2>
				<span className={`network-state network-state-${runtime.state ?? 'unknown'}`}>{runtime.state ?? 'unknown'}</span>
			</div>
			<div className="network-grid">
				<label>Mode<select value={mode} onChange={changeMode}><option value="dhcp">DHCP</option><option value="static">Static</option></select></label>
				{mode === 'static' ? <>
					<label>Address/CIDR<input value={ipv4.address ?? ''} onInput={event => updateConfig('network.ipv4.address', event.target.value)} /></label>
					<label>Gateway<input value={ipv4.gateway ?? ''} onInput={event => updateConfig('network.ipv4.gateway', event.target.value)} /></label>
				</> : <label>Fallback address<input value={ipv4.fallback_address ?? ''} onInput={event => updateConfig('network.ipv4.fallback_address', event.target.value)} /></label>}
				<label>MTU<input type="number" min="576" max="9216" value={ipv4.mtu ?? 1500} onInput={event => updateConfig('network.ipv4.mtu', Number(event.target.value))} /></label>
			</div>
			<dl className="network-runtime">
				<div><dt>Current</dt><dd>{runtime.address ?? '—'}</dd></div>
				<div><dt>Source</dt><dd>{runtime.source ?? '—'}</dd></div>
				<div><dt>Gateway</dt><dd>{runtime.gateway ?? '—'}</dd></div>
				<div><dt>Broadcast</dt><dd>{runtime.broadcast ?? '—'}</dd></div>
				<div><dt>Lease acquired</dt><dd>{formatTimestamp(runtime.lease_acquired_at)}</dd></div>
				<div><dt>Renew</dt><dd>{formatSeconds(runtime.renew_in)}</dd></div>
				<div><dt>Expires in</dt><dd>{formatSeconds(runtime.expires_in)}</dd></div>
				<div><dt>Lease expires</dt><dd>{formatTimestamp(runtime.lease_expires_at)}</dd></div>
			</dl>
			{runtime.last_error && <div className="warning">{runtime.last_error}</div>}
			<p className="network-note">Applying a new management address may disconnect this page. Reconnect using the new address shown above.</p>
		</section>
	);
}
