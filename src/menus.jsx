import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { createBackup, downloadBlob, readBackup } from './backup';
import NetworkPanel from './network';
import Table from './table';

function ModalButton({ label, title, className = '', children, onOpen, onClose }) {
	const ref = useRef();
	const open = () => { onOpen?.(); ref.current?.showModal(); };
	const close = () => ref.current?.close();
	return <>
		<button className={`toolbar-button ${className}`} title={title ?? label} onClick={open}>{label}</button>
		<dialog className="management-dialog" ref={ref} onClose={onClose} onClick={event => { if (event.target === ref.current) close(); }}>
			{children({ close })}
		</dialog>
	</>;
}

function Tabs({ tabs, selected, onSelect }) {
	return <nav className="dialog-tabs" aria-label="Dialog sections">
		{tabs.map(tab => <button key={tab.id} className={selected === tab.id ? 'active' : ''} onClick={() => onSelect(tab.id)}>{tab.label}</button>)}
	</nav>;
}

function DialogHeader({ title, close }) {
	return <div className="dialog-heading"><h2>{title}</h2><button onClick={close}>Close</button></div>;
}

function BackupPane({ client, config, canRestore }) {
	const [restoreFile, setRestoreFile] = useState(null);
	const [notice, setNotice] = useState('');
	const [error, setError] = useState('');
	const [working, setWorking] = useState(false);
	const backup = async () => {
		setError(''); setNotice('');
		try {
			const blob = await createBackup(config);
			downloadBlob(blob, `postmerkos-config-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
			setNotice('Configuration backup download started.');
		} catch (failure) { setError(failure.message); }
	};
	const restore = async () => {
		setWorking(true); setError(''); setNotice('');
		try {
			const restored = await readBackup(restoreFile);
			await client.request('replace_config', restored, { timeout: 30000 });
			setNotice('Configuration validated, restored, and applied.');
		} catch (failure) { setError(failure.message); }
		finally { setWorking(false); }
	};
	return <div className="tab-pane">
		<section><h3>Download configuration</h3><p>Creates a restore-compatible JSON file without account passwords or private keys.</p><button onClick={backup} disabled={!config}>Download Backup</button></section>
		{canRestore && <section><h3>Restore configuration</h3><label>Backup JSON<input type="file" accept=".json,application/json" onChange={event => setRestoreFile(event.currentTarget.files?.[0] ?? null)} /></label><button onClick={restore} disabled={!restoreFile || working}>{working ? 'Restoring…' : 'Validate and Restore'}</button></section>}
		{notice && <div className="notice">{notice}</div>}{error && <div className="error">{error}</div>}
	</div>;
}

function FirmwarePane({ client, connected, config, compatibility }) {
	const [file, setFile] = useState(null);
	const [manifestFile, setManifestFile] = useState(null);
	const [overlay, setOverlay] = useState('preserve');
	const [force, setForce] = useState(false);
	const [acceptUntested, setAcceptUntested] = useState(false);
	const [backupChoice, setBackupChoice] = useState('download');
	const [ready, setReady] = useState(null);
	const [upload, setUpload] = useState(null);
	const [status, setStatus] = useState(null);
	const [repositories, setRepositories] = useState(null);
	const [repositoryText, setRepositoryText] = useState('');
	const [repositoryResult, setRepositoryResult] = useState(null);
	const [error, setError] = useState('');
	useEffect(() => {
		if (!connected) return undefined;
		let stopped = false;
		const poll = async () => {
			try {
				const [nextStatus, nextRepositories] = await Promise.all([
					client.request('firmware_status'), client.request('firmware_repo_get'),
				]);
				if (!stopped) { setStatus(nextStatus.data); setRepositories(nextRepositories.data); setRepositoryText(previous => previous || JSON.stringify(nextRepositories.data, null, 2)); }
			} catch (failure) { if (!stopped) setError(failure.message); }
		};
		poll(); const timer = setInterval(poll, 1500);
		return () => { stopped = true; clearInterval(timer); };
	}, [client, connected]);
	const start = async event => {
		event.preventDefault(); setError(''); setReady(null);
		if (!file) return;
		if (compatibility === 'known-incompatible') { setError('This firmware is marked known-incompatible with the detected model.'); return; }
		if (compatibility === 'untested' && !acceptUntested) { setError('Acknowledge the untested-model warning before continuing.'); return; }
		if (backupChoice === 'cancel') { setError('Firmware update cancelled by backup policy.'); return; }
		if (backupChoice === 'download') {
			try {
				const blob = await createBackup(config);
				downloadBlob(blob, `postmerkos-preupdate-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
				if (!globalThis.confirm('The backup download was started. Continue with firmware upload?')) return;
			} catch (failure) { setError(`Backup could not be prepared: ${failure.message}`); return; }
		} else if (!globalThis.confirm('Continue without an external configuration backup?')) return;
		setUpload({ phase: 'starting', progress: 0 });
		try {
			const response = await client.uploadFirmware(file, { manifestFile, overlay, force, acceptUntested, onProgress: setUpload });
			setReady(response.data);
		} catch (failure) { setError(failure.message); }
		finally { setUpload(null); }
	};
	const begin = async () => {
		if (!ready?.token || !globalThis.confirm('Begin flashing now? Management connections will close and the switch will reboot.')) return;
		try {
			const response = await client.beginFirmware(ready.token);
			setStatus({ state: 'starting', stage: 'acknowledged', progress: 0, message: response.data?.message }); setReady(null);
		} catch (failure) { setError(failure.message); }
	};
	const saveRepositories = async () => {
		setError('');
		try {
			const parsed = JSON.parse(repositoryText);
			await client.request('firmware_repo_set', parsed);
			setRepositories(parsed); setRepositoryResult({ message: 'Repository configuration saved.' });
		} catch (failure) { setError(failure.message); }
	};
	const checkRepository = async () => {
		setError('');
		try {
			const parsed = JSON.parse(repositoryText);
			const url = parsed?.sources?.[0]?.url;
			if (!url) throw new Error('Set a repository URL first.');
			const response = await client.request('firmware_repo_check', { url }, { timeout: 30000 });
			setRepositoryResult(response.data);
		} catch (failure) { setError(failure.message); }
	};
	return <div className="tab-pane firmware-pane">
		<section className="system-card"><h3>Installed firmware</h3><p>{status?.installed_version ?? 'See System Information'}</p>{status?.last_update && <pre>{JSON.stringify(status.last_update, null, 2)}</pre>}</section>
		<form onSubmit={start}>
			<label>Pre-update backup<select value={backupChoice} onChange={event => setBackupChoice(event.currentTarget.value)}><option value="download">Download Backup and Continue</option><option value="skip">Continue Without Backup</option><option value="cancel">Cancel Update</option></select></label>
			<label>Firmware image<input type="file" accept=".bin,.img,.squashfs" onChange={event => setFile(event.currentTarget.files?.[0] ?? null)} /></label>
			<label>Release manifest (optional)<input type="file" accept=".json,application/json" onChange={event => setManifestFile(event.currentTarget.files?.[0] ?? null)} /></label>
			<label>Writable-overlay policy<select value={overlay} onChange={event => setOverlay(event.currentTarget.value)}><option value="preserve">Preserve settings</option><option value="migrate">Migrate selected settings</option><option value="reset">Reset settings</option><option value="image">Use image overlay</option></select></label>
			<label className="checkbox-line"><input type="checkbox" checked={force} onChange={event => setForce(event.currentTarget.checked)} /> Force same, older, or metadata-free image</label>
			{compatibility === 'untested' && <label className="checkbox-line warning"><input type="checkbox" checked={acceptUntested} onChange={event => setAcceptUntested(event.currentTarget.checked)} /> I understand that this model is untested and recovery may require hardware flashing</label>}
			{compatibility === 'known-incompatible' && <div className="error">This release is known-incompatible with the detected switch model and cannot be installed.</div>}
			<button disabled={!file || !connected || compatibility === 'known-incompatible' || Boolean(upload) || Boolean(ready)}>Upload and Validate</button>
		</form>
		{upload && <div className="progress-block"><progress max="100" value={upload.progress ?? 0} /><span>{upload.phase}: {upload.progress ?? 0}%</span></div>}
		{ready && <div className="notice"><strong>Firmware validated and ready</strong><p>{ready.message}</p><button onClick={begin}>Begin Firmware Update</button><button onClick={() => { client.request('firmware_upload_cancel').catch(() => {}); setReady(null); }}>Cancel</button></div>}
		{status && <div className="firmware-status"><strong>{status.state} / {status.stage}</strong><progress max="100" value={status.progress ?? 0} /><span>{status.progress ?? 0}% — {status.message}</span></div>}
		<details><summary>Repository configuration</summary><p>Configure HTTP/HTTPS firmware sources. The first source is used by Check Repository.</p><textarea className="json-editor" rows="10" value={repositoryText || JSON.stringify(repositories, null, 2)} onInput={event => setRepositoryText(event.currentTarget.value)} /><div className="button-row"><button onClick={saveRepositories}>Save Repositories</button><button onClick={checkRepository}>Check Repository</button></div>{repositoryResult && <pre>{repositoryResult.output ?? repositoryResult.message ?? JSON.stringify(repositoryResult, null, 2)}</pre>}</details>
		<p className="warning">When flashing begins, the interface will disconnect. Controllable port/PoE LEDs show approximate progress where supported. Serial output and the post-reboot update log remain available.</p>
		{error && <div className="error">{error}</div>}
	</div>;
}

