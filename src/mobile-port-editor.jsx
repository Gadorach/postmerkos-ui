import { mergePortState } from './port-state';

const Card = ({ label, children, changed = false, help }) => <div className={`mobile-setting-card${changed ? ' diff-background' : ''}`}><div className="mobile-setting-label"><strong>{label}</strong>{help && <small>{help}</small>}</div><div className="mobile-setting-control">{children}</div></div>;
const Bool = ({ value, onChange, onLabel = 'On', offLabel = 'Off' }) => <span className="toggle"><button className={!value ? 'active' : ''} onClick={() => onChange(false)}>{offLabel}</button><button className={value ? 'active' : ''} onClick={() => onChange(true)}>{onLabel}</button></span>;
const changedAt = (diff, port, path) => path.split('.').reduce((value, part) => value?.[part], diff?.ports?.[port]) != null;

export default function MobilePortEditor({ port, config, status, poe, updatePort, updatePortMulti, diff }) {
	const desired = config.ports[port];
	const clients = status?.clients?.[port] ?? [];
	const p = mergePortState(desired, status?.ports?.[port], clients);
	const poeCapable = status?.ports?.[port]?.capabilities?.poe ?? Boolean(p.poe);
	const vlanMode = p.vlan?.mode ?? 'access';
	const vlanValue = vlanMode === 'access' ? (p.vlan?.pvid ?? 1) : (p.vlan?.allowed ?? '');
	const updateVlans = value => {
		if (/[,\-]/.test(String(value))) updatePortMulti(port, { 'vlan.mode': p.vlan?.untagged_vid ? 'hybrid' : 'trunk', 'vlan.allowed': value, 'vlan.pvid': Number(String(value).split(/[,\-]/)[0]) || 1 });
		else updatePortMulti(port, { 'vlan.mode': 'access', 'vlan.pvid': Number(value) || 1, 'vlan.allowed': '', 'vlan.untagged_vid': 0 });
	};
	return <div className="mobile-port-editor">
		<details open><summary>Overview</summary><div className="mobile-settings-list">
			<Card label="Link state"><span>{p.link?.established ? 'Up' : 'Down'} · {p.link?.speed ? `${p.link.speed} Mb/s` : 'not negotiated'}</span></Card>
			<Card label="Clients"><span>{clients.length}</span></Card>
			{poe && <Card label="PoE runtime"><span>{poeCapable ? `${status?.ports?.[port]?.poe?.power?.toFixed?.(2) ?? '—'} W` : 'Not supported'}</span></Card>}
		</div></details>
		<details open><summary>Basic settings</summary><div className="mobile-settings-list">
			<Card label="Administrative state" changed={changedAt(diff, port, 'enabled')}><Bool value={p.enabled ?? true} onChange={value => updatePort(port, 'enabled', value)} onLabel="Enabled" offLabel="Disabled" /></Card>
			<Card label="Port name" changed={changedAt(diff, port, 'name')}><input value={p.name ?? ''} onInput={event => updatePort(port, 'name', event.currentTarget.value)} /></Card>
			<Card label="Configured speed" changed={changedAt(diff, port, 'speed')}><select value={p.speed ?? 'auto'} onChange={event => updatePort(port, 'speed', event.currentTarget.value)}><option value="auto">Auto</option><option value="10-half">10 half</option><option value="10-full">10 full</option><option value="100-half">100 half</option><option value="100-full">100 full</option><option value="1000-full">1000 full</option><option value="10000-full">10000 full</option></select></Card>
			<Card label="Flow control" changed={changedAt(diff, port, 'flow_control')}><Bool value={p.flow_control ?? false} onChange={value => updatePort(port, 'flow_control', value)} /></Card>
			<Card label="Energy Efficient Ethernet" changed={changedAt(diff, port, 'eee')}><Bool value={p.eee ?? true} onChange={value => updatePort(port, 'eee', value)} /></Card>
			<Card label="Storm control" changed={changedAt(diff, port, 'storm_control')}><Bool value={p.storm_control ?? false} onChange={value => updatePort(port, 'storm_control', value)} /></Card>
		</div></details>
		{poe && poeCapable && <details><summary>Power over Ethernet</summary><div className="mobile-settings-list">
			<Card label="PoE state" changed={changedAt(diff, port, 'poe.enabled')}><Bool value={p.poe?.enabled ?? false} onChange={value => updatePort(port, 'poe.enabled', value)} /></Card>
			<Card label="PoE standard" changed={changedAt(diff, port, 'poe.mode')}><select value={p.poe?.mode ?? 'at'} onChange={event => updatePort(port, 'poe.mode', event.currentTarget.value)}><option value="af">802.3af</option><option value="at">802.3at</option></select></Card>
			<Card label="Energy policy" changed={changedAt(diff, port, 'poe.policy')}><select value={p.poe?.policy ?? 'normal'} onChange={event => updatePort(port, 'poe.policy', event.currentTarget.value)}><option value="normal">Normal</option><option value="boot-prune">Boot prune</option></select></Card>
		</div></details>}
		<details><summary>VLAN</summary><div className="mobile-settings-list">
			<Card label="VLANs" changed={changedAt(diff, port, 'vlan.mode') || changedAt(diff, port, 'vlan.pvid') || changedAt(diff, port, 'vlan.allowed')} help="Single VLAN = access; list/range = trunk or hybrid"><input value={vlanValue} onInput={event => updateVlans(event.currentTarget.value)} /></Card>
			<Card label="Native VLAN" changed={changedAt(diff, port, 'vlan.untagged_vid')}><input type="number" min="1" max="4094" disabled={vlanMode === 'access'} value={p.vlan?.untagged_vid || ''} onInput={event => updatePortMulti(port, { 'vlan.mode': Number(event.currentTarget.value) ? 'hybrid' : 'trunk', 'vlan.untagged_vid': Number(event.currentTarget.value) || 0 })} /></Card>
			<Card label="Ingress filtering" changed={changedAt(diff, port, 'vlan.ingress_filter')}><Bool value={p.vlan?.ingress_filter ?? true} onChange={value => updatePort(port, 'vlan.ingress_filter', value)} /></Card>
		</div></details>
		<details><summary>Spanning Tree</summary><div className="mobile-settings-list">
			<Card label="STP state" changed={changedAt(diff, port, 'stp.enabled')}><Bool value={p.stp?.enabled ?? false} onChange={value => updatePort(port, 'stp.enabled', value)} /></Card>
			<Card label="Priority" changed={changedAt(diff, port, 'stp.priority')}><input type="number" min="0" max="255" value={p.stp?.priority ?? 128} onInput={event => updatePort(port, 'stp.priority', Number(event.currentTarget.value))} /></Card>
			<Card label="Path cost" changed={changedAt(diff, port, 'stp.cost')}><input type="number" min="0" value={p.stp?.cost ?? 0} onInput={event => updatePort(port, 'stp.cost', Number(event.currentTarget.value))} /></Card>
			<Card label="Edge port" changed={changedAt(diff, port, 'stp.edge')}><Bool value={p.stp?.edge ?? false} onChange={value => updatePort(port, 'stp.edge', value)} /></Card>
			<Card label="Automatic edge" changed={changedAt(diff, port, 'stp.auto_edge')}><Bool value={p.stp?.auto_edge ?? true} onChange={value => updatePort(port, 'stp.auto_edge', value)} /></Card>
			<Card label="Observed state"><span>{p.stp?.state ?? '—'} · {p.stp?.role ?? '—'}</span></Card>
		</div></details>
		<details><summary>Clients ({clients.length})</summary><div className="mobile-settings-list">{clients.length ? clients.map(client => <div className="mobile-client-card" key={`${client.mac}-${client.ip}`}><strong>{client.mac}</strong><span>{client.ip || '—'}</span><small>{Number.isFinite(client.age) ? `${Math.round(client.age)} seconds ago` : 'age unavailable'}</small></div>) : <p>No learned clients.</p>}</div></details>
	</div>;
}
