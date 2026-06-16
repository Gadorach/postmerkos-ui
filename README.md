# postmerkos-ui

A Preact management interface for the postmerkOS `configd` protocol. Validation, persistence, hardware capability detection, and switch application remain in `configd`, so the browser and local CLI share the same behavior.

## Features

- Linux PAM login before configuration or status is disclosed;
- local account password updates for authorized administrators;
- management IPv4 DHCP/static configuration and live lease status;
- per-port PHY, VLAN, STP, storm-control, and PoE desired state even while link is down;
- click a port graphic to scroll to and highlight its configuration row;
- keep a floating unapplied-change warning visible until changes are applied or discarded;
- hover a port graphic for a plain-text status/property summary;
- authenticated root command window with bounded output and runtime;
- firmware image upload, client-side SHA-256, overlay policy, and updater status;
- plain or password-protected configuration backup/restore;
- explicit request IDs, acknowledgements, warning display, and reconnect handling.

The password-protected backup format is compatible with the firmware CLI: OpenSSL `Salted__` AES-256-CBC, PBKDF2-HMAC-SHA256, 100,000 iterations. Client-side cryptography is bundled and does not depend on the Web Crypto secure-origin API, so it works from the switch's normal HTTP interface.

## Development

```sh
npm ci
npm run lint
npm run build
npm run dev
```

The Vite mock server serves `src/test/24` when `SWITCH_HOST` is unset. Its development-only login accepts any non-empty username and password. To proxy a real switch:

```sh
SWITCH_HOST=192.168.1.20 npm run dev
```

The production build connects to `ws://<current-host>:4001`. Authentication protects management operations, but HTTP/WebSocket transport is not encrypted. Use a trusted management VLAN or add TLS termination before exposing the interface to an untrusted network.

## Firmware uploads

The browser limits images to 16 MiB, hashes the selected file, streams 64 KiB binary messages, and asks `configd` to hand the completed file to `fw_update`. The updater performs its own digest, format, flash-region, write, and verification checks. Loss of the browser connection is expected when services stop and the switch reboots.
