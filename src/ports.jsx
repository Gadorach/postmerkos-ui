import './style.css';
import Port from './port';
import { mergePortState } from './port-state';
import { splitPortBanks } from './port-layout';

export default function Ports({ config, status, poe, selectedPort, onSelectPort }) {
	const ports = config.ports;
	const keys = Object.keys(ports).map(Number).sort((a, b) => a - b);

	const makePort = number => {
		const port = String(number);
		return <Port key={port} number={port}
			port={mergePortState(ports[port], status?.ports?.[port], status?.clients?.[port] ?? [])}
			poe={poe} selected={String(selectedPort) === port} onSelect={onSelectPort} />;
	};

	const { ethernetBanks, sfpPorts } = splitPortBanks(keys);

	return <div className="ports-container">
		<div className="ports-layout" aria-label="Switch front-panel ports">
			{ethernetBanks.map((bank, index) => <div className="port-bank ethernet-bank" key={`ethernet-${index + 1}`}>
				<div className="port-bank-grid">{bank.map(makePort)}</div>
			</div>)}
			{sfpPorts.length > 0 && <div className="port-bank sfp-bank">
				<div className="port-bank-grid">{sfpPorts.map(makePort)}</div>
			</div>}
		</div>
	</div>;
}
