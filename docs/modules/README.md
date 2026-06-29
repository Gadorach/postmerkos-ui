# UI module index

| Module | Responsibility |
|---|---|
| [api](api.md) | Reconnecting WebSocket transport, protocol/session state, request correlation, and errors |
| [index](index.md) | Confirmed/editable state, delta generation, navigation, dialogs, upload recovery, and top-level layout |
| [network](network.md) | DHCP/static management IPv4 editor and runtime state |
| [table](table.md) | Complete editable port table, filters, cloning entry points, and sticky-header behavior |
| [ports](ports.md) | Graphical front panel, twelve-port/SFP banks, wrapping, and badges |
| [help](help.md) | User-facing field explanations |

Cross-cutting controls for accounts, SSH, time, services, terminal, telemetry, System Information, firmware, and backup/restore are assembled in `src/menus.jsx` and `src/tools.jsx`.
