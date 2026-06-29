import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { createBackup, downloadBlob, readBackup } from './backup';
import NetworkPanel from './network';
import Table from './table';
import {
	CogIcon, UpdateIcon,
	ChipIcon, MonitorIcon, GlobeIcon, GridIcon, ShareIcon, UsersIcon, ServerIcon, ActivityIcon, ClockIcon, TerminalIcon,
	CheckIcon, PlusIcon, TrashIcon, DownloadIcon, UploadIcon, EyeIcon, RefreshIcon, DiscardIcon,
} from './icons';
import { buildIssueUrl } from './compat';
import { TIMEZONE_GROUPS, applyTimezonePolicy, findTimezone } from './timezones';


const formatBytes = value => {
	const bytes = Number(value);
	if (!Number.isFinite(bytes) || bytes < 0) return '—';
	const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
	let amount = bytes; let unit = 0;
	while (amount >= 1024 && unit < units.length - 1) { amount /= 1024; unit++; }
	return `${amount >= 100 || unit === 0 ? amount.toFixed(0) : amount.toFixed(1)} ${units[unit]}`;
};
const formatDuration = value => {
	let seconds = Math.max(0, Math.floor(Number(value) || 0));
	const days = Math.floor(seconds / 86400); seconds %= 86400;
	const hours = Math.floor(seconds / 3600); seconds %= 3600;
	const minutes = Math.floor(seconds / 60);
	return [days ? `${days}d` : '', hours || days ? `${hours}h` : '', `${minutes}m`, `${seconds % 60}s`].filter(Boolean).join(' ');
};
const formatEpoch = value => Number(value) > 0 ? new Date(Number(value) * 1000).toLocaleString() : '—';
const formatPercent = value => Number.isFinite(Number(value)) ? `${Number(value).toFixed(1)}%` : '—';
const manualTimeFromIso = value => {
	const match = String(value ?? '').match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/);
	return match ? `${match[4]}:${match[5]}:${match[6]} - ${match[3]}:${match[2]}:${match[1]}` : '';
};

function ModalButton({ label, title, className = '', dialogClassName = '', children, onOpen, onClose }) {
	const ref = useRef();
	const open = () => { onOpen?.(); ref.current?.showModal(); };
	const close = () => ref.current?.close();
	return <>
		<button className={`toolbar-button ${className}`} title={title ?? label} aria-label={typeof title === 'string' ? title : undefined} onClick={open}>{label}</button>
		<dialog className={`management-dialog ${dialogClassName}`} ref={ref} onClose={onClose} onClick={event => { if (event.target === ref.current) close(); }}>
			{children({ close })}
		</dialog>
	</>;
}

function Tabs({ tabs, selected, onSelect }) {
	return <nav className="dialog-tabs" aria-label="Dialog sections">
		{tabs.map(tab => <button key={tab.id} className={selected === tab.id ? 'active' : ''} onClick={() => onSelect(tab.id)}>{tab.icon && <span className="tab-ico">{tab.icon}</span>}{tab.label}</button>)}
	</nav>;
}

function DialogHeader({ title, close }) {
	return <div className="dialog-heading"><h2>{title}</h2><button onClick={close}>Close</button></div>;
}

// Pinned-top frame: a sticky header zone (heading + optional tab row) over a
// scrolling body. Keeps the menu row at a constant on-screen position across tabs.
function DialogShell({ className = '', title, close, tabs, selected, onSelect, children }) {
	return <div className={`tool-dialog ${className}`}>
		<div className="dialog-topbar">
			<DialogHeader title={title} close={close} />
			{tabs && <Tabs tabs={tabs} selected={selected} onSelect={onSelect} />}
		</div>
		<div className="dialog-body">{children}</div>
	</div>;
}