export function UpdateMenu(props) {
	const [tab, setTab] = useState('backup');
	const tabs = [{ id: 'backup', label: 'Configuration Backup' }, { id: 'firmware', label: 'Firmware' }];
	return <ModalButton label="Update" title="Configuration backup, restore, and firmware update">
		{({ close }) => <div className="tool-dialog wide-dialog"><DialogHeader title="Update" close={close} /><Tabs tabs={tabs} selected={tab} onSelect={setTab} />
			{tab === 'backup' ? <BackupPane {...props} canRestore={props.hasCapability('config.restore')} /> : props.hasCapability('firmware.update') ? <FirmwarePane {...props} /> : <div className="warning">Firmware updates require administrator access.</div>}
		</div>}
	</ModalButton>;
}

function TerminalPane({ client }) {
	const [command, setCommand] = useState('');
	const [lines, setLines] = useState([]);
	const [limit, setLimit] = useState(2000);
	const [working, setWorking] = useState(false);
	const [token, setToken] = useState(null);
	const append = additions => setLines(previous => [...previous, ...additions].slice(-Math.max(100, Number(limit) || 2000)));
	useEffect(() => {
		const removeOutput = client.subscribe('terminal_output', data => {
			if (!token || data.token === token) append(String(data.output ?? '').split(/\r?\n/));
		});
		const removeExit = client.subscribe('terminal_exit', data => {
			if (!token || data.token === token) {
				append([`[exit ${data.exit_code ?? '?'}${data.timed_out ? ', timed out' : ''}${data.truncated ? ', output limit reached' : ''}]`]);
				setWorking(false); setToken(null);
			}
		});
		return () => { removeOutput(); removeExit(); };
	}, [client, token, limit]);
	const run = async event => {
		event.preventDefault(); const current = command.trim(); if (!current) return;
		setCommand(''); setWorking(true); append([`$ ${current}`]);
		try {
			const response = await client.request('terminal_start', { command: current }, { timeout: 10000 });
			setToken(response.data?.token ?? null);
		} catch (failure) { append([`error: ${failure.message}`]); setWorking(false); }
	};
	return <div className="tab-pane"><label>Browser history limit (lines)<input type="number" min="100" max="20000" value={limit} onInput={event => setLimit(Number(event.currentTarget.value))} /></label><pre className="terminal-output">{lines.join('\n')}</pre><form className="terminal-input" onSubmit={run}><span>$</span><input value={command} onInput={event => setCommand(event.currentTarget.value)} disabled={working} /><button disabled={working || !command.trim()}>{working ? 'Running…' : 'Run'}</button></form></div>;
}

