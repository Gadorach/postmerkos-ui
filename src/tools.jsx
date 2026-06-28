import { useEffect, useRef, useState } from 'preact/hooks';
import { createBackup, downloadBlob, readBackup } from './backup';

function DialogButton({ label, title, children, className = '', onOpen, onClose }) {
	const ref = useRef();
	const open = () => { onOpen?.(); ref.current?.showModal(); };
	const close = () => { ref.current?.close(); };
	return <>
		<button className={className} title={title ?? label} onClick={open}>{label}</button>
		<dialog ref={ref} onClose={onClose} onClick={event => { if (event.target === ref.current) close(); }}>
			{children({ close })}
		</dialog>
	</>;
}

export function TerminalTool({ client }) {
	const [command, setCommand] = useState('');
	const [lines, setLines] = useState([]);
	const [working, setWorking] = useState(false);
	const run = async event => {
		event.preventDefault();
		if (!command.trim()) return;
		const current = command; setCommand(''); setWorking(true);
		try {
			const response = await client.request('terminal_exec', { command: current }, { timeout: 20000 });
			setLines(previous => [...previous, `$ ${current}`, response.data?.output ?? '', `[exit ${response.data?.exit_code ?? '?'}]`]);
		} catch (error) { setLines(previous => [...previous, `$ ${current}`, `error: ${error.message}`]); }
		finally { setWorking(false); }
	};
	return <DialogButton label="terminal" title="authenticated root command window">
		{({ close }) => <div className="tool-dialog terminal-dialog">
			<div className="dialog-heading"><h2>Command line</h2><button onClick={close}>close</button></div>
			<p>Commands execute as root and are limited to 15 seconds and 64 KiB of output.</p>
			<pre className="terminal-output">{lines.join('\n')}</pre>
			<form className="terminal-input" onSubmit={run}><span>$</span><input autoFocus value={command} onInput={event => setCommand(event.currentTarget.value)} disabled={working} /><button disabled={working || !command.trim()}>{working ? 'running…' : 'run'}</button></form>
		</div>}
	</DialogButton>;
}

