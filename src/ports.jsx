import './style.css';
import { useMemo } from 'preact/hooks';
import Port from './port';
import { mergePortState } from './port-state';

export default function Ports({ config, status, poe, selectedPort, onSelectPort }) {
	const ports = config.ports;
	const count = Object.keys(ports).length;
	const { gridStyle, spfCount } = useMemo(() => {
		const rows = count > 10 ? 2 : 1;
		const spf = count > 10 ? 4 : 2;
		const groups = Math.floor(count / 12);
		return { gridStyle: { gridTemplateColumns: `repeat(${((count - spf) / rows) + groups}, 1fr)` }, spfCount: spf };
	}, [count]);
	const compare = (a, b) => {
		if (count < 12) return Number(a) - Number(b);
		const firstSpf = count - spfCount;
		if (Number(a) > firstSpf || Number(b) > firstSpf) return Number(a) - Number(b);
		return Number(b) % 2 - Number(a) % 2;
	};
	return <div className="ports-container"><div className="ports-grid" style={gridStyle}>
		{Object.keys(ports).sort(compare).map(port => {
			const graphic = <Port key={port} number={port} port={mergePortState(ports[port], status?.ports?.[port])} poe={poe} selected={String(selectedPort) === String(port)} onSelect={onSelectPort} />;
			const index = Number(port) % 12;
			return (index === 0 || index === 11) ? [graphic, <div key={`spacer-${port}`} className="port-spacer" />] : graphic;
		})}
	</div></div>;
}