function AccountPane({ client, auth, canManage }) {
	const [users, setUsers] = useState(auth?.users ?? []);
	const [newUser, setNewUser] = useState(''); const [newPassword, setNewPassword] = useState(''); const [newRole, setNewRole] = useState('viewer');
	const [passwordTarget, setPasswordTarget] = useState(auth?.username ?? ''); const [currentPassword, setCurrentPassword] = useState(''); const [replacementPassword, setReplacementPassword] = useState('');
	const [notice, setNotice] = useState(''); const [error, setError] = useState('');
	const refresh = async () => { try { const response = await client.request('user_list'); setUsers(response.data?.users ?? []); } catch (failure) { setError(failure.message); } };
	useEffect(() => { if (canManage) refresh(); }, [canManage]);
	const create = async event => { event.preventDefault(); setError(''); try { const response = await client.request('user_create', { username: newUser, password: newPassword, role: newRole }); setUsers(response.data?.users ?? []); setNewUser(''); setNewPassword(''); setNotice('Account created.'); } catch (failure) { setError(failure.message); } };
	const setRole = async (username, role) => { setError(''); try { const response = await client.request('user_role', { username, role }); setUsers(response.data?.users ?? []); setNotice(`${username} is now ${role}.`); } catch (failure) { setError(failure.message); } };
	const remove = async username => { if (username === 'root' || !globalThis.confirm(`Delete ${username}?`)) return; setError(''); try { const response = await client.request('user_delete', { username }); setUsers(response.data?.users ?? []); setNotice(`${username} deleted.`); } catch (failure) { setError(failure.message); } };
	const changePassword = async event => { event.preventDefault(); setError(''); try { await client.request('password_change', { username: passwordTarget || auth.username, current_password: currentPassword, new_password: replacementPassword }); setCurrentPassword(''); setReplacementPassword(''); setNotice('Password updated.'); } catch (failure) { setError(failure.message); } };
	return <div className="tab-pane"><h3>Accounts and roles</h3><div className="account-grid">{users.map(user => <div className="account-row" key={user.username}><strong>{user.username}</strong><select value={user.role} disabled={!canManage || user.username === 'root'} onChange={event => setRole(user.username, event.currentTarget.value)}><option value="admin">Administrator</option><option value="operator">Operator</option><option value="viewer">Viewer</option></select>{canManage && <button disabled={user.username === 'root'} onClick={() => remove(user.username)}>Delete</button>}</div>)}</div><form onSubmit={changePassword}><h3>Change password</h3><label>Account<select value={passwordTarget} onChange={event => setPasswordTarget(event.currentTarget.value)}>{users.filter(user => canManage || user.username === auth.username).map(user => <option key={user.username} value={user.username}>{user.username}</option>)}</select></label><label>Current password<input type="password" value={currentPassword} onInput={event => setCurrentPassword(event.currentTarget.value)} /></label><label>New password<input type="password" value={replacementPassword} onInput={event => setReplacementPassword(event.currentTarget.value)} /></label><button disabled={!currentPassword || replacementPassword.length < 8}>Change Password</button></form>{canManage && <form onSubmit={create}><h3>Create account</h3><label>Username<input value={newUser} onInput={event => setNewUser(event.currentTarget.value)} /></label><label>Initial password<input type="password" value={newPassword} onInput={event => setNewPassword(event.currentTarget.value)} /></label><label>Role<select value={newRole} onChange={event => setNewRole(event.currentTarget.value)}><option value="admin">Administrator</option><option value="operator">Operator</option><option value="viewer">Viewer</option></select></label><button disabled={!newUser || newPassword.length < 8}>Create Account</button></form>}{notice && <div className="notice">{notice}</div>}{error && <div className="error">{error}</div>}</div>;
}

