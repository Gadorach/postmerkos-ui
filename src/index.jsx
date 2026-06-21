import { render } from 'preact';
import './style.css';
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { ConfigdClient } from './api';
import Ports from './ports';
import Legend from './legend';
import Login from './login';
import { CompatibilityNotice, ConfigurationMenu, PortEditor, UpdateMenu } from './menus';
import Table from './table';

const setPath = (obj, path, value) => {
	const keys = path.split('.'); const result = structuredClone(obj); let current = result;
	for (let index = 0; index < keys.length - 1; index++) { if (current[keys[index]] == null) current[keys[index]] = {}; current = current[keys[index]]; }
	current[keys.at(-1)] = value; return result;
};
const computeDiff = (desired, current) => {
	if (desired === current) return undefined;
	if (desired == null || current == null || typeof desired !== 'object' || typeof current !== 'object') return desired;
	const result = {};
	for (const key of Object.keys(desired)) { const value = computeDiff(desired[key], current[key]); if (value !== undefined && (typeof value !== 'object' || value === null || Object.keys(value).length)) result[key] = value; }
	return result;
};

function App() {
	const [auth, setAuth] = useState(null); const [config, setConfig] = useState(null); const [configOnDisk, setConfigOnDisk] = useState(null);
	const [diff, setDiff] = useState({}); const [status, setStatus] = useState({}); const [error, setError] = useState(null); const [notice, setNotice] = useState(null);
	const [uploading, setUploading] = useState(false); const [connected, setConnected] = useState(false); const [connectionState, setConnectionState] = useState('Connecting…'); const [selectedPort, setSelectedPort] = useState(null);
	const clientRef = useRef(null);
	const [frontTable, setFrontTable] = useState(() => { try { return localStorage.getItem('pmos.frontTable') !== '0'; } catch (error) { return true; } });
	const setFrontTablePref = useCallback(value => { setFrontTable(value); try { localStorage.setItem('pmos.frontTable', value ? '1' : '0'); } catch (error) { /* ignore */ } }, []);
	const selectPort = useCallback(port => {
		setSelectedPort(String(port));
		if (frontTable) requestAnimationFrame(() => document.getElementById(`port-row-${port}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
	}, [frontTable]);
	useEffect(() => {
		const client = new ConfigdClient({
			onStatus: next => setStatus(next), onConfig: next => { setConfig(next); setConfigOnDisk(next); setDiff({}); },
			onConnection: setConnected, onConnectionState: setConnectionState, onAuth: next => { setAuth(next); setError(null); setConnectionState(`Authenticated as ${next.username} (${next.role}).`); },
			onAuthRequired: () => { setAuth(null); setConfig(null); setConfigOnDisk(null); setDiff({}); setStatus({}); }, onError: setError,
		});
		clientRef.current = client; client.connect(); return () => { client.close(); clientRef.current = null; };
	}, []);
	const login = useCallback(async (username, password) => { setError(null); try { const response = await clientRef.current.authenticate(username, password); setAuth(response.data); } catch (failure) { setError(failure.message); } }, []);
	const logout = useCallback(async () => { try { await clientRef.current.request('logout'); } catch (failure) { setError(failure.message); } finally { setAuth(null); setConfig(null); setConfigOnDisk(null); setStatus({}); } }, []);
	const updateRoot = useCallback((path, value) => setConfig(previous => { const updated = setPath(previous, path, value); setDiff(computeDiff(updated, configOnDisk) ?? {}); return updated; }), [configOnDisk]);
	const updatePort = useCallback((port, path, value) => setConfig(previous => { const updated = structuredClone(previous); updated.ports[port] = setPath(updated.ports[port], path, value); setDiff(computeDiff(updated, configOnDisk) ?? {}); return updated; }), [configOnDisk]);
	const updatePortMulti = useCallback((port, updates) => setConfig(previous => { const updated = structuredClone(previous); let next = updated.ports[port]; for (const [path, value] of Object.entries(updates)) next = setPath(next, path, value); updated.ports[port] = next; setDiff(computeDiff(updated, configOnDisk) ?? {}); return updated; }), [configOnDisk]);
	const uploadConfig = useCallback(async () => {
		const delta = computeDiff(config, configOnDisk) ?? {}; if (!Object.keys(delta).length) return;
		setUploading(true); setError(null); setNotice(null);
		try { const response = await clientRef.current.request('config', delta); const warnings = response.data?.warnings ?? []; setNotice(warnings.length ? `Configuration accepted with warnings: ${warnings.join('; ')}` : 'Configuration accepted'); }
		catch (failure) { setError(failure.message || 'Bad Request'); } finally { setUploading(false); }
	}, [config, configOnDisk]);
	const discardChanges = useCallback(() => { if (!configOnDisk) return; setConfig(structuredClone(configOnDisk)); setDiff({}); setError(null); setNotice('Unapplied configuration changes discarded.'); }, [configOnDisk]);
	const hasDiff = Object.keys(diff ?? {}).length > 0;
	useEffect(() => { if (!hasDiff) return undefined; const warn = event => { event.preventDefault(); event.returnValue = ''; }; globalThis.addEventListener('beforeunload', warn); return () => globalThis.removeEventListener('beforeunload', warn); }, [hasDiff]);
	useEffect(() => {
		const panel = document.querySelector('.front-panel-view .ports-container');
		if (!panel) return undefined;
		const apply = () => document.documentElement.style.setProperty('--panel-offset', `${panel.offsetHeight}px`);
		apply();
		const observer = new ResizeObserver(apply);
		observer.observe(panel);
		return () => observer.disconnect();
	}, [config, frontTable]);
	if (!auth) return <Login connected={connected} connectionState={connectionState} onLogin={login} error={error} />;
	const client = clientRef.current; const hasCapability = capability => (auth?.capabilities ?? []).includes(capability); const canWrite = hasCapability('switching.write') || hasCapability('network.write'); const poe = Boolean(status?.capabilities?.poe?.supported);
	return <div>
		<header id="heading">
			<div className="heading-bar"><div><h1>postmerkOS</h1><span className="version">{status?.release?.version ?? 'unknown firmware'}</span></div><nav className="heading-actions">
				<Legend poe={poe} />
				{client && config && <UpdateMenu client={client} connected={connected} config={configOnDisk} compatibility={status?.capabilities?.compatibility} hasCapability={hasCapability} />}
				{client && config && <ConfigurationMenu client={client} auth={auth} config={config} status={status} updateRoot={updateRoot} updatePort={updatePort} updatePortMulti={updatePortMulti} diff={diff} poe={poe} hasCapability={hasCapability} frontTable={frontTable} onFrontTableChange={setFrontTablePref} />}
				<button className="toolbar-button" onClick={logout}>Logout</button>
			</nav></div>
			<div className="device-summary"><div>{status.device}</div><div>{status.time?.local ?? status.datetime}</div><div>{status.network?.ipv4?.address ?? 'no management address'}</div>{Object.entries(status.temperature ?? {}).map(([type, values]) => <div key={type}>{type}: {(values ?? []).map(value => Number(value).toFixed(1)).join(', ')} °C</div>)}</div>
			<div className={`connection-state ${connected ? 'connected' : 'disconnected'}`}>{connected ? `Connected as ${auth.username} (${auth.role})` : 'Disconnected'}</div>
			{status?.security?.default_password_active && <div className="warning">The root password is still set to the switch serial number.</div>}
			{error && <div className="error">{error}</div>}{notice && <div className="notice">{notice}</div>}
			{(status.errors ?? []).map((item, index) => <div className="warning" key={`${item.source}-${index}`}>{item.source}: {item.message}</div>)}
		</header>
		{config && <main className="front-panel-view"><Ports config={config} status={status} poe={poe} selectedPort={selectedPort} onSelectPort={selectPort} />{frontTable ? <Table ports={config.ports} status={status} poe={poe} updatePort={updatePort} updatePortMulti={updatePortMulti} diff={diff} selectedPort={selectedPort} /> : <p className="front-panel-hint">Select a port to open its focused configuration window.</p>}</main>}
		{!frontTable && client && config && <PortEditor client={client} selectedPort={selectedPort} onSelect={setSelectedPort} onClose={() => setSelectedPort(null)} config={config} status={status} poe={poe} updatePort={updatePort} updatePortMulti={updatePortMulti} diff={diff} />}
		{client && <CompatibilityNotice client={client} notice={status?.compatibility_notice} onDismiss={() => setStatus(previous => ({ ...previous, compatibility_notice: { ...previous.compatibility_notice, required: false } }))} />}
		{hasDiff && canWrite && <aside className="unsaved-changes" role="status"><div className="unsaved-copy"><strong>Unapplied configuration changes</strong><span>Apply these changes or discard them to restore the current switch configuration.</span></div><div className="unsaved-actions"><button onClick={discardChanges} disabled={uploading}>Discard Changes</button><button className="apply-button" onClick={uploadConfig} disabled={!connected || uploading}>{uploading ? 'Applying…' : 'Apply Changes'}</button></div></aside>}
	</div>;
}

render(<App />, document.getElementById('app'));