export function FirmwareTool({ client, connected, config, compatibility = 'untested' }) {
	const [file, setFile] = useState(null);
	const [manifestFile, setManifestFile] = useState(null);
	const [overlay, setOverlay] = useState('preserve');
	const [force, setForce] = useState(false);
	const [acceptUntested, setAcceptUntested] = useState(false);
	const [ready, setReady] = useState(null);
	const [repositories, setRepositories] = useState(null);
	const [upload, setUpload] = useState(null);
	const [status, setStatus] = useState(null);
	const [error, setError] = useState('');
	const [active, setActive] = useState(false);
	const uploadingRef = useRef(false);
	useEffect(() => {
		if (!active || !connected) return undefined;
		let stopped = false;
		const poll = async () => {
			if (uploadingRef.current) return;
			try {
				const [response, repoResponse, uploadResponse] = await Promise.all([
					client.request('firmware_status'),
					client.request('firmware_repo_get'),
					client.request('firmware_upload_status'),
				]);
				if (!stopped && !uploadingRef.current) {
					setStatus(response.data);
					setRepositories(repoResponse.data);
					const staged = uploadResponse.data ?? {};
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
			}
			catch (pollError) { if (!stopped && !uploadingRef.current) setError(pollError.message); }
		};
		poll(); const timer = setInterval(poll, 1500);
		return () => { stopped = true; clearInterval(timer); };
	}, [active, connected, client]);
	const start = async event => {
		event.preventDefault(); setError(''); setReady(null);
		if (compatibility === 'known-incompatible') { setError('This firmware is marked known-incompatible with the detected model'); return; }
		if (compatibility === 'untested' && !acceptUntested) { setError('Acknowledge the untested-model warning before continuing'); return; }
		if (config && globalThis.confirm('Download a configuration backup before uploading firmware?')) {
			try { const blob = await createBackup(config); downloadBlob(blob, `postmerkos-preupdate-${new Date().toISOString().replace(/[:.]/g, '-')}.json`); }
			catch (backupError) { setError(`Backup could not be prepared: ${backupError.message}`); return; }
		}
		setUpload({ phase: 'starting', progress: 0 });
		uploadingRef.current = true;
		try {
			const response = await client.uploadFirmware(file, { manifestFile, overlay, force, acceptUntested, onProgress: setUpload });
			setReady(response.data);
		} catch (uploadError) { setError(uploadError.message); }
		finally { uploadingRef.current = false; setUpload(null); }
	};
	const begin = async () => {
		if (!ready?.token) return;
		if (!globalThis.confirm('Begin flashing now? The web interface will disconnect and the switch will reboot.')) return;
		try {
			const response = await client.beginFirmware(ready.token);
			setStatus({ state: 'starting', stage: 'acknowledged', progress: 0, message: response.data?.message }); setReady(null);
		} catch (beginError) { setError(beginError.message); }
	};
	return <DialogButton label="firmware" title="upload and install firmware" onOpen={() => setActive(true)} onClose={() => setActive(false)}>
		{({ close }) => <div className="tool-dialog firmware-dialog">
			<div className="dialog-heading"><h2>Firmware update</h2><button onClick={close}>close</button></div>
			<form onSubmit={start}>
				<label>Firmware image<input type="file" accept=".bin,.img,.squashfs" onChange={event => setFile(event.currentTarget.files?.[0] ?? null)} /></label>
				<label>Release manifest (optional)<input type="file" accept=".json,application/json" onChange={event => setManifestFile(event.currentTarget.files?.[0] ?? null)} /></label>
				<label>Writable-overlay policy<select value={overlay} onChange={event => setOverlay(event.currentTarget.value)}><option value="preserve">Preserve settings byte-for-byte</option><option value="migrate">Migrate selected settings</option><option value="reset">Reset settings</option><option value="image">Use overlay embedded in full image</option></select></label>
				<label className="checkbox-line"><input type="checkbox" checked={force} onChange={event => setForce(event.currentTarget.checked)} /> Force same/older or metadata-free image</label>
				{compatibility === 'untested' && <label className="checkbox-line warning"><input type="checkbox" checked={acceptUntested} onChange={event => setAcceptUntested(event.currentTarget.checked)} /> I understand that this switch model is currently untested</label>}
				{compatibility === 'known-incompatible' && <div className="error">This release is known-incompatible with the detected switch model and cannot be installed.</div>}
				<button disabled={!file || !connected || compatibility === 'known-incompatible' || Boolean(upload) || Boolean(ready)}>{upload ? 'uploading…' : 'Upload and validate'}</button>
			</form>
			{upload && <div className="progress-block"><progress max="100" value={upload.progress ?? 0} /><span>{upload.phase}: {upload.progress ?? 0}%</span></div>}
			{ready && <div className="notice"><strong>Firmware validated and ready</strong><p>{ready.message}</p><button onClick={begin}>Begin firmware update</button><button onClick={() => { client.request('firmware_upload_cancel').catch(() => {}); setReady(null); }}>Cancel</button></div>}
			{repositories && <details><summary>Firmware repositories</summary><pre>{JSON.stringify(repositories, null, 2)}</pre></details>}
			{status && <div className="firmware-status"><strong>{status.state} / {status.stage}</strong><progress max="100" value={status.progress ?? 0} /><span>{status.progress ?? 0}% — {status.message}</span></div>}
			{error && <div className="error">{error}</div>}
			<p className="warning">When flashing begins, management connections will close. Controllable copper/PoE LEDs show approximate progress when supported; serial status and the post-reboot update log remain available.</p>
		</div>}
	</DialogButton>;
}

export function BackupTool({ client, config, canRestore = false }) {
	const [restoreFile, setRestoreFile] = useState(null);
	const [notice, setNotice] = useState('');
	const [error, setError] = useState('');
	const [working, setWorking] = useState(false);
	const backup = async () => {
		setError(''); setNotice('');
		try { const blob = await createBackup(config); downloadBlob(blob, `postmerkos-config-${new Date().toISOString().replace(/[:.]/g, '-')}.json`); setNotice('JSON backup downloaded'); }
		catch (backupError) { setError(backupError.message); }
	};
	const restore = async () => {
		setWorking(true); setError(''); setNotice('');
		try { const restored = await readBackup(restoreFile); await client.request('replace_config', restored, { timeout: 30000 }); setNotice('Configuration restored and applied'); }
		catch (restoreError) { setError(restoreError.message); }
		finally { setWorking(false); }
	};
	return <DialogButton label="backup" title="back up or restore configuration">
		{({ close }) => <div className="tool-dialog backup-dialog">
			<div className="dialog-heading"><h2>Configuration backup</h2><button onClick={close}>close</button></div>
			<section><h3>Export</h3><p>Backups are plain JSON files.</p><button onClick={backup} disabled={!config}>Download backup</button></section>
			{canRestore && <section><h3>Restore</h3><label>Backup file<input type="file" accept=".json,application/json" onChange={event => setRestoreFile(event.currentTarget.files?.[0] ?? null)} /></label><button onClick={restore} disabled={!restoreFile || working}>{working ? 'restoring…' : 'Validate and restore'}</button></section>}
			{notice && <div className="notice">{notice}</div>}{error && <div className="error">{error}</div>}
		</div>}
	</DialogButton>;
}

export function AccountTool({ client, auth, canManage = false }) {
	const [username, setUsername] = useState(auth?.username ?? 'root');
	const [current, setCurrent] = useState('');
	const [replacement, setReplacement] = useState('');
	const [confirmation, setConfirmation] = useState('');
	const [notice, setNotice] = useState('');
	const [error, setError] = useState('');
	const change = async event => {
		event.preventDefault(); setError(''); setNotice('');
		if (replacement !== confirmation) { setError('New passwords do not match'); return; }
		try { await client.request('password_change', { username, current_password: current, new_password: replacement }, { timeout: 20000 }); setCurrent(''); setReplacement(''); setConfirmation(''); setNotice(`Password updated for ${username}`); }
		catch (changeError) { setError(changeError.message); }
	};
	return <DialogButton label="account" title="manage local account passwords">
		{({ close }) => <div className="tool-dialog account-dialog">
			<div className="dialog-heading"><h2>Account password</h2><button onClick={close}>close</button></div>
			<form onSubmit={change}>
				<label>Account<select value={username} onChange={event => setUsername(event.currentTarget.value)}>{(canManage ? (auth?.users ?? []) : [{ username: auth?.username }]).filter(user => user?.username).map(user => <option key={user.username} value={user.username}>{user.username}</option>)}</select></label>
				<label>Current password<input type="password" autoComplete="current-password" value={current} onInput={event => setCurrent(event.currentTarget.value)} /></label>
				<label>New password<input type="password" autoComplete="new-password" value={replacement} onInput={event => setReplacement(event.currentTarget.value)} /></label>
				<label>Confirm new password<input type="password" autoComplete="new-password" value={confirmation} onInput={event => setConfirmation(event.currentTarget.value)} /></label>
				<button disabled={!current || replacement.length < 8 || !confirmation}>Change password</button>
			</form>
			{notice && <div className="notice">{notice}</div>}{error && <div className="error">{error}</div>}
		</div>}
	</DialogButton>;
}