function ServicePane({ client }) {
	const [policy, setPolicy] = useState(null); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
	const load = async () => { try { const response = await client.request('services_get'); setPolicy(response.data); } catch (failure) { setError(failure.message); } };
	useEffect(() => { load(); }, []);
	const set = (service, key, value) => setPolicy(previous => ({ ...previous, [service]: { ...previous[service], [key]: value } }));
	const save = async () => { try { await client.request('services_set', policy); setNotice('Service policy saved and applied.'); } catch (failure) { setError(failure.message); } };
	return <div className="tab-pane"><h3>Services</h3>{policy && ['ssh', 'web', 'chrony'].map(name => <fieldset key={name}><legend>{name === 'ssh' ? 'SSH' : name === 'web' ? 'Web interface' : 'Chrony'}</legend><label className="checkbox-line"><input type="checkbox" checked={policy[name]?.enabled} onChange={event => set(name, 'enabled', event.currentTarget.checked)} /> Enabled</label><label className="checkbox-line"><input type="checkbox" checked={policy[name]?.autostart} onChange={event => set(name, 'autostart', event.currentTarget.checked)} /> Start automatically</label>{name === 'ssh' && <><label className="checkbox-line"><input type="checkbox" checked={policy.ssh.password_auth} onChange={event => set('ssh', 'password_auth', event.currentTarget.checked)} /> Allow password authentication</label><label>Listening port<input type="number" min="1" max="65535" value={policy.ssh.port} onInput={event => set('ssh', 'port', Number(event.currentTarget.value))} /></label></>}</fieldset>)}<button onClick={save} disabled={!policy}>Save Service Policy</button>{notice && <div className="notice">{notice}</div>}{error && <div className="error">{error}</div>}</div>;
}

