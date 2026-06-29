# Port table module

`src/table.jsx` renders editable per-port desired state and combines it with live status. Desktop All Ports uses a measured sticky control/header stack with overlap to prevent scrolled content from appearing in a seam. Narrow/mobile layouts disable sticky table behavior and stack filters/actions for touch use.

PoE controls use off, 802.3af, and 802.3at. Selecting a mode sets `poe.enabled=true` with the strict mode; off changes only `enabled=false` and preserves the selected mode. Cells are omitted for globally non-PoE hardware and show unavailable for non-PoE or SFP ports.

Storm control displays persistent desired state because the Click graph has no dependable dump handler.
