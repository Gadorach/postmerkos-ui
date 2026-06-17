import { useState } from 'preact/hooks';
import Help from './help';
import { mergePortState } from './port-state';

const SECTIONS = [
	{
		key: 'port',
		label: 'Port',
		defaultExpanded: true,
		columns: (poe) => [
			{ key: 'speed', label: 'speed', sortable: true, tooltip: 'Current link speed in Mbps' },
			...(poe ? [
				{ key: 'power', label: 'power', sortable: true, tooltip: 'Power consumption in watts' },
				{ key: 'poe', label: 'poe', sortable: true, tooltip: 'Power over Ethernet standard' },
				{ key: 'poe_policy', label: 'policy', tooltip: 'Normal detection or boot-prune energy-saving policy' },
			] : []),
			{ key: 'storm', label: 'storm', tooltip: 'Limits broadcast/multicast flooding' },
		],
	},
	{
		key: 'clients',
		label: 'Clients',
		defaultExpanded: false,
		columns: () => [
			{ key: 'client_count', label: 'count', sortable: true, tooltip: 'Number of connected clients' },
			{ key: 'client_detail', label: 'MAC / IP', tooltip: 'Connected client MAC, IP and last-seen age' },
		],
	},
	{
		key: 'vlan',
		label: 'VLAN',
		defaultExpanded: false,
		columns: () => [
			{ key: 'vlans', label: 'vlans', tooltip: 'VLAN IDs: single = access, comma/range = trunk/hybrid' },
			{ key: 'native', label: 'native', tooltip: 'Untagged VLAN on trunk/hybrid (enables hybrid mode)' },
			{ key: 'ingress_filter', label: 'filter', tooltip: 'Drop inbound frames with VLANs not in the allowed list' },
		],
	},
	{
		key: 'stp',
		label: 'STP',
		defaultExpanded: false,
		columns: () => [
			{ key: 'enabled', label: 'enabled', tooltip: 'Enable Spanning Tree Protocol on this port' },
			{ key: 'priority', label: 'priority', tooltip: 'Lower values are preferred for root port election' },
			{ key: 'cost', label: 'cost', tooltip: 'Path cost — lower values are preferred paths' },
			{ key: 'edge', label: 'edge', tooltip: 'Skip STP negotiation (for end devices, not switches)' },
			{ key: 'state', label: 'state', tooltip: 'Current STP state: forwarding, blocking, learning, or listening' },
			{ key: 'role', label: 'role', tooltip: 'STP role: root, designated, alternate, or disabled' },
		],
	},
];

// Check if a vlans string represents multiple VLANs (comma-separated or range)
const isMultipleVlans = (v) => /[,\-]/.test(String(v ?? ''));

const formatAge = (seconds) => {
	if (seconds == null || !Number.isFinite(seconds)) return '—';
	if (seconds < 60) return `${Math.round(seconds)}s`;
	if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
	return `${Math.floor(seconds / 3600)}h`;
};

const sortValue = (port, portNum, col, status, poe) => {
	const p = mergePortState(port, status?.ports?.[portNum], status?.clients?.[portNum] ?? []);
	switch (col) {
		case 'port': return Number(portNum);
		case 'name': return (p.name ?? '').toLowerCase();
		case 'speed': return p.link?.speed ?? 0;
		case 'power': return poe ? (status?.ports?.[portNum]?.poe?.power ?? -1) : -1;
		case 'poe': return p.poe?.enabled ? (p.poe?.mode === 'at' ? 2 : 1) : 0;
		case 'client_count': return (status?.clients?.[portNum] ?? []).length;
		default: return Number(portNum);
	}
};