function TimePane({ client }) {
	const [data, setData] = useState(null); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
	useEffect(() => { client.request('time_get').then(response => setData(response.data)).catch(failure => setError(failure.message)); }, []);
	const policy = data?.policy;
	const patch = (path, value) => setData(previous => { const next = globalThis.structuredClone ? structuredClone(previous) : JSON.parse(JSON.stringify(previous)); let current = next.policy; const keys = path.split('.'); keys.slice(0, -1).forEach(key => { if (!current[key]) current[key] = {}; current = current[key]; }); current[keys[keys.length - 1]] = value; return next; });
	const save = async () => { try { await client.request('time_set', policy); setNotice('Time policy saved.'); } catch (failure) { setError(failure.message); } };
	return <div className="tab-pane"><h3>Time and NTP</h3>{data && <><dl className="system-grid"><div><dt>UTC</dt><dd>{data.utc}</dd></div><div><dt>Local</dt><dd>{data.local}</dd></div><div><dt>Offset</dt><dd>{data.offset_minutes} minutes</dd></div><div><dt>DST</dt><dd>{data.dst_active ? 'active' : 'inactive'}</dd></div></dl><label>Standard UTC offset (minutes)<input type="number" min="-720" max="840" value={policy.standard_offset_minutes} onInput={event => patch('standard_offset_minutes', Number(event.currentTarget.value))} /></label><label className="checkbox-line"><input type="checkbox" checked={policy.dst?.enabled} onChange={event => patch('dst.enabled', event.currentTarget.checked)} /> Automatic daylight-saving rule</label><label>DST UTC offset (minutes)<input type="number" min="-720" max="840" value={policy.dst?.offset_minutes} onInput={event => patch('dst.offset_minutes', Number(event.currentTarget.value))} /></label><label className="checkbox-line"><input type="checkbox" checked={policy.ntp_enabled} onChange={event => patch('ntp_enabled', event.currentTarget.checked)} /> Synchronize with NTP</label><label>NTP servers<input value={(policy.servers ?? []).join(', ')} onInput={event => patch('servers', event.currentTarget.value.split(',').map(item => item.trim()).filter(Boolean))} /></label><button onClick={save}>Save Time Policy</button><button onClick={() => client.request('time_sync').then(() => setNotice('Synchronization requested.')).catch(failure => setError(failure.message))}>Synchronize Now</button></>}{notice && <div className="notice">{notice}</div>}{error && <div className="error">{error}</div>}</div>;
}

function SystemPane({ client, status }) {
	const [report, setReport] = useState(null);
	const loadReport = async () => { const response = await client.request('compatibility_report'); setReport(response.data); };
	const downloadReport = async () => { const response = report ?? (await client.request('compatibility_report')).data; downloadBlob(new Blob([JSON.stringify(response, null, 2)], { type: 'application/json' }), `postmerkos-compatibility-${response.model}-${response.firmware}.json`); };
	return <div className="tab-pane"><h3>System Information</h3><dl className="system-grid"><div><dt>Model</dt><dd>{status.device}</dd></div><div><dt>Firmware</dt><dd>{status.release?.version ?? 'unknown'}</dd></div><div><dt>Compatibility</dt><dd>{status.capabilities?.compatibility}</dd></div><div><dt>Ports</dt><dd>{status.capabilities?.port_count}</dd></div><div><dt>Local time</dt><dd>{status.time?.local}</dd></div><div><dt>UTC</dt><dd>{status.time?.utc}</dd></div></dl><button onClick={loadReport}>View Compatibility Report</button><button onClick={downloadReport}>Download Compatibility Report</button>{report && <pre>{JSON.stringify(report, null, 2)}</pre>}</div>;
}

