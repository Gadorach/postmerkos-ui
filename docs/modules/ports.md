# Port visualization modules

`src/ports.jsx` partitions copper ports into ordered banks of 12 and keeps all SFP ports in one bank. The wrapping order moves SFP first, then the highest-numbered copper bank, then earlier banks. CSS changes each bank to a two-column vertical layout when the normal switch-face grid cannot fit.

`src/port.jsx` combines desired and observed state into link-speed color, administrative-state opacity, VLAN label, STP badge, and PoE mode badge. PoE badges require the per-port `status.ports.<n>.capabilities.poe` flag; model-name suffixes are never used as capability tests.