function FilterBar({ filters, onChange }) {
	const set = (key, value) => onChange({ ...filters, [key]: value });
	return (
		<div className="filter-bar">
			<label>Link: <select value={filters.link} onChange={e => set('link', e.target.value)}>
				<option value="all">all</option>
				<option value="up">up</option>
				<option value="down">down</option>
			</select></label>
			<label>Speed: <select value={filters.speed} onChange={e => set('speed', e.target.value)}>
				<option value="all">any</option>
				<option value="10">10M</option>
				<option value="100">100M</option>
				<option value="1000">1G</option>
				<option value="10000">10G</option>
			</select></label>
			<label>PoE: <select value={filters.poe} onChange={e => set('poe', e.target.value)}>
				<option value="all">any</option>
				<option value="powered">powered</option>
				<option value="unpowered">unpowered</option>
			</select></label>
			<label><input type="checkbox" checked={filters.hasClients} onChange={e => set('hasClients', e.target.checked)} /> has clients</label>
		</div>
	);
}

const DEFAULT_FILTERS = { link: 'all', speed: 'all', poe: 'all', hasClients: false };

export default function Table({ ports, status, poe, updatePort, updatePortMulti, diff, selectedPort }) {
	const [sections, setSections] = useState(() => {
		const init = {};
		SECTIONS.forEach(s => { init[s.key] = s.defaultExpanded; });
		return init;
	});
	const [filters, setFilters] = useState(DEFAULT_FILTERS);
	const [sort, setSort] = useState({ column: null, direction: 'asc' });

	const toggle = (key) => setSections(prev => ({ ...prev, [key]: !prev[key] }));

	const toggleSort = (col) => {
		setSort(prev => {
			if (prev.column === col) {
				if (prev.direction === 'asc') return { column: col, direction: 'desc' };
				return { column: null, direction: 'asc' };
			}
			return { column: col, direction: 'asc' };
		});
	};

	const sortIndicator = (col) => {
		if (sort.column !== col) return '';
		return sort.direction === 'asc' ? ' ▴' : ' ▾';
	};

	const stickyHeaderSort = (col) => ({
		className: `sticky-col ${col === 'port' ? 'sticky-col-1' : 'sticky-col-2'} sortable`,
		onClick: () => toggleSort(col),
	});

	const diffStyle = (port, field) => {
		const parts = field.split('.');
		let val = diff?.ports?.[port];
		for (const part of parts) {
			val = val?.[part];
		}
		if (val != null) return "diff-background";
	};

	const vlansDiff = (port) =>
		diffStyle(port, 'vlan.mode') || diffStyle(port, 'vlan.pvid') || diffStyle(port, 'vlan.allowed');

	const handleVlansChange = (port, value, native) => {
		if (isMultipleVlans(value)) {
			updatePortMulti(port, {
				'vlan.mode': native ? 'hybrid' : 'trunk',
				'vlan.allowed': value,
				'vlan.pvid': Number(value.split(/[,\-]/)[0]) || 1,
			});
		} else {
			updatePortMulti(port, {
				'vlan.mode': 'access',
				'vlan.pvid': Number(value) || 1,
				'vlan.allowed': '',
				'vlan.untagged_vid': 0,
			});
		}
	};

	const handleNativeChange = (port, value, vlans) => {
		const n = Number(value) || 0;
		updatePortMulti(port, {
			'vlan.mode': n ? 'hybrid' : 'trunk',
			'vlan.untagged_vid': n,
		});
	};

	const expandedSections = SECTIONS.map(s => ({
		...s,
		expanded: sections[s.key],
		cols: s.columns(poe),
	}));

	let portKeys = Object.keys(ports);

	portKeys = portKeys.filter(port => {
		const runtime = status?.ports?.[port];
		const established = runtime?.link?.established;
		const speed = runtime?.link?.speed;
		const power = runtime?.poe?.power;
		const clients = status?.clients?.[port] ?? [];

		if (filters.link === 'up' && !established) return false;
		if (filters.link === 'down' && established) return false;
		if (filters.speed !== 'all' && String(speed) !== filters.speed) return false;
		if (filters.poe === 'powered' && !(power > 0)) return false;
		if (filters.poe === 'unpowered' && power > 0) return false;
		if (filters.hasClients && clients.length === 0) return false;
		return true;
	});

	if (sort.column) {
		const dir = sort.direction === 'asc' ? 1 : -1;
		portKeys.sort((a, b) => {
			const va = sortValue(ports[a], a, sort.column, status, poe);
			const vb = sortValue(ports[b], b, sort.column, status, poe);
			const cmp = typeof va === 'string' ? va.localeCompare(vb) : (va < vb ? -1 : va > vb ? 1 : 0);
			return cmp !== 0 ? cmp * dir : Number(a) - Number(b);
		});
	}

	return (
		<div className="table-scroll">
			<FilterBar filters={filters} onChange={setFilters} />
			<table className="port-table">
				<thead>
					<tr>
						<th rowSpan="2" {...stickyHeaderSort('port')}
							title="Sort by port number">port{sortIndicator('port')}</th>
						<th rowSpan="2" {...stickyHeaderSort('name')}
							title="Sort by port name">name{sortIndicator('name')}</th>
						{expandedSections.map(s => (
							<th key={s.key}
								colSpan={s.expanded ? s.cols.length : 1}
								className={`section-header section-toggle${s.expanded ? ' expanded' : ''}`}
								onClick={() => toggle(s.key)}
							>
								<span className="section-toggle-label">
									<span className="section-arrow">{s.expanded ? '▾' : '▸'}</span>
									{s.label}
									<Help section={s.key} />
								</span>
							</th>
						))}
					</tr>
					<tr>
						{expandedSections.map(s =>
							s.expanded
								? s.cols.map(col => (
									<th key={`${s.key}-${col.key}`} title={col.tooltip}
										className={col.sortable ? 'sortable' : ''}
										onClick={col.sortable ? () => toggleSort(col.key) : undefined}
									>{col.label}{col.sortable ? sortIndicator(col.key) : ''}</th>
								))
								: <th key={`${s.key}-collapsed`} className="collapsed-placeholder" />
						)}
					</tr>
				</thead>
				<tbody>
					{portKeys.map(port => {
						const clients = status?.clients?.[port] ?? [];
						let p = mergePortState(ports[port], status?.ports?.[port], clients);
						let enabled = p.enabled ?? true;
						let established = p.link?.established;
						let poeMode = p.poe?.mode ?? 'at';
						let poeEnabled = p.poe?.enabled ?? false;
						let poePolicy = p.poe?.policy ?? 'normal';
						let poeCapable = status?.ports?.[port]?.capabilities?.poe ?? Boolean(p.poe);
						let vlanMode = p.vlan?.mode ?? 'access';
						let isAccess = vlanMode === 'access';
						let vlansValue = isAccess ? (p.vlan?.pvid ?? '') : (p.vlan?.allowed ?? '');
						let nativeValue = p.vlan?.untagged_vid || '';
						let stpEnabled = p.stp?.enabled ?? false;
						return (
							<tr id={`port-row-${port}`} key={port} className={`${established ? '' : 'link-down'} ${String(selectedPort) === String(port) ? 'selected-port-row' : ''}`.trim()}>
								<td className={`sticky-col sticky-col-1 ${diffStyle(port, 'enabled') ?? ''}`}>
									<span className="toggle">
										<button
											className={enabled ? 'active' : ''}
											onClick={() => updatePort(port, 'enabled', !enabled)}
										>{port}</button>
									</span>
								</td>

								<td className={`sticky-col sticky-col-2 ${diffStyle(port, 'name') ?? ''}`}>
									<input
										type="text"
										value={p.name}
										onChange={(e) => updatePort(port, 'name', e.target.value)}
									/>
								</td>

								{/* port section */}
								{sections.port ? (<>
									<td className="section-port section-first">{p.link?.speed}</td>
									{poe && <td className="section-port">{poeCapable ? (status?.ports?.[port]?.poe?.power?.toFixed(2) ?? '—') : '—'}</td>}
									{poe && <td className={`section-port ${diffStyle(port, "poe.enabled") ?? ''} ${diffStyle(port, "poe.mode") ?? ''}`}>
										{poeCapable ? <span className="toggle">
											<button className={!poeEnabled ? 'active' : ''} title="Disable PoE"
												onClick={() => updatePort(port, 'poe.enabled', false)}>off</button>
											{[['af', 'af'], ['at', 'at']].map(([mode, label]) => (
												<button key={mode} className={poeEnabled && poeMode === mode ? 'active' : ''}
													title={mode === 'at' ? 'Enable 802.3at mode' : 'Enable 802.3af mode'}
													onClick={() => updatePortMulti(port, { 'poe.enabled': true, 'poe.mode': mode })}>{label}</button>
											))}
										</span> : '—'}
									</td>}
									{poe && <td className={`section-port ${diffStyle(port, "poe.policy") ?? ''}`}>
										{poeCapable ? <select value={poePolicy} onChange={event => updatePort(port, 'poe.policy', event.currentTarget.value)} title="Boot-prune disables ports unused during startup; later connections require manual re-enable"><option value="normal">normal</option><option value="boot-prune">boot-prune</option></select> : '—'}
									</td>}
									<td className={`section-port ${diffStyle(port, 'storm_control') ?? ''}`}>
										<span className="toggle">
											<button
												className={p.storm_control ? 'active' : ''}
												onClick={() => updatePort(port, 'storm_control', !p.storm_control)}
											/>
										</span>
									</td>
								</>) : <td />}

								{/* clients section */}
								{sections.clients ? (<>
									<td className="section-clients section-first client-count">{clients.length || '—'}</td>
									<td className="section-clients client-detail">
										{clients.length > 0 ? (
											<div className="client-list">
												{clients.map((c, i) => (
													<div key={i} className="client-entry">
														<a className="client-mac" href={`https://maclookup.app/search/result?mac=${c.mac}`} target="_blank" rel="noopener noreferrer">{c.mac}</a>
														<span className="client-ip">{c.ip}</span>
														<span className="client-age">{formatAge(c.age)}</span>
													</div>
												))}
											</div>
										) : '—'}
									</td>
								</>) : <td />}

								{/* vlan section */}
								{sections.vlan ? (<>
									<td className={`section-vlan section-first ${vlansDiff(port) ?? ''}`}>
										<input
											value={vlansValue}
											onChange={e => handleVlansChange(port, e.target.value, nativeValue)}
										/>
									</td>
									<td className={`section-vlan ${diffStyle(port, "vlan.untagged_vid") ?? ''}`}>
										<input className="vlan-input" type="number" min="1" max="4094"
											disabled={isAccess}
											value={nativeValue}
											onChange={e => handleNativeChange(port, e.target.value, vlansValue)}
										/>
									</td>
									<td className={`section-vlan ${diffStyle(port, "vlan.ingress_filter") ?? ''}`}>
										<span className="toggle">
											<button
												className={p.vlan?.ingress_filter ? 'active' : ''}
												onClick={() => updatePort(port, 'vlan.ingress_filter', !p.vlan?.ingress_filter)}
											/>
										</span>
									</td>
								</>) : <td />}

								{/* stp section */}
								{sections.stp ? (<>
									<td className={`section-stp section-first ${diffStyle(port, "stp.enabled") ?? ''}`}>
										<span className="toggle">
											<button
												className={stpEnabled ? 'active' : ''}
												onClick={() => updatePort(port, 'stp.enabled', !stpEnabled)}
											/>
										</span>
									</td>
									<td className={`section-stp ${diffStyle(port, "stp.priority") ?? ''}`}>
										<input className="vlan-input" type="number" min="0" max="255"
											value={p.stp?.priority}
											onChange={e => updatePort(port, 'stp.priority', Number(e.target.value))}
										/>
									</td>
									<td className={`section-stp ${diffStyle(port, "stp.cost") ?? ''}`}>
										<input className="vlan-input" type="number" min="0"
											value={p.stp?.cost}
											onChange={e => updatePort(port, 'stp.cost', Number(e.target.value))}
										/>
									</td>
									<td className={`section-stp ${diffStyle(port, "stp.edge") ?? ''}`}>
										<span className="toggle">
											<button
												className={p.stp?.edge ? 'active' : ''}
												onClick={() => updatePort(port, 'stp.edge', !p.stp?.edge)}
											/>
										</span>
									</td>
									<td className="section-stp">{p.stp?.state}</td>
									<td className="section-stp">{p.stp?.role}</td>
								</>) : <td />}
							</tr>
						);
					})}
				</tbody>
			</table>
		</div>
	);
}
