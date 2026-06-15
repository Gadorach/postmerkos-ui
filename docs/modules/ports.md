# Port visualization modules

`src/ports.jsx` arranges ports to resemble compact and 24/48-port switch faces. `src/port.jsx` combines desired and observed state into link-speed color, disabled opacity, VLAN label, STP badge, and PoE mode badge.

PoE badges require the per-port `status.ports.<n>.capabilities.poe` flag; a model-name suffix is never used as the capability test.