// In-dialog commit footer for switch-config tabs (network/ports/switching/monitoring).
// The floating global banner is occluded by the modal's top layer, so each config
// tab carries a consistent Apply / Discard footer driven by the same global diff.
function ConfigFooter({ diff, onApply, onDiscard, applying, connected }) {
	const dirty = Object.keys(diff ?? {}).length > 0;
	return <div className="pane-footer">
		<span className={`pane-footer-status${dirty ? ' dirty' : ''}`}>{dirty ? 'Unapplied changes on this switch.' : 'No unapplied changes.'}</span>
		<div className="pane-footer-actions">
			<button className="btn-danger" onClick={onDiscard} disabled={!dirty || applying}><DiscardIcon /> Discard</button>
			<button className="btn-primary" onClick={onApply} disabled={!dirty || !connected || applying}><CheckIcon /> {applying ? 'Applying…' : 'Apply'}</button>
		</div>
	</div>;
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
		<section><h3>Download configuration</h3><p>Creates a restore-compatible JSON file without account passwords or private keys.</p><button className="btn-secondary" onClick={backup} disabled={!config}><DownloadIcon /> Download backup</button></section>
		{canRestore && <section><h3>Restore configuration</h3><label>Backup JSON<input type="file" accept=".json,application/json" onChange={event => setRestoreFile(event.currentTarget.files?.[0] ?? null)} /></label><button className="btn-primary" onClick={restore} disabled={!restoreFile || working}><CheckIcon /> {working ? 'Restoring…' : 'Validate & restore'}</button></section>}
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
	// configd is single-threaded; a slow upload starves the status poll and its
	// timeouts surface as spurious "Request timed out" errors. Pause polling while
	// an upload is in flight.
	const uploadingRef = useRef(false);
	useEffect(() => {
		if (!connected) return undefined;
		let stopped = false;
		const poll = async () => {
			if (uploadingRef.current) return;
			try {
				const [nextStatus, nextRepositories, nextUpload] = await Promise.all([
					client.request('firmware_status'),
					client.request('firmware_repo_get'),
					client.request('firmware_upload_status'),
				]);
				if (!stopped && !uploadingRef.current) {
					setStatus(nextStatus.data);
					setRepositories(nextRepositories.data);
					setRepositoryText(previous => previous || JSON.stringify(nextRepositories.data, null, 2));
					const staged = nextUpload.data ?? {};
					if (staged.ready) {
						setReady(staged);
						setUpload(null);
					} else if (staged.state === 'validating') {
						setReady(null);
						setUpload({ phase: 'verifying', progress: staged.progress ?? 100, state: staged.state });
					} else if (staged.state === 'failed') {
						setReady(null);
						setUpload(null);
						setError(staged.error || 'Firmware validation failed.');
					} else if (!staged.active) {
						setUpload(null);
					}
				}
			} catch (failure) { if (!stopped && !uploadingRef.current) setError(failure.message); }
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
		uploadingRef.current = true;
		try {
			const response = await client.uploadFirmware(file, { manifestFile, overlay, force, acceptUntested, onProgress: setUpload });
			setReady(response.data);
		} catch (failure) { setError(failure.message); }
		finally { uploadingRef.current = false; setUpload(null); }
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
			<button className="btn-primary" disabled={!file || !connected || compatibility === 'known-incompatible' || Boolean(upload) || Boolean(ready)}><UploadIcon /> Upload &amp; validate</button>
		</form>
		{upload && <div className="progress-block"><progress max="100" value={upload.progress ?? 0} /><span>{upload.phase}: {upload.progress ?? 0}%</span></div>}
		{ready && <div className="notice"><strong>Firmware validated and ready</strong><p>{ready.message}</p><div className="button-row"><button className="btn-primary" onClick={begin}><CheckIcon /> Begin update</button><button className="btn-secondary" onClick={() => { client.request('firmware_upload_cancel').catch(() => {}); setReady(null); }}>Cancel</button></div></div>}
		{status && <div className="firmware-status"><strong>{status.state} / {status.stage}</strong><progress max="100" value={status.progress ?? 0} /><span>{status.progress ?? 0}% — {status.message}</span></div>}
		<details><summary>Repository configuration</summary><p>Configure HTTP/HTTPS firmware sources. The first source is used by Check Repository.</p><textarea className="json-editor" rows="10" value={repositoryText || JSON.stringify(repositories, null, 2)} onInput={event => setRepositoryText(event.currentTarget.value)} /><div className="button-row"><button className="btn-primary" onClick={saveRepositories}><CheckIcon /> Save</button><button className="btn-secondary" onClick={checkRepository}><RefreshIcon /> Check</button></div>{repositoryResult && <pre>{repositoryResult.output ?? repositoryResult.message ?? JSON.stringify(repositoryResult, null, 2)}</pre>}</details>
		<p className="warning">When flashing begins, the interface will disconnect. On hardware-verified models, the chassis status LED alternates green and orange faster as progress advances, pulses orange on failure or rollback, and remains green after verification. Port LEDs are used only as a fallback. Serial output and the post-reboot update log remain available.</p>
		{error && <div className="error">{error}</div>}
	</div>;
}

export function UpdateMenu(props) {
	const [tab, setTab] = useState('backup');
	const tabs = [{ id: 'backup', label: 'Configuration backup', icon: <DownloadIcon /> }, { id: 'firmware', label: 'Firmware', icon: <UpdateIcon /> }];
	return <ModalButton label={<UpdateIcon />} className="icon-button" title="Update — configuration backup, restore, and firmware">
		{({ close }) => <DialogShell className="wide-dialog" title="Update" close={close} tabs={tabs} selected={tab} onSelect={setTab}>
			{tab === 'backup' ? <BackupPane {...props} canRestore={props.hasCapability('config.restore')} /> : props.hasCapability('firmware.update') ? <FirmwarePane {...props} /> : <div className="warning">Firmware updates require administrator access.</div>}
		</DialogShell>}
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
	return <div className="tab-pane terminal-pane"><section><label>Browser history limit (lines)<input type="number" min="100" max="20000" value={limit} onInput={event => setLimit(Number(event.currentTarget.value))} /></label><pre className="terminal-output">{lines.join('\n')}</pre><form className="terminal-input" onSubmit={run}><span>$</span><input value={command} onInput={event => setCommand(event.currentTarget.value)} disabled={working} /><button className="btn-primary" disabled={working || !command.trim()}>{working ? 'Running…' : 'Run'}</button></form></section></div>;
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
	return <div className="tab-pane"><section><h3>Accounts and roles</h3><div className="account-grid">{users.map(user => <div className="account-row" key={user.username}><strong>{user.username}</strong><select value={user.role} disabled={!canManage || user.username === 'root'} onChange={event => setRole(user.username, event.currentTarget.value)}><option value="admin">Administrator</option><option value="operator">Operator</option><option value="viewer">Viewer</option></select>{canManage && <button className="btn-danger" disabled={user.username === 'root'} onClick={() => remove(user.username)}><TrashIcon /> Delete</button>}</div>)}</div></section><section><form onSubmit={changePassword}><h3>Change password</h3><label>Account<select value={passwordTarget} onChange={event => setPasswordTarget(event.currentTarget.value)}>{users.filter(user => canManage || user.username === auth.username).map(user => <option key={user.username} value={user.username}>{user.username}</option>)}</select></label><label>Current password<input type="password" value={currentPassword} onInput={event => setCurrentPassword(event.currentTarget.value)} /></label><label>New password<input type="password" value={replacementPassword} onInput={event => setReplacementPassword(event.currentTarget.value)} /></label><button className="btn-primary" disabled={!currentPassword || replacementPassword.length < 8}><CheckIcon /> Change password</button></form></section>{canManage && <section><form onSubmit={create}><h3>Create account</h3><label>Username<input value={newUser} onInput={event => setNewUser(event.currentTarget.value)} /></label><label>Initial password<input type="password" value={newPassword} onInput={event => setNewPassword(event.currentTarget.value)} /></label><label>Role<select value={newRole} onChange={event => setNewRole(event.currentTarget.value)}><option value="admin">Administrator</option><option value="operator">Operator</option><option value="viewer">Viewer</option></select></label><button className="btn-primary" disabled={!newUser || newPassword.length < 8}><PlusIcon /> Create account</button></form></section>}{notice && <div className="notice">{notice}</div>}{error && <div className="error">{error}</div>}</div>;
}

async function sshFingerprint(key) {
	try {
		const blob = key.trim().split(/\s+/)[1];
		if (!blob) return '';
		const bytes = Uint8Array.from(atob(blob), c => c.charCodeAt(0));
		const digest = await crypto.subtle.digest('SHA-256', bytes);
		const b64 = btoa(String.fromCharCode(...new Uint8Array(digest))).replace(/=+$/, '');
		return `SHA256:${b64}`;
	} catch (failure) { return ''; }
}

function SshKeysPane({ client, canManage }) {
	const [keys, setKeys] = useState([]);
	const [prints, setPrints] = useState({});
	const [label, setLabel] = useState('');
	const [material, setMaterial] = useState('');
	const [notice, setNotice] = useState(''); const [error, setError] = useState('');
	const load = async data => {
		const list = data ?? (await client.request('ssh_key_list')).data?.keys ?? [];
		setKeys(list);
		const entries = await Promise.all(list.map(async k => [k.key, await sshFingerprint(k.key)]));
		setPrints(Object.fromEntries(entries));
	};
	useEffect(() => { if (canManage) load().catch(failure => setError(failure.message)); }, [canManage]);
	const add = async event => {
		event.preventDefault(); setError('');
		try { const response = await client.request('ssh_key_add', { label, key: material.trim() }); await load(response.data?.keys); setLabel(''); setMaterial(''); setNotice('Key added.'); }
		catch (failure) { setError(failure.message); }
	};
	const remove = async key => {
		if (!globalThis.confirm('Remove this SSH key?')) return; setError('');
		try { const response = await client.request('ssh_key_remove', { key }); await load(response.data?.keys); setNotice('Key removed.'); }
		catch (failure) { setError(failure.message); }
	};
	if (!canManage) return null;
	return <div className="tab-pane"><section><h3>SSH keys (root)</h3>
		<p className="ssh-hint">Public keys that authorize SSH login as root. Password login can be disabled separately under Services.</p>
		<div className="ssh-key-list">{keys.length === 0 && <div className="ssh-empty">No keys configured.</div>}{keys.map(k => <div className="ssh-key-row" key={k.key}><div className="ssh-key-main"><strong>{k.label || (k.key.split(/\s+/)[2] ?? k.key.split(/\s+/)[0])}</strong><code>{prints[k.key] || k.key.split(/\s+/)[0]}</code></div><button className="btn-danger" onClick={() => remove(k.key)}><TrashIcon /> Remove</button></div>)}</div></section>
		<section><form onSubmit={add}><h3>Add key</h3><label>Label (optional)<input value={label} onInput={event => setLabel(event.currentTarget.value)} /></label><label>Public key<textarea rows="3" value={material} placeholder="ssh-ed25519 AAAA... user@host" onInput={event => setMaterial(event.currentTarget.value)} /></label><button className="btn-primary" disabled={!material.trim()}><PlusIcon /> Add key</button></form></section>
		{notice && <div className="notice">{notice}</div>}{error && <div className="error">{error}</div>}</div>;
}

function ServicePane({ client }) {
	const [policy, setPolicy] = useState(null); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
	const load = async () => { try { const response = await client.request('services_get'); setPolicy(response.data); } catch (failure) { setError(failure.message); } };
	useEffect(() => { load(); }, []);
	const set = (service, key, value) => setPolicy(previous => ({ ...previous, [service]: { ...previous[service], [key]: value } }));
	const save = async () => { try { await client.request('services_set', policy); setNotice('Service policy saved and applied.'); } catch (failure) { setError(failure.message); } };
	return <div className="tab-pane service-pane"><section><h3>Services</h3>{policy && ['ssh', 'web', 'chrony'].map(name => <fieldset key={name}><legend>{name === 'ssh' ? 'SSH' : name === 'web' ? 'Web interface' : 'Chrony'}</legend><label className="checkbox-line"><input type="checkbox" checked={policy[name]?.enabled} onChange={event => set(name, 'enabled', event.currentTarget.checked)} /> Enabled</label><label className="checkbox-line"><input type="checkbox" checked={policy[name]?.autostart} onChange={event => set(name, 'autostart', event.currentTarget.checked)} /> Start automatically</label>{name === 'ssh' && <><label className="checkbox-line"><input type="checkbox" checked={policy.ssh.password_auth} onChange={event => set('ssh', 'password_auth', event.currentTarget.checked)} /> Allow password authentication</label><label>Listening port<input type="number" min="1" max="65535" value={policy.ssh.port} onInput={event => set('ssh', 'port', Number(event.currentTarget.value))} /></label></>}</fieldset>)}<div className="button-row"><button className="btn-primary" onClick={save} disabled={!policy}><CheckIcon /> Apply</button></div>{notice && <div className="notice">{notice}</div>}{error && <div className="error">{error}</div>}</section></div>;
}

function TimePane({ client }) {
	const [data, setData] = useState(null);
	const [manualTime, setManualTime] = useState('');
	const [error, setError] = useState('');
	const [notice, setNotice] = useState('');
	const load = async () => {
		const response = await client.request('time_get');
		setData(response.data);
		setManualTime(manualTimeFromIso(response.data?.local));
	};
	useEffect(() => { load().catch(failure => setError(failure.message)); }, [client]);
	const policy = data?.policy;
	const patch = (path, value) => setData(previous => {
		const next = structuredClone(previous); let current = next.policy;
		const keys = path.split('.'); keys.slice(0, -1).forEach(key => { if (!current[key]) current[key] = {}; current = current[key]; });
		current[keys[keys.length - 1]] = value; return next;
	});
	const selectTimezone = timezone => setData(previous => ({ ...previous, policy: applyTimezonePolicy(previous.policy, timezone) }));
	const save = async () => {
		setError(''); setNotice('');
		try { await client.request('time_set', policy); await load(); setNotice('Time zone and synchronization policy saved.'); }
		catch (failure) { setError(failure.message); }
	};
	const setClock = async event => {
		event.preventDefault(); setError(''); setNotice('');
		try { await client.request('time_set_clock', { local: manualTime }, { timeout: 15000 }); await load(); setNotice('System clock updated.'); }
		catch (failure) { setError(failure.message); }
	};
	const selectedTimezone = findTimezone(policy?.timezone) ? policy.timezone : 'custom';
	return <div className="tab-pane time-pane">
		<section><h3>Current time</h3>{data && <dl className="system-grid"><div><dt>Time zone</dt><dd>{policy?.timezone ?? 'Custom offset'}</dd></div><div><dt>Local</dt><dd>{data.local}</dd></div><div><dt>UTC</dt><dd>{data.utc}</dd></div><div><dt>Current offset</dt><dd>{data.offset_minutes} minutes</dd></div><div><dt>Daylight saving</dt><dd>{data.dst_active ? 'active' : 'inactive'}</dd></div></dl>}</section>
		{data && <section><h3>Time zone and NTP</h3>
			<label>Common time zone<select value={selectedTimezone} onChange={event => selectTimezone(event.currentTarget.value)}><option value="custom">Custom offset and daylight-saving rule</option>{TIMEZONE_GROUPS.map(group => <optgroup key={group.label} label={group.label}>{group.zones.map(zone => <option key={zone.id} value={zone.id}>{zone.label} ({zone.id})</option>)}</optgroup>)}</select></label>
			<label className="checkbox-line"><input type="checkbox" checked={policy.ntp_enabled} onChange={event => patch('ntp_enabled', event.currentTarget.checked)} /> Synchronize with NTP</label>
			<label>NTP servers<input value={(policy.servers ?? []).join(', ')} onInput={event => patch('servers', event.currentTarget.value.split(',').map(item => item.trim()).filter(Boolean))} /></label>
			<details className="advanced-settings"><summary>Advanced custom offset and daylight-saving rule</summary><div className="form-grid"><label>Standard UTC offset (minutes)<input type="number" min="-720" max="840" value={policy.standard_offset_minutes} onInput={event => patch('standard_offset_minutes', Number(event.currentTarget.value))} /></label><label>DST UTC offset (minutes)<input type="number" min="-720" max="840" value={policy.dst?.offset_minutes} onInput={event => patch('dst.offset_minutes', Number(event.currentTarget.value))} /></label></div><label className="checkbox-line"><input type="checkbox" checked={policy.dst?.enabled} onChange={event => patch('dst.enabled', event.currentTarget.checked)} /> Automatic daylight-saving rule</label><p className="network-note">Selecting a named zone fills these values with its current common rule. Advanced values remain editable for local exceptions.</p></details>
			<div className="button-row"><button className="btn-primary" onClick={save}><CheckIcon /> Apply policy</button><button className="btn-secondary" onClick={() => client.request('time_sync').then(() => { setNotice('Synchronization requested.'); setError(''); }).catch(failure => setError(failure.message))}><RefreshIcon /> Sync now</button></div>
		</section>}
		<section><form onSubmit={setClock}><h3>Set time manually</h3><label>Local time<input value={manualTime} inputMode="numeric" placeholder="HH:MM:SS - DD:MM:YYYY" pattern="[0-2][0-9]:[0-5][0-9]:[0-5][0-9] - [0-3][0-9]:[0-1][0-9]:[0-9]{4}" onInput={event => setManualTime(event.currentTarget.value)} /></label><p className="network-note">Format: HH:MM:SS - DD:MM:YYYY. The configured time-zone and daylight-saving rule are used when converting this local time.</p>{policy?.ntp_enabled && <p className="warning">NTP is enabled and may correct the clock after a manual change.</p>}<button className="btn-primary" disabled={!manualTime.trim()}><ClockIcon /> Set system clock</button></form></section>
		{notice && <div className="notice">{notice}</div>}{error && <div className="error">{error}</div>}
	</div>;
}

function SystemPane({ client, status }) {
	const [report, setReport] = useState(null);
	const [error, setError] = useState('');
	useEffect(() => { client.request('compatibility_report').then(response => setReport(response.data)).catch(failure => setError(failure.message)); }, [client]);
	const download = () => { if (report) downloadBlob(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }), `postmerkos-compatibility-${report.model}-${report.firmware}.json`); };
	const submit = () => { if (report) globalThis.open(buildIssueUrl(report), '_blank', 'noopener'); };
	const poe = report && (report.poe_supported ? (report.poe_available ? 'available' : 'supported') : 'not supported');
	const reset = status.hardware_policy?.reset_button;
	const resetState = reset?.state ?? 'unavailable';
	const resetLabel = resetState === 'countdown' ? `countdown ${reset?.progress ?? 0}%` : resetState.replace(/-/g, ' ');
	const ledOwner = status.hardware_policy?.led_owner ?? 'normal';
	const statusLed = status.hardware_policy?.status_led;
	const greenGpio = statusLed?.green?.gpio; const orangeGpio = statusLed?.orange?.gpio;
	const hasKnownStatusGpios = Number.isInteger(greenGpio) && greenGpio >= 0 && Number.isInteger(orangeGpio) && orangeGpio >= 0;
	const statusLedLabel = statusLed?.verified && hasKnownStatusGpios ? `GPIO${greenGpio} green · GPIO${orangeGpio} orange` : statusLed?.verified ? `${statusLed.backend ?? 'verified handler'} · ${statusLed.protocol ?? 'verified protocol'}` : 'not hardware verified for this model';
	const system = status.system ?? {}; const identity = system.identity ?? {}; const processor = system.processor ?? {}; const kernel = system.kernel ?? {}; const runtime = system.runtime ?? {}; const memory = system.memory ?? {}; const storage = system.storage ?? {}; const flash = system.flash ?? {};
	const release = status.release ?? {}; const services = status.services ?? {}; const temperatures = status.temperature ?? status.temperatures ?? {};
	const storageEntries = [['Overlay', storage.overlay], ['Configuration', storage.configuration], ['Root filesystem', storage.root], ['Temporary filesystem', storage.temporary]].filter(([, value]) => value);
	return <div className="tab-pane system-pane">
		<section><h3>Device identity</h3><dl className="system-grid"><div><dt>Model</dt><dd>{status.device ?? identity.exact_model ?? '—'}</dd></div><div><dt>Product number</dt><dd>{identity.product_number ?? '—'}</dd></div><div><dt>Serial number</dt><dd>{identity.serial_number ?? '—'}</dd></div><div><dt>Base MAC</dt><dd>{identity.base_mac ?? '—'}</dd></div><div><dt>Hostname</dt><dd>{identity.hostname ?? kernel.node ?? '—'}</dd></div><div><dt>Compatibility</dt><dd>{status.capabilities?.compatibility ?? '—'}</dd></div><div><dt>Ports</dt><dd>{status.capabilities?.port_count ?? '—'}</dd></div></dl></section>
		<section><h3>Software</h3><dl className="system-grid"><div><dt>Firmware release</dt><dd>{release.version ?? 'unknown'}</dd></div><div><dt>Build time</dt><dd>{release.build_time_utc ?? '—'}</dd></div><div><dt>Git revision</dt><dd>{release.git_revision ?? '—'}</dd></div><div><dt>Target family</dt><dd>{release.target_family ?? '—'}</dd></div><div><dt>Image format</dt><dd>{release.image_format ?? '—'}</dd></div><div><dt>Configuration schema</dt><dd>{release.config_schema ?? '—'}</dd></div><div><dt>Web API</dt><dd>{release.web_api ?? '—'}</dd></div><div><dt>Firmware-update API</dt><dd>{release.fwupdate_api ?? '—'}</dd></div></dl></section>
		<section><h3>Processor and kernel</h3><dl className="system-grid"><div><dt>Processor</dt><dd>{processor.model ?? processor.hardware ?? '—'}</dd></div><div><dt>SoC / system type</dt><dd>{processor.system_type ?? processor.machine ?? '—'}</dd></div><div><dt>Logical processors</dt><dd>{processor.logical_processors ?? '—'}</dd></div><div><dt>BogoMIPS</dt><dd>{processor.bogomips ?? '—'}</dd></div><div><dt>Architecture</dt><dd>{kernel.architecture ?? '—'}</dd></div><div><dt>Kernel release</dt><dd>{kernel.release ?? '—'}</dd></div><div><dt>Kernel build</dt><dd>{kernel.version ?? '—'}</dd></div><div><dt>CPU revision / ASEs</dt><dd>{[processor.revision, processor.ases].filter(Boolean).join(' · ') || '—'}</dd></div></dl><details className="advanced-settings"><summary>Kernel command line</summary><code className="long-value">{kernel.command_line ?? 'unavailable'}</code></details></section>
		<section><h3>Runtime</h3><dl className="system-grid"><div><dt>Uptime</dt><dd>{runtime.uptime_seconds != null ? formatDuration(runtime.uptime_seconds) : '—'}</dd></div><div><dt>Boot time</dt><dd>{formatEpoch(runtime.boot_time_epoch)}</dd></div><div><dt>Load average</dt><dd>{[runtime.load_1, runtime.load_5, runtime.load_15].map(value => Number.isFinite(Number(value)) ? Number(value).toFixed(2) : '—').join(' / ')}</dd></div><div><dt>Processes</dt><dd>{runtime.process_count ?? runtime.scheduled_processes ?? '—'}{runtime.running_processes != null ? ` (${runtime.running_processes} running)` : ''}</dd></div><div><dt>Local time</dt><dd>{status.time?.local ?? '—'}</dd></div><div><dt>UTC</dt><dd>{status.time?.utc ?? '—'}</dd></div></dl></section>
		{Object.keys(temperatures).length > 0 && <section><h3>Temperatures</h3><dl className="system-grid">{Object.entries(temperatures).map(([name, values]) => <div key={name}><dt>{name.replace(/_/g, ' ')}</dt><dd>{(Array.isArray(values) ? values : [values]).map(value => Number.isFinite(Number(value)) ? `${Number(value).toFixed(1)} °C` : String(value)).join(' / ')}</dd></div>)}</dl></section>}
		{Object.keys(services).length > 0 && <section><h3>Service health</h3><dl className="system-grid">{Object.entries(services).map(([name, service]) => <div key={name}><dt>{name}</dt><dd>{service.running ? 'running' : 'stopped'} · {service.enabled ? 'enabled' : 'disabled'}{service.in_sync === false ? ' · policy mismatch' : ''}{service.port ? ` · port ${service.port}` : ''}</dd></div>)}</dl></section>}
		<section><h3>Memory</h3><dl className="system-grid"><div><dt>Total RAM</dt><dd>{formatBytes(memory.total_bytes)}</dd></div><div><dt>Available RAM</dt><dd>{formatBytes(memory.available_bytes ?? memory.free_bytes)}</dd></div><div><dt>Free RAM</dt><dd>{formatBytes(memory.free_bytes)}</dd></div><div><dt>Cache</dt><dd>{formatBytes(memory.cached_bytes)}</dd></div><div><dt>Buffers</dt><dd>{formatBytes(memory.buffers_bytes)}</dd></div><div><dt>Kernel slab</dt><dd>{formatBytes(memory.slab_bytes)}</dd></div><div><dt>Swap</dt><dd>{formatBytes(memory.swap_free_bytes)} free of {formatBytes(memory.swap_total_bytes)}</dd></div></dl></section>
		<section><h3>Storage</h3><div className="storage-grid">{storageEntries.map(([label, filesystem]) => <article className="storage-card" key={label}><h4>{label}</h4>{filesystem.available ? <><strong>{formatBytes(filesystem.available_bytes)} free</strong><progress max="100" value={filesystem.used_percent ?? 0} /><span>{formatBytes(filesystem.used_bytes)} used of {formatBytes(filesystem.total_bytes)} · {formatPercent(filesystem.used_percent)}</span><small>{[filesystem.path, filesystem.type, filesystem.source].filter(Boolean).join(' · ')}</small></> : <span>Unavailable at {filesystem.path}</span>}</article>)}</div></section>
		<section><h3>Flash layout</h3><p>{formatBytes(flash.total_bytes)} across {(flash.partitions ?? []).length} MTD partitions.</p>{(flash.partitions ?? []).length > 0 && <div className="compact-table-wrap"><table className="compact-table"><thead><tr><th>Device</th><th>Name</th><th>Size</th><th>Erase block</th></tr></thead><tbody>{flash.partitions.map(partition => <tr key={partition.device}><td>{partition.device}</td><td>{partition.name}</td><td>{formatBytes(partition.size_bytes)}</td><td>{formatBytes(partition.erase_size_bytes)}</td></tr>)}</tbody></table></div>}</section>
		<section><h3>Physical controls</h3><dl className="system-grid"><div><dt>Reset button</dt><dd className={`hardware-state hardware-${resetState}`}>{resetLabel}</dd></div><div><dt>Input</dt><dd>{reset?.available ? `GPIO${reset.gpio} · ${reset.active_low ? 'active low' : 'active high'}` : 'not available'}</dd></div><div><dt>Safety</dt><dd>{reset?.verified && reset?.destructive_enabled ? 'hardware verified' : 'destructive action disabled'}</dd></div><div><dt>Factory reset</dt><dd>{reset?.enabled ? `hold ${reset.hold_seconds ?? 10} seconds` : 'disabled by policy'}</dd></div><div><dt>Status LED owner</dt><dd>{ledOwner}</dd></div><div><dt>Status LED</dt><dd>{statusLed?.available ? 'available' : statusLed?.verified ? 'verified but unavailable' : 'not available'}</dd></div><div><dt>Status LED evidence</dt><dd>{statusLedLabel}</dd></div></dl>{resetState === 'countdown' && <p className="warning reset-countdown-warning">Release the reset button now to cancel the factory reset.</p>}{resetState === 'inhibited' && <p className="notice">The physical reset button is temporarily blocked while a firmware operation owns the flash lock.</p>}{resetState === 'waiting-release' && <p className="notice">Release the button once after boot before it can be armed. This prevents a stuck button from erasing settings.</p>}</section>
		<section><h3>Compatibility report</h3>{error && <div className="error">{error}</div>}{report && <div className="compat-card"><div className="compat-head"><strong>{report.model}</strong><span className={`compat-badge compat-${report.compatibility}`}>{report.compatibility}</span><span className="compat-fw">firmware {report.firmware}</span></div><dl className="compat-grid"><div><dt>Family</dt><dd>{report.family}</dd></div><div><dt>Ports</dt><dd>{report.port_count} ({report.copper_ports} copper · {report.uplink_ports} uplink)</dd></div><div><dt>PoE</dt><dd>{poe} · {report.poe_controllers} controllers</dd></div><div><dt>Switch instances</dt><dd>{report.switch_instances}</dd></div><div><dt>MAC</dt><dd>{report.mac_oui}</dd></div></dl><div className="button-row"><button className="btn-primary" onClick={submit}><UploadIcon /> Submit report</button><button className="btn-secondary" onClick={download}><DownloadIcon /> Download</button></div><details className="compat-details"><summary>Show details</summary><pre>{JSON.stringify(report, null, 2)}</pre></details></div>}</section>
	</div>;
}

function SwitchingPane({ config, updateRoot }) {
	const stp = config?.stp ?? { priority: 32768, hello_time: 2, forward_delay: 15, max_age: 20, hold_count: 6 };
	const lacp = config?.lacp ?? { enabled: false };
	const multicast = config?.multicast ?? { igmp_snooping: true, igmp_querier_interval: 125, mld_snooping: true, mld_querier_interval: 125 };
	return <div className="tab-pane switching-pane"><fieldset><legend>Global Spanning Tree</legend><div className="form-grid"><label>Bridge priority<input type="number" min="0" max="61440" step="4096" value={stp.priority} onInput={event => updateRoot('stp.priority', Number(event.currentTarget.value))} /></label><label>Hello time<input type="number" min="1" max="10" value={stp.hello_time} onInput={event => updateRoot('stp.hello_time', Number(event.currentTarget.value))} /></label><label>Forward delay<input type="number" min="4" max="30" value={stp.forward_delay} onInput={event => updateRoot('stp.forward_delay', Number(event.currentTarget.value))} /></label><label>Maximum age<input type="number" min="6" max="40" value={stp.max_age} onInput={event => updateRoot('stp.max_age', Number(event.currentTarget.value))} /></label><label>Hold count<input type="number" min="1" max="10" value={stp.hold_count} onInput={event => updateRoot('stp.hold_count', Number(event.currentTarget.value))} /></label></div></fieldset><fieldset><legend>Link Aggregation</legend><label className="checkbox-line"><input type="checkbox" checked={lacp.enabled} onChange={event => updateRoot('lacp.enabled', event.currentTarget.checked)} /> Enable LACP</label></fieldset><fieldset><legend>Multicast</legend><div className="form-grid"><label className="checkbox-line"><input type="checkbox" checked={multicast.igmp_snooping} onChange={event => updateRoot('multicast.igmp_snooping', event.currentTarget.checked)} /> IGMP snooping</label><label>IGMP querier interval<input type="number" min="1" max="3600" value={multicast.igmp_querier_interval} onInput={event => updateRoot('multicast.igmp_querier_interval', Number(event.currentTarget.value))} /></label><label className="checkbox-line"><input type="checkbox" checked={multicast.mld_snooping} onChange={event => updateRoot('multicast.mld_snooping', event.currentTarget.checked)} /> MLD snooping</label><label>MLD querier interval<input type="number" min="1" max="3600" value={multicast.mld_querier_interval} onInput={event => updateRoot('multicast.mld_querier_interval', Number(event.currentTarget.value))} /></label></div></fieldset></div>;
}

function MonitoringPane({ config, updateRoot }) {
	const t = config?.telemetry ?? {};
	const prom = t.prometheus ?? { enabled: false, port: 9100, management_only: true };
	const snmp = t.snmp ?? { enabled: false, community: '', location: '', contact: '', management_only: true };
	const mgmt = config?.network?.ipv4?.address?.split('/')?.[0] ?? '<management-address>';
	return <div className="tab-pane monitoring-pane">
		<fieldset>
			<legend>Prometheus metrics</legend>
			<label className="checkbox-line"><input type="checkbox" checked={prom.enabled ?? false}
				onChange={event => updateRoot('telemetry.prometheus.enabled', event.currentTarget.checked)} /> Enable Prometheus metrics endpoint</label>
			<label className="checkbox-line"><input type="checkbox" checked={prom.management_only ?? true}
				onChange={event => updateRoot('telemetry.prometheus.management_only', event.currentTarget.checked)} /> Restrict listener to the Linux management interface</label>
			<div className="form-grid">
				<label>Port<input type="number" min="1" max="65535" value={prom.port ?? 9100}
					onInput={event => updateRoot('telemetry.prometheus.port', Number(event.currentTarget.value))} /></label>
			</div>
			{prom.enabled && <p className={(prom.management_only ?? true) ? 'notice' : 'warning'}>Metrics endpoint: http://{mgmt}:{prom.port ?? 9100}/metrics. {(prom.management_only ?? true) ? 'Access is restricted to linux_mgmt.' : 'The listener is exposed on every Linux interface.'}</p>}
		</fieldset>
		<fieldset>
			<legend>SNMP (read-only v2c IF-MIB)</legend>
			<label className="checkbox-line"><input type="checkbox" checked={snmp.enabled ?? false}
				onChange={event => updateRoot('telemetry.snmp.enabled', event.currentTarget.checked)} /> Enable SNMP</label>
			<label className="checkbox-line"><input type="checkbox" checked={snmp.management_only ?? true}
				onChange={event => updateRoot('telemetry.snmp.management_only', event.currentTarget.checked)} /> Restrict listener to the Linux management interface</label>
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
			{snmp.enabled && snmp.community && <p className={(snmp.management_only ?? true) ? 'notice' : 'warning'}>{(snmp.management_only ?? true) ? 'SNMP v2c read-only is restricted to linux_mgmt.' : 'SNMP v2c is exposed on every Linux interface.'}</p>}
		</fieldset>
	</div>;
}

function ClonePane({ client, config, sourcePort, onDone }) {
	const allFields = ['administrative', 'name', 'phy', 'storm_control', 'vlan', 'stp', 'poe'];
	const [fields, setFields] = useState(allFields); const [targets, setTargets] = useState([]); const [result, setResult] = useState(null); const [error, setError] = useState('');
	const ports = Object.keys(config?.ports ?? {}).map(Number);
	const toggle = (list, value, setter) => setter(list.includes(value) ? list.filter(item => item !== value) : [...list, value]);
	const clone = async () => { try { const response = await client.request('ports_clone', { source: Number(sourcePort), targets, fields }, { timeout: 30000 }); setResult(response.data); onDone?.(); } catch (failure) { setError(failure.message); } };
	return <div className="clone-pane"><h3>Clone Port {sourcePort}</h3><div className="clone-fields">{allFields.map(field => <label className="checkbox-line" key={field}><input type="checkbox" checked={fields.includes(field)} onChange={() => toggle(fields, field, setFields)} /> {field.replace('_', ' ')}</label>)}</div><div className="target-grid">{ports.map(port => <button key={port} className={targets.includes(port) ? 'active' : ''} disabled={String(port) === String(sourcePort)} onClick={() => toggle(targets, port, setTargets)}>{port}</button>)}</div><button className="btn-primary" onClick={clone} disabled={!targets.length || !fields.length}><CheckIcon /> Clone</button>{result && <div className="notice">Copied to ports {(result.targets ?? []).join(', ')}. {(result.warnings ?? []).join(' ')}</div>}{error && <div className="error">{error}</div>}</div>;
}

export function PortEditor({ client, selectedPort, onSelect, onClose, config, status, poe, updatePort, updatePortMulti, diff }) {
	const ref = useRef(); const [clone, setClone] = useState(false);
	useEffect(() => { if (selectedPort) ref.current?.showModal(); else ref.current?.close(); }, [selectedPort]);
	if (!selectedPort || !config?.ports?.[selectedPort]) return null;
	const numbers = Object.keys(config.ports).map(Number).sort((a, b) => a - b); const index = numbers.indexOf(Number(selectedPort));
	const move = delta => { const next = numbers[index + delta]; if (next) onSelect?.(String(next)); };
	return <dialog className="management-dialog port-editor-dialog" ref={ref} onClose={onClose}><div className="tool-dialog wide-dialog"><div className="dialog-topbar"><DialogHeader title={`Port ${selectedPort}`} close={onClose} /><div className="port-navigation"><button className="btn-secondary" disabled={index <= 0} onClick={() => move(-1)}>Previous</button><button className="btn-secondary" onClick={() => setClone(value => !value)}>Clone configuration</button><button className="btn-secondary" disabled={index >= numbers.length - 1} onClick={() => move(1)}>Next</button></div></div><div className="dialog-body">{clone && <ClonePane client={client} config={config} sourcePort={selectedPort} />}<Table ports={{ [selectedPort]: config.ports[selectedPort] }} status={status} poe={poe} updatePort={updatePort} updatePortMulti={updatePortMulti} diff={diff} selectedPort={selectedPort} /></div></div></dialog>;
}

export function ConfigurationMenu({ client, auth, config, status, updateRoot, updatePort, updatePortMulti, diff, poe, hasCapability, frontTable, onFrontTableChange, onApply, onDiscard, applying, connected }) {
	const available = useMemo(() => [
		{ id: 'system', label: 'System', icon: <ChipIcon /> }, { id: 'display', label: 'Display', icon: <MonitorIcon /> }, { id: 'network', label: 'Network', icon: <GlobeIcon /> }, { id: 'ports', label: 'Ports', icon: <GridIcon /> }, { id: 'switching', label: 'Switching', icon: <ShareIcon /> },
		{ id: 'accounts', label: 'Accounts', icon: <UsersIcon /> }, { id: 'services', label: 'Services', icon: <ServerIcon /> }, { id: 'monitoring', label: 'Monitoring', icon: <ActivityIcon /> }, { id: 'time', label: 'Time', icon: <ClockIcon /> },
		...(hasCapability('terminal.exec') ? [{ id: 'terminal', label: 'Terminal', icon: <TerminalIcon /> }] : []),
	], [hasCapability]);
	const [tab, setTab] = useState('system');
	const canWrite = hasCapability('network.write');
	// Switch-config tabs commit through the shared diff; they get the in-dialog footer.
	const configTab = ['network', 'ports', 'switching', 'monitoring'].includes(tab);
	const footer = configTab && canWrite
		? <ConfigFooter diff={diff} onApply={onApply} onDiscard={onDiscard} applying={applying} connected={connected} />
		: null;
	const dialogClassName = tab === 'ports' ? 'dialog-extra-wide' : tab === 'terminal' ? 'dialog-wide' : 'dialog-standard';
	return <ModalButton label={<CogIcon />} className="icon-button" dialogClassName={dialogClassName} title="Configuration — switch configuration and system tools">
		{({ close }) => <DialogShell title="Configuration" close={close} tabs={available} selected={tab} onSelect={setTab}>
			{tab === 'system' && <SystemPane client={client} status={status} />}
			{tab === 'display' && <div className="tab-pane"><section><h3>Display</h3><label className="checkbox-line"><input type="checkbox" checked={frontTable} onChange={event => onFrontTableChange?.(event.currentTarget.checked)} /> View all ports on the front page (uncheck for a focused per-port configuration window)</label><p>When enabled, the full port table is shown on the front page and clicking a port in the diagram scrolls to its row. When disabled, clicking a port opens its focused configuration window. This preference is stored in your browser.</p></section></div>}
			{tab === 'network' && <NetworkPanel config={config} status={status} updateConfig={updateRoot} diff={diff} />}
			{tab === 'ports' && <div className="tab-pane all-ports-pane"><Table ports={config.ports} status={status} poe={poe} updatePort={updatePort} updatePortMulti={updatePortMulti} diff={diff} /></div>}
			{tab === 'switching' && <SwitchingPane config={config} updateRoot={updateRoot} />}
			{tab === 'accounts' && <div className="tab-stack account-pane-stack"><AccountPane client={client} auth={auth} canManage={hasCapability('users.manage')} /><SshKeysPane client={client} canManage={hasCapability('users.manage')} /></div>}
			{tab === 'services' && (hasCapability('services.manage') ? <ServicePane client={client} /> : <div className="warning">Service configuration requires administrator access.</div>)}
			{tab === 'monitoring' && (canWrite
				? <MonitoringPane config={config} updateRoot={updateRoot} />
				: <div className="warning">Monitoring configuration requires write access.</div>)}
			{tab === 'time' && (hasCapability('services.manage') ? <TimePane client={client} /> : <SystemPane client={client} status={status} />)}
			{tab === 'terminal' && <TerminalPane client={client} />}
			{footer}
		</DialogShell>}
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
	const submit = async () => {
		try {
			const data = report ?? (await client.request('compatibility_report')).data;
			setReport(data);
			globalThis.open(buildIssueUrl(data), '_blank', 'noopener');
		} catch (failure) { setError(failure.message); }
	};
	return <dialog className="management-dialog compatibility-dialog" ref={ref}>
		<div className="tool-dialog">
			<div className="dialog-body">
				<h2>{incompatible ? 'Known-incompatible firmware' : 'Untested switch model'}</h2>
				<p>{notice.message}</p>
				<p>Model: <strong>{notice.model}</strong><br />Firmware: <strong>{notice.firmware}</strong></p>
				<div className="button-row">
					<button className="btn-primary" onClick={submit}><UploadIcon /> Submit report</button>
					<button className="btn-secondary" onClick={async () => {
						try { const response = await client.request('compatibility_report'); setReport(response.data); }
						catch (failure) { setError(failure.message); }
					}}><EyeIcon /> View diagnostic summary</button>
					{!incompatible && <button className="btn-primary" onClick={dismiss}><CheckIcon /> Dismiss for this firmware</button>}
					<button className="btn-secondary" onClick={() => ref.current?.close()}>{incompatible ? 'Return to management' : 'Remind me next time'}</button>
				</div>
				{report && <pre>{JSON.stringify(report, null, 2)}</pre>}
				{incompatible && <div className="error">This release cannot be acknowledged for this model. Install a compatible release before relying on hardware-control features.</div>}
				{error && <div className="error">{error}</div>}
			</div>
		</div>
	</dialog>;
}
