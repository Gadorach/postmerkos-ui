import { render } from 'preact';
import './style.css';
import { useState, useEffect, useRef, useCallback } from 'preact/hooks';
import { ConfigdClient } from './api';
import NetworkPanel from './network';
import Ports from './ports';
import Legend from './legend';
import Table from './table';
import Button from './button';
import Login from './login';
import { AccountTool, BackupTool, FirmwareTool, TerminalTool } from './tools';

const setPath = (obj, path, value) => {
	const keys = path.split('.');
	const result = structuredClone(obj);
	let current = result;
	for (let i = 0; i < keys.length - 1; i++) {
		if (current[keys[i]] == null) current[keys[i]] = {};
		current = current[keys[i]];
	}
	current[keys[keys.length - 1]] = value;
	return result;
};

const computeDiff = (desired, current) => {
	if (desired === current) return undefined;
	if (desired == null || current == null || typeof desired !== 'object' || typeof current !== 'object') return desired;
	const result = {};
	for (const key of Object.keys(desired)) {
		const value = computeDiff(desired[key], current[key]);
		if (value !== undefined && (typeof value !== 'object' || value === null || Object.keys(value).length > 0)) result[key] = value;
	}
	return result;
};

function App() {
	const [auth, setAuth] = useState(null);
	const [config, setConfig] = useState(null);
	const [configOnDisk, setConfigOnDisk] = useState(null);
	const [diff, setDiff] = useState({});
	const [status, setStatus] = useState({});
	const [error, setError] = useState(null);
	const [notice, setNotice] = useState(null);
	const [uploading, setUploading] = useState(false);
	const [connected, setConnected] = useState(false);
	const [selectedPort, setSelectedPort] = useState(null);
	const dialogRef = useRef();
	const clientRef = useRef(null);

	useEffect(() => {
		const client = new ConfigdClient({
			onStatus: next => setStatus(next),
			onConfig: next => { setConfig(next); setConfigOnDisk(next); setDiff({}); },
			onConnection: value => setConnected(value),
			onAuth: next => { setAuth(next); setError(null); },
			onAuthRequired: () => { setAuth(null); setConfig(null); setConfigOnDisk(null); setDiff({}); setStatus({}); },
			onError: message => setError(message),
		});
		clientRef.current = client; client.connect();
		return () => { client.close(); clientRef.current = null; };
	}, []);

	const login = useCallback(async (username, password) => {
		setError(null);
		try { const response = await clientRef.current.authenticate(username, password); setAuth(response.data); }
		catch (loginError) { setError(loginError.message); }
	}, []);
	const logout = useCallback(async () => {
		try { await clientRef.current.request('logout'); } catch (logoutError) { setError(logoutError.message); }
		finally { setAuth(null); setConfig(null); setConfigOnDisk(null); setStatus({}); }
	}, []);
	const updateRoot = useCallback((path, value) => {
		setConfig(previous => { const updated = setPath(previous, path, value); setDiff(computeDiff(updated, configOnDisk) ?? {}); return updated; });
	}, [configOnDisk]);
	const updatePort = useCallback((portNumber, path, value) => {
		setConfig(previous => { const updated = structuredClone(previous); updated.ports[portNumber] = setPath(updated.ports[portNumber], path, value); setDiff(computeDiff(updated, configOnDisk) ?? {}); return updated; });
	}, [configOnDisk]);
	const updatePortMulti = useCallback((portNumber, updates) => {
		setConfig(previous => { const updated = structuredClone(previous); let port = updated.ports[portNumber]; for (const [path, value] of Object.entries(updates)) port = setPath(port, path, value); updated.ports[portNumber] = port; setDiff(computeDiff(updated, configOnDisk) ?? {}); return updated; });
	}, [configOnDisk]);
	const selectPort = useCallback(port => {
		setSelectedPort(String(port));
		requestAnimationFrame(() => document.getElementById(`port-row-${port}`)?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' }));
	}, []);
	const uploadConfig = useCallback(async () => {
		const delta = computeDiff(config, configOnDisk) ?? {};
		if (Object.keys(delta).length === 0) return;
		setUploading(true); setError(null); setNotice(null);
		try { const response = await clientRef.current.request('config', delta); const warnings = response.data?.warnings ?? []; setNotice(warnings.length ? `Configuration accepted with warnings: ${warnings.join('; ')}` : 'Configuration accepted'); }
		catch (uploadError) { setError(uploadError.message || 'Bad Request'); }
		finally { setUploading(false); }
	}, [config, configOnDisk]);
	const discardChanges = useCallback(() => {
		if (!configOnDisk) return;
		setConfig(structuredClone(configOnDisk)); setDiff({}); setError(null); setNotice('Unapplied configuration changes discarded');
	}, [configOnDisk]);
	const hasDiff = Object.keys(diff ?? {}).length > 0;
	useEffect(() => {
		if (!hasDiff) return undefined;
		const warnBeforeLeaving = event => { event.preventDefault(); event.returnValue = ''; };
		globalThis.addEventListener('beforeunload', warnBeforeLeaving);
		return () => globalThis.removeEventListener('beforeunload', warnBeforeLeaving);
	}, [hasDiff]);

	if (!auth) return <Login connected={connected} onLogin={login} error={error} />;
	const client = clientRef.current;
	const poeSupported = Boolean(status?.capabilities?.poe?.supported);
	return <div>
		<div id="heading">
			<div className="heading-bar"><div><h1>postmerkOS</h1><span className="version">{/* VERSION */} dev {/* NOTE: do not remove; this is replaced in CI */}</span></div>
				<div className="heading-actions">{config && client && <div id="buttons">
					<Button onClick={uploadConfig} isLoading={uploading} disabled={!connected || uploading || !hasDiff} title={connected ? 'upload config' : 'disconnected'}>apply</Button>
					<button title="view config" onClick={() => dialogRef.current.showModal()}>config</button>
					<dialog className="config-preview" ref={dialogRef} onClick={event => { if (event.target === dialogRef.current) dialogRef.current.close(); }}><textarea readOnly value={JSON.stringify(config, null, 2)} /></dialog>
					<TerminalTool client={client} /><FirmwareTool client={client} connected={connected} /><BackupTool client={client} config={configOnDisk} /><AccountTool client={client} auth={auth} /><Legend poe={poeSupported} />
					<button title={`sign out ${auth.username}`} onClick={logout}>logout</button>
				</div>}</div></div>
			<div className="device-summary"><div>{status.device}</div><div>{status.datetime}</div>{Object.keys(status.temperature ?? {}).map(type => <div key={type}>{type}: {(status.temperature[type] ?? []).map((c, i) => <span key={i}>{Number(c).toFixed(1)} </span>)}(<span className="status-temp">°C</span>)</div>)}</div>
			<div className={`connection-state ${connected ? 'connected' : 'disconnected'}`}>{connected ? `connected as ${auth.username}` : 'disconnected'}</div>
			{error && <div className="error">{error}</div>}{notice && <div className="notice">{notice}</div>}
			{(status.errors ?? []).map((item, index) => <div className="warning" key={`${item.source}-${index}`}>{item.source}: {item.message}</div>)}
		</div>
		{config && <div><NetworkPanel config={config} status={status} updateConfig={updateRoot} diff={diff} /><Ports config={config} status={status} poe={poeSupported} selectedPort={selectedPort} onSelectPort={selectPort} /><Table ports={config.ports} updatePort={updatePort} updatePortMulti={updatePortMulti} status={status} poe={poeSupported} diff={diff} selectedPort={selectedPort} /></div>}
		{hasDiff && <aside className="unsaved-changes" role="status" aria-live="assertive"><div className="unsaved-copy"><strong>Unapplied configuration changes</strong><span>Apply these changes before leaving the page, or discard them to restore the switch's current configuration.</span></div><div className="unsaved-actions"><button type="button" className="discard-button" onClick={discardChanges} disabled={uploading}>Discard changes</button><button type="button" className="apply-button" onClick={uploadConfig} disabled={!connected || uploading}>{uploading ? 'Applying…' : 'Apply changes'}</button></div></aside>}
	</div>;
}

render(<App />, document.getElementById('app'));
