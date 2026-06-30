import { useState } from 'preact/hooks';
import { CheckIcon } from './icons';

export default function ClonePane({ client, config, sourcePort, onDone }) {
	const allFields = ['administrative', 'name', 'phy', 'storm_control', 'vlan', 'stp', 'poe'];
	const [fields, setFields] = useState(allFields);
	const [targets, setTargets] = useState([]);
	const [result, setResult] = useState(null);
	const [error, setError] = useState('');
	const ports = Object.keys(config?.ports ?? {}).map(Number);
	const toggle = (list, value, setter) => setter(list.includes(value) ? list.filter(item => item !== value) : [...list, value]);
	const clone = async () => {
		try {
			const response = await client.request('ports_clone', { source: Number(sourcePort), targets, fields }, { timeout: 30000 });
			setResult(response.data); onDone?.();
		} catch (failure) { setError(failure.message); }
	};
	return <div className="clone-pane"><h3>Clone Port {sourcePort}</h3><div className="clone-fields">{allFields.map(field => <label className="checkbox-line" key={field}><input type="checkbox" checked={fields.includes(field)} onChange={() => toggle(fields, field, setFields)} /> {field.replace('_', ' ')}</label>)}</div><div className="target-grid">{ports.map(port => <button key={port} className={targets.includes(port) ? 'active' : ''} disabled={String(port) === String(sourcePort)} onClick={() => toggle(targets, port, setTargets)}>{port}</button>)}</div><button className="btn-primary" onClick={clone} disabled={!targets.length || !fields.length}><CheckIcon /> Clone</button>{result && <div className="notice">Copied to ports {(result.targets ?? []).join(', ')}. {(result.warnings ?? []).join(' ')}</div>}{error && <div className="error">{error}</div>}</div>;
}
