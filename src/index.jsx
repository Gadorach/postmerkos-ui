import { render } from 'preact';
import './style.css';
import { useState, useEffect, useRef, useCallback } from 'preact/hooks';
import { ConfigdClient } from './api';
import NetworkPanel from './network';
import Ports from './ports';
import Legend from './legend';
import Table from './table';
import Button from './button';

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
	if (desired == null || current == null || typeof desired !== 'object' || typeof current !== 'object') {
		return desired;
	}
	const result = {};
	for (const key of Object.keys(desired)) {
		const value = computeDiff(desired[key], current[key]);
		if (value !== undefined && (typeof value !== 'object' || value === null || Object.keys(value).length > 0)) {
			result[key] = value;
		}
	}
	return result;
};

function App() {
	const [config, setConfig] = useState(null);
	const [configOnDisk, setConfigOnDisk] = useState(null);
	const [diff, setDiff] = useState({});
	const [status, setStatus] = useState({});
	const [error, setError] = useState(null);
	const [notice, setNotice] = useState(null);
	const [uploading, setUploading] = useState(false);
	const [connected, setConnected] = useState(false);
	const dialogRef = useRef();
	const clientRef = useRef(null);

	useEffect(() => {
		const client = new ConfigdClient({
			onStatus: next => setStatus(next),
			onConfig: next => {
				setConfig(next);
				setConfigOnDisk(next);
				setDiff({});
			},
			onConnection: value => setConnected(value),
			onError: message => setError(message),
		});
		clientRef.current = client;
		client.connect();
		return () => {
			client.close();
			clientRef.current = null;
		};
	}, []);

	const updateRoot = useCallback((path, value) => {
		setConfig(previous => {
			const updated = setPath(previous, path, value);
			setDiff(computeDiff(updated, configOnDisk) ?? {});
			return updated;
		});
	}, [configOnDisk]);

	const updatePort = useCallback((portNumber, path, value) => {
		setConfig(previous => {
			const updated = structuredClone(previous);
			updated.ports[portNumber] = setPath(updated.ports[portNumber], path, value);
			setDiff(computeDiff(updated, configOnDisk) ?? {});
			return updated;
		});
	}, [configOnDisk]);

	const updatePortMulti = useCallback((portNumber, updates) => {
		setConfig(previous => {
			const updated = structuredClone(previous);
			let port = updated.ports[portNumber];
			for (const [path, value] of Object.entries(updates)) port = setPath(port, path, value);
			updated.ports[portNumber] = port;
			setDiff(computeDiff(updated, configOnDisk) ?? {});
			return updated;
		});
	}, [configOnDisk]);

	const uploadConfig = useCallback(async () => {
		const delta = computeDiff(config, configOnDisk) ?? {};
		if (Object.keys(delta).length === 0) return;
		setUploading(true);
		setError(null);
		setNotice(null);
		try {
			const response = await clientRef.current.request('config', delta);
			const warnings = response.data?.warnings ?? [];
			setNotice(warnings.length
				? `Configuration accepted with warnings: ${warnings.join('; ')}`
				: 'Configuration accepted');
		} catch (uploadError) {
			setError(uploadError.message || 'Bad Request');
		} finally {
			setUploading(false);
		}
	}, [config, configOnDisk]);

	const poeSupported = Boolean(status?.capabilities?.poe?.supported);
	const hasDiff = Object.keys(diff ?? {}).length > 0;

	if (error && !config) {
		return <div id="heading"><h1>postmerkOS</h1><div className="error">{error}</div></div>;
	}

	return (
		<div>
			<div id="heading">
				<div className="heading-bar">
					<div>
						<h1>postmerkOS</h1>
						<span className="version">{/* VERSION */} dev {/* NOTE: do not remove; this is replaced in CI */}</span>
					</div>
					<div className="heading-actions">
						{config && <div id="buttons">
							<Button onClick={uploadConfig} isLoading={uploading}
								disabled={!connected || uploading || !hasDiff}
								title={connected ? 'upload config' : 'disconnected'}>
								<svg className={hasDiff ? 'diff-foreground' : ''} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32" fill="none" stroke="currentcolor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2">
									<path d="M9 22 C0 23 1 12 9 13 6 2 23 2 22 10 32 7 32 23 23 22 M11 18 L16 14 21 18 M16 14 L16 29" />
								</svg>
							</Button>
							<button title="view config" onClick={() => dialogRef.current.showModal()}>
								<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32" fill="none" stroke="currentcolor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><circle cx="17" cy="15" r="1" /><circle cx="16" cy="16" r="6" /><path d="M2 16 C2 16 7 6 16 6 25 6 30 16 30 16 30 16 25 26 16 26 7 26 2 16 2 16 Z" /></svg>
							</button>
							<dialog className="config-preview" ref={dialogRef} onClick={event => { if (event.target === dialogRef.current) dialogRef.current.close(); }}>
								<textarea readOnly value={JSON.stringify(config, null, 2)} />
							</dialog>
							<Legend poe={poeSupported} />
							<a href="https://github.com/Gadorach/postmerkos-ui" target="_blank" rel="noopener noreferrer" title="GitHub"><button>source</button></a>
						</div>}
					</div>
				</div>
				<div className="device-summary">
					<div>{status.device}</div><div>{status.datetime}</div>
					{Object.keys(status.temperature ?? {}).map(type => <div key={type}>{type}: {(status.temperature[type] ?? []).map((c, i) => <span key={i}>{Number(c).toFixed(1)} </span>)}(<span className="status-temp">°C</span>)</div>)}
				</div>
				<div className={`connection-state ${connected ? 'connected' : 'disconnected'}`}>{connected ? 'connected' : 'disconnected'}</div>
				{error && <div className="error">{error}</div>}
				{notice && <div className="notice">{notice}</div>}
				{(status.errors ?? []).map((item, index) => <div className="warning" key={`${item.source}-${index}`}>{item.source}: {item.message}</div>)}
			</div>
			{config && <div>
				<NetworkPanel config={config} status={status} updateConfig={updateRoot} diff={diff} />
				<Ports config={config} status={status} poe={poeSupported} />
				<Table ports={config.ports} updatePort={updatePort} updatePortMulti={updatePortMulti} status={status} poe={poeSupported} diff={diff} />
			</div>}
		</div>
	);
}

render(<App />, document.getElementById('app'));
