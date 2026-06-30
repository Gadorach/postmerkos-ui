import { useEffect, useState } from 'preact/hooks';

const formatTimestamp = value => value ? new Date(Number(value) * 1000).toLocaleString() : '—';
const formatSeconds = value => { const seconds = Number(value || 0); if (!seconds) return '—'; if (seconds < 60) return `${seconds}s`; const minutes = Math.floor(seconds / 60); if (minutes < 60) return `${minutes}m`; return `${Math.floor(minutes / 60)}h ${minutes % 60}m`; };

export default function NetworkPanel({ client, config, status, updateConfig, diff, canManage }) {
	const ipv4 = config?.network?.ipv4 ?? {};
	const runtime = status?.network?.ipv4 ?? {};
	const mode = ipv4.mode ?? 'dhcp';
	const changed = Boolean(diff?.network);
	const [identity, setIdentity] = useState(null);
	const [identityError, setIdentityError] = useState('');
	const [identityNotice, setIdentityNotice] = useState('');
	const loadIdentity = () => client?.request('system_identity_get').then(response => setIdentity(response.data)).catch(failure => setIdentityError(failure.message));
	useEffect(() => { loadIdentity(); }, [client]);
	const hostname = identity?.policy?.hostname ?? identity?.configured_hostname ?? 'postmerkos';
	const saveIdentity = async () => {
		setIdentityError(''); setIdentityNotice('');
		try { await client.request('system_identity_set', { hostname: String(hostname).toLowerCase() }); await loadIdentity(); setIdentityNotice('Hostname updated. Local discovery is being refreshed.'); }
		catch (failure) { setIdentityError(failure.message); }
	};
	const changeMode = event => {
		const nextMode = event.target.value;
		if (nextMode === 'static') updateConfig('network.ipv4', { mode: 'static', address: String(runtime.address ?? '192.168.1.2/24'), gateway: runtime.gateway || '192.168.1.1', mtu: ipv4.mtu || 1500 });
		else updateConfig('network.ipv4', { mode: 'dhcp', fallback_address: '169.254.0.10/16', mtu: ipv4.mtu || 1500 });
	};
	return <div className="tab-stack network-stack">
		<section className="network-panel"><div className="network-heading"><h2>System Identity & Discovery</h2><span className={`network-state ${status?.services?.mdns?.running ? 'network-state-bound' : 'network-state-unknown'}`}>{status?.services?.mdns?.running ? 'mDNS active' : 'mDNS inactive'}</span></div>
			<div className="network-grid"><label>Hostname<input value={hostname} maxLength="63" pattern="[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?" disabled={!canManage} onInput={event => setIdentity(previous => ({ ...previous, policy: { ...(previous?.policy ?? {}), hostname: event.currentTarget.value.toLowerCase() } }))} /></label><label>Local address<input readOnly value={identity?.advertised_name ?? `${hostname}.local`} /></label></div>
			<dl className="network-runtime"><div><dt>Responder verification</dt><dd>{identity?.advertised_name_verified ? 'verified' : 'responder-managed'}</dd></div><div><dt>Name conflict</dt><dd>{identity?.conflict_state ?? 'unobserved'}</dd></div><div><dt>Central DNS registration</dt><dd>{identity?.dhcp_hostname_registration_supported ? 'supported' : 'not confirmed'}</dd></div></dl>
			{identity?.advertised_name_verified === false && <div className="warning">Avahi manages duplicate-name conflict resolution. This compact build does not use D-Bus, so a conflict-assigned suffix cannot be confirmed through configd; verify the resolved name from an mDNS client.</div>}
			<p className="network-note">The hostname is one DNS label. Do not include <code>.local</code>. Multicast DNS is restricted to the management interface and ordinary router DNS registration depends on the DHCP server.</p>
			<div className="button-row"><button className="btn-primary" disabled={!canManage || !identity} onClick={saveIdentity}>Apply identity</button><button className="btn-secondary" disabled={!canManage} onClick={() => setIdentity(previous => ({ ...previous, policy: { ...(previous?.policy ?? {}), hostname: 'postmerkos' } }))}>Use postmerkos</button><button className="btn-secondary" disabled={!canManage} onClick={() => setIdentity(previous => ({ ...previous, policy: { ...(previous?.policy ?? {}), hostname: `m${String(status?.system?.identity?.base_mac ?? '').replace(/:/g, '').toLowerCase()}` } }))}>Generate unique name</button></div>
			{identityNotice && <div className="notice">{identityNotice}</div>}{identityError && <div className="error">{identityError}</div>}
		</section>
		<section className={`network-panel${changed ? ' diff-background' : ''}`}><div className="network-heading"><h2>Management IPv4</h2><span className={`network-state network-state-${runtime.state ?? 'unknown'}`}>{runtime.state ?? 'unknown'}</span></div>
			<div className="network-grid"><label>Mode<select value={mode} onChange={changeMode}><option value="dhcp">DHCP</option><option value="static">Static</option></select></label>{mode === 'static' ? <><label>Address/CIDR<input value={ipv4.address ?? ''} onInput={event => updateConfig('network.ipv4.address', event.target.value)} /></label><label>Gateway<input value={ipv4.gateway ?? ''} onInput={event => updateConfig('network.ipv4.gateway', event.target.value)} /></label></> : <label>Fallback address<input value={ipv4.fallback_address ?? ''} onInput={event => updateConfig('network.ipv4.fallback_address', event.target.value)} /></label>}<label>MTU<input type="number" min="576" max="9216" value={ipv4.mtu ?? 1500} onInput={event => updateConfig('network.ipv4.mtu', Number(event.target.value))} /></label></div>
			<dl className="network-runtime"><div><dt>Current</dt><dd>{runtime.address ?? '—'}</dd></div><div><dt>Source</dt><dd>{runtime.source ?? '—'}</dd></div><div><dt>Gateway</dt><dd>{runtime.gateway ?? '—'}</dd></div><div><dt>Broadcast</dt><dd>{runtime.broadcast ?? '—'}</dd></div><div><dt>Lease acquired</dt><dd>{formatTimestamp(runtime.lease_acquired_at)}</dd></div><div><dt>Renew</dt><dd>{formatSeconds(runtime.renew_in)}</dd></div><div><dt>Expires in</dt><dd>{formatSeconds(runtime.expires_in)}</dd></div><div><dt>Lease expires</dt><dd>{formatTimestamp(runtime.lease_expires_at)}</dd></div></dl>
			{runtime.last_error && <div className="warning">{runtime.last_error}</div>}<p className="network-note">Applying a new management address may disconnect this page. Reconnect using the new address shown above.</p>
		</section>
	</div>;
}