function SwitchingPane({ config, updateRoot }) {
	const stp = config?.stp ?? { priority: 32768, hello_time: 2, forward_delay: 15, max_age: 20, hold_count: 6 };
	const lacp = config?.lacp ?? { enabled: false };
	const multicast = config?.multicast ?? { igmp_snooping: true, igmp_querier_interval: 125, mld_snooping: true, mld_querier_interval: 125 };
	return <div className="tab-pane switching-pane"><fieldset><legend>Global Spanning Tree</legend><div className="form-grid"><label>Bridge priority<input type="number" min="0" max="61440" step="4096" value={stp.priority} onInput={event => updateRoot('stp.priority', Number(event.currentTarget.value))} /></label><label>Hello time<input type="number" min="1" max="10" value={stp.hello_time} onInput={event => updateRoot('stp.hello_time', Number(event.currentTarget.value))} /></label><label>Forward delay<input type="number" min="4" max="30" value={stp.forward_delay} onInput={event => updateRoot('stp.forward_delay', Number(event.currentTarget.value))} /></label><label>Maximum age<input type="number" min="6" max="40" value={stp.max_age} onInput={event => updateRoot('stp.max_age', Number(event.currentTarget.value))} /></label><label>Hold count<input type="number" min="1" max="10" value={stp.hold_count} onInput={event => updateRoot('stp.hold_count', Number(event.currentTarget.value))} /></label></div></fieldset><fieldset><legend>Link Aggregation</legend><label className="checkbox-line"><input type="checkbox" checked={lacp.enabled} onChange={event => updateRoot('lacp.enabled', event.currentTarget.checked)} /> Enable LACP</label></fieldset><fieldset><legend>Multicast</legend><div className="form-grid"><label className="checkbox-line"><input type="checkbox" checked={multicast.igmp_snooping} onChange={event => updateRoot('multicast.igmp_snooping', event.currentTarget.checked)} /> IGMP snooping</label><label>IGMP querier interval<input type="number" min="1" max="3600" value={multicast.igmp_querier_interval} onInput={event => updateRoot('multicast.igmp_querier_interval', Number(event.currentTarget.value))} /></label><label className="checkbox-line"><input type="checkbox" checked={multicast.mld_snooping} onChange={event => updateRoot('multicast.mld_snooping', event.currentTarget.checked)} /> MLD snooping</label><label>MLD querier interval<input type="number" min="1" max="3600" value={multicast.mld_querier_interval} onInput={event => updateRoot('multicast.mld_querier_interval', Number(event.currentTarget.value))} /></label></div></fieldset></div>;
}

