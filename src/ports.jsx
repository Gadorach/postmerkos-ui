import './style.css';
import Port from './port';
import { mergePortState } from './port-state';

export default function Ports({ config, status, poe, selectedPort, onSelectPort }) {
	const ports = config.ports;
	const keys = Object.keys(ports).map(Number).sort((a, b) => a - b);
	const count = keys.length;
	const spfCount = count > 10 ? 4 : 2;
	const firstSpf = count - spfCount + 1;

	const makePort = (n) => {
		const port = String(n);
		return <Port key={port} number={port}
			port={mergePortState(ports[port], status?.ports?.[port], status?.clients?.[port] ?? [])}
			poe={poe} selected={String(selectedPort) === port} onSelect={onSelectPort} />;
	};

	const ethKeys = keys.filter(n => n < firstSpf);
	const sfpKeys = keys.filter(n => n >= firstSpf);

	const topRow = [];
	const bottomRow = [];
	const perGroup = 12;
	const lastEth = ethKeys[ethKeys.length - 1];

	for (let i = 0; i < ethKeys.length; i++) {
		const n = ethKeys[i];
		const row = (n % 2 === 1) ? topRow : bottomRow;
		row.push(makePort(n));
		if (n % perGroup === 0 && n < lastEth) {
			topRow.push(<div key={`sp-t-${n}`} className="port-spacer" />);
			bottomRow.push(<div key={`sp-b-${n}`} className="port-spacer" />);
		}
	}

	return <div className="ports-container">
		<div className="ports-layout">
			<div className="eth-grid">
				<div className="port-row">{topRow}</div>
				{bottomRow.length > 0 && <div className="port-row">{bottomRow}</div>}
			</div>
			{sfpKeys.length > 0 && <div className="sfp-grid">
				<div className="port-row">{sfpKeys.map(makePort)}</div>
			</div>}
		</div>
	</div>;
}
