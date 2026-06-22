import { useRef } from 'preact/hooks';
import Port from './port';
import { InfoIcon } from './icons';

const states = [
    { help: "port is disabled", port: { enabled: false } },
    { help: "link established at 100M", port: { link: { speed: 100 } } },
    { help: "link established at 1G", port: { link: { speed: 1000 } } },
    { help: "link established at 10G", port: { link: { speed: 10000 } } },
    { help: "poe enabled (802.3at/af mode)", port: { poe: { enabled: true, mode: "at" } } },
    { help: "stp enabled", port: { stp: { enabled: true } } },
    { help: "vlan id", port: { vlan: { pvid: 10 } } },
    { help: "stp forwarding", port: { link: { established: true }, stp: { state: "forwarding" } } },
    { help: "stp blocking", port: { link: { established: true }, stp: { state: "blocking" } } },
    { help: "stp learning", port: { link: { established: true }, stp: { state: "learning" } } },
    { help: "vlan group (colored by pvid)", port: { enabled: true, vlan: { pvid: 10 } } },
];

export default function Legend({ poe }) {
    const dialogRef = useRef();

    return (
        <span>
            <button className="toolbar-button icon-button" title="Legend" aria-label="Legend" onClick={() => dialogRef.current.showModal()}><InfoIcon /></button>
            <dialog className="legend" ref={dialogRef} onClick={(e) => {
                if (e.target === dialogRef.current) dialogRef.current.close();
            }}>
                <dl>
                    {states
                        .filter(s => poe || !('poe' in s.port))
                        .map((s, i) => (
                            <span key={i} className="legend-item">
                                <dt><Port number="X" port={s.port} poe={poe} /></dt>
                                <dd>{s.help}</dd>
                            </span>
                        ))}
                </dl>
            </dialog>
        </span>
    );
}
