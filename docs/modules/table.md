# Port table module

`src/table.jsx` renders editable per-port desired state and combines it with live status.

PoE controls use three choices: off, 802.3af, and 802.3at. Selecting a mode sets both `poe.enabled=true` and the strict `poe.mode`; off changes only `enabled=false` and preserves the selected mode. Cells are omitted for globally non-PoE hardware and show unavailable on non-PoE/SFP ports.

Storm control displays persistent desired state because the Click graph has no dependable dump handler.