function MonitoringPane({ config, updateRoot }) {
	const t = config?.telemetry ?? {};
	const prom = t.prometheus ?? { enabled: false, port: 9100 };
	const snmp = t.snmp ?? { enabled: false, community: '', location: '', contact: '' };
	const mgmt = config?.network?.ipv4?.address?.split('/')?.[0] ?? '<management-address>';
	return <div className="tab-pane monitoring-pane">
		<fieldset>
			<legend>Prometheus metrics</legend>
			<label className="checkbox-line"><input type="checkbox" checked={prom.enabled}
				onChange={event => updateRoot('telemetry.prometheus.enabled', event.currentTarget.checked)} /> Enable Prometheus metrics endpoint</label>
			<div className="form-grid">
				<label>Port<input type="number" min="1" max="65535" value={prom.port ?? 9100}
					onInput={event => updateRoot('telemetry.prometheus.port', Number(event.currentTarget.value))} /></label>
			</div>
			{prom.enabled && <p className="notice">Metrics endpoint: http://{mgmt}:{prom.port ?? 9100}/metrics</p>}
		</fieldset>
		<fieldset>
			<legend>SNMP (read-only v2c IF-MIB)</legend>
			<label className="checkbox-line"><input type="checkbox" checked={snmp.enabled}
				onChange={event => updateRoot('telemetry.snmp.enabled', event.currentTarget.checked)} /> Enable SNMP</label>
			<div className="form-grid">
				<label>Community<input value={snmp.community ?? ''} placeholder="(required when enabled)"
					onInput={event => updateRoot('telemetry.snmp.community', event.currentTarget.value)} /></label>
				<label>Location<input value={snmp.location ?? ''}
					onInput={event => updateRoot('telemetry.snmp.location', event.currentTarget.value)} /></label>
				<label>Contact<input value={snmp.contact ?? ''}
					onInput={event => updateRoot('telemetry.snmp.contact', event.currentTarget.value)} /></label>
			</div>
			{snmp.enabled && !snmp.community && <p className="warning">A community string is required to enable SNMP.</p>}
			{snmp.community === 'public' && <p className="warning">Avoid the well-known community "public".</p>}
			{snmp.enabled && snmp.community && <p className="notice">SNMP v2c read-only enabled on the management interface.</p>}
		</fieldset>
	</div>;
}

function ClonePane({ client, config, sourcePort, onDone }) {
	const allFields = ['administrative', 'name', 'phy', 'storm_control', 'vlan', 'stp', 'poe'];
	const [fields, setFields] = useState(allFields); const [targets, setTargets] = useState([]); const [result, setResult] = useState(null); const [error, setError] = useState('');
	const ports = Object.keys(config?.ports ?? {}).map(Number);
	const toggle = (list, value, setter) => setter(list.includes(value) ? list.filter(item => item !== value) : [...list, value]);
	const clone = async () => { try { const response = await client.request('ports_clone', { source: Number(sourcePort), targets, fields }, { timeout: 30000 }); setResult(response.data); onDone?.(); } catch (failure) { setError(failure.message); } };
	return <div className="clone-pane"><h3>Clone Port {sourcePort}</h3><div className="clone-fields">{allFields.map(field => <label className="checkbox-line" key={field}><input type="checkbox" checked={fields.includes(field)} onChange={() => toggle(fields, field, setFields)} /> {field.replace('_', ' ')}</label>)}</div><div className="target-grid">{ports.map(port => <button key={port} className={targets.includes(port) ? 'active' : ''} disabled={String(port) === String(sourcePort)} onClick={() => toggle(targets, port, setTargets)}>{port}</button>)}</div><button onClick={clone} disabled={!targets.length || !fields.length}>Clone Selected Configuration</button>{result && <div className="notice">Copied to ports {(result.targets ?? []).join(', ')}. {(result.warnings ?? []).join(' ')}</div>}{error && <div className="error">{error}</div>}</div>;
}

export function PortEditor({ client, selectedPort, onSelect, onClose, config, status, poe, updatePort, updatePortMulti, diff }) {
	const ref = useRef(); const [clone, setClone] = useState(false);
	useEffect(() => { if (selectedPort) ref.current?.showModal(); else ref.current?.close(); }, [selectedPort]);
	if (!selectedPort || !config?.ports?.[selectedPort]) return null;
	const numbers = Object.keys(config.ports).map(Number).sort((a, b) => a - b); const index = numbers.indexOf(Number(selectedPort));
	const move = delta => { const next = numbers[index + delta]; if (next) onSelect?.(String(next)); };
	return <dialog className="management-dialog port-editor-dialog" ref={ref} onClose={onClose}><div className="tool-dialog wide-dialog"><DialogHeader title={`Port ${selectedPort}`} close={onClose} /><div className="port-navigation"><button disabled={index <= 0} onClick={() => move(-1)}>Previous</button><button onClick={() => setClone(value => !value)}>Clone Configuration</button><button disabled={index >= numbers.length - 1} onClick={() => move(1)}>Next</button></div>{clone && <ClonePane client={client} config={config} sourcePort={selectedPort} />}<Table ports={{ [selectedPort]: config.ports[selectedPort] }} status={status} poe={poe} updatePort={updatePort} updatePortMulti={updatePortMulti} diff={diff} selectedPort={selectedPort} /></div></dialog>;
}

export function ConfigurationMenu({ client, auth, config, status, updateRoot, updatePort, updatePortMulti, diff, poe, hasCapability, frontTable, onFrontTableChange }) {
	const available = useMemo(() => [
		{ id: 'system', label: 'System' }, { id: 'display', label: 'Display' }, { id: 'network', label: 'Network' }, { id: 'ports', label: 'Ports' }, { id: 'switching', label: 'Switching' },
		{ id: 'accounts', label: 'Accounts' }, { id: 'services', label: 'Services' }, { id: 'monitoring', label: 'Monitoring' }, { id: 'time', label: 'Time' },
		...(hasCapability('terminal.exec') ? [{ id: 'terminal', label: 'Terminal' }] : []),
	], [hasCapability]);
	const [tab, setTab] = useState('system');
	return <ModalButton label="Configuration" title="Switch configuration and system tools">
		{({ close }) => <div className="tool-dialog extra-wide-dialog"><DialogHeader title="Configuration" close={close} /><Tabs tabs={available} selected={tab} onSelect={setTab} />
			{tab === 'system' && <SystemPane client={client} status={status} />}
			{tab === 'display' && <div className="tab-pane"><h3>Display</h3><label className="checkbox-line"><input type="checkbox" checked={frontTable} onChange={event => onFrontTableChange?.(event.currentTarget.checked)} /> View all ports on the front page (uncheck for a focused per-port configuration window)</label><p>When enabled, the full port table is shown on the front page and clicking a port in the diagram scrolls to its row. When disabled, clicking a port opens its focused configuration window. This preference is stored in your browser.</p></div>}
			{tab === 'network' && <NetworkPanel config={config} status={status} updateConfig={updateRoot} diff={diff} />}
			{tab === 'ports' && <div className="tab-pane all-ports-pane"><Table ports={config.ports} status={status} poe={poe} updatePort={updatePort} updatePortMulti={updatePortMulti} diff={diff} /></div>}
			{tab === 'switching' && <SwitchingPane config={config} updateRoot={updateRoot} />}
			{tab === 'accounts' && <AccountPane client={client} auth={auth} canManage={hasCapability('users.manage')} />}
			{tab === 'services' && (hasCapability('services.manage') ? <ServicePane client={client} /> : <div className="warning">Service configuration requires administrator access.</div>)}
			{tab === 'monitoring' && (hasCapability('network.write')
				? <MonitoringPane config={config} updateRoot={updateRoot} />
				: <div className="warning">Monitoring configuration requires write access.</div>)}
			{tab === 'time' && (hasCapability('services.manage') ? <TimePane client={client} /> : <SystemPane client={client} status={status} />)}
			{tab === 'terminal' && <TerminalPane client={client} />}
		</div>}
	</ModalButton>;
}

export function CompatibilityNotice({ client, notice, onDismiss }) {
	const ref = useRef();
	const [report, setReport] = useState(null);
	const [error, setError] = useState('');
	const incompatible = notice?.state === 'known-incompatible' || notice?.compatibility === 'known-incompatible';
	useEffect(() => { if (notice?.required) ref.current?.showModal(); }, [notice?.required]);
	if (!notice?.required) return null;
	const dismiss = async () => {
		if (incompatible) return;
		try {
			await client.request('compatibility_ack');
			ref.current?.close();
			onDismiss?.();
		} catch (failure) { setError(failure.message); }
	};
	return <dialog className="management-dialog compatibility-dialog" ref={ref}>
		<div className="tool-dialog">
			<h2>{incompatible ? 'Known-Incompatible Firmware' : 'Untested Switch Model'}</h2>
			<p>{notice.message}</p>
			<p>Model: <strong>{notice.model}</strong><br />Firmware: <strong>{notice.firmware}</strong></p>
			<button onClick={async () => {
				try { const response = await client.request('compatibility_report'); setReport(response.data); }
				catch (failure) { setError(failure.message); }
			}}>View Diagnostic Summary</button>
			{report && <pre>{JSON.stringify(report, null, 2)}</pre>}
			{!incompatible && <button onClick={dismiss}>Dismiss for This Firmware</button>}
			<button onClick={() => ref.current?.close()}>{incompatible ? 'Return to Management' : 'Remind Me Next Time'}</button>
			{incompatible && <div className="error">This release cannot be acknowledged for this model. Install a compatible release before relying on hardware-control features.</div>}
			{error && <div className="error">{error}</div>}
		</div>
	</dialog>;
}
