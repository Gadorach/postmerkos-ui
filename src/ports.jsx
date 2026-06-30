import './style.css';
import Port from './port';
import { mergePortState } from './port-state';
import { splitPortBanks } from './port-layout';
import { useResponsiveMode } from './responsive';

export default function Ports({ config, status, poe, selectedPort, onSelectPort }) {
	const ports = config.ports;
	const keys = Object.keys(ports).map(Number).sort((a, b) => a - b);
	const { phone } = useResponsiveMode();
	const capabilities = status?.capabilities ?? {};

	const makePort = number => {
		const port = String(number);
		return <Port key={port} number={port}
			port={mergePortState(ports[port], status?.ports?.[port], status?.clients?.[port] ?? [])}
			poe={poe} selected={String(selectedPort) === port} onSelect={onSelectPort} />;
	};

	const { copperBanks, uplinkPairs, uplinkLabel } = splitPortBanks(keys, capabilities, phone);
	return <div className={`ports-container${phone ? ' phone-ports' : ''}`}>
		<div className="ports-layout" aria-label="Switch front-panel ports">
			{copperBanks.map(bank => <fieldset className="port-bank copper-bank" key={bank.label}>
				<legend>{bank.label}</legend>
				<div className="port-bank-grid">{bank.ports.map(makePort)}</div>
			</fieldset>)}
			{uplinkPairs.length > 0 && <fieldset className="port-bank sfp-bank">
				<legend>{uplinkLabel}</legend>
				<div className="sfp-pairs">{uplinkPairs.map((pair, index) => <div className="sfp-pair" key={`sfp-${index}`}>{pair.map(makePort)}</div>)}</div>
			</fieldset>}
		</div>
	</div>;
}
