import { useState } from 'preact/hooks';
import Table from './table';
import ClonePane from './clone-pane';

export default function AllPortsPanel({ client, config, status, poe, updatePort, updatePortMulti, diff, selectedPort, onSelectPort, showName, onShowNameChange, title = 'All Ports' }) {
	const [cloneOpen, setCloneOpen] = useState(false);
	return <fieldset className="all-ports-panel"><legend>{title}</legend>
		<div className="all-ports-toolbar">
			<label className="checkbox-line"><input type="checkbox" checked={showName} onChange={event => onShowNameChange?.(event.currentTarget.checked)} /> Show port names</label>
			<button className="btn-secondary" disabled={!selectedPort} onClick={() => setCloneOpen(value => !value)}>Clone selected port</button>
			<span className="selected-port-label">{selectedPort ? `Selected: ${selectedPort}` : 'Select a port row to clone it'}</span>
		</div>
		{cloneOpen && selectedPort && <ClonePane client={client} config={config} sourcePort={selectedPort} onDone={() => setCloneOpen(false)} />}
		<Table ports={config.ports} status={status} poe={poe} updatePort={updatePort} updatePortMulti={updatePortMulti} diff={diff} selectedPort={selectedPort} onSelectPort={onSelectPort} showName={showName} />
	</fieldset>;
}
